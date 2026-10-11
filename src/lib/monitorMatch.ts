/**
 * Label-based reading matcher for multiparameter patient monitors.
 *
 * Input : OCR words with bounding boxes (from tesseract.js).
 * Output: values that are safe to pre-fill, plus notes about everything that was NOT filled.
 *
 * SAFETY RULES
 *  - A value is filled only when: it sits clearly next to a recognised label (or inside a
 *    template region), the number has the right format, it is inside the plausible range,
 *    and OCR confidence is >= MIN_CONF.
 *  - If two different numbers could belong to the same label, NOTHING is filled for it.
 *  - Missing digits (such as a dropped decimal point) are never guessed.
 *  - Low-confidence readings are returned only as "suggestions"; staff must tap to accept them.
 *
 * This file has no imports on purpose so it can be unit-tested with plain Node.
 */

export type OcrWord = { text: string; conf: number; x0: number; y0: number; x1: number; y1: number };

export type ScanField = "temperature" | "pulse" | "bpSystolic" | "bpDiastolic" | "spo2" | "respRate";
type Target = ScanField | "map";

export type Region = { x: number; y: number; w: number; h: number }; // fractions 0-1 of the cropped screen

/**
 * Monitor-specific template. Add one per monitor model you use in hospital.
 *  - labelAliases : extra label spellings used by that monitor (UPPERCASE, letters/digits only)
 *  - regions      : fixed areas (fractions of the cropped screen) where a value is shown.
 *                   A field with a region is read from that region instead of from labels.
 */
export type MonitorTemplate = {
  id: string;
  name: string;
  labelAliases?: Record<string, ScanField | "map">;
  regions?: Partial<Record<ScanField, Region>>;
};

export const MONITOR_TEMPLATES: MonitorTemplate[] = [
  { id: "auto", name: "Auto-detect (use labels on screen)" },
  // Example for later (coordinates are fractions of the cropped screen):
  // {
  //   id: "acme-m9",
  //   name: "Acme M9 bedside monitor",
  //   labelAliases: { ECG: "pulse" },
  //   regions: { pulse: { x: 0.62, y: 0.18, w: 0.18, h: 0.2 }, spo2: { x: 0.62, y: 0.4, w: 0.18, h: 0.2 } },
  // },
];

export const MIN_CONF = 85; // OCR word confidence (0-100) needed before a value is auto-filled

export const FIELD_LABEL: Record<ScanField, string> = {
  temperature: "Temperature",
  pulse: "Pulse",
  bpSystolic: "BP systolic",
  bpDiastolic: "BP diastolic",
  spo2: "SpO2",
  respRate: "Resp rate",
};
// Same limits as the nurse form (temperature in F). Keep in sync with VitalsScanner RANGE and the backend.
export const FIELD_RANGE: Record<ScanField, [number, number, string]> = {
  temperature: [85, 110, "\u00B0F"],
  pulse: [20, 250, "bpm"],
  bpSystolic: [50, 280, "mmHg"],
  bpDiastolic: [20, 180, "mmHg"],
  spo2: [50, 100, "%"],
  respRate: [4, 80, "/min"],
};
const TEMP_C_RANGE: [number, number] = [30, 45];

export type FieldResult = { text: string; conf: number; source: string };
export type Suggestion = { text: string; conf: number };
export type MatchOutput = {
  values: Partial<Record<ScanField, FieldResult>>;
  suggestions: Partial<Record<ScanField, Suggestion>>;
  temp?: { raw: string; unit: "C" | "F"; f: string };
  notes: string[];
  missing: ScanField[];
};

type Box = { x0: number; y0: number; x1: number; y1: number };
type Num = Box & { id: number; text: string; value: number; conf: number; dot: boolean };
type Lbl = Box & { text: string; target: Target };
type Cand = { num: Num; score: number; label: string; row: boolean };
type Pick = { kind: "none" } | { kind: "amb"; texts: string[] } | { kind: "one"; cand: Cand };

const MAX_SCORE = 3; // farther than this (in digit heights) is not "next to" the label
const AMBIG = 1.3; // runner-up within this ratio of the winner => ambiguous => fill nothing

const LABEL_PATTERNS: [RegExp, Target][] = [
  [/^SYS(T|TOLIC)?$/, "bpSystolic"],
  [/^DIA(S|ST|STOLIC)?$/, "bpDiastolic"],
  [/^MAP$/, "map"],
  [/^(PR|HR|PULSE)$/, "pulse"],
  [/^SP[O0]2?$/, "spo2"],
  [/^(RESP|RR|RESPIRATION)$/, "respRate"],
  [/^(TEMP|TEMPERATURE|T1|T2)$/, "temperature"],
];

