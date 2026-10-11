/**
 * Consensus rules for the monitor scanner (pure logic, easy to test).
 *
 * Pass 1 reads the same photo as several image variants (normal, inverted, colour channel).
 * Pass 2 re-reads every number's own area with the OCR limited to digits.
 *
 * A number is only trusted (kept at its OCR confidence) when
 *   (a) at least two image variants read the same text at the same place, AND
 *   (b) the digits-only re-check reads the same text again.
 * If variants or the re-check read DIFFERENT text, the number is dropped.
 * Anything only partly confirmed is capped below the fill threshold, so it can only
 * show up as an "unclear read" suggestion that staff must tap.
 *
 * Agreement lowers the risk of a wrong digit; it does not remove it (all reads start from the
 * same pixels), so staff verification before saving stays mandatory.
 */
import type { OcrWord } from "./monitorMatch";

export type Trace = { text: string; conf: number; seen: string; recheck: string; status: string; x: number; y: number };
export type Item = { word: OcrWord; numeric: boolean; agreed: boolean; rawConf: number; trace: Trace };
export type Recheck = { text: string; conf: number } | null;

const hgt = (w: { y0: number; y1: number }) => Math.max(1, w.y1 - w.y0);

export function normNum(t: string): string {
  return t
    .trim()
    .replace(/^[\[\](){}|<>*_~'"`]+|[\[\](){}|<>*_~'"`%]+$/g, "")
    .replace(/,/g, ".")
    .replace(/\s+/g, "");
}
export function isNumericText(t: string): boolean {
  const n = normNum(t);
  return /^[\d./]+$/.test(n) && /\d/.test(n);
}

function iou(a: OcrWord, b: OcrWord): number {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const inter = ix * iy;
  const ua = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter;
  return ua > 0 ? inter / ua : 0;
}

/**
 * OCR splits "120/80" differently each time ("120/" + "80", "120" + "/" + "80", or one word).
 * Join those pieces first so the variants can be compared word for word.
 */
export function joinSlashWords(words: OcrWord[]): OcrWord[] {
  const used = new Set<number>();
  const out: OcrWord[] = [];
  const rowOk = (a: OcrWord, b: OcrWord) =>
    Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)) / Math.min(hgt(a), hgt(b)) >= 0.5;
  const right = (a: OcrWord, test: (n: string) => boolean, skip: Set<number>): number => {
    let best = -1;
    for (let j = 0; j < words.length; j++) {
      const b = words[j];
      if (b === a || used.has(j) || skip.has(j) || !rowOk(a, b)) continue;
      const gap = b.x0 - a.x1;
      if (gap < -hgt(a) * 0.3 || gap > hgt(a) * 2.5) continue;
      if (!test(normNum(b.text))) continue;
      if (best < 0 || b.x0 < words[best].x0) best = j;
    }
    return best;
  };
  const merge = (a: OcrWord, b: OcrWord, text: string): OcrWord => ({
    text,
    conf: Math.min(a.conf, b.conf),
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  });
  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue;
    const a = words[i];
    const na = normNum(a.text);
    let cur: OcrWord = a;
    if (/^\d{1,3}\/$/.test(na)) {
      const j = right(a, (n) => /^\d{1,3}$/.test(n), new Set([i]));
      if (j >= 0) { cur = merge(a, words[j], na + normNum(words[j].text)); used.add(j); }
    } else if (/^\d{1,3}$/.test(na)) {
      const j = right(a, (n) => n === "/", new Set([i]));
      if (j >= 0) {
        const k = right(words[j], (n) => /^\d{1,3}$/.test(n), new Set([i, j]));
        if (k >= 0) {
          cur = merge(merge(a, words[j], na + "/"), words[k], na + "/" + normNum(words[k].text));
          used.add(j); used.add(k);
        }
      } else {
        const j2 = right(a, (n) => /^\/\d{1,3}$/.test(n), new Set([i]));
        if (j2 >= 0) { cur = merge(a, words[j2], na + normNum(words[j2].text)); used.add(j2); }
      }
    }
    used.add(i);
    out.push(cur);
  }
  return out;
}

