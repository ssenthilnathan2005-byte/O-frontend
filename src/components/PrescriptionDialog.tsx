import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pill, Send, Pencil, Check } from "lucide-react";
import { getToken } from "@/api";
import { toast } from "sonner";

interface Medicine {
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
  dosageAmount: string;
  dosageUnit: string;
  durationAmount: string;
  durationUnit: string;
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

  async function handleSave() {
    const validMeds = medicines
      .filter(m => m.name.trim())
      .map(({ name, dosageAmount, dosageUnit, durationAmount, durationUnit, instructions }) => ({
        name,
        dosage: formatDosage(dosageAmount, dosageUnit),
        duration: formatDuration(durationAmount, durationUnit),
        instructions,
      }));
    if (!booking?.id) { onConfirm(); return; }
    setSaving(true);
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
        toast.success("Prescription saved ✓");
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save prescription");
      }
    } catch {
      toast.error("Network error saving prescription");
    } finally {
      setSaving(false);
      setMedicines([{ ...EMPTY_MED }]);
      setNotes("");
      setCollapsed(new Set());
      setOtherOpen(new Set());
      onConfirm();
    }
  }

  function handleSkip() {
    setMedicines([{ ...EMPTY_MED }]);
    setNotes("");
    setCollapsed(new Set());
    setOtherOpen(new Set());
    onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

        <DialogFooter className="flex gap-2 mt-2">
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
      </DialogContent>
    </Dialog>
  );
}
