# Better listening: use the recognizer's alternative guesses and pick the one that matches real medicines,
# fix known mishearings, and add tonics/syrups to the medicine list.
# Run from F:\O-frontend AFTER apply_fast.py:  python apply_better_hearing.py
import os, re, sys
comp = "src/components/VoicePrescription.tsx"
heard = "src/lib/voiceHeard.ts"
meds = "src/lib/commonMedicines.ts"
if not os.path.exists(comp): sys.exit("STOP: run this from the O-frontend folder.")
with open(comp, "r", encoding="utf-8", newline="") as f: raw = f.read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")
if "warmRef" not in s: sys.exit("STOP: apply_fast.py must be applied first. Nothing changed.")

LIB = '''// Helps the voice screen choose the right words when speech recognition is unsure.
import { soundAlikeMatches } from "./voicePrescription";

// Words the recognizer often gets wrong -> what doctors really mean. Add your own lines as you find them.
// Keys must be lowercase. Only add words that are never real prescription words.
export const MISHEARD: Record<string, string> = {
  "electronics": "cough tonic",
  "meenakshil": "minoxidil",
};

export function fixMisheard(text: string): string {
  let out = text;
  for (const [bad, good] of Object.entries(MISHEARD)) {
    out = out.replace(new RegExp("\\\\b" + bad.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + "\\\\b", "gi"), good);
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
'''

OPS = [
 ('import { COMMON_MEDICINES } from "../lib/commonMedicines";\n',
  'import { COMMON_MEDICINES } from "../lib/commonMedicines";\nimport { pickBestAlternative, fixMisheard } from "../lib/voiceHeard";\n'),
 ("  const warmRef = useRef(false);\n", "  const warmRef = useRef(false);\n  const catalogArrRef = useRef<string[]>([]);\n"),
 ("    void getCatalog();                                   // load the medicine list before it is needed\n",
  "    void getCatalog().then(c => { catalogArrRef.current = c; }); // load the medicine list before it is needed\n"),
 ("    rec.maxAlternatives = 1;\n", "    rec.maxAlternatives = 5;\n"),
 ('        const t = (r[0]?.transcript || "").trim();\n',
  '''        const alts: string[] = [];
        for (let k = 0; k < r.length; k++) alts.push(r[k]?.transcript || "");
        const t = (r.isFinal ? pickBestAlternative(alts, catalogArrRef.current) : alts[0] || "").trim();
'''),
 ("maxResults: 1,", "maxResults: 5,"),
 ('            chunk = (result?.matches?.[0] ?? "").trim();\n',
  '            chunk = pickBestAlternative(result?.matches ?? [], catalogArrRef.current).trim();\n'),
 ("    const t = text.trim();\n    if (skipRef.current)", "    const t = fixMisheard(text.trim());\n    if (skipRef.current)"),
]
for i, (old, new) in enumerate(OPS, 1):
    if s.count(old) != 1:
        sys.exit("STOP: patch %d did not match exactly once (already applied, or the file differs). Nothing changed." % i)
for old, new in OPS: s = s.replace(old, new)

with open(heard, "w", encoding="utf-8", newline="\n") as f: f.write(LIB)
with open(comp, "w", encoding="utf-8", newline="") as f: f.write(s.replace("\n", "\r\n") if crlf else s)

# tonics, syrups and other products doctors say by type
EXTRA = ["Cough Tonic", "Cough Syrup", "Iron Tonic", "Multivitamin Tonic", "Liver Tonic", "Digestive Tonic", "Appetite Tonic",
         "Calcium Syrup", "Antacid Syrup", "Zinc Syrup", "Paracetamol Syrup", "Ibuprofen Syrup", "Ointment", "Antiseptic Cream",
         "Eye Ointment", "Ear Drops", "Nasal Drops", "Gargle", "Mouth Wash", "Oral Rehydration Solution"]
if os.path.exists(meds):
    with open(meds, "r", encoding="utf-8", newline="") as f: m = f.read()
    nl = "\r\n" if "\r\n" in m else "\n"
    m = m.replace("\r\n", "\n")
    have = {h.lower() for h in re.findall(r'^\s*"([^"]+)",$', m, re.M)}
    new = [n for n in EXTRA if n.lower() not in have]
    if new and m.rstrip().endswith("];") and re.search(r"COMMON_MEDICINES[^\n]*\[\n", m):
        m = m.rstrip()[:-2] + "".join('  "%s",\n' % n for n in new) + "];\n"
        with open(meds, "w", encoding="utf-8", newline="") as f: f.write(m.replace("\n", nl))
        print("added", len(new), "tonics/syrups to the medicine list")
print("done: better listening")
