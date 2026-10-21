import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/api";
import { getSymptomsForSpecialty } from "@/data/doctorSymptoms";
import { PRESET_API, fetchPresets, splitAmountUnit, type Preset } from "@/components/PresetSuggestions";
import { FORM_CONFIG, getFormConfig, detectFormFromText } from "@/lib/medicineTypes";

const DOSAGE_UNITS = ["mg", "g", "ml", "mcg", "tablet", "capsule", "drop", "puff"];
const DURATION_UNITS = ["day", "week"];
const NO_SPACE = new Set(["mg", "g", "ml", "mcg"]);
const TIMES = ["Morning", "Afternoon", "Evening"];
const FOODS = ["After food", "Before food"];

// Dropdown shows only mg / g / ml. An old preset that still has tablet / drop / puff keeps its value so nothing is silently changed.
const STD_UNITS = ["mg", "g", "ml"];
function withForm(m: FormMed, form: string): Partial<FormMed> {
  const cfg = getFormConfig(form);
  const keep = (cfg.allowedUnits as string[]).includes(m.dUnit);
  return { form, dUnit: keep ? m.dUnit : cfg.defaultUnit, dAmt: keep ? m.dAmt : "" };
}
function unitOptions(form: string, current: string): string[] {
  const base = getFormConfig(form).allowedUnits as string[];
  return base.includes(current) ? base : [...base, current];
}

interface FormMed {
  name: string; form: string; dAmt: string; dUnit: string; uAmt: string; uUnit: string; times: string[]; food: string;
}
const emptyMed = (): FormMed => ({ name: "", form: "tablet", dAmt: "", dUnit: "mg", uAmt: "", uUnit: "day", times: [], food: "" });

const plural = (u: string, a: string) => (parseFloat(a) === 1 ? u : `${u}s`);
const fmtDose = (a: string, u: string) => !a.trim() ? "" : NO_SPACE.has(u) ? `${a}${u}` : `${a} ${plural(u, a)}`;
const fmtDur = (a: string, u: string) => !a.trim() ? "" : `${a} ${plural(u, a)}`;

function fromPreset(p: Preset) {
  return p.items.map<FormMed>(i => {
    const d = splitAmountUnit(i.dosage, "mg", DOSAGE_UNITS);
    const u = splitAmountUnit(i.duration, "day", DURATION_UNITS);
    const parts = i.instructions.split(",").map(x => x.trim());
    return {
      name: i.name, dAmt: d.amount, dUnit: d.unit,
      form: i.form || detectFormFromText(i.name) || (d.unit === "ml" ? "syrup" : d.unit === "drop" ? "drops" : d.unit === "puff" ? "spray" : "tablet"), uAmt: u.amount, uUnit: u.unit,
      times: TIMES.filter(t => parts.includes(t)), food: FOODS.find(f => parts.includes(f)) || "",
    };
  });
}

