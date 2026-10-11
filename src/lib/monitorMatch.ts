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
type Target = ScanField | "map" | "nibp" | "invasive";

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
  /**
   * Labels (UPPERCASE letters/digits only) that identify this layout. A template with a signature is used
   * automatically only when at least `minSignature` of them are found on the screen. A template WITHOUT a
   * signature is used only when the nurse picks it by hand.
   */
  signature?: string[];
  minSignature?: number;
  /** Honest test status shown to the user. Nothing here is "validated" unless it was tested on live camera photos. */
  status?: string;
};

export const MONITOR_TEMPLATES: MonitorTemplate[] = [
  { id: "auto", name: "Auto-detect (labels on screen, generic mode)" },
  // Region numbers are fractions of the CROPPED screen. They were measured on one stock photo of each layout
  // (checked by drawing the boxes on the photo). They have NOT been tested on live camera photos.
  {
    id: "nk-vismo",
    name: "Nihon Kohden Vismo (stock photo only, not field-tested)",
    status: "stock photo only",
    signature: ["NIBP", "ART", "TSKIN", "TRECT", "SPO2", "HR", "IMPRR"],
    minSignature: 4,
    labelAliases: { TREC: "temperature", IMPRR: "respRate" },
    regions: {
      pulse: { x: 0.095, y: 0.09, w: 0.193, h: 0.167 },
      spo2: { x: 0.225, y: 0.771, w: 0.101, h: 0.101 },
      respRate: { x: 0.228, y: 0.915, w: 0.099, h: 0.085 },
    },
  },
  {
    id: "contec-cms",
    name: "Contec / CMS style, unlabeled big numbers (stock photo only, not field-tested)",
    status: "stock photo only",
    // No signature: its big numbers have no labels, so it can only be chosen by hand.
    regions: {
      pulse: { x: 0.706, y: 0.126, w: 0.138, h: 0.16 },
      spo2: { x: 0.706, y: 0.372, w: 0.138, h: 0.145 },
      respRate: { x: 0.674, y: 0.542, w: 0.135, h: 0.132 },
    },
  },
];

const cleanLabel = (t: string) => t.toUpperCase().replace(/\u2082/g, "2").replace(/[^A-Z0-9]/g, "");

/**
 * Decide whether a fixed-position template may be used. Never forces a template onto a layout it does not match.
 *  - "auto"            : a template is used only if its signature labels are really on the screen.
 *  - a template picked : signature templates must still match; templates without a signature (unlabeled layouts)
 *                        are trusted because the nurse identified the monitor.
 */
export function resolveTemplate(selectedId: string, words: OcrWord[], registry: MonitorTemplate[] = MONITOR_TEMPLATES): { template?: MonitorTemplate; note?: string } {
  const present = new Set(words.map((w) => cleanLabel(w.text)).filter(Boolean));
  const hits = (t: MonitorTemplate) => (t.signature || []).filter((l) => present.has(l)).length;
  if (selectedId && selectedId !== "auto") {
    const t = registry.find((x) => x.id === selectedId);
    if (!t) return { note: "The chosen monitor layout is unknown, so generic label matching was used." };
    if (t.signature && hits(t) < (t.minSignature || 1)) {
      return { note: `This screen does not look like "${t.name}" (its labels were not found), so generic label matching was used instead of forcing that layout.` };
    }
    return { template: t, note: t.signature ? undefined : `Fixed-position layout "${t.name}" was used because you chose it. Check every value against the monitor.` };
  }
  let best: MonitorTemplate | undefined, bestHits = 0, tie = false;
  for (const t of registry) {
    if (!t.signature) continue;
    const h = hits(t);
    if (h < (t.minSignature || 1)) continue;
    if (h > bestHits) { best = t; bestHits = h; tie = false; } else if (h === bestHits) tie = true;
  }
  if (best && !tie) return { template: best, note: `Layout recognised from its labels: ${best.name}.` };
  return {};
}

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
  /** Several temperature channels were seen and none could be chosen. Shown as tap-to-use buttons; never auto-filled. */
  tempChoices?: { raw: string; unit: "C" | "F"; f: string; label: string }[];
  /** One line per decision (accepted / suggested / rejected) for the diagnostic panel. */
  log: string[];
  notes: string[];
  missing: ScanField[];
};

type Box = { x0: number; y0: number; x1: number; y1: number };
type Num = Box & { id: number; text: string; value: number; conf: number; dot: boolean; paren?: boolean };
type Lbl = Box & { text: string; target: Target };
type Cand = { num: Num; score: number; label: string; row: boolean };
type Pick = { kind: "none" } | { kind: "amb"; texts: string[]; labels?: string[] } | { kind: "one"; cand: Cand };

const MAX_SCORE = 3; // farther than this (in digit heights) is not "next to" the label
const AMBIG = 1.3; // runner-up within this ratio of the winner => ambiguous => fill nothing

