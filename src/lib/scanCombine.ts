// scanCombine.ts - run EVERY monitor layout on the same OCR words, add the label/unit pass, and merge.
//
// Safety rules (same spirit as the rest of the scanner):
//  * "Strong" reads = Auto-detect (labels / recognised layout) and the label+unit pass.
//    Strong reads that agree -> filled (green). Strong reads that disagree -> field left EMPTY and a note names both.
//  * "Weak" reads = fixed-position layouts forced onto the photo (Vismo, Contec). They only ever become amber
//    suggestions, and only when no strong read exists and the weak reads agree with each other.
import { matchMonitorReadings, resolveTemplate, MONITOR_TEMPLATES, FIELD_LABEL } from "./monitorMatch";
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

export function combineMatches(words: AnyObj[], width: number, height: number, minConf: number) {
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
