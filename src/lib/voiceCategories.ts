// Generic words a doctor may say instead of a medicine name ("cough syrup", "pain killer").
// When one of these is spoken ON ITS OWN, the app asks which medicine instead of picking one.
// If the doctor names a specific medicine ("ambroxol syrup"), none of this applies.
// The choices are only a starting list to pick from. Have a doctor review them.
// To add a category: copy a block. "phrases" = what the doctor says, "terms" = medicines to offer.

export type VoiceCategory = {
  id: string;
  phrases: string[];
  terms: string[];
  perTerm?: number; // how many entries to offer per term (default 2)
  liquid?: boolean; // list syrups / suspensions first
};

export const VOICE_CATEGORIES: VoiceCategory[] = [
  {
    id: "cough",
    phrases: ["cough", "cough syrup", "cough medicine", "cough tonic", "cough mixture", "cough linctus"],
    terms: ["cough", "ambroxol", "bromhexine", "guaifenesin", "dextromethorphan", "acetylcysteine"],
    perTerm: 3,
    liquid: true,
  },
  {
    id: "pain",
    phrases: ["painkiller", "pain killer", "painkillers", "pain killers", "pain tablet", "pain tablets", "pain medicine", "pain medication", "analgesic"],
    terms: ["paracetamol", "diclofenac", "aceclofenac", "ibuprofen", "naproxen", "mefenamic acid", "etoricoxib"],
  },
  {
    id: "antibiotic",
    phrases: ["antibiotic", "antibiotics", "antibiotic tablet", "antibiotic syrup"],
    terms: ["amoxicillin", "azithromycin", "cefixime", "cefpodoxime", "cefuroxime", "doxycycline", "ciprofloxacin", "levofloxacin"],
  },
  {
    id: "antacid",
    phrases: ["antacid", "gas tablet", "gastric tablet", "acidity tablet", "acid tablet", "gas medicine", "acidity medicine"],
    terms: ["antacid", "pantoprazole", "rabeprazole", "omeprazole", "esomeprazole", "famotidine"],
  },
  {
    id: "fever",
    phrases: ["fever tablet", "fever tablets", "fever medicine", "fever syrup"],
    terms: ["paracetamol"],
    perTerm: 6,
  },
  {
    id: "allergy",
    phrases: ["allergy tablet", "allergy tablets", "allergy medicine", "antihistamine", "antihistamines"],
    terms: ["cetirizine", "levocetirizine", "fexofenadine", "loratadine", "desloratadine", "bilastine"],
  },
  {
    id: "vitamin",
    phrases: ["vitamin", "vitamins", "vitamin tablet", "vitamin tablets", "vitamin syrup", "vitamin tonic"],
    terms: ["multivitamin", "cholecalciferol", "vitamin c", "methylcobalamin", "folic acid", "vitamin b"],
  },
  {
    id: "bp",
    phrases: ["bp tablet", "bp tablets", "bp medicine", "pressure tablet", "pressure tablets", "blood pressure tablet", "blood pressure medicine"],
    terms: ["amlodipine", "telmisartan", "losartan", "olmesartan", "metoprolol", "atenolol"],
  },
  {
    id: "sugar",
    phrases: ["sugar tablet", "sugar tablets", "sugar medicine", "diabetes tablet", "diabetes tablets", "diabetes medicine"],
    terms: ["metformin", "glimepiride", "gliclazide", "sitagliptin", "vildagliptin", "teneligliptin"],
  },
];

const FILLER = new Set(["a", "an", "the", "some", "any", "my", "normal", "general"]);
const squash = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(w => w && !FILLER.has(w)).join("");

const PHRASE_INDEX = new Map<string, VoiceCategory>();
for (const c of VOICE_CATEGORIES) for (const p of c.phrases) PHRASE_INDEX.set(squash(p), c);

/** The category when the WHOLE spoken name is a generic word like "cough syrup"; null for a specific medicine. */
export function findCategory(...spoken: (string | undefined)[]): VoiceCategory | null {
  for (const s of spoken) {
    if (!s) continue;
    const hit = PHRASE_INDEX.get(squash(s));
    if (hit) return hit;
  }
  return null;
}

/** Available choices for a category, taken from the medicine list (pharmacy entries come first). */
export async function categoryCandidates(
  cat: VoiceCategory,
  search: (q: string) => Promise<string[]>,
  catalog: string[],
): Promise<string[]> {
  const per = cat.perTerm ?? 2;
  const lists = await Promise.all(cat.terms.map(async term => {
    const t = term.toLowerCase();
    let found = catalog.filter(n => n.toLowerCase().includes(t));
    if (!found.length) {
      try { found = await search(term); } catch { found = []; }
    }
    return found.slice(0, per);
  }));
  const seen = new Set<string>();
  let out: string[] = [];
  for (const l of lists) for (const n of l) {
    const k = n.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(n); }
  }
  if (cat.liquid) {
    const liquid = (n: string) => /syrup|suspension|solution|tonic|drops?|linctus/i.test(n);
    out = [...out.filter(liquid), ...out.filter(n => !liquid(n))];
  }
  return out.slice(0, 10);
}