async function call(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function PrescriptionPresetsManager({ doctor }: { doctor?: { specialty?: string } | null }) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [meds, setMeds] = useState<FormMed[]>([emptyMed()]);
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; inStock: boolean }[]>([]);
  const [activeMedIdx, setActiveMedIdx] = useState<number | null>(null);
  function applyMedName(i: number, n: string) {
    const fm = detectFormFromText(n);
    const cur = meds[i];
    setMed(i, fm && cur && fm !== cur.form ? { name: n, ...withForm(cur, fm) } : { name: n });
  }
  async function searchMedicines(i: number, q: string) {
    applyMedName(i, q);
    setActiveMedIdx(i);
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/pharmacy/medicines?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data.filter((m: any) => m && m.name).map((m: any) => ({ name: m.name, inStock: m.in_stock === true })) : []);
    } catch { setSuggestions([]); }
  }
  function pickSuggestion(i: number, name: string) {
    applyMedName(i, name);
    setSuggestions([]);
    setActiveMedIdx(null);
  }

  const symptomList = getSymptomsForSpecialty(doctor?.specialty || "")?.symptoms ?? [];

  const reload = () => fetchPresets().then(setPresets).catch(() => {});
  useEffect(() => { reload(); }, []);

  function startNew() {
    setEditing("new"); setName(""); setSymptoms([]); setMeds([emptyMed()]); setMinAge(""); setMaxAge("");
  }
  function startEdit(p: Preset) {
    setEditing(p.id); setName(p.name); setSymptoms(p.symptoms); setMeds(fromPreset(p));
    setMinAge(p.minAge != null ? String(p.minAge) : ""); setMaxAge(p.maxAge != null ? String(p.maxAge) : "");
  }
  const setMed = (i: number, patch: Partial<FormMed>) =>
    setMeds(prev => prev.map((m, idx) => idx === i ? { ...m, ...patch } : m));

  async function save() {
    const items = meds.filter(m => m.name.trim()).map(m => ({
      name: m.name.trim(),
      form: m.form,
      dosage: fmtDose(m.dAmt, m.dUnit),
      duration: fmtDur(m.uAmt, m.uUnit),
      instructions: [...TIMES.filter(t => m.times.includes(t)), m.food].filter(Boolean).join(", "),
    }));
    if (!name.trim() || !symptoms.length || !items.length) {
      toast.error("Add a name, at least one symptom and one medicine");
      return;
    }
    setSaving(true);
    try {
      const body = { name, symptoms, items, minAge: minAge || null, maxAge: maxAge || null };
      if (editing === "new") await call("POST", PRESET_API, body);
      else await call("PATCH", `${PRESET_API}/${editing}`, body);
      toast.success("Preset saved");
      setEditing(null);
      reload();
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  }

  async function remove(p: Preset) {
    if (!window.confirm(`Delete preset "${p.name}"?`)) return;
    try { await call("DELETE", `${PRESET_API}/${p.id}`); reload(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Prescription Presets</h2>
        <p className="text-sm text-gray-500">Add your usual medicines for common symptoms whenever you are free. They appear as one-tap suggestions in Write Prescription when a patient's symptoms match.</p>
      </div>

          {editing === null ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Save your usual medicines for common symptoms. They appear as one-tap suggestions when a patient books with those symptoms. You always review before saving.
              </p>
              {presets.map(p => (
                <div key={p.id} className="flex items-start justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.symptoms.join(", ")}</p>
                    <p className="text-xs text-gray-400">{p.items.map(i => i.name).join(" · ")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(p)} className="text-gray-400 hover:text-gray-700"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(p)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              {!presets.length && <p className="py-4 text-center text-sm text-gray-400">No presets yet</p>}
              <Button className="w-full" onClick={startNew}><Plus className="mr-1 h-4 w-4" /> New preset</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-500">Preset name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Adult viral fever" />
              </div>

              <div>
                <Label className="text-xs text-gray-500">Use when the patient reports</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {symptomList.map(s => {
                    const on = symptoms.includes(s);
                    return (
                      <button key={s}
                        onClick={() => setSymptoms(prev => on ? prev.filter(x => x !== s) : [...prev, s])}
                        className={`rounded-full border px-3 py-1 text-xs ${on ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-700"}`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs text-gray-500">Min age (optional)</Label>
                  <Input type="number" min="0" value={minAge} onChange={e => setMinAge(e.target.value)} /></div>
                <div><Label className="text-xs text-gray-500">Max age (optional)</Label>
                  <Input type="number" min="0" value={maxAge} onChange={e => setMaxAge(e.target.value)} /></div>
              </div>

              {meds.map((m, i) => (
                <div key={i} className="space-y-2 rounded-xl border bg-gray-50 p-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input value={m.name} onChange={e => searchMedicines(i, e.target.value)} onFocus={() => setActiveMedIdx(i)} placeholder="Medicine name" />
                      {activeMedIdx === i && suggestions.length > 0 && (
                        <div className="absolute z-10 bg-white border rounded-lg shadow-lg mt-1 w-full max-h-60 overflow-y-auto">
                          {suggestions.map(s => (
                            <button type="button" key={s.name} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2" onClick={() => pickSuggestion(i, s.name)}>
                              <span>{s.name}</span>
                              {s.inStock && <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">In Stock</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {meds.length > 1 && (
                      <button onClick={() => setMeds(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex gap-1">
                      <Input type="number" min="0" step="any" placeholder="Dose" value={m.dAmt} onChange={e => setMed(i, { dAmt: e.target.value })} />
                      <select value={m.dUnit} onChange={e => setMed(i, { dUnit: e.target.value })} className="rounded-md border bg-white px-1 text-sm">
                        {unitOptions(m.form, m.dUnit).map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-1">
                      <Input type="number" min="0" placeholder="For" value={m.uAmt} onChange={e => setMed(i, { uAmt: e.target.value })} />
                      <select value={m.uUnit} onChange={e => setMed(i, { uUnit: e.target.value })} className="rounded-md border bg-white px-1 text-sm">
                        {DURATION_UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <select value={m.form} onChange={e => setMed(i, withForm(m, e.target.value))} className="w-full rounded-md border bg-white px-2 py-1.5 text-sm">
                    {FORM_CONFIG.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {TIMES.map(t => (
                      <label key={t} className="flex items-center gap-1.5">
                        <input type="checkbox" className="accent-blue-600" checked={m.times.includes(t)}
                          onChange={() => setMed(i, { times: m.times.includes(t) ? m.times.filter(x => x !== t) : [...m.times, t] })} />{t}
                      </label>
                    ))}
                    {FOODS.map(f => (
                      <label key={f} className="flex items-center gap-1.5">
                        <input type="checkbox" className="accent-blue-600" checked={m.food === f}
                          onChange={() => setMed(i, { food: m.food === f ? "" : f })} />{f}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setMeds(prev => [...prev, emptyMed()])}>
                <Plus className="mr-1 h-4 w-4" /> Add medicine
              </Button>

              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                <Button className="flex-1 bg-blue-600 text-white hover:bg-blue-700" onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save preset"}
                </Button>
              </div>
            </div>
          )}
    </div>
  );
}