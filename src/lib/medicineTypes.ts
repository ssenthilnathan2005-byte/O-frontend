// Single source of truth for medicine type -> dosage unit -> packaging.
// Used by the manual form, voice prescription, presets and pharmacy dispensing.

export type MedForm = "tablet" | "syrup" | "drops" | "injection" | "ointment" | "spray" | "other";
export type DoseUnit = "mg" | "ml" | "g";

export interface FormConfig {
  value: MedForm;
  label: string;
  unit: string;              // packaging unit shown / saved with the dispense quantity
  defaultUnit: DoseUnit;     // dosage unit picked automatically for this type
  allowedUnits: DoseUnit[];  // only mg / ml / g are ever allowed
  autoQuantity: boolean;     // true only for tablets (dose x times x days)
}

export const FORM_CONFIG: FormConfig[] = [
  { value: "tablet",    label: "Tablet / Capsule", unit: "tablets",    defaultUnit: "mg", allowedUnits: ["mg", "g"],       autoQuantity: true },
  { value: "syrup",     label: "Syrup / Tonic",    unit: "bottle(s)",  defaultUnit: "ml", allowedUnits: ["ml"],            autoQuantity: false },
  { value: "drops",     label: "Drops",            unit: "bottle(s)",  defaultUnit: "ml", allowedUnits: ["ml"],            autoQuantity: false },
  { value: "injection", label: "Injection",        unit: "vial(s)",    defaultUnit: "ml", allowedUnits: ["ml", "mg"],      autoQuantity: false },
  { value: "ointment",  label: "Ointment / Cream", unit: "tube(s)",    defaultUnit: "g",  allowedUnits: ["g"],             autoQuantity: false },
  { value: "spray",     label: "Spray / Inhaler",  unit: "inhaler(s)", defaultUnit: "ml", allowedUnits: ["ml", "mg"],      autoQuantity: false },
  { value: "other",     label: "Other",            unit: "unit(s)",    defaultUnit: "mg", allowedUnits: ["mg", "ml", "g"], autoQuantity: false },
];

export function getFormConfig(form: string | undefined): FormConfig {
  return FORM_CONFIG.find(f => f.value === form) ?? FORM_CONFIG[0];
}

export function coerceUnit(form: string | undefined, unit: string): DoseUnit {
  const cfg = getFormConfig(form);
  return (cfg.allowedUnits as string[]).includes(unit) ? (unit as DoseUnit) : cfg.defaultUnit;
}

/** Medicine type implied by a name or spoken phrase, or null if nothing is recognised. */
export function detectFormFromText(text: string): MedForm | null {
  const t = " " + (text || "").toLowerCase() + " ";
  if (/\b(ointment|cream|gel|lotion)\b/.test(t)) return "ointment";
  if (/\bdrops?\b/.test(t)) return "drops";
  if (/\b(spray|inhaler|inhalation|rotacap)\b/.test(t)) return "spray";
  if (/\b(injection|inj|vial|ampoule|insulin)\b/.test(t)) return "injection";
  if (/\b(syrup|syp|tonic|suspension|solution|linctus|mixture|liquid|elixir)\b/.test(t)) return "syrup";
  if (/\b(tablets?|tabs?|capsules?|caps)\b/.test(t)) return "tablet";
  return null;
}

/** Per-dose unit used by the voice screen for each type (tablet count, ml, drops, puffs). */
export function voiceDoseUnit(form: MedForm, current: string): string {
  switch (form) {
    case "tablet": return current === "capsule" ? "capsule" : "tablet";
    case "syrup":
    case "injection":
    case "drops":
    case "spray": return "ml";
    case "ointment": return "g";
    
    
    default: return current;
  }
}

/** Fixes old / preset medicines that still carry tablet, capsule, drop, puff or mcg as a dosage unit. */
export function normalizeLegacyMedicine<T extends { name: string; form?: string; dosageAmount: string; dosageUnit: string; perDose?: string }>(m: T): T {
  let amount = m.dosageAmount;
  let unit = m.dosageUnit;
  let perDose = m.perDose;
  let form: string | undefined = m.form;
  if (unit === "tablet" || unit === "capsule") { form = form || "tablet"; perDose = amount || perDose || "1"; amount = ""; unit = "mg"; }
  else if (unit === "drop") { form = form || "drops"; amount = ""; unit = "ml"; }
  else if (unit === "puff") { form = form || "spray"; amount = ""; unit = "ml"; }
  else if (unit === "mcg") { const n = parseFloat(amount); amount = isNaN(n) ? "" : String(n / 1000); unit = "mg"; }
  form = form || detectFormFromText(m.name) || (unit === "ml" ? "syrup" : "tablet");
  if (!amount && form === "tablet") { const s = /(\d+(?:\.\d+)?)\s*mg/i.exec(m.name); if (s) { amount = s[1]; unit = "mg"; } }
  return { ...m, form, dosageAmount: amount, dosageUnit: coerceUnit(form, unit), perDose: perDose ?? "1" };
}