// Voice prescription: spoken text -> structured medicines (pure functions, no UI).
// Output maps onto the existing prescription item shape
// { name, dosage, duration, instructions } so pharmacy / patient views keep working.

export type NameState = "matched" | "ambiguous" | "unknown" | "manual";

export interface VoiceMed {
  id: string;
  spoken: string;            // name as heard
  searchTerm: string;        // abbreviation-expanded name used for the DB search
  name: string;              // chosen medicine ("" until resolved)
  nameState: NameState;
  candidates: string[];
  strengthAmount: string;
  strengthUnit: string;      // mg | g | mcg | iu | unit
  strengthAssumed: boolean;  // number heard without a unit -> mg assumed
  qty: string;               // dose per intake, e.g. "1"
  qtyUnit: string;           // tablet | capsule | ml | drop | puff
  freq: number | null;       // times per day
  times: string[];           // Morning | Afternoon | Evening | Night
  prn: boolean;
  everyHours: number | null;
  unusualFreq: string;       // e.g. "weekly" -> doctor must set frequency manually
  food: "" | "After food" | "Before food";
  extra: string;
  durationAmount: string;
  durationUnit: "day" | "week";
}

export const TIME_ORDER = ["Morning", "Afternoon", "Evening", "Night"];

// ───────────────────────── normalisation ─────────────────────────

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const isNumWord = (w: string) => w in UNITS || w in TENS || w === "hundred" || w === "thousand";

function wordsToDigits(s: string): string {
  const tok = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < tok.length) {
    if (!isNumWord(tok[i])) { out.push(tok[i]); i++; continue; }
    let total = 0, cur = 0, j = i;
    while (j < tok.length) {
      const w = tok[j];
      if (w === "zero") { if (j === i) { j++; } break; }
      if (w in UNITS) {
        const v = UNITS[w];
        const ok = v < 10 ? (cur === 0 || cur % 10 === 0) : (cur % 100 === 0);
        if (!ok) break;
        cur += v;
      } else if (w in TENS) {
        if (cur % 100 !== 0) break;
        cur += TENS[w];
      } else if (w === "hundred") {
        cur = (cur || 1) * 100;
      } else if (w === "thousand") {
        total += (cur || 1) * 1000; cur = 0;
      } else if (w === "and" && (cur >= 100 || total > 0) && j + 1 < tok.length && isNumWord(tok[j + 1])) {
        // "six hundred and fifty"
      } else break;
      j++;
    }
    if (j === i) { out.push(tok[i]); i++; continue; }
    out.push(String(total + cur));
    i = j;
  }
  return out.join(" ");
}

export function normalise(raw: string): string {
  let s = " " + raw.toLowerCase() + " ";
  s = s
    .replace(/\bmilli\s?grams?\b|\bmgs\b|\bmg\./g, " mg ")
    .replace(/\bmicro\s?grams?\b|\bmcgs\b/g, " mcg ")
    .replace(/\bmilli\s?lit(?:re|er)s?\b|\bmls\b/g, " ml ")
    .replace(/\bgrams?\b/g, " g ")
    .replace(/\btablets?\b|\btabs?\b/g, " tablet ")
    .replace(/\bcapsules?\b|\bcaps?\b/g, " capsule ")
    .replace(/\bdrops?\b/g, " drop ")
    .replace(/\bpuffs?\b/g, " puff ")
    .replace(/\bone and (?:a )?half\b/g, "1.5");
  s = s.replace(/[^a-z0-9.,/\-| ]/g, " ");
  s = s.replace(/(\d)([a-z])/g, "$1 $2");           // 650mg -> 650 mg
  s = s.replace(/\.(?!\d)/g, " | ");                // sentence breaks, keep decimals
  s = s.replace(/,/g, " , ");
  s = wordsToDigits(s.replace(/\s+/g, " ").trim());
  s = s.replace(/(\d+)\s+and\s+(?:a\s+)?half\b/g, (_, n) => `${n}.5`)
       .replace(/\b1\/2\b/g, "0.5").replace(/\b1\/4\b/g, "0.25")
       .replace(/\bhalf\b/g, "0.5").replace(/\bquarter\b/g, "0.25");
  return s.replace(/\s+/g, " ").trim();
}

