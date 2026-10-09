import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/api";
import { getSymptomsForSpecialty } from "@/data/doctorSymptoms";
import { PRESET_API, fetchPresets, splitAmountUnit, type Preset } from "@/components/PresetSuggestions";

const DOSAGE_UNITS = ["mg", "g", "ml", "mcg", "tablet", "capsule", "drop", "puff"];
const DURATION_UNITS = ["day", "week"];
const NO_SPACE = new Set(["mg", "g", "ml", "mcg"]);
const TIMES = ["Morning", "Afternoon", "Evening"];
const FOODS = ["After food", "Before food"];

interface FormMed {
  name: string; dAmt: string; dUnit: string; uAmt: string; uUnit: string; times: string[]; food: string;
}
const emptyMed = (): FormMed => ({ name: "", dAmt: "", dUnit: "mg", uAmt: "", uUnit: "day", times: [], food: "" });

const plural = (u: string, a: string) => (parseFloat(a) === 1 ? u : `${u}s`);
const fmtDose = (a: string, u: string) => !a.trim() ? "" : NO_SPACE.has(u) ? `${a}${u}` : `${a} ${plural(u, a)}`;
const fmtDur = (a: string, u: string) => !a.trim() ? "" : `${a} ${plural(u, a)}`;

function fromPreset(p: Preset) {
  return p.items.map<FormMed>(i => {
    const d = splitAmountUnit(i.dosage, "mg", DOSAGE_UNITS);
    const u = splitAmountUnit(i.duration, "day", DURATION_UNITS);
    const parts = i.instructions.split(",").map(x => x.trim());
    return {
      name: i.name, dAmt: d.amount, dUnit: d.unit, uAmt: u.amount, uUnit: u.unit,
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
                    <Input value={m.name} onChange={e => setMed(i, { name: e.target.value })} placeholder="Medicine name" />
                    {meds.length > 1 && (
                      <button onClick={() => setMeds(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex gap-1">
                      <Input type="number" min="0" step="any" placeholder="Dose" value={m.dAmt} onChange={e => setMed(i, { dAmt: e.target.value })} />
                      <select value={m.dUnit} onChange={e => setMed(i, { dUnit: e.target.value })} className="rounded-md border bg-white px-1 text-sm">
                        {DOSAGE_UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-1">
                      <Input type="number" min="0" placeholder="For" value={m.uAmt} onChange={e => setMed(i, { uAmt: e.target.value })} />
                      <select value={m.uUnit} onChange={e => setMed(i, { uUnit: e.target.value })} className="rounded-md border bg-white px-1 text-sm">
                        {DURATION_UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
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