const LABEL_PATTERNS: [RegExp, Target][] = [
  [/^SYS(T|TOLIC)?$/, "bpSystolic"],
  [/^DIA(S|ST|STOLIC)?$/, "bpDiastolic"],
  [/^MAP$/, "map"],
  // Cuff pressure anchors. Only these (plus SYS/DIA) may feed the ward BP fields.
  [/^(NIBP|NBP|CUFF)$/, "nibp"],
  // Invasive pressures are never ward BP. They are recognised only so they can be excluded.
  [/^(ART|IBP|ABP|CVP|PAP|ICP|LAP|RAP)[0-9]?$/, "invasive"],
  [/^ALINE$/, "invasive"],
  [/^(PR|HR|PULSE)$/, "pulse"],
  [/^SP[O0]2?$/, "spo2"],
  [/^(RESP|RR|RESPIRATION|RESPRATE|IMPRR|AWRR)$/, "respRate"],
  [/^(TEMP|TEMPERATURE|T1|T2|TEMP1|TEMP2|TSKIN|TREC|TRECT|TCORE)$/, "temperature"],
];

/** True for words the matcher treats as a label (SYS, SpO2, NIBP, ART ...). */
export function isKnownLabel(text: string): boolean {
  const up = cleanLabel(text);
  return !!up && LABEL_PATTERNS.some(([re]) => re.test(up));
}

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
    if ((m = s.match(/^(\d{1,3})[.:]$/))) {
      // trailing stray punctuation; the digits themselves are unchanged
      nums.push({ ...box, id: id++, text: m[1], value: Number(m[1]), conf: w.conf, dot: false });
      continue;
    }
    if (/^\d{1,3}(\.\d)?$/.test(s)) {
      // a number printed inside brackets, "(91)", is the mean pressure (MAP) on virtually every monitor
      const paren = /^\s*[(\[]\s*\d{1,3}\s*[)\]]\s*$/.test(w.text);
      nums.push({ ...box, id: id++, text: s, value: Number(s), conf: w.conf, dot: s.includes("."), paren });
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
  if (rival) return { kind: "amb", texts: [first.num.text, rival.num.text], labels: [first.label, rival.label] };

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
    if (sib) return { kind: "amb", texts: [w.text, sib.text], labels: [first.label, ""] };
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
  if (rival) return { kind: "amb", texts: [first.text, rival.text], labels: ["", ""] };
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

type BpClass = "nibp" | "invasive" | "unknown";
type BpPair = { sys: Num; dia: Num };

/**
 * Which kind of pressure is this pair? Decided by the nearest BP-related label:
 * NIBP / SYS / DIA / CUFF => cuff, ART / IBP / A-LINE / CVP ... => invasive. If the two kinds are about equally
 * close, or no label is near, the pair is "unknown" (never assumed to be cuff when invasive labels exist).
 */
function classifyPair(p: BpPair, labels: Lbl[]): BpClass {
  const box: Box = { x0: Math.min(p.sys.x0, p.dia.x0), y0: Math.min(p.sys.y0, p.dia.y0), x1: Math.max(p.sys.x1, p.dia.x1), y1: Math.max(p.sys.y1, p.dia.y1) };
  let nibp = Infinity, inv = Infinity;
  for (const L of labels) {
    const sc = proximity(L, box);
    if (sc > MAX_SCORE) continue;
    if (L.target === "nibp" || L.target === "bpSystolic" || L.target === "bpDiastolic") nibp = Math.min(nibp, sc);
    else if (L.target === "invasive") inv = Math.min(inv, sc);
  }
  if (nibp === Infinity && inv === Infinity) return "unknown";
  if (inv === Infinity) return "nibp";
  if (nibp === Infinity) return "invasive";
  if (nibp < inv / AMBIG) return "nibp";
  if (inv < nibp / AMBIG) return "invasive";
  return "unknown";
}

function tempFromText(text: string): { raw: string; unit: "C" | "F"; f: string } | null {
  if (!/^\d{2,3}\.\d$/.test(text)) return null;
  const v = Number(text);
  if (v >= TEMP_C_RANGE[0] && v <= TEMP_C_RANGE[1]) return { raw: text, unit: "C", f: (v * 9 / 5 + 32).toFixed(1) };
  if (v >= FIELD_RANGE.temperature[0] && v <= FIELD_RANGE.temperature[1]) return { raw: text, unit: "F", f: text };
  return null;
}

export function matchMonitorReadings(
  words: OcrWord[],
  opts: { template?: MonitorTemplate; width?: number; height?: number } = {},
): MatchOutput {
  const tpl = opts.template;
  const { nums, labels, pairs } = tokenize(words, tpl?.labelAliases || {});
  const out: MatchOutput = { values: {}, suggestions: {}, notes: [], missing: [], log: [] };
  const excluded = new Set<number>();
  const picks: Partial<Record<Target, Pick>> = {};
  const W = opts.width || 0, H = opts.height || 0;

  // Bracketed numbers are mean pressures, never one of the six fields.
  for (const N of nums) if (N.paren) excluded.add(N.id);

  // 0) Invasive pressure labels (ART, IBP, A-LINE, CVP ...): numbers that belong to them are never ward vitals.
  const hasInvasiveLabel = labels.some((l) => l.target === "invasive");
  if (hasInvasiveLabel) {
    for (const N of nums) {
      let nearest: Lbl | null = null, ns = Infinity;
      for (const L of labels) {
        const sc = proximity(L, N);
        if (sc <= MAX_SCORE && sc < ns) { ns = sc; nearest = L; }
      }
      if (nearest && nearest.target === "invasive") excluded.add(N.id);
    }
  }

  // 1) Blood pressure written as "120/80" (strongest evidence), cuff (NIBP) only
  let bpPair: BpPair | null = null;
  const validPairs = pairs.filter((p) => p.sys.value > p.dia.value);
  const classed = validPairs.map((p) => ({ p, cls: classifyPair(p, labels), key: p.sys.text + "/" + p.dia.text }));
  for (const c of classed) {
    if (c.cls === "invasive") out.notes.push(`Ignored ${c.key}: it is next to an ART/IBP (invasive) label, not the cuff BP.`);
  }
  // Every BP-looking pair stays out of the other fields (pulse, SpO2 ...), whatever happens to it.
  for (const c of classed) { excluded.add(c.p.sys.id); excluded.add(c.p.dia.id); }

  let cands = classed.filter((c) => c.cls === "nibp");
  // With no invasive label on the screen, a single unlabeled pair is accepted as before. With one, it must be
  // positively tied to NIBP/SYS/DIA/CUFF.
  if (!cands.length && !hasInvasiveLabel) cands = classed.filter((c) => c.cls === "unknown");
  const distinct = new Map(cands.map((c) => [c.key, c.p]));
  if (distinct.size === 1) {
    bpPair = [...distinct.values()][0];
    out.log.push(`BP pair ${[...distinct.keys()][0]} taken as cuff (NIBP) pressure.`);
  } else if (distinct.size > 1) {
    out.notes.push(`Several BP readings were found (${[...distinct.keys()].join(", ")}). BP was not filled; type it or rescan.`);
  } else if (hasInvasiveLabel && classed.length) {
    out.notes.push("This monitor shows invasive (ART/IBP) pressure. The cuff (NIBP) reading could not be identified, so BP was not filled. Type it or rescan.");
  }
  const bpLocked = !!bpPair || classed.length > 0; // a BP pair exists on screen: do not rebuild BP from loose SYS/DIA labels

  // 2) Everything else: template region first, else nearest label
  const order: Target[] = ["bpSystolic", "bpDiastolic", "pulse", "spo2", "respRate", "temperature", "map"];
  for (const t of order) {
    if (bpLocked && (t === "bpSystolic" || t === "bpDiastolic")) continue;
    const region = t !== "map" ? tpl?.regions?.[t as ScanField] : undefined;
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
    if (!r.ok) { out.notes.push(`${FIELD_LABEL[field]}: ${r.reason}. Type it or rescan.`); out.log.push(`${FIELD_LABEL[field]}: rejected, ${r.reason}.`); return; }
    if (n.conf < MIN_CONF) {
      out.suggestions[field] = { text: r.text, conf: Math.round(n.conf) };
      out.notes.push(`${FIELD_LABEL[field]}: read ${n.text} but the text was unclear (confidence ${Math.round(n.conf)}%), so it was not filled.`);
      out.log.push(`${FIELD_LABEL[field]}: ${n.text} offered as a suggestion only (confidence ${Math.round(n.conf)}%, needs ${MIN_CONF}%).`);
      if (field === "temperature" && r.temp) out.temp = undefined;
      return;
    }
    out.values[field] = { text: r.text, conf: Math.round(n.conf), source };
    out.log.push(`${FIELD_LABEL[field]}: accepted ${n.text} from ${source} (confidence ${Math.round(n.conf)}%).`);
    if (field === "temperature" && r.temp) out.temp = r.temp;
  };

  if (bpPair) {
    accept("bpSystolic", bpPair.sys, "BP pair (NIBP)");
    accept("bpDiastolic", bpPair.dia, "BP pair (NIBP)");
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
      if (p.texts.length) {
        out.notes.push(`${FIELD_LABEL[t as ScanField]}: several possible numbers (${p.texts.join(", ")}). Not filled; type it or rescan.`);
        out.log.push(`${FIELD_LABEL[t as ScanField]}: ambiguous (${p.texts.join(" / ")}), left blank.`);
        if (t === "temperature") {
          const choices = p.texts.map((tx, i) => ({ c: tempFromText(tx), label: p.labels?.[i] || "" })).filter((x) => x.c);
          if (choices.length >= 2) out.tempChoices = choices.map((x) => ({ ...x.c!, label: x.label }));
        }
      }
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