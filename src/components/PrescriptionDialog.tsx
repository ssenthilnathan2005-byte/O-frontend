import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pill, Send, Pencil, Check, Mic } from "lucide-react";
import { getToken } from "@/api";
import { toast } from "sonner";
import VoicePrescription, { type VoiceItem } from "@/components/VoicePrescription";
import PresetSuggestions, { presetItemToMedicine, type PresetItem } from "@/components/PresetSuggestions";

interface Medicine {
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
  dosageAmount: string;
  dosageUnit: string;
  durationAmount: string;
  durationUnit: string;
  form?: string;
  qtyOverride?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void; // called after prescription saved (or skipped)
  booking: {
    id: string;
    patientId?: string;
    patientName?: string;
    patientAge?: number;
    complaint?: string | null;
  } | null;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
}

const EMPTY_MED: Medicine = {
  name: "", dosage: "", duration: "", instructions: "",
  dosageAmount: "", dosageUnit: "mg", durationAmount: "", durationUnit: "day",
};

const TIME_OPTIONS = ["Morning", "Afternoon", "Evening"];
const FOOD_OPTIONS = ["After food", "Before food"];
const CUSTOM_PREFIX = "Custom: ";

const DOSAGE_UNITS = ["mg", "g", "ml", "mcg", "tablet", "capsule", "drop", "puff"];
const DURATION_UNITS = ["day", "week"];
const UNIT_NO_SPACE = new Set(["mg", "g", "ml", "mcg"]);

function pluralize(unit: string, amount: string): string {
  const n = parseFloat(amount);
  return n === 1 ? unit : `${unit}s`;
}

function formatDosage(amount: string, unit: string): string {
  if (!amount.trim()) return "";
  return UNIT_NO_SPACE.has(unit) ? `${amount}${unit}` : `${amount} ${pluralize(unit, amount)}`;
}

function formatDuration(amount: string, unit: string): string {
  if (!amount.trim()) return "";
  return `${amount} ${pluralize(unit, amount)}`;
}

function isMedFilled(m: Medicine) {
  return m.name.trim() && m.dosageAmount.trim() && m.durationAmount.trim();
}

type MedForm = "tablet" | "syrup" | "drops" | "injection" | "ointment" | "spray" | "other";
const FORM_OPTIONS: { value: MedForm; label: string; unit: string }[] = [
  { value: "tablet", label: "Tablet / Capsule", unit: "tablets" },
  { value: "syrup", label: "Syrup / Tonic", unit: "bottle(s)" },
  { value: "drops", label: "Drops", unit: "bottle(s)" },
  { value: "injection", label: "Injection", unit: "vial(s)" },
  { value: "ointment", label: "Ointment / Cream", unit: "tube(s)" },
  { value: "spray", label: "Spray / Inhaler", unit: "unit(s)" },
  { value: "other", label: "Other", unit: "unit(s)" },
];
function guessForm(m: Medicine): MedForm {
  if (m.form) return m.form as MedForm;
  if (m.dosageUnit === "ml") return "syrup";
  if (m.dosageUnit === "drop") return "drops";
  if (m.dosageUnit === "puff") return "spray";
  return "tablet";
}
function timesPerDay(m: Medicine): number {
  return ["Morning", "Afternoon", "Evening", "Night"].filter(t => (m.instructions || "").includes(t)).length || 1;
}
function totalDays(m: Medicine): number {
  const n = parseFloat(m.durationAmount) || 0;
  return (m.durationUnit === "week" ? n * 7 : n) || 1;
}
function autoQuantity(m: Medicine): number {
  if (guessForm(m) !== "tablet") return 1;
  const perDose = (m.dosageUnit === "tablet" || m.dosageUnit === "capsule") ? (parseFloat(m.dosageAmount) || 1) : 1;
  return Math.max(1, Math.ceil(perDose * timesPerDay(m) * totalDays(m)));
}
function finalQuantity(m: Medicine): number {
  const o = parseFloat(m.qtyOverride || "");
  return o > 0 ? Math.round(o) : autoQuantity(m);
}
function qtyHint(m: Medicine): string {
  if (guessForm(m) !== "tablet") return "Dosage is the amount per time. Dispensing quantity is separate: default 1, change if needed.";
  const perDose = (m.dosageUnit === "tablet" || m.dosageUnit === "capsule") ? (parseFloat(m.dosageAmount) || 1) : 1;
  return `Auto: ${perDose} per dose x ${timesPerDay(m)} times/day x ${totalDays(m)} days = ${autoQuantity(m)}. Type a number to override.`;
}

function getParts(instructions: string): string[] {
  return instructions.split(",").map(p => p.trim()).filter(Boolean);
}

function composeInstructions(parts: string[]): string {
  const times = TIME_OPTIONS.filter(t => parts.includes(t));
  const food = parts.find(p => FOOD_OPTIONS.includes(p) || p.startsWith(CUSTOM_PREFIX));
  return [...times, food].filter(Boolean).join(", ");
}

function getCustomText(instructions: string): string {
  const part = getParts(instructions).find(p => p.startsWith(CUSTOM_PREFIX));
  return part ? part.slice(CUSTOM_PREFIX.length) : "";
}

export default function PrescriptionDialog({
  open, onClose, onConfirm, booking, doctorId, doctorName, hospitalId, hospitalName
}: Props) {
  const [medicines, setMedicines] = useState<Medicine[]>([{ ...EMPTY_MED }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeMedIdx, setActiveMedIdx] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [otherOpen, setOtherOpen] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<"manual" | "voice">("voice");

  // always start in Speak mode when the dialog is opened again
  useEffect(() => { if (!open) setMode("voice"); }, [open]);

  function updateMed(idx: number, field: keyof Medicine, value: string) {
    setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  function updateDosageAmount(idx: number, amount: string) {
    setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, dosageAmount: amount, dosage: formatDosage(amount, m.dosageUnit) } : m));
  }

  function updateDosageUnit(idx: number, unit: string) {
    setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, dosageUnit: unit, dosage: formatDosage(m.dosageAmount, unit) } : m));
  }

  function updateDurationAmount(idx: number, amount: string) {
    setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, durationAmount: amount, duration: formatDuration(amount, m.durationUnit) } : m));
  }

  function updateDurationUnit(idx: number, unit: string) {
    setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, durationUnit: unit, duration: formatDuration(m.durationAmount, unit) } : m));
  }

  async function searchMedicines(idx: number, q: string) {
    updateMed(idx, "name", q);
    setActiveMedIdx(idx);
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/pharmacy/medicines?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setSuggestions(data.map((m: any) => m.name));
    } catch { setSuggestions([]); }
  }

  function pickSuggestion(idx: number, name: string) {
    updateMed(idx, "name", name);
    setSuggestions([]);
    setActiveMedIdx(null);
  }

  function toggleTime(idx: number, time: string) {
    const parts = getParts(medicines[idx].instructions);
    const has = parts.includes(time);
    const next = has ? parts.filter(p => p !== time) : [...parts, time];
    updateMed(idx, "instructions", composeInstructions(next));
  }

  function selectFood(idx: number, food: string) {
    const parts = getParts(medicines[idx].instructions);
    const cleaned = parts.filter(p => !FOOD_OPTIONS.includes(p) && !p.startsWith(CUSTOM_PREFIX));
    const had = parts.includes(food);
    const next = had ? cleaned : [...cleaned, food];
    updateMed(idx, "instructions", composeInstructions(next));
    setOtherOpen(prev => { const n = new Set(prev); n.delete(idx); return n; });
  }

  function toggleOther(idx: number) {
    const parts = getParts(medicines[idx].instructions);
    const hasCustom = parts.some(p => p.startsWith(CUSTOM_PREFIX));
    const isOpen = otherOpen.has(idx);
    if (hasCustom || isOpen) {
      // turn off: clear custom text and close the box
      const cleaned = parts.filter(p => !p.startsWith(CUSTOM_PREFIX));
      updateMed(idx, "instructions", composeInstructions(cleaned));
      setOtherOpen(prev => { const n = new Set(prev); n.delete(idx); return n; });
    } else {
      // turn on: clear any After/Before food selection, open the text box
      const cleaned = parts.filter(p => !FOOD_OPTIONS.includes(p));
      updateMed(idx, "instructions", composeInstructions(cleaned));
      setOtherOpen(prev => new Set(prev).add(idx));
    }
  }

  function updateCustomText(idx: number, text: string) {
    const parts = getParts(medicines[idx].instructions).filter(p => !p.startsWith(CUSTOM_PREFIX));
    const next = text.trim() ? [...parts, `${CUSTOM_PREFIX}${text}`] : parts;
    updateMed(idx, "instructions", composeInstructions(next));
  }

  function addMed() {
    setCollapsed(prev => {
      const next = new Set(prev);
      const lastIdx = medicines.length - 1;
      if (isMedFilled(medicines[lastIdx])) next.add(lastIdx);
      return next;
    });
    setMedicines(prev => [...prev, { ...EMPTY_MED }]);
  }

  function removeMed(idx: number) {
    setMedicines(prev => prev.filter((_, i) => i !== idx));
    const shift = (prev: Set<number>) => {
      const next = new Set<number>();
      prev.forEach(i => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1); });
      return next;
    };
    setCollapsed(shift);
    setOtherOpen(shift);
  }

  function toggleCollapsed(idx: number) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  // Fill the manual form from a preset: keeps medicines already entered, skips duplicates by name
  function applyPreset(items: PresetItem[]) {
    setMedicines(prev => {
      const existing = prev.filter(m => m.name.trim());
      const have = new Set(existing.map(m => m.name.trim().toLowerCase()));
      const added = items
        .filter(i => !have.has(i.name.trim().toLowerCase()))
        .map(presetItemToMedicine);
      const next = [...existing, ...added];
      return next.length ? next : [{ ...EMPTY_MED }];
    });
    setCollapsed(new Set());
    setOtherOpen(new Set());
    setMode("manual");
  }

  async function handleSave() {
    const validMeds = medicines
      .filter(m => m.name.trim())
      .map(m => ({
        name: m.name,
        dosage: formatDosage(m.dosageAmount, m.dosageUnit),
        duration: formatDuration(m.durationAmount, m.durationUnit),
        instructions: m.instructions,
        form: guessForm(m),
        quantity: finalQuantity(m),
        quantityUnit: FORM_OPTIONS.find(o => o.value === guessForm(m))?.unit ?? "units",
      }));
    await submitPrescription(validMeds);
  }

  // Shared by the manual form and voice mode. keepOpenOnError is used by voice so a failed
  // save never throws away the reviewed prescription.
  async function submitPrescription(validMeds: VoiceItem[], keepOpenOnError = false) {
    if (!booking?.id) { onConfirm(); return; }
    setSaving(true);
    let ok = false;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/prescriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          bookingId: booking.id,
          doctorId,
          doctorName,
          patientId: booking.patientId,
          patientName: booking.patientName ?? "Walk-in",
          hospitalId,
          hospitalName,
          items: validMeds,
          notes,
        }),
      });
      if (res.ok) {
        ok = true;
        toast.success("Prescription saved ✓");
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save prescription");
      }
    } catch {
      toast.error("Network error saving prescription");
    }
    setSaving(false);
    if (keepOpenOnError && !ok) return;
    setMedicines([{ ...EMPTY_MED }]);
    setNotes("");
    setCollapsed(new Set());
    setOtherOpen(new Set());
    setMode("voice");
    onConfirm();
  }

  function handleSkip() {
    setMedicines([{ ...EMPTY_MED }]);
    setNotes("");
    setCollapsed(new Set());
    setOtherOpen(new Set());
    setMode("voice");
    onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-screen max-sm:max-w-none max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-blue-600" />
            Write Prescription
          </DialogTitle>
          {booking && (
            <p className="text-sm text-gray-500">
              {booking.patientName ?? "Walk-in"}
              {booking.patientAge != null && ` · ${booking.patientAge} yrs`}
            </p>
          )}
        </DialogHeader>

        <div className="absolute top-4 right-12 z-10">
          {mode === "voice" ? (
            <button
              onClick={() => setMode("manual")}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="w-3.5 h-3.5" /> Manual
            </button>
          ) : (
            <button
              onClick={() => setMode("voice")}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-blue-300 bg-white text-xs font-medium text-blue-700 hover:bg-blue-50"
            >
              <Mic className="w-3.5 h-3.5" /> Speak
            </button>
          )}
        </div>

        <PresetSuggestions
          complaint={booking?.complaint ?? ""}
          age={booking?.patientAge}
          onApply={applyPreset}
        />

        {mode === "voice" && (
          <VoicePrescription
            saving={saving}
            notes={notes}
            onNotesChange={setNotes}
            onSkip={handleSkip}
            onConfirm={items => submitPrescription(items, true)}
          />
        )}

        {mode === "manual" && (<>
        <div className="space-y-4">
          {medicines.map((med, idx) => {
            const isCollapsed = collapsed.has(idx) && isMedFilled(med);
            const parts = getParts(med.instructions);
            const isOtherActive = otherOpen.has(idx) || parts.some(p => p.startsWith(CUSTOM_PREFIX));

            if (isCollapsed) {
              return (
                <div
                  key={idx}
                  className="border rounded-xl px-3 py-2 flex items-center justify-between bg-white cursor-pointer"
                  onClick={() => toggleCollapsed(idx)}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="font-medium">{med.name}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">{med.dosage} · {med.duration}</span>
                  </div>
                  <Pencil className="w-3.5 h-3.5 text-gray-400" />
                </div>
              );
            }

            return (
              <div key={idx} className="border rounded-xl p-3 space-y-3 bg-gray-50 relative">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">Medicine {idx + 1}</Badge>
                  <div className="flex items-center gap-2">
                    {isMedFilled(med) && (
                      <button onClick={() => toggleCollapsed(idx)} className="text-gray-400 hover:text-gray-600">
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {medicines.length > 1 && (
                      <button onClick={() => removeMed(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <Label className="text-xs text-gray-500">Medicine Name</Label>
                  <Input
                    placeholder="e.g. Paracetamol"
                    value={med.name}
                    onChange={e => searchMedicines(idx, e.target.value)}
                    onFocus={() => setActiveMedIdx(idx)}
                    autoFocus={idx === medicines.length - 1}
                  />
                  {activeMedIdx === idx && suggestions.length > 0 && (
                    <div className="absolute z-10 bg-white border rounded-lg shadow-lg mt-1 w-full">
                      {suggestions.map(s => (
                        <button
                          key={s}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                          onClick={() => pickSuggestion(idx, s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-500">Dosage</Label>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 500"
                        value={med.dosageAmount}
                        onChange={e => updateDosageAmount(idx, e.target.value)}
                        className="flex-1"
                      />
                      <select
                        value={med.dosageUnit}
                        onChange={e => updateDosageUnit(idx, e.target.value)}
                        className="border rounded-md text-sm px-2 bg-white shrink-0"
                      >
                        {DOSAGE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Duration</Label>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 5"
                        value={med.durationAmount}
                        onChange={e => updateDurationAmount(idx, e.target.value)}
                        className="flex-1"
                      />
                      <select
                        value={med.durationUnit}
                        onChange={e => updateDurationUnit(idx, e.target.value)}
                        className="border rounded-md text-sm px-2 bg-white shrink-0"
                      >
                        {DURATION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-gray-500">Medicine type</Label>
                      <select
                        value={guessForm(med)}
                        onChange={e => setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, form: e.target.value, qtyOverride: "" } : m))}
                        className="w-full border rounded-md text-sm px-2 py-2 bg-white"
                      >
                        {FORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Quantity to dispense ({FORM_OPTIONS.find(o => o.value === guessForm(med))?.unit})</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder={String(autoQuantity(med))}
                        value={med.qtyOverride ?? ""}
                        onChange={e => setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, qtyOverride: e.target.value } : m))}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">{qtyHint(med)} Final quantity: <b>{finalQuantity(med)}</b></p>
                </div>

                <div>
                  <Label className="text-xs text-gray-500">Instructions</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div className="space-y-1.5">
                      {TIME_OPTIONS.map(t => (
                        <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={parts.includes(t)}
                            onChange={() => toggleTime(idx, t)}
                            className="w-4 h-4 accent-blue-600"
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {FOOD_OPTIONS.map(f => (
                        <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={parts.includes(f)}
                            onChange={() => selectFood(idx, f)}
                            className="w-4 h-4 accent-blue-600"
                          />
                          {f}
                        </label>
                      ))}
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isOtherActive}
                          onChange={() => toggleOther(idx)}
                          className="w-4 h-4 accent-blue-600"
                        />
                        Other
                      </label>
                    </div>
                  </div>
                  {isOtherActive && (
                    <Input
                      className="mt-2"
                      placeholder="Type custom instruction..."
                      value={getCustomText(med.instructions)}
                      onChange={e => updateCustomText(idx, e.target.value)}
                      autoFocus
                    />
                  )}
                </div>
              </div>
            );
          })}

          <Button variant="outline" size="sm" onClick={addMed} className="w-full border-dashed">
            <Plus className="w-4 h-4 mr-1" /> Add Medicine
          </Button>

          <div>
            <Label className="text-xs text-gray-500">Doctor's Notes (optional)</Label>
            <Textarea
              placeholder="Additional notes, advice, follow-up instructions..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 mt-2 max-sm:sticky max-sm:bottom-0 max-sm:bg-white max-sm:pt-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" size="sm" onClick={handleSkip} disabled={saving}>
            Skip — No Prescription
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
            onClick={handleSave}
            disabled={saving}
          >
            <Send className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save & Complete"}
          </Button>
        </DialogFooter>
        </>)}
      </DialogContent>
    </Dialog>
  );
}