const hh = (b: Box) => Math.max(1, b.y1 - b.y0);
const ww = (b: Box) => Math.max(1, b.x1 - b.x0);
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const sameRow = (a: Box, b: Box) => overlap(a.y0, a.y1, b.y0, b.y1) / Math.min(hh(a), hh(b)) >= 0.5;

/** How far a number is from a label, in digit heights. Smaller = closer. */
function proximity(L: Box, N: Box): number {
  const dx = Math.max(0, N.x0 - L.x1, L.x0 - N.x1);
  const dy = Math.max(0, N.y0 - L.y1, L.y0 - N.y1);
  const row = sameRow(L, N);
  const col = overlap(L.x0, L.x1, N.x0, N.x1) / Math.min(ww(L), ww(N)) >= 0.3;
  const above = N.y1 <= L.y0 + 1 && !row;
  let s = Math.hypot(dx, dy) / hh(N);
  if (row) s *= 0.85;
  else if (!col) s *= 1.5;
  if (above) s *= 2.5; // monitors put labels above or beside their value, rarely below it
  return s;
}

function cleanToken(t: string): string {
  return t
    .trim()
    .replace(/^[\[\](){}|<>*_~'"`]+|[\[\](){}|<>*_~'"`%]+$/g, "")
    .replace(",", ".");
}

function tokenize(words: OcrWord[], aliases: Record<string, ScanField | "map">) {
  const nums: Num[] = [];
  const labels: Lbl[] = [];
  const slashes: OcrWord[] = [];
  const openSlash = new Set<number>(); // ids of "120/" style numbers
  const pairs: { sys: Num; dia: Num }[] = [];
  let id = 0;

  for (const w of words) {
    const s = cleanToken(w.text);
    if (!s) continue;
    const box: Box = { x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 };
    let m: RegExpMatchArray | null;

    if (s === "/") { slashes.push(w); continue; }

    if ((m = s.match(/^(\d{2,3})\/(\d{2,3})$/))) {
      // "120/80" read as one word: split the box by character count
      const cw = ww(box) / s.length;
      const sys: Num = { ...box, x1: box.x0 + cw * m[1].length, id: id++, text: m[1], value: Number(m[1]), conf: w.conf, dot: false };
      const dia: Num = { ...box, x0: box.x1 - cw * m[2].length, id: id++, text: m[2], value: Number(m[2]), conf: w.conf, dot: false };
      nums.push(sys, dia);
      pairs.push({ sys, dia });
      continue;
    }
    if ((m = s.match(/^(\d{2,3})\/$/))) {
      const n: Num = { ...box, id: id++, text: m[1], value: Number(m[1]), conf: w.conf, dot: false };
      nums.push(n); openSlash.add(n.id);
      continue;
    }
    if ((m = s.match(/^\/(\d{2,3})$/))) {
      const n: Num = { ...box, id: id++, text: m[1], value: Number(m[1]), conf: w.conf, dot: false };
      nums.push(n);
      continue;
    }
    if (/^\d{1,3}(\.\d)?$/.test(s)) {
      nums.push({ ...box, id: id++, text: s, value: Number(s), conf: w.conf, dot: s.includes(".") });
      continue;
    }
    const up = s.toUpperCase().replace(/\u2082/g, "2").replace(/[^A-Z0-9]/g, "");
    if (!up) continue;
    let target: Target | undefined = aliases[up];
    if (!target) for (const [re, t] of LABEL_PATTERNS) if (re.test(up)) { target = t; break; }
    if (target) labels.push({ ...box, text: up, target });
  }

  // "120/" followed by a number on the same row => BP pair
  for (const a of nums) {
    if (!openSlash.has(a.id)) continue;
    let best: Num | null = null;
    for (const b of nums) {
      if (b.id === a.id || b.dot || !sameRow(a, b)) continue;
      const gap = b.x0 - a.x1;
      if (gap < -hh(a) * 0.3 || gap > hh(a) * 3) continue;
      if (!best || b.x0 < best.x0) best = b;
    }
    if (best) pairs.push({ sys: a, dia: best });
  }
  // "120" "/" "80" as three words
  for (const sl of slashes) {
    let left: Num | null = null, right: Num | null = null;
    for (const n of nums) {
      if (n.dot || !sameRow(sl, n)) continue;
      const gapL = sl.x0 - n.x1, gapR = n.x0 - sl.x1;
      if (gapL >= -hh(sl) * 0.3 && gapL <= hh(sl) * 2 && (!left || n.x1 > left.x1)) left = n;
      if (gapR >= -hh(sl) * 0.3 && gapR <= hh(sl) * 2 && (!right || n.x0 < right.x0)) right = n;
    }
    if (left && right) pairs.push({ sys: left, dia: right });
  }
  // remove duplicate pairs
  const seen = new Set<string>();
  const uniq = pairs.filter((p) => {
    const k = p.sys.id + ":" + p.dia.id;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { nums, labels, pairs: uniq };
}

function pickFor(target: Target, labels: Lbl[], nums: Num[], excluded: Set<number>): Pick {
  const best = new Map<number, Cand>();
  for (const L of labels) {
    if (L.target !== target) continue;
    for (const N of nums) {
      if (excluded.has(N.id)) continue;
      const score = proximity(L, N);
      if (score > MAX_SCORE) continue;
      const prev = best.get(N.id);
      if (!prev || score < prev.score) best.set(N.id, { num: N, score, label: L.text, row: sameRow(L, N) });
    }
  }
  const list = [...best.values()].sort((a, b) => a.score - b.score);
  if (!list.length) return { kind: "none" };
  const first = list[0];
  const rival = list.find((c, i) => i > 0 && c.num.text !== first.num.text && c.score < first.score * AMBIG + 1e-9);
  if (rival) return { kind: "amb", texts: [...new Set([first.num.text, rival.num.text])] };

  // Label-above-value layouts: a second, similar-sized number stacked right under/over the winner with no
  // label of its own (e.g. two temperature channels under one TEMP label) cannot be told apart => ambiguous.
  if (!first.row) {
    const w = first.num;
    const h = hh(w);
    const sib = nums.find((n) => {
      if (n.id === w.id || excluded.has(n.id) || n.text === w.text) return false;
      const ratio = hh(n) / h;
      if (ratio < 0.6 || ratio > 1.6) return false;
      if (overlap(w.x0, w.x1, n.x0, n.x1) / Math.min(ww(w), ww(n)) < 0.5) return false;
      const gap = n.y0 >= w.y1 ? n.y0 - w.y1 : w.y0 - n.y1;
      if (gap < -2 || gap > 2 * h) return false;
      return !labels.some((l) => l.target !== target && proximity(l, n) <= 1.5); // it has its own label
    });
    if (sib) return { kind: "amb", texts: [...new Set([w.text, sib.text])] };
  }
  return { kind: "one", cand: first };
}

function pickFromRegion(region: Region, W: number, H: number, nums: Num[], excluded: Set<number>): Pick {
  const rx0 = region.x * W, ry0 = region.y * H, rx1 = (region.x + region.w) * W, ry1 = (region.y + region.h) * H;
  const inside = nums.filter((n) => {
    if (excluded.has(n.id)) return false;
    const cx = (n.x0 + n.x1) / 2, cy = (n.y0 + n.y1) / 2;
    return cx >= rx0 && cx <= rx1 && cy >= ry0 && cy <= ry1;
  });
  if (!inside.length) return { kind: "none" };
  inside.sort((a, b) => hh(b) - hh(a));
  const first = inside[0];
  const rival = inside.find((n, i) => i > 0 && n.text !== first.text && hh(n) >= hh(first) * 0.75);
  if (rival) return { kind: "amb", texts: [...new Set([first.text, rival.text])] };
  return { kind: "one", cand: { num: first, score: 0, label: "template region", row: true } };
}

type Interp = { ok: true; text: string; temp?: { raw: string; unit: "C" | "F"; f: string } } | { ok: false; reason: string };

function interpret(field: ScanField, n: Num): Interp {
  const [lo, hi, unit] = FIELD_RANGE[field];
  if (field === "temperature") {
    if (!n.dot) return { ok: false, reason: `read "${n.text}" without a decimal point, so it was not used` };
    if (n.value >= TEMP_C_RANGE[0] && n.value <= TEMP_C_RANGE[1]) {
      const f = (n.value * 9 / 5 + 32).toFixed(1);
      return { ok: true, text: f, temp: { raw: n.text, unit: "C", f } };
    }
    if (n.value >= lo && n.value <= hi) return { ok: true, text: n.text, temp: { raw: n.text, unit: "F", f: n.text } };
    return { ok: false, reason: `read ${n.text}, which is not a plausible body temperature` };
  }
  if (n.dot) return { ok: false, reason: `read "${n.text}" with a decimal point, expected a whole number` };
  if (n.value < lo || n.value > hi) return { ok: false, reason: `read ${n.text}, outside the plausible range (${lo}-${hi} ${unit})` };
  return { ok: true, text: n.text };
}

export function matchMonitorReadings(
  words: OcrWord[],
  opts: { template?: MonitorTemplate; width?: number; height?: number } = {},
): MatchOutput {
  const tpl = opts.template;
  const { nums, labels, pairs } = tokenize(words, tpl?.labelAliases || {});
  const out: MatchOutput = { values: {}, suggestions: {}, notes: [], missing: [] };
  const excluded = new Set<number>();
  const picks: Partial<Record<Target, Pick>> = {};
  const W = opts.width || 0, H = opts.height || 0;

  // 1) Blood pressure written as "120/80" (strongest evidence)
  let bpPair: { sys: Num; dia: Num } | null = null;
  const validPairs = pairs.filter((p) => p.sys.value > p.dia.value);
  const distinct = new Map(validPairs.map((p) => [p.sys.text + "/" + p.dia.text, p]));
  if (distinct.size === 1) {
    bpPair = [...distinct.values()][0];
    excluded.add(bpPair.sys.id);
    excluded.add(bpPair.dia.id);
  } else if (distinct.size > 1) {
    out.notes.push(`Several BP readings were found (${[...distinct.keys()].join(", ")}). BP was not filled; type it or rescan.`);
  }

  // 2) Everything else: template region first, else nearest label
  const order: Target[] = ["bpSystolic", "bpDiastolic", "pulse", "spo2", "respRate", "temperature", "map"];
  for (const t of order) {
    if (bpPair && (t === "bpSystolic" || t === "bpDiastolic")) continue;
    const region = t !== "map" ? tpl?.regions?.[t] : undefined;
    picks[t] = region && W && H ? pickFromRegion(region, W, H, nums, excluded) : pickFor(t, labels, nums, excluded);
  }

  // 3) A number that is clearly closer to a MAP label than to its own label is the MAP, not that field
  const mapPick = picks.map;
  if (mapPick && mapPick.kind === "one") {
    for (const t of order) {
      const p = picks[t];
      if (t === "map" || !p || p.kind !== "one" || p.cand.num.id !== mapPick.cand.num.id) continue;
      if (mapPick.cand.score < p.cand.score * 0.5) picks[t] = { kind: "none" };
    }
  }

  // 4) One number can feed only one field
  const used = new Map<number, Target[]>();
  for (const t of order) {
    const p = picks[t];
    if (t === "map" || !p || p.kind !== "one") continue;
    const arr = used.get(p.cand.num.id) || [];
    arr.push(t);
    used.set(p.cand.num.id, arr);
  }
  for (const [, ts] of used) {
    if (ts.length < 2) continue;
    for (const t of ts) picks[t] = { kind: "amb", texts: [] };
    out.notes.push(`The same number was matched to ${ts.map((t) => FIELD_LABEL[t as ScanField]).join(" and ")}. None of them were filled; type them or rescan.`);
  }

  const accept = (field: ScanField, n: Num, source: string) => {
    const r = interpret(field, n);
    if (!r.ok) { out.notes.push(`${FIELD_LABEL[field]}: ${r.reason}. Type it or rescan.`); return; }
    if (n.conf < MIN_CONF) {
      out.suggestions[field] = { text: r.text, conf: Math.round(n.conf) };
      out.notes.push(`${FIELD_LABEL[field]}: read ${n.text} but the text was unclear (confidence ${Math.round(n.conf)}%), so it was not filled.`);
      if (field === "temperature" && r.temp) out.temp = undefined;
      return;
    }
    out.values[field] = { text: r.text, conf: Math.round(n.conf), source };
    if (field === "temperature" && r.temp) out.temp = r.temp;
  };

  if (bpPair) {
    // sanity check against labelled values, if the monitor also shows SYS/DIA labels
    accept("bpSystolic", bpPair.sys, "BP pair");
    accept("bpDiastolic", bpPair.dia, "BP pair");
    if (!out.values.bpSystolic || !out.values.bpDiastolic) {
      // never fill half of a BP
      delete out.values.bpSystolic;
      delete out.values.bpDiastolic;
    }
  }
  for (const t of order) {
    if (t === "map") continue;
    const p = picks[t];
    if (!p || p.kind === "none") continue;
    if (p.kind === "amb") {
      if (p.texts.length) out.notes.push(`${FIELD_LABEL[t as ScanField]}: several possible numbers (${p.texts.join(", ")}). Not filled; type it or rescan.`);
      continue;
    }
    accept(t as ScanField, p.cand.num, p.cand.label);
  }

  // BP must come as a complete, ordered pair
  const s = out.values.bpSystolic, d = out.values.bpDiastolic;
  if (!!s !== !!d) {
    delete out.values.bpSystolic;
    delete out.values.bpDiastolic;
    out.notes.push("Only one of systolic/diastolic could be read, so BP was not filled. Type both or rescan.");
  } else if (s && d && Number(s.text) <= Number(d.text)) {
    delete out.values.bpSystolic;
    delete out.values.bpDiastolic;
    out.notes.push("Systolic must be higher than diastolic, so BP was not filled. Type both or rescan.");
  }

  if (!labels.length && !bpPair && !Object.keys(tpl?.regions || {}).length) {
    out.notes.unshift("No monitor labels (SYS, DIA, PR, SpO2, TEMP...) were recognised. Crop closer to the screen, avoid glare, or enter the values manually.");
  }

  out.missing = (Object.keys(FIELD_LABEL) as ScanField[]).filter((f) => !out.values[f]);
  return out;
}