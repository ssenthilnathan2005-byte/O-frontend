import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getToken } from "@/api";

export const PRESET_API = `${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/prescription-presets`;

export interface PresetItem { name: string; dosage: string; duration: string; instructions: string }
export interface Preset {
  id: string; name: string; symptoms: string[]; items: PresetItem[];
  minAge: number | null; maxAge: number | null;
}

export async function fetchPresets(): Promise<Preset[]> {
  const res = await fetch(PRESET_API, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) return [];
  return res.json();
}

const DOSAGE_UNITS = ["mg", "g", "ml", "mcg", "tablet", "capsule", "drop", "puff"];
const DURATION_UNITS = ["day", "week"];

export function splitAmountUnit(s: string, fallback: string, units: string[]) {
  const m = (s || "").trim().match(/^([\d.]+)\s*([a-zA-Z]*)$/);
  if (!m) return { amount: "", unit: fallback };
  let u = m[2].toLowerCase();
  if (!units.includes(u) && u.endsWith("s")) u = u.slice(0, -1);
  return { amount: m[1], unit: units.includes(u) ? u : fallback };
}

// Converts a saved preset item into the shape PrescriptionDialog's manual form uses
export function presetItemToMedicine(i: PresetItem) {
  const d = splitAmountUnit(i.dosage, "mg", DOSAGE_UNITS);
  const u = splitAmountUnit(i.duration, "day", DURATION_UNITS);
  return {
    name: i.name, dosage: i.dosage, duration: i.duration, instructions: i.instructions,
    dosageAmount: d.amount, dosageUnit: d.unit, durationAmount: u.amount, durationUnit: u.unit,
  };
}

interface Props {
  complaint?: string;
  age?: number;
  onApply: (items: PresetItem[]) => void;
}

export default function PresetSuggestions({ complaint, age, onApply }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    fetchPresets().then(setPresets).catch(() => setPresets([])).finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  if (!presets.length) {
    return (
      <p className="text-[11px] text-gray-400">
        No presets yet. Add them in the Presets tab of your dashboard to get one-tap suggestions here.
      </p>
    );
  }

  const text = (complaint || "").toLowerCase();
  const matches = presets.filter(p => {
    if (age != null && p.minAge != null && age < p.minAge) return false;
    if (age != null && p.maxAge != null && age > p.maxAge) return false;
    return p.symptoms.some(s => text.includes(s.toLowerCase()));
  });
  const shown = showAll ? presets : matches;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-blue-800">
        <Sparkles className="h-3.5 w-3.5" />
        {showAll ? "All your presets" : matches.length ? "Your presets for this patient's symptoms" : "No preset matches this patient's symptoms"}
      </p>
      <div className="flex flex-wrap gap-2">
        {shown.map(p => (
          <button
            key={p.id}
            onClick={() => onApply(p.items)}
            className="rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            {p.name} ? {p.items.length} med{p.items.length > 1 ? "s" : ""}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">Tap to fill the prescription. You can review and edit before saving.</p>
        {(matches.length < presets.length || showAll) && (
          <button onClick={() => setShowAll(v => !v)} className="shrink-0 text-[11px] font-medium text-blue-700 underline">
            {showAll ? "Show matching only" : `Browse all my presets (${presets.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
