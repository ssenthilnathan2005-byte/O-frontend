// scanCombine.ts - run EVERY monitor layout on the same OCR words, add the label/unit pass, and merge.
//
// Safety rules (same spirit as the rest of the scanner):
//  * "Strong" reads = Auto-detect (labels / recognised layout) and the label+unit pass.
//    Strong reads that agree -> filled (green). Strong reads that disagree -> field left EMPTY and a note names both.
//  * "Weak" reads = fixed-position layouts forced onto the photo (Vismo, Contec). They only ever become amber
//    suggestions, and only when no strong read exists and the weak reads agree with each other.
import { matchMonitorReadings, resolveTemplate, MONITOR_TEMPLATES, FIELD_LABEL, FIELD_RANGE } from "./monitorMatch";
import { mergeVitals } from "./vitalsMerge";
import type { Word } from "./vitalsMerge";

type AnyObj = any;
type Read = { text: string; conf: number; source?: string };

const FIELDS = ["bpSystolic", "bpDiastolic", "pulse", "spo2", "respRate", "temperature"] as const;
const KEY: Record<string, string> = { sys: "bpSystolic", dia: "bpDiastolic", pulse: "pulse", spo2: "spo2", rr: "respRate", temp: "temperature" };

const same = (a: string, b: string) => {
  const x = Number(a), y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.abs(x - y) < 0.15 : a === b;
};

/** Group reads that agree numerically; returns groups sorted by support. */
function groups(reads: Read[]) {
  const g: { text: string; conf: number; n: number }[] = [];
  for (const r of reads) {
    const hit = g.find((x) => same(x.text, r.text));
    if (hit) { hit.n++; hit.conf = Math.max(hit.conf, r.conf); } else g.push({ text: r.text, conf: r.conf, n: 1 });
  }
  return g.sort((a, b) => b.n - a.n);
}


// ---- Rescue pass -------------------------------------------------------------------------------------
// Numbers the OCR consensus rejected for cosmetic reasons (a stray quote mark, a "%" read as a "5") are
// cleaned up and offered as AMBER SUGGESTIONS ONLY. They never become green "read" values.
const NOISE = /[\u201C\u201D\u2018\u2019"'`\u00B4,;:]/g;
const clean = (v: string) => v.replace(NOISE, "").replace(/\s+/g, "").trim();

function variantsOf(t: AnyObj): string[] {
  const src = String(t.raw || t.text || "");
  const parts = src.includes("|") ? src.split("|") : src.split(" / ");
  return parts.map(clean).filter(Boolean);
}
const seenCount = (t: AnyObj) => String(t.seen ?? "").split(/\s+/).filter((x) => x && x !== "-").length;
const inRange = (f: string, v: number) => { const r: AnyObj = (FIELD_RANGE as AnyObj)[f]; return !!r && v >= r[0] && v <= r[1]; };
const inside = (a: AnyObj, b: AnyObj) => b.w > 0 && b.h > 0 && a.x >= b.x && a.x <= b.x + b.w && a.y >= b.y && a.y <= b.y + b.h;

// ---- Alarm-limit guard ------------------------------------------------------------------------------
// Monitors print alarm limits (e.g. 130 / 50) in small digits right next to the label, while the real reading
// is printed much bigger. A value whose every on-screen copy is tiny compared with the main numbers is
// treated as a probable alarm limit and is NEVER filled.
const NUM = /^\d{2,3}(\.\d)?$/;
const isNumTrace = (t: AnyObj) => variantsOf(t).some((v) => NUM.test(v) || /^\d{2,3}\/\d{2,3}$/.test(v));
const LIMIT_RATIO = 0.25;
const WEAK_MIN_CONF = 40; // layout / matcher guesses below this confidence are never pre-filled

/** Typical height of the big readings: median of the numeric boxes at least 60% as tall as the tallest. */
function sizeRef(traces: AnyObj[]): number {
  const hs = traces.filter((t) => t && t.h > 0 && isNumTrace(t)).map((t) => t.h as number);
  if (!hs.length) return 0;
  const max = Math.max(...hs);
  const big = hs.filter((h) => h >= 0.6 * max).sort((a, b) => a - b);
  return big[Math.floor(big.length / 2)];
}
const isSmall = (t: AnyObj, ref: number) => ref > 0 && t.h > 0 && t.h < LIMIT_RATIO * ref;

function isLimitLike(value: string, traces: AnyObj[], ref: number): boolean {
  if (!ref) return false;
  const copies = traces.filter((t) => t && t.h > 0 && (variantsOf(t).some((v) => same(v, value)) || (t.recheck && same(String(t.recheck), value))));
  return copies.length > 0 && copies.every((t) => isSmall(t, ref));
}

const FIELD_LABELS: Record<string, RegExp> = {
  pulse: /^(hr|pr|pulse|heart|heartrate|bpm)$/i,
  spo2: /^(spo2|sp02|spo|o2|sat|sao2)$/i,
  respRate: /^(rr|awrr|resp|rpm|respiration)$/i,
  temperature: /^(temp|temperature|t1|t2|tperi|tcore|tskin)$/i,
};
const CORE_LABELS = /^(hr|pr|pulse|spo2|sp02|resp|rr|awrr|temp|nibp|nbp|etco2|sys|dia)$/i;

/** Tap-to-pick candidates: numbers printed big, close to this field's label, that were not reliable enough to fill. */
function choicesFor(f: string, traces: AnyObj[], ref: number): string[] {
  const re = FIELD_LABELS[f];
  if (!re) return [];
  const labels = traces.filter((t) => t && /^[A-Za-z0-9]+$/.test(clean(String(t.text ?? ""))) && re.test(clean(String(t.text ?? ""))));
  const reach = ref > 0 ? 1.5 * ref : 250;
  const first: string[] = [], rest: string[] = [];
  for (const c of traces) {
    if (!c || typeof c.x !== "number" || isSmall(c, ref) || !isNumTrace(c)) continue;
    const near = labels.some((l) => {
      const dx = c.x - l.x, dy = c.y - l.y;
      return dx > -60 && dy > -60 && Math.hypot(dx, dy) <= reach;
    });
    if (!near) continue;
    const rc = c.recheck ? clean(String(c.recheck)) : "";
    if (NUM.test(rc) && inRange(f, +rc)) first.push(rc);
    for (const v of variantsOf(c)) if (NUM.test(v) && inRange(f, +v)) rest.push(v);
  }
  return [...new Set([...first, ...rest])].slice(0, 3);
}

// ---- Extra check of the big digits (multi-frame, multi-zoom vote) ------------------------------------
// The component re-reads each unreliable BIG number on every captured frame at several zoom levels and stores
// the reads on the trace as `deep`. Here the votes are counted. A value is only ever offered in AMBER.
const labelTraces = (f: string, traces: AnyObj[]) => {
  const re = FIELD_LABELS[f];
  return re ? traces.filter((t) => t && typeof t.x === "number" && /^[A-Za-z0-9]+$/.test(clean(String(t.text ?? ""))) && re.test(clean(String(t.text ?? "")))) : [];
};
const nearAnyLabel = (c: AnyObj, labels: AnyObj[], reach: number) =>
  labels.some((l) => { const dx = c.x - l.x, dy = c.y - l.y; return dx > -60 && dy > -60 && Math.hypot(dx, dy) <= reach; });

/** How many pulse / SpO2 / resp / temp / BP labels the OCR actually found. Few labels = an unlabeled (layout-only) screen. */
const knownLabelCount = (traces: AnyObj[]) => traces.filter((t) => t && CORE_LABELS.test(clean(String(t.text ?? "")))).length;

/** A temperature-looking decimal ("37.5" degC or "99.5" degF) as text, or null. */
const tempDecimal = (v: string): number | null => {
  const m = /^(\d{2,3})[.,](\d)$/.exec(v.trim());
  if (!m) return null;
  const n = +`${m[1]}.${m[2]}`;
  return n >= 34 && n <= 42.5 ? n * 9 / 5 + 32 : n >= 93 && n <= 108.5 ? n : null;
};
const isTempTrace = (t: AnyObj) => variantsOf(t).some((v) => tempDecimal(v) !== null) || ((t.deep ?? []) as AnyObj[]).some((r) => tempDecimal(String(r.text ?? "")) !== null);

/**
 * Not-yet-confirmed numbers worth re-reading on every frame:
 *  1. big numbers next to a pulse / SpO2 / resp label,
 *  2. temperature-looking decimals (36.8 / 98.6), wherever they are,
 *  3. on a screen with (almost) no readable labels: every big unconfirmed number.
 * Alarm limits (tiny digits) are never targets. Boxes without a size get a typical one.
 */
export function pickDeepTargets(traces: AnyObj[]) {
  const ref = sizeRef(traces);
  type Target = { trace: AnyObj; box: { x0: number; y0: number; x1: number; y1: number }; pri: number };
  if (!ref) return [] as { trace: AnyObj; box: { x0: number; y0: number; x1: number; y1: number } }[];
  const labels = ["pulse", "spo2", "respRate"].flatMap((f) => labelTraces(f, traces));
  const unlabeled = knownLabelCount(traces) < 2;
  const out: Target[] = [];
  for (const t of traces) {
    if (!t || typeof t.x !== "number" || typeof t.y !== "number") continue;
    if (String(t.status ?? "") === "confirmed") continue;
    if (!variantsOf(t).some((v) => NUM.test(v) || tempDecimal(v) !== null)) continue;
    const temp = variantsOf(t).some((v) => tempDecimal(v) !== null);
    if (t.h > 0 && t.h < (temp ? 0.25 : 0.6) * ref) continue; // tiny numbers are alarm limits, not readings
    const near = nearAnyLabel(t, labels, 1.5 * ref);
    if (!near && !temp && !unlabeled) continue;
    const w = t.w > 0 ? t.w : ref * 1.5, h = t.h > 0 ? t.h : ref;
    out.push({ trace: t, box: { x0: t.x, y0: t.y, x1: t.x + w, y1: t.y + h }, pri: near ? 0 : temp ? 1 : 2 });
  }
  return out.sort((a, b) => a.pri - b.pri || a.trace.y - b.trace.y).map(({ trace, box }) => ({ trace, box }));
}

/** Winning value of the votes for one box (needs 2+ agreeing reads and at least twice the runner-up), else null. */
function deepVote(t: AnyObj): string | null {
  const reads: string[] = [];
  for (const r of (t.deep ?? []) as AnyObj[]) {
    if (String(r.method ?? "").startsWith("mask:red")) continue; // red = ART / IBP clue, never a vote
    const v = String(r.text ?? "").replace(/[^0-9]/g, "");
    if (/^\d{2,3}$/.test(v) && (Number(r.conf) || 0) >= 50) reads.push(v);
  }
  if (t.recheck) { const v = clean(String(t.recheck)); if (/^\d{2,3}$/.test(v)) reads.push(v); }
  const counts = new Map<string, number>();
  for (const v of reads) counts.set(v, (counts.get(v) || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < 2) return null;
  if (ranked.length > 1 && ranked[0][1] < 2 * ranked[1][1]) return null; // needs a clear lead, not a narrow majority
  return ranked[0][0];
}

/** Winning temperature (degF text) among a box's reads, with the same "2+ reads and twice the runner-up" rule. */
function deepVoteTemp(t: AnyObj): string | null {
  const counts = new Map<string, number>();
  for (const r of (t.deep ?? []) as AnyObj[]) {
    if (String(r.method ?? "").startsWith("mask:red") || (Number(r.conf) || 0) < 50) continue;
    const f = tempDecimal(String(r.text ?? "").replace(/[^0-9.,]/g, ""));
    if (f !== null) counts.set(f.toFixed(1), (counts.get(f.toFixed(1)) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < 2) return null;
  if (ranked.length > 1 && ranked[0][1] < 2 * ranked[1][1]) return null;
  return ranked[0][0];
}

/** One readable line per re-checked number: original read, every extra read and the method that made it, and why it was accepted or not. */
function describeDeep(f: string, t: AnyObj, decision: string): string {
  const byValue = new Map<string, Map<string, number>>();
  for (const r of (t.deep ?? []) as AnyObj[]) {
    const v = String(r.text ?? "").replace(/[^0-9]/g, "") || "?";
    const m = String(r.method ?? "normal");
    const inner = byValue.get(v) ?? new Map<string, number>();
    inner.set(m, (inner.get(m) || 0) + 1);
    byValue.set(v, inner);
  }
  const reads = [...byValue.entries()]
    .map(([v, ms]) => `${v}\u00D7${[...ms.values()].reduce((a, b) => a + b, 0)} (${[...ms.entries()].map(([m, n]) => `${m}\u00D7${n}`).join(", ")})`)
    .join("; ");
  const box = `x=${Math.round(t.x)}, y=${Math.round(t.y)}, w=${Math.round(t.w || 0)}, h=${Math.round(t.h || 0)}`;
  const rc = t.recheck ? `, digit check ${t.recheck}${t.recheckConf !== undefined ? ` (${t.recheckConf}%)` : ""}` : "";
  return `Big digits for ${(FIELD_LABEL as AnyObj)[f] ?? f} [${box}]: original read "${String(t.text ?? "")}" (${Math.round(Number(t.conf) || 0)}%${rc}); extra reads ${reads || "none"}; ${decision}`;
}

function deepFill(traces: AnyObj[], skip: Set<string>, ref: number) {
  const fills: Record<string, string> = {}, choices: Record<string, string[]> = {}, logs: string[] = [];
  const reach = ref > 0 ? 1.5 * ref : 250;
  for (const f of ["pulse", "spo2", "respRate"]) {
    if (skip.has(f)) continue;
    const labels = labelTraces(f, traces);
    const boxes = traces.filter((t) => t && Array.isArray(t.deep) && t.deep.length && typeof t.x === "number" && nearAnyLabel(t, labels, reach));
    const votes = boxes.map((t) => ({ t, v: deepVote(t) }));
    for (const { t, v } of votes) {
      logs.push(describeDeep(f, t, v === null ? "REJECTED: no value had 2+ reads and twice the runner-up" : !inRange(f, +v) ? `REJECTED: ${v} is outside the plausible range` : `voted ${v}`));
    }
    const vals = [...new Set(votes.map((x) => x.v).filter((v): v is string => !!v && inRange(f, +v)))];
    if (vals.length === 1) { fills[f] = vals[0]; if (boxes.length) logs.push(`${(FIELD_LABEL as AnyObj)[f] ?? f}: ACCEPTED ${vals[0]} as an amber suggestion (never green).`); }
    else if (vals.length > 1) { choices[f] = vals; logs.push(`${(FIELD_LABEL as AnyObj)[f] ?? f}: boxes disagree (${vals.join(" vs ")}), so the field is left blank for manual checking.`); }
    else {
      const counts = new Map<string, number>();
      for (const t of traces) {
        if (!t || !Array.isArray(t.deep) || typeof t.x !== "number" || !nearAnyLabel(t, labels, reach)) continue;
        for (const r of t.deep as AnyObj[]) {
          const v = String(r.text ?? "").replace(/[^0-9]/g, "");
          if (/^\d{2,3}$/.test(v) && inRange(f, +v) && (Number(r.conf) || 0) >= 50) counts.set(v, (counts.get(v) || 0) + 1);
        }
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]);
      if (top.length) choices[f] = top;
    }
  }
  // Screens with (almost) no readable labels: assign the voted big numbers top to bottom as pulse, SpO2, resp (by range).
  // Amber only: this is position + plausible range, so the nurse must confirm each one.
  if (knownLabelCount(traces) < 2) {
    const order = ["pulse", "spo2", "respRate"].filter((f) => !skip.has(f) && !fills[f] && !choices[f]);
    const taken = new Set(Object.values(fills));
    const boxes = traces.filter((t) => t && Array.isArray(t.deep) && t.deep.length && typeof t.y === "number" && !isSmall(t, ref) && !isTempTrace(t)).sort((a, b) => a.y - b.y);
    for (const t of boxes) {
      const v = deepVote(t);
      if (!v) { logs.push(describeDeep("pulse", t, "REJECTED (no labels on screen): no value had 2+ reads and twice the runner-up").replace("Pulse", "Unlabeled number")); continue; }
      const f = order.find((x) => inRange(x, +v));
      if (!f || taken.has(v)) continue;
      fills[f] = v; taken.add(v); order.splice(order.indexOf(f), 1);
      logs.push(describeDeep(f, t, `ACCEPTED ${v} by position and range (no labels on screen) as an amber suggestion`));
    }
  }

  // Temperature: a decimal in the temperature range, voted across frames and methods (shown in degF).
  if (!skip.has("temperature")) {
    const tvals = [...new Set(traces.filter((t) => t && Array.isArray(t.deep) && t.deep.length && isTempTrace(t)).map(deepVoteTemp).filter((v): v is string => !!v))];
    if (tvals.length === 1) { fills.temperature = tvals[0]; logs.push(`Temperature: ACCEPTED ${tvals[0]} \u00B0F from repeated decimal reads as an amber suggestion (never green).`); }
    else if (tvals.length > 1) { choices.temperature = tvals; logs.push(`Temperature: reads disagree (${tvals.join(" vs ")}), so the field is left blank for manual checking.`); }
    else {
      // nobody won the vote: offer the two most-read plausible temperatures to tap
      const counts = new Map<string, number>();
      for (const t of traces) {
        if (!t || !Array.isArray(t.deep) || !isTempTrace(t)) continue;
        for (const r of t.deep as AnyObj[]) {
          if (String(r.method ?? "").startsWith("mask:red") || (Number(r.conf) || 0) < 50) continue;
          const f = tempDecimal(String(r.text ?? "").replace(/[^0-9.,]/g, ""));
          if (f !== null) counts.set(f.toFixed(1), (counts.get(f.toFixed(1)) || 0) + 1);
        }
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]);
      if (top.length) { choices.temperature = top; logs.push(`Temperature: no clear winner among the reads (${top.join(" vs ")}), so the field is left blank for manual checking.`); }
    }
  }
  return { fills, choices, logs };
}

/** Temperature without a label: a decimal like 36.8 / 98.6 (no other vital has one). Returns degF text, or null. */
function tempRescue(traces: AnyObj[]): string | null {
  const cands: { text: string; h: number }[] = [];
  for (const t of traces) {
    if (!t || typeof t.y !== "number") continue;
    const vs = variantsOf(t).map((v) => v.replace(/^(\d{2}),(\d)$/, "$1.$2"));
    if (!vs.length || new Set(vs).size !== 1 || !/^\d{2,3}\.\d$/.test(vs[0])) continue;
    if (!(seenCount(t) >= 2 || t.status === "confirmed")) continue;
    const v = +vs[0];
    const f = v >= 34 && v <= 42.5 ? (v * 9) / 5 + 32 : v >= 93 && v <= 108.5 ? v : null;
    if (f !== null) cands.push({ text: f.toFixed(1), h: t.h > 0 ? t.h : 1 });
  }
  if (!cands.length) return null;
  if (cands.length === 1) return cands[0].text;
  cands.sort((a, b) => b.h - a.h);
  // several decimals (e.g. 36.8 plus its alarm limits 39.0 / 35.0): only the clearly biggest one counts
  return cands[0].h >= 1.4 * cands[1].h ? cands[0].text : null;
}

// ---- NIBP (cuff) vs ART / IBP (invasive) --------------------------------------------------------------------
// The form only has cuff-BP fields. A BP-looking number whose nearest label is an invasive-pressure label
// (ART / ABP / IBP / P1 / P2) must never fill them, whatever colour it is printed in.
const ART_LABEL = /^(art|abp|ibp|ibp1|ibp2|p1|p2)$/i;
const NIBP_LABEL = /^(nibp|nbp|nibp1|nibp2|bp|cuff)$/i;

function invasiveCopies(sys: string, dia: string, traces: AnyObj[], ref: number): { invasive: boolean; ambiguous: boolean } {
  const pair = `${sys}/${dia}`;
  const copies = traces.filter((t) => t && typeof t.x === "number" && variantsOf(t).some((v) => v === pair));
  if (!copies.length) return { invasive: false, ambiguous: false };
  const reach = ref > 0 ? 2.2 * ref : 400;
  const labelsOf = (re: RegExp) => traces.filter((l) => l && typeof l.x === "number" && /^[A-Za-z0-9]+$/.test(clean(String(l.text ?? ""))) && re.test(clean(String(l.text ?? ""))));
  const arts = labelsOf(ART_LABEL), nibps = labelsOf(NIBP_LABEL);
  const near = (c: AnyObj, ls: AnyObj[]) => Math.min(Infinity, ...ls.map((l) => Math.hypot(c.x - l.x, c.y - l.y)).filter((d) => d <= reach));
  let invasive = false, ambiguous = false;
  for (const c of copies) {
    const dA = near(c, arts), dN = near(c, nibps);
    if (!isFinite(dA)) continue;                 // no invasive label nearby: normal cuff BP
    if (!isFinite(dN) || dA < 0.85 * dN) invasive = true;
    else if (dN >= 0.85 * dA && dN <= 1.18 * dA) ambiguous = true; // equally close to both: identity unclear
  }
  return { invasive, ambiguous };
}

function rescue(traces: AnyObj[], haveVals: Record<string, string>, ref: number): Record<string, string> {
  const have = new Set(Object.keys(haveVals));
  const out: Record<string, string> = {};
  const used = new Set<AnyObj>();
  const rows = traces.filter((t) => t && typeof t.y === "number");

  // 1) Blood pressure: the same "120/80" in at least two image variants, once stray marks are removed.
  if (!have.has("bpSystolic") && !have.has("bpDiastolic")) {
    for (const t of rows) {
      const counts = new Map<string, number>();
      for (const v of variantsOf(t)) if (/^\d{2,3}\/\d{2,3}$/.test(v)) counts.set(v, (counts.get(v) || 0) + 1);
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!best || best[1] < 2) continue;
      const [s, d] = best[0].split("/").map(Number);
      const inv = invasiveCopies(String(s), String(d), traces, ref);
      if (inv.invasive || inv.ambiguous) continue; // ART / IBP (or unclear): never into the cuff BP fields
      if (inRange("bpSystolic", s) && inRange("bpDiastolic", d) && s > d) {
        out.bpSystolic = String(s); out.bpDiastolic = String(d); used.add(t); break;
      }
    }
  }

  // 2) SpO2 by unit: "98%" (the digit re-check often turns the % into a 5, giving "985", so it is ignored here).
  if (!have.has("spo2")) {
    const found = new Set<string>();
    for (const t of rows) {
      for (const v of variantsOf(t)) {
        const m = v.match(/^(\d{2,3})%$/);
        if (m && inRange("spo2", +m[1])) { found.add(m[1]); used.add(t); }
      }
    }
    if (found.size === 1) out.spo2 = [...found][0];
  }

  // 3) Remaining plain numbers seen in 2+ image variants, top to bottom: pulse, SpO2, resp rate (by range).
  const knownLabels = rows.filter((t) => CORE_LABELS.test(clean(String(t.text ?? "")))).length;
  const order = knownLabels >= 2 ? [] : ["pulse", "spo2", "respRate"].filter((f) => !have.has(f) && !out[f]);
  const plain = rows
    .filter((t) => !used.has(t) && !isSmall(t, ref) && !rows.some((u) => used.has(u) && inside(t, u)))
    .map((t) => ({ t, vs: variantsOf(t) }))
    .filter(({ t, vs }) => vs.length > 0 && vs.every((v) => /^\d{2,3}$/.test(v)) && new Set(vs).size === 1 && (seenCount(t) >= 2 || t.status === "confirmed"))
    .sort((a, b) => a.t.y - b.t.y);
  for (const { vs } of plain) {
    const n = +vs[0];
    const f = order.find((x) => inRange(x, n));
    const taken = new Set([...Object.values(out), ...Object.values(haveVals)]); // a number already used by another field is never reused
    if (f && !taken.has(vs[0])) { out[f] = vs[0]; order.splice(order.indexOf(f), 1); }
  }
  return out;
}

export function combineMatches(words: AnyObj[], width: number, height: number, minConf: number, traces: AnyObj[] = []) {
  const runs: { id: string; name: string; forced: boolean; out: AnyObj }[] = [];
  for (const t of MONITOR_TEMPLATES as AnyObj[]) {
    try {
      const resolved: AnyObj = (resolveTemplate as AnyObj)(t.id, words);
      const out: AnyObj = (matchMonitorReadings as AnyObj)(words, { template: resolved.template, width, height });
      runs.push({ id: t.id, name: t.name, forced: t.id !== "auto", out });
    } catch { /* one layout failing must never stop the others */ }
  }
  const primary = runs.find((r) => !r.forced) ?? runs[0];
  if (!primary) throw new Error("No monitor layout could be applied");

  // Label + unit pass over words the OCR consensus already trusts (numbers below minConf are not used here).
  const sure = words.filter((w) => !/\d/.test(w.text) || w.conf >= minConf) as Word[];
  const extra = mergeVitals(sure, width);

  const values: Record<string, Read> = {};
  const suggestions: Record<string, Read> = {};
  const notes: string[] = [];
  const log: string[] = [];
  const conflictChoices: Record<string, string[]> = {};

  for (const f of FIELDS) {
    const name = (FIELD_LABEL as AnyObj)[f] ?? f;
    const strong: Read[] = [];
    const pv: Read | undefined = primary.out.values?.[f];
    if (pv?.text) strong.push({ text: pv.text, conf: Number(pv.conf) || 0, source: "labels" });
    const key = Object.keys(KEY).find((k) => KEY[k] === f)!;
    const ex = extra[key as keyof typeof extra];
    if (ex.status === "read" && ex.value !== null) {
      const text = f === "temperature" ? (ex.value * 9 / 5 + 32).toFixed(1) : String(ex.value);
      strong.push({ text, conf: minConf, source: "label+unit" });
    } else if (ex.status === "conflict") {
      notes.push(`${name}: labels and units on the screen point to different numbers. Check the monitor.`);
    }

    const sg = groups(strong);
    if (sg.length === 1) {
      values[f] = { ...(pv ?? {}), text: pv?.text && same(pv.text, sg[0].text) ? pv.text : sg[0].text, conf: sg[0].conf, source: "merged" };
      continue;
    }
    if (sg.length > 1) {
      notes.push(`${name}: two readings disagree (${sg.map((x) => x.text).join(" vs ")}), so it was left empty. Type the value from the monitor.`);
      conflictChoices[f] = sg.map((x) => x.text);
      continue;
    }

    // No strong read: weak layout guesses -> amber suggestion only if they agree.
    const weak: Read[] = [];
    const ps: Read | undefined = primary.out.suggestions?.[f];
    // A guess the matcher itself rated near 0% is noise, not a suggestion: never pre-fill it.
    if (ps?.text && (Number(ps.conf) || 0) >= WEAK_MIN_CONF) weak.push({ text: ps.text, conf: Number(ps.conf) || 0 });
    else if (ps?.text) log.push(`${name}: matcher suggestion ${ps.text} ignored (confidence ${Math.round(Number(ps.conf) || 0)}%, below ${WEAK_MIN_CONF}%)`);
    for (const r of runs.filter((x) => x.forced)) {
      const v: Read | undefined = r.out.values?.[f] ?? r.out.suggestions?.[f];
      if (!v?.text) continue;
      if ((Number(v.conf) || 0) < WEAK_MIN_CONF) { log.push(`${name}: ${r.name} layout guess ${v.text} ignored (confidence ${Math.round(Number(v.conf) || 0)}%, below ${WEAK_MIN_CONF}%)`); continue; }
      weak.push({ text: v.text, conf: Number(v.conf) || 0 }); log.push(`${name}: ${r.name} layout guessed ${v.text}`);
    }
    const wg = groups(weak);
    if (wg.length === 1) suggestions[f] = { text: wg[0].text, conf: Math.min(wg[0].conf, minConf - 1) };
    else if (wg.length > 1) {
      if (wg[0].n > wg[1].n) suggestions[f] = { text: wg[0].text, conf: Math.min(wg[0].conf, minConf - 1) };
      else notes.push(`${name}: layout guesses disagree (${wg.map((x) => x.text).join(" vs ")}), so it was left empty.`);
    }
  }

  // Alarm-limit guard: drop anything that is only ever printed in tiny digits next to the real readings.
  const ref = sizeRef(traces);
  const tempLabels = labelTraces("temperature", traces);
  const tempReach = ref > 0 ? 1.5 * ref : 250;
  const tempLocalMax = Math.max(0, ...traces.filter((t) => t && t.h > 0 && typeof t.x === "number" && isNumTrace(t) && nearAnyLabel(t, tempLabels, tempReach)).map((t) => t.h as number));
  const isTempLimit = (value: string) => {
    if (!tempLocalMax) return false;
    const copies = traces.filter((t) => t && t.h > 0 && variantsOf(t).some((v) => same(v, value)));
    return copies.length > 0 && copies.every((t) => t.h < 0.6 * tempLocalMax); // limits are printed smaller than the reading beside them
  };
  for (const f of ["pulse", "spo2", "respRate", "temperature"]) {
    for (const store of [values, suggestions]) {
      const r = store[f];
      if (r && (f === "temperature" ? isTempLimit(r.text) : isLimitLike(r.text, traces, ref))) {
        delete store[f];
        notes.push(`${(FIELD_LABEL as AnyObj)[f] ?? f}: ${r.text} is printed much smaller than the main numbers on the screen, so it is probably an alarm limit and was not used.`);
      }
    }
  }

  // BP alarm limits (e.g. "200 / 80" in small digits) are not the cuff reading: drop a pair that is only ever printed tiny.
  for (const store of [values, suggestions]) {
    const sy = store.bpSystolic, di = store.bpDiastolic;
    if (!sy || !di || !ref) continue;
    const pair = `${sy.text}/${di.text}`;
    const copies = traces.filter((t) => t && t.h > 0 && variantsOf(t).some((v) => v === pair));
    if (copies.length && copies.every((t) => isSmall(t, ref))) {
      delete store.bpSystolic; delete store.bpDiastolic;
      notes.push(`BP ${pair} is printed much smaller than the main numbers on the screen, so it is probably an alarm limit and was not used.`);
    }
  }

  // NIBP vs ART / IBP: drop a BP pair that belongs to an invasive-pressure label (or whose identity is unclear).
  for (const store of [values, suggestions]) {
    const sy = store.bpSystolic, di = store.bpDiastolic;
    if (!sy || !di) continue;
    const inv = invasiveCopies(sy.text, di.text, traces, ref);
    if (inv.invasive || inv.ambiguous) {
      delete store.bpSystolic; delete store.bpDiastolic;
      notes.push(`BP ${sy.text}/${di.text}: ${inv.invasive ? "it sits next to an ART / IBP label (invasive pressure)" : "it is equally close to an NIBP and an ART / IBP label"}, so it was not put into the cuff BP fields.`);
      log.push(`BP ${sy.text}/${di.text} excluded: ${inv.invasive ? "invasive (ART/IBP) label nearest" : "NIBP and ART/IBP labels equally near"}`);
    }
  }

  // Big-digit vote across frames and zoom levels (amber only, never green).
  const deepChoices: Record<string, string[]> = {};
  try {
    const skip = new Set<string>([...Object.keys(values), ...Object.keys(suggestions)]);
    const d = deepFill(traces, skip, ref);
    for (const f of Object.keys(d.fills)) suggestions[f] = { text: d.fills[f], conf: Math.min(minConf - 1, 65), source: "multi-frame" };
    Object.assign(deepChoices, d.choices);
    log.push(...d.logs);
    const keys = Object.keys(d.fills);
    if (keys.length) notes.push(`The big digits were re-read on several frames and zoom levels and filled in amber for: ${keys.map((k) => (FIELD_LABEL as AnyObj)[k] ?? k).join(", ")}. Check each against the monitor.`);
  } catch { /* optional */ }

  // Rescue: only for fields still empty. Always amber, never green.
  const haveVals: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...suggestions, ...values })) haveVals[k] = v.text;
  try {
    const rescued = rescue(traces, haveVals, ref);
    const keys = Object.keys(rescued);
    for (const f of keys) suggestions[f] = { text: rescued[f], conf: Math.min(minConf - 1, 59), source: "rescued" };
    if (keys.length) {
      notes.push(`Partly read numbers were cleaned up and filled in amber for: ${keys.map((k) => (FIELD_LABEL as AnyObj)[k] ?? k).join(", ")}. Check each against the monitor.`);
    }
    if (!values.temperature && !suggestions.temperature && !rescued.temperature) {
      const tr = tempRescue(traces);
      if (tr && !isTempLimit(tr)) {
        suggestions.temperature = { text: tr, conf: Math.min(minConf - 1, 59), source: "rescued" };
        notes.push("Temperature: a decimal reading in the temperature range was filled in amber. Check it against the monitor.");
      }
    }
  } catch { /* the rescue pass is optional */ }

  // Tap-to-pick: fields that are still empty get the big, unreliable numbers printed next to their label.
  const choices: Record<string, string[]> = {};
  for (const f of ["pulse", "spo2", "respRate", "temperature"]) {
    if (values[f] || suggestions[f]) continue;
    const list = [...new Set([...(conflictChoices[f] || []), ...(deepChoices[f] || []), ...(f === "temperature" ? [] : choicesFor(f, traces, ref))])];
    if (list.length) choices[f] = list;
  }
  if (Object.keys(choices).length) notes.push("Some numbers on the screen could not be read reliably. Tap the matching choice under the field, or type the value.");

  const used = runs.map((r) => r.name).join(", ");
  return {
    output: {
      ...primary.out,
      values,
      suggestions,
      choices,
      notes: [...(primary.out.notes ?? []), ...notes],
      log: [...(primary.out.log ?? []), ...log],
    } as AnyObj,
    summary: `One scan for every monitor: ${used} were all tried plus a label/unit pass, and the results were merged.`,
  };
}
