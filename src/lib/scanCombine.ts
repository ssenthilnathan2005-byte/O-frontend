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

function rescue(traces: AnyObj[], haveVals: Record<string, string>): Record<string, string> {
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
  const order = ["pulse", "spo2", "respRate"].filter((f) => !have.has(f) && !out[f]);
  const plain = rows
    .filter((t) => !used.has(t) && !rows.some((u) => used.has(u) && inside(t, u)))
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
      continue;
    }

    // No strong read: weak layout guesses -> amber suggestion only if they agree.
    const weak: Read[] = [];
    const ps: Read | undefined = primary.out.suggestions?.[f];
    if (ps?.text) weak.push({ text: ps.text, conf: Number(ps.conf) || 0 });
    for (const r of runs.filter((x) => x.forced)) {
      const v: Read | undefined = r.out.values?.[f] ?? r.out.suggestions?.[f];
      if (v?.text) { weak.push({ text: v.text, conf: Number(v.conf) || 0 }); log.push(`${name}: ${r.name} layout guessed ${v.text}`); }
    }
    const wg = groups(weak);
    if (wg.length === 1) suggestions[f] = { text: wg[0].text, conf: Math.min(wg[0].conf, minConf - 1) };
    else if (wg.length > 1) {
      if (wg[0].n > wg[1].n) suggestions[f] = { text: wg[0].text, conf: Math.min(wg[0].conf, minConf - 1) };
      else notes.push(`${name}: layout guesses disagree (${wg.map((x) => x.text).join(" vs ")}), so it was left empty.`);
    }
  }

  // Rescue: only for fields still empty. Always amber, never green.
  const haveVals: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...suggestions, ...values })) haveVals[k] = v.text;
  try {
    const rescued = rescue(traces, haveVals);
    const keys = Object.keys(rescued);
    for (const f of keys) suggestions[f] = { text: rescued[f], conf: Math.min(minConf - 1, 59), source: "rescued" };
    if (keys.length) {
      notes.push(`Partly read numbers were cleaned up and filled in amber for: ${keys.map((k) => (FIELD_LABEL as AnyObj)[k] ?? k).join(", ")}. Check each against the monitor.`);
    }
  } catch { /* the rescue pass is optional */ }

  const used = runs.map((r) => r.name).join(", ");
  return {
    output: {
      ...primary.out,
      values,
      suggestions,
      notes: [...(primary.out.notes ?? []), ...notes],
      log: [...(primary.out.log ?? []), ...log],
    } as AnyObj,
    summary: `One scan for every monitor: ${used} were all tried plus a label/unit pass, and the results were merged.`,
  };
}