// ───────────────────────── segmentation ─────────────────────────

const LEADING_STRIP = new Set([
  "tablet", "capsule", "syrup", "syp", "injection", "inj", "prescribe", "give", "start", "add", "take",
  "and", "then", "next", "also", "plus", "please", "another", "second", "medicine", "drug", "|", ",",
]);

const KEYWORDS = new Set([
  "once", "twice", "thrice", "daily", "morning", "afternoon", "evening", "night", "after", "before",
  "with", "without", "for", "every", "sos", "prn", "tablet", "capsule", "drop", "puff", "bd", "bid",
  "od", "tds", "tid", "qid", "qds", "hs", "at", "in", "on", "avoid", "do", "dont", "don't", "not",
  "if", "only", "empty", "bedtime", "x", "take", "per", "each", "a", "the", "half", "when", "as",
  "continue", "till", "until", "mg", "mcg", "g", "ml", "iu", "weekly", "monthly", "alternate",
]);

function startsNewMedicine(chunk: string): boolean {
  const first = chunk.trim().split(" ")[0] || "";
  if (!first || /^[\d.]/.test(first)) return false;
  return !KEYWORDS.has(first) && !LEADING_STRIP.has(first);
}

export function splitSegments(norm: string): string[] {
  let s = norm
    .replace(/(\bfor \d+(?:\.\d+)? (?:days?|weeks?|months?)\b)/g, "$1 |")
    .replace(/\b(?:and then|then|next|also)\b/g, " | ");
  const hard = s.split("|").map(x => x.trim()).filter(Boolean);
  const segs: string[] = [];
  for (const piece of hard) {
    // split on commas / "and" only where a new medicine name begins
    const parts = piece.split(/\s,\s|\s,|,\s|\sand\s/)
      .map(x => x.trim().replace(/^(?:(?:and|then|next|also|plus|please|another)\s+)+/, ""))
      .filter(Boolean);
    let cur = "";
    for (const p of parts) {
      if (!cur) { cur = p; continue; }
      if (startsNewMedicine(p)) { segs.push(cur); cur = p; } else { cur += " " + p; }
    }
    if (cur) segs.push(cur);
  }
  // a chunk that starts like an instruction (e.g. "after food") belongs to the previous medicine
  const merged: string[] = [];
  for (const seg of segs) {
    if (merged.length && !startsNewMedicine(seg) && !/^\d/.test(seg.split(" ")[0] || "x")) merged[merged.length - 1] += " " + seg;
    else if (merged.length && /^\d/.test(seg)) merged[merged.length - 1] += " " + seg;
    else merged.push(seg);
  }
  return merged;
}

// ───────────────────────── single medicine parsing ─────────────────────────

const ALIASES: Record<string, string> = {
  pcm: "paracetamol", para: "paracetamol", paracet: "paracetamol", paracetamole: "paracetamol",
  panto: "pantoprazole", pantop: "pantoprazole", pantaprazole: "pantoprazole", pentoprazole: "pantoprazole",
  amox: "amoxicillin", azithro: "azithromycin", cipro: "ciprofloxacin", metro: "metronidazole",
  diclo: "diclofenac", ibu: "ibuprofen", cetrizine: "cetirizine", cetirizin: "cetirizine", cetrizin: "cetirizine",
};

let idCounter = 0;
const newId = () => `vm${Date.now().toString(36)}${idCounter++}`;

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function defaultTimes(freq: number): string[] {
  if (freq === 2) return ["Morning", "Evening"];
  if (freq === 3) return ["Morning", "Afternoon", "Evening"];
  if (freq >= 4) return ["Morning", "Afternoon", "Evening", "Night"];
  return [];
}
const sortTimes = (t: string[]) => TIME_ORDER.filter(x => t.includes(x));

export function parseSegment(seg: string): VoiceMed | null {
  let tokens = seg.split(" ").filter(Boolean);
  while (tokens.length && LEADING_STRIP.has(tokens[0])) tokens.shift();
  const nameTokens: string[] = [];
  while (tokens.length && !/^[\d.]/.test(tokens[0]) && !KEYWORDS.has(tokens[0]) && nameTokens.length < 4) {
    nameTokens.push(tokens.shift()!);
  }
  if (!nameTokens.length || nameTokens.join("").replace(/[^a-z]/g, "").length < 2) return null;

  let rest = " " + tokens.join(" ") + " ";
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(rest);
    if (m) rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
    return m;
  };

  // frequency written as 1-0-1 (morning-afternoon-night)
  let times: string[] = [];
  let freq: number | null = null;
  const pat = /\s([0-3])[\s-]+([0-3])[\s-]+([0-3])\s/.exec(rest);
  if (pat && (/-/.test(pat[0]) || pat.slice(1, 4).includes("0"))) {
    rest = rest.slice(0, pat.index) + " " + rest.slice(pat.index + pat[0].length);
    if (+pat[1] > 0) times.push("Morning");
    if (+pat[2] > 0) times.push("Afternoon");
    if (+pat[3] > 0) times.push("Night");
  }

  // duration
  let durationAmount = "", durationUnit: "day" | "week" = "day";
  const du = take(/\s(?:for|x|upto|up to|till|continue for)?\s*(\d+(?:\.\d+)?) (days?|weeks?|months?)\s/);
  if (du) {
    const n = parseFloat(du[1]);
    if (/^month/.test(du[2])) { durationAmount = String(Math.round(n * 30)); }
    else { durationAmount = String(n); durationUnit = /^week/.test(du[2]) ? "week" : "day"; }
  }

  // unusual schedules must never be read as "daily"
  let unusualFreq = "";
  const un = take(/\s(weekly|monthly|per week|a week|every week|once a month|alternate days?|every other day|every \d+ days?)\s/);
  if (un) unusualFreq = un[1].trim();

  // every N hours
  let everyHours: number | null = null;
  const eh = take(/\severy (\d+) (?:hours?|hrs?|h)\s/);
  if (eh) everyHours = parseInt(eh[1], 10);

  // PRN
  let prn = false;
  if (take(/\s(?:sos|s o s|prn|if needed|as needed|when needed|if required|when required|as required)\s/)) prn = true;

  // night-time phrases before the food check (so "before sleeping" is not "before food")
  const night = take(/\s(?:at night|night time|nighttime|night|bedtime|bed time|before sleep(?:ing)?|hs)\s/);

  // food
  let food: VoiceMed["food"] = "";
  let extraParts: string[] = [];
  if (take(/\s(?:after|post)\s+(?:food|meals?|eating|breakfast|lunch|dinner|having food)\s/)) food = "After food";
  if (take(/\s(?:before|pre)\s+(?:food|meals?|eating|breakfast|lunch|dinner)\s|\sempty stomach\s/)) {
    food = food ? food : "Before food";
  }
  if (take(/\swith\s+(?:food|meals?)\s/)) extraParts.push("With food");

  // times of day
  if (take(/\s(?:in the |every |at )?morning\s/)) times.push("Morning");
  if (take(/\s(?:in the |every |at )?afternoon\s/)) times.push("Afternoon");
  if (take(/\s(?:in the |every |at )?evening\s/)) times.push("Evening");
  if (night) times.push("Night");

  // times per day
  const nt = take(/\s(\d+)\s*(?:times?|x)(?:\s*(?:a|per|in a|each)\s*day|\s*daily)?\s/);
  if (nt) freq = parseInt(nt[1], 10);
  else if (take(/\s(?:thrice|tds|tid|t d s)\s/)) freq = 3;
  else if (take(/\s(?:twice|bd|bid|b d)\s(?:a day|daily|per day)?\s*/)) freq = 2;
  else if (take(/\s(?:qid|qds)\s/)) freq = 4;
  else if (take(/\s(?:once|od|qd)\s(?:a day|daily|per day|in a day)?\s*/)) freq = 1;
  else if (take(/\s(?:daily|every day|a day|per day)\s/)) freq = 1;

  // strength (explicit unit)
  let strengthAmount = "", strengthUnit = "mg", strengthAssumed = false;
  const st = take(/\s(\d+(?:\.\d+)?) (mg|mcg|g|iu|units?)\s/);
  if (st) { strengthAmount = st[1]; strengthUnit = st[2].startsWith("unit") ? "unit" : st[2]; }

  // dose per intake
  let qty = "", qtyUnit = "tablet";
  const dq = take(/\s(\d+(?:\.\d+)?) (tablet|capsule|ml|drop|puff)\s/);
  if (dq) { qty = dq[1]; qtyUnit = dq[2]; }
  else {
    const bare = /\s(tablet|capsule)\s/.exec(rest); // "tablet" without a number -> nothing to read
    if (bare) rest = rest.replace(bare[0], " ");
  }

  // a bare number right after the name is the strength (mg assumed) — never guessed further
  if (!strengthAmount) {
    const bn = take(/\s(\d+(?:\.\d+)?)\s/);
    if (bn) { strengthAmount = bn[1]; strengthUnit = "mg"; strengthAssumed = true; }
  }

  // whatever is left over is kept as an additional instruction the doctor can see
  const FILLER = new Set(["a", "an", "the", "and", "in", "at", "on", "of", "per", "for", "to", "it", "is", "x",
    "tablet", "capsule", "daily", "day", "days", "times", "time", "once", "twice", "mg", "mcg", "g", "ml", "iu",
    "each", "every", "take", "give", "|", ",", "-", "morning", "afternoon", "evening", "night", "dose"]);
  const leftover = rest.split(" ").filter(t => t && !FILLER.has(t) && !/^[\d.]+$/.test(t));
  if (leftover.length) extraParts.push(leftover.join(" "));

  // "once a week", "alternate days" ...: never guess a daily schedule, the doctor must set it
  if (unusualFreq) { freq = null; times = []; prn = false; everyHours = null; }

  times = sortTimes(Array.from(new Set(times)));
  if (freq && !times.length) times = defaultTimes(freq);
  if (!freq && times.length) freq = times.length;

  const spoken = nameTokens.join(" ");
  const key = nameTokens.length === 1 ? nameTokens[0] : spoken;
  return {
    id: newId(),
    spoken: cap(spoken),
    searchTerm: ALIASES[key] ?? spoken,
    name: "", nameState: "unknown", candidates: [],
    strengthAmount, strengthUnit, strengthAssumed,
    qty, qtyUnit,
    freq, times, prn, everyHours, unusualFreq,
    food,
    extra: cap(extraParts.join(", ")),
    durationAmount, durationUnit,
  };
}

export function parseTranscript(raw: string): VoiceMed[] {
  const norm = normalise(raw);
  if (!norm) return [];
  return splitSegments(norm).map(parseSegment).filter((m): m is VoiceMed => !!m);
}

// ───────────────────────── medicine database matching ─────────────────────────

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const baseKey = (name: string) =>
  letters(name.split(/\d/)[0].replace(/\b(tablets?|capsules?|syrup|ip|bp|usp)\b/gi, ""));
const numbersIn = (s: string) => (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export type MedicineSearch = (q: string) => Promise<string[]>;

export async function resolveMed(m: VoiceMed, search: MedicineSearch): Promise<VoiceMed> {
  const term = m.searchTerm;
  const key = letters(term);
  const strength = m.strengthAmount ? parseFloat(m.strengthAmount) : null;
  let results: string[] = [];
  try {
    results = await search(term);
    if (!results.length && term !== m.spoken.toLowerCase()) results = await search(m.spoken);
    let fuzzy = false;
    if (!results.length && key.length >= 4) {
      const pool = await search(key.slice(0, 3));
      results = pool
        .filter(n => editDistance(baseKey(n), key) <= Math.max(2, Math.floor(key.length / 4)))
        .slice(0, 6);
      fuzzy = results.length > 0;
    }
    if (!results.length) return { ...m, name: "", nameState: "unknown", candidates: [] };

    let pool = results;
    if (strength !== null) {
      const narrowed = results.filter(n => numbersIn(n).includes(strength));
      if (narrowed.length) pool = narrowed;
    }
    const exact = pool.filter(n => letters(n) === key || baseKey(n) === key);
    if (!fuzzy && exact.length === 1) return { ...m, name: exact[0], nameState: "matched", candidates: [] };
    if (!fuzzy && pool.length === 1 && letters(pool[0]).startsWith(key)) {
      return { ...m, name: pool[0], nameState: "matched", candidates: [] };
    }
    return { ...m, name: "", nameState: "ambiguous", candidates: (exact.length > 1 ? exact : pool).slice(0, 6) };
  } catch {
    return { ...m, name: "", nameState: "unknown", candidates: [] };
  }
}

// ───────────────────────── review helpers ─────────────────────────

const plural = (unit: string, amount: string) => (parseFloat(amount) === 1 ? unit : `${unit}s`);
const strengthText = (m: VoiceMed) =>
  m.strengthAmount ? `${m.strengthAmount} ${m.strengthUnit === "unit" ? "units" : m.strengthUnit}` : "";

/** Medicine title shown in review and saved as the item name. */
export function displayName(m: VoiceMed): string {
  if (!m.name) return m.spoken;
  const hasStrength = m.strengthAmount && numbersIn(m.name).includes(parseFloat(m.strengthAmount));
  // when a tablet/capsule count is saved in `dosage`, the strength has to live in the name
  if (m.strengthAmount && !hasStrength && m.qty && numbersIn(m.name).length === 0) return `${m.name} ${strengthText(m)}`;
  return m.name;
}

export function frequencyLabel(m: VoiceMed): string {
  if (m.prn) return "SOS";
  if (m.everyHours) return `every ${m.everyHours} h`;
  if (m.times.length) return m.freq && m.freq !== m.times.length ? `${m.freq} daily · ${m.times.join("/")}` : m.times.join(" + ");
  if (m.freq) return m.freq === 1 ? "once daily" : `${m.freq} daily`;
  return "";
}

export function durationText(m: VoiceMed): string {
  return m.durationAmount ? `${m.durationAmount} ${plural(m.durationUnit, m.durationAmount)}` : "";
}

export function summaryLine(m: VoiceMed): string {
  const dose = m.qty ? `${m.qty} ${plural(m.qtyUnit, m.qty)}` : "";
  return [dose, frequencyLabel(m), durationText(m)].filter(Boolean).join(" × ");
}

/** Problems that must be fixed by the doctor before the prescription can be confirmed. */
export function blockingIssues(m: VoiceMed): string[] {
  const issues: string[] = [];
  if (!m.name.trim()) issues.push("Choose the medicine");
  if (m.unusualFreq) issues.push(`Check frequency (“${m.unusualFreq}”)`);
  else if (!m.prn && !m.everyHours && !m.freq && !m.times.length) issues.push("Set how often");
  if (!m.prn && !m.durationAmount) issues.push("Set duration");
  if (m.name && m.strengthAmount) {
    const nums = numbersIn(m.name);
    if (nums.length && !nums.includes(parseFloat(m.strengthAmount))) issues.push(`Strength ${m.strengthAmount} differs from “${m.name}”`);
  }
  return issues;
}

export function softWarnings(m: VoiceMed): string[] {
  const w: string[] = [];
  if (m.strengthAssumed && m.strengthAmount) w.push(`${m.strengthAmount} ${m.strengthUnit} assumed`);
  if (!m.qty) w.push("Dose per intake not stated");
  return w;
}

/** Final item in the same shape the manual form saves. */
export function toPrescriptionItem(m: VoiceMed): { name: string; dosage: string; duration: string; instructions: string } {
  const dosage = m.qty ? `${m.qty} ${plural(m.qtyUnit, m.qty)}` : strengthText(m).replace(" ", "");
  const parts: string[] = [];
  if (m.prn) parts.push("SOS (if needed)");
  else if (m.everyHours) parts.push(`Every ${m.everyHours} hours`);
  else if (!m.times.length && m.freq === 1) parts.push("Once daily");
  parts.push(...sortTimes(m.times));
  if (m.food) parts.push(m.food);
  if (m.extra.trim()) parts.push(m.extra.trim());
  return { name: displayName(m), dosage, duration: durationText(m), instructions: parts.join(", ") };
}
