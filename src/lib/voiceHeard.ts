// Helps the voice screen choose the right words when speech recognition is unsure.
import { soundAlikeMatches } from "./voicePrescription";

// Words the recognizer often gets wrong -> what doctors really mean. Add your own lines as you find them.
// Keys must be lowercase. Only add words that are never real prescription words.
export const MISHEARD: Record<string, string> = {
  "electronics": "cough tonic",
  "meenakshil": "minoxidil",
  "stirrup": "syrup",
};

export function fixMisheard(text: string): string {
  let out = text;
  for (const [bad, good] of Object.entries(MISHEARD)) {
    out = out.replace(new RegExp("\\b" + bad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi"), good);
  }
  return out;
}

const SKIP = new Set([
  "take", "tablet", "tablets", "capsule", "capsules", "daily", "morning", "afternoon", "evening", "night", "after", "before",
  "food", "days", "day", "week", "weeks", "times", "twice", "thrice", "once", "give", "with", "three", "four", "five", "seven",
  "give", "him", "her", "this", "that", "then", "also", "next", "please", "medicine", "dose", "each", "every", "hours",
]);

let cachedCatalog: string[] | null = null;
let wordSet = new Set<string>();
function words(catalog: string[]): Set<string> {
  if (cachedCatalog !== catalog) {
    cachedCatalog = catalog;
    wordSet = new Set<string>();
    for (const n of catalog) for (const w of n.toLowerCase().split(/[^a-z]+/)) if (w.length >= 3) wordSet.add(w);
  }
  return wordSet;
}

const memo = new Map<string, string>();

function score(text: string, catalog: string[], ws: Set<string>): number {
  const toks = text.toLowerCase().split(/[^a-z]+/).filter(t => t.length >= 4 && !SKIP.has(t)).slice(0, 12);
  let total = 0;
  for (const tok of toks) {
    const base = tok.endsWith("s") ? tok.slice(0, -1) : tok;
    if (ws.has(tok) || ws.has(base)) total += 1;
    else if (base.length >= 5 && soundAlikeMatches(base, catalog, 1, 0.86).length) total += 0.6;
  }
  return total;
}

/** Given the recognizer's alternative guesses (best first), return the one that best matches known medicines. */
export function pickBestAlternative(alts: string[], catalog: string[]): string {
  const list = alts.map(a => (a || "").trim()).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1 || !catalog.length) return list[0];
  const key = list.join("|") + "#" + catalog.length;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const ws = words(catalog);
  let best = 0;
  let bestScore = score(list[0], catalog, ws);
  for (let i = 1; i < list.length; i++) {
    const sc = score(list[i], catalog, ws);
    if (sc > bestScore + 0.05) { best = i; bestScore = sc; }
  }
  if (memo.size > 200) memo.clear();
  memo.set(key, list[best]);
  return list[best];
}