/** Combine the words read from each image variant. All variants must share the same pixel size. */
export function mergeVariants(variants: OcrWord[][], names: string[]): { items: Item[]; notes: string[]; dropped: Trace[] } {
  const vs = variants.map(joinSlashWords);
  const assigned = vs.map(() => new Set<number>());
  const items: Item[] = [];
  const dropped: Trace[] = [];
  const notes: string[] = [];

  for (let i = 0; i < vs.length; i++) {
    for (let a = 0; a < vs[i].length; a++) {
      if (assigned[i].has(a)) continue;
      assigned[i].add(a);
      const members: { v: number; w: OcrWord }[] = [{ v: i, w: vs[i][a] }];
      for (let j = i + 1; j < vs.length; j++) {
        let best = -1, bestIou = 0.4;
        for (let b = 0; b < vs[j].length; b++) {
          if (assigned[j].has(b)) continue;
          const o = iou(vs[i][a], vs[j][b]);
          if (o >= bestIou) { bestIou = o; best = b; }
        }
        if (best >= 0) { assigned[j].add(best); members.push({ v: j, w: vs[j][best] }); }
      }
      const n = members.length;
      const rect = {
        x0: members.reduce((s, m) => s + m.w.x0, 0) / n,
        y0: members.reduce((s, m) => s + m.w.y0, 0) / n,
        x1: members.reduce((s, m) => s + m.w.x1, 0) / n,
        y1: members.reduce((s, m) => s + m.w.y1, 0) / n,
      };
      const seen = names.map((nm, k) => (members.some((m) => m.v === k) ? nm : "-")).join(" ");
      const numeric = members.map((m) => isNumericText(m.w.text));
      const minConf = Math.min(...members.map((m) => m.w.conf));

      if (numeric.every(Boolean)) {
        const texts = [...new Set(members.map((m) => normNum(m.w.text)))];
        if (texts.length > 1) {
          dropped.push({ text: texts.join(" / "), conf: Math.round(minConf), seen, recheck: "", status: "image versions disagreed, not used", x: rect.x0, y: rect.y0 });
          notes.push(`The image versions read one spot differently (${texts.join(" / ")}), so it was not used.`);
          continue;
        }
        const word: OcrWord = { text: texts[0], conf: minConf, ...rect };
        items.push({ word, numeric: true, agreed: n >= 2, rawConf: minConf, trace: { text: texts[0], conf: Math.round(minConf), seen, recheck: "", status: "", x: rect.x0, y: rect.y0 } });
      } else if (numeric.some(Boolean)) {
        dropped.push({ text: members.map((m) => m.w.text).join(" / "), conf: Math.round(minConf), seen, recheck: "", status: "number and text mixed, not used", x: rect.x0, y: rect.y0 });
      } else {
        const best = members.reduce((p, m) => (m.w.conf > p.w.conf ? m : p));
        items.push({ word: best.w, numeric: false, agreed: n >= 2, rawConf: best.w.conf, trace: { text: best.w.text, conf: Math.round(best.w.conf), seen, recheck: "", status: "label", x: rect.x0, y: rect.y0 } });
      }
    }
  }
  return { items, notes: [...new Set(notes)], dropped };
}

/** Which numbers get the digits-only re-check: the biggest ones first, skipping text too small to re-read. */
export function pickRecheckTargets(items: Item[], max = 30, minHeight = 10): number[] {
  return items
    .map((it, idx) => ({ idx, h: hgt(it.word), ok: it.numeric && hgt(it.word) >= minHeight }))
    .filter((x) => x.ok)
    .sort((a, b) => b.h - a.h)
    .slice(0, max)
    .map((x) => x.idx);
}

/**
 * Apply the digits-only re-check. `rechecks[idx]` is: undefined = not attempted, null = read nothing,
 * or the text it read. Returns the words to give the label matcher.
 */
export function finalize(
  items: Item[],
  rechecks: Record<number, Recheck | undefined>,
  opts: { singleCap: number },
): { words: OcrWord[]; traces: Trace[]; notes: string[] } {
  const words: OcrWord[] = [];
  const traces: Trace[] = [];
  const notes: string[] = [];

  items.forEach((it, idx) => {
    if (!it.numeric) {
      words.push(it.word);
      traces.push(it.trace);
      return;
    }
    const r = rechecks[idx];
    const t = { ...it.trace };
    let conf = it.rawConf;
    let confirmed = false;

    if (r === undefined) {
      t.status = it.agreed ? "not re-checked (too small), unconfirmed" : "one image version only, unconfirmed";
    } else if (r === null || !normNum(r.text)) {
      t.recheck = "(nothing)";
      t.status = "digit re-check read nothing, unconfirmed";
    } else if (normNum(r.text) !== normNum(it.word.text)) {
      t.recheck = normNum(r.text);
      t.status = "digit re-check differed, not used";
      notes.push(`Two reads of one number disagreed (${normNum(it.word.text)} vs ${normNum(r.text)}), so it was not used.`);
      traces.push(t);
      return;
    } else {
      t.recheck = normNum(r.text);
      conf = Math.min(conf, r.conf);
      if (it.agreed) { confirmed = true; t.status = "confirmed"; }
      else t.status = "re-check agrees, but only one image version saw it";
    }
    if (!confirmed) conf = Math.min(conf, opts.singleCap);
    t.conf = Math.round(conf);
    words.push({ ...it.word, conf });
    traces.push(t);
  });

  traces.sort((a, b) => a.y - b.y || a.x - b.x);
  return { words, traces, notes: [...new Set(notes)] };
}