import AssignFollowUpDialog from "./AssignFollowUpDialog";
import { searchIcd10 } from "../data/icd10Common";
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
import { FORM_CONFIG, getFormConfig, coerceUnit, detectFormFromText, normalizeLegacyMedicine, type MedForm } from "@/lib/medicineTypes";

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
  perDose?: string;      // tablets/capsules per dose (Tablet type only)
  formManual?: boolean;  // doctor picked the type by hand, so don't auto-change it from the name
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
  form: "tablet", perDose: "1",
};

const TIME_OPTIONS = ["Morning", "Afternoon", "Evening"];
const FOOD_OPTIONS = ["After food", "Before food"];
const CUSTOM_PREFIX = "Custom: ";


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

const FORM_OPTIONS = FORM_CONFIG; // fields used below: value, label, unit

function guessForm(m: Medicine): MedForm {
  return (m.form as MedForm) || detectFormFromText(m.name) || "tablet";
}
function timesPerDay(m: Medicine): number {
  return ["Morning", "Afternoon", "Evening", "Night"].filter(t => (m.instructions || "").includes(t)).length || 1;
}
function totalDays(m: Medicine): number {
  const n = parseFloat(m.durationAmount) || 0;
  return (m.durationUnit === "week" ? n * 7 : n) || 1;
}
function perDoseCount(m: Medicine): number {
  return parseFloat(m.perDose || "1") || 1;
}
// Only tablets are computed (per dose x times x days). Everything else defaults to 1 bottle / vial / tube.
function autoQuantity(m: Medicine): number {
  if (!getFormConfig(guessForm(m)).autoQuantity) return 1;
  return Math.max(1, Math.ceil(perDoseCount(m) * timesPerDay(m) * totalDays(m)));
}
function finalQuantity(m: Medicine): number {
  const o = parseFloat(m.qtyOverride || "");
  return o > 0 ? Math.round(o) : autoQuantity(m);
}
function qtyHint(m: Medicine): string {
  const cfg = getFormConfig(guessForm(m));
  if (!cfg.autoQuantity) return `Dose is the amount per time. Dispense quantity is separate and defaults to 1 ${cfg.unit.replace("(s)", "")}.`;
  return `Auto: ${perDoseCount(m)} per dose x ${timesPerDay(m)} times/day x ${totalDays(m)} days = ${autoQuantity(m)}. Type a number to override.`;
}
function dosageText(m: Medicine): string {
  const base = formatDosage(m.dosageAmount, m.dosageUnit);
  if (guessForm(m) !== "tablet") return base;
  const n = perDoseCount(m);
  if (!base) return `${n} ${n === 1 ? "tablet" : "tablets"}`;
  return n === 1 ? base : `${n} tablets x ${base}`;
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
  const [fuFor, setFuFor] = useState<{ id: string; date?: string; name?: string } | null>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [diagnosisCode, setDiagnosisCode] = useState("");
  const [icdOpen, setIcdOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; inStock: boolean }[]>([]);
  const [activeMedIdx, setActiveMedIdx] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [otherOpen, setOtherOpen] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<"manual" | "voice">("voice");
  const [voiceItems, setVoiceItems] = useState<VoiceItem[]>([]);
  const [voicePending, setVoicePending] = useState<string[]>([]);

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

  // Type picked by hand: unit and quantity follow the type automatically
  function changeForm(idx: number, form: MedForm) {
    const cfg = getFormConfig(form);
    setMedicines(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      const keep = m.dosageUnit === cfg.defaultUnit;
      const amount = keep ? m.dosageAmount : "";   // never carry "500" from mg into ml
      return { ...m, form, formManual: true, dosageUnit: cfg.defaultUnit, dosageAmount: amount,
               dosage: formatDosage(amount, cfg.defaultUnit), qtyOverride: "" };
    }));
  }

  // Name typed or picked: if it says tonic / syrup / drops etc., set the type and unit
  function updateName(idx: number, name: string) {
    setMedicines(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      if (m.formManual) return { ...m, name };
      const detected = detectFormFromText(name);
      if (!detected || detected === m.form) return { ...m, name };
      return { ...m, name, form: detected, dosageUnit: getFormConfig(detected).defaultUnit, qtyOverride: "" };
    }));
  }
  async function searchMedicines(idx: number, q: string) {
    updateName(idx, q);
    setActiveMedIdx(idx);
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/pharmacy/medicines?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data.filter((m: any) => m && m.name).map((m: any) => ({ name: m.name, inStock: m.in_stock === true })) : []);
    } catch { setSuggestions([]); }
  }

  function pickSuggestion(idx: number, name: string) {
    updateName(idx, name);
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
        .map(i => normalizeLegacyMedicine(presetItemToMedicine(i)));
      const next = [...existing, ...added];
      return next.length ? next : [{ ...EMPTY_MED }];
    });
    setCollapsed(new Set());
    setOtherOpen(new Set());
    setMode("manual");
  }

  function buildManualItems(): VoiceItem[] {
    return medicines
      .filter(m => m.name.trim())
      .map(m => ({
        name: m.name,
        dosage: dosageText(m),
        duration: formatDuration(m.durationAmount, m.durationUnit),
        instructions: m.instructions,
        form: guessForm(m),
        quantity: finalQuantity(m),
        quantityUnit: FORM_OPTIONS.find(o => o.value === guessForm(m))?.unit ?? "units",
      }));
  }

  async function handleSave() {
    // voice medicines first, then manual ones
    if (voicePending.length) {
      toast.error(`Finish the voice medicine details first: ${voicePending.join(", ")}`);
      setMode("voice");
      return;
    }
    await submitPrescription([...voiceItems, ...buildManualItems()], true);
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
          diagnosis: diagnosis.trim() || undefined,
          diagnosisCode: diagnosisCode.trim() || undefined,
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
    if (ok && booking) { setFuFor({ id: booking.id, date: (booking as any).date, name: booking.patientName }); return; }
    setMedicines([{ ...EMPTY_MED }]);
    setVoiceItems([]);
    setVoicePending([]);
    setNotes(""); setDiagnosis(""); setDiagnosisCode(""); setIcdOpen(false); 
    setCollapsed(new Set());
    setOtherOpen(new Set());
    setMode("voice");
    onConfirm();
  }

  function finishAfterFollowUp() {
    setFuFor(null);
    setMedicines([{ ...EMPTY_MED }]);
    setVoiceItems([]);
    setVoicePending([]);
    setNotes(""); setDiagnosis(""); setDiagnosisCode(""); setIcdOpen(false);
    setCollapsed(new Set());
    setOtherOpen(new Set());
    setMode("voice");
    onConfirm();
  }

  function handleSkip() {
    setMedicines([{ ...EMPTY_MED }]);
    setVoiceItems([]);
    setVoicePending([]);
    setNotes(""); setDiagnosis(""); setDiagnosisCode(""); setIcdOpen(false); 
    setCollapsed(new Set());
    setOtherOpen(new Set());
    setMode("voice");
    onConfirm();
  }

  return (
    <>
    <AssignFollowUpDialog open={!!fuFor} bookingId={fuFor?.id ?? ""} bookingDate={fuFor?.date} patientName={fuFor?.name} onDone={finishAfterFollowUp} />
    <Dialog open={open && !fuFor} onOpenChange={onClose}>
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

        <div>
          <Label className="text-xs text-gray-500">Diagnosis (optional)</Label>
          <div className="relative">
            <Input placeholder="e.g. Acute viral fever" value={diagnosis} maxLength={500}
              onChange={e => { setDiagnosis(e.target.value); setDiagnosisCode(""); setIcdOpen(true); }}
              onFocus={() => setIcdOpen(true)}
              onBlur={() => setTimeout(() => setIcdOpen(false), 150)} />
            {diagnosisCode && <p className="text-xs text-green-700 mt-1">ICD-10: {diagnosisCode}</p>}
            {icdOpen && !diagnosisCode && searchIcd10(diagnosis).length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-auto rounded-md border bg-white shadow">
                {searchIcd10(diagnosis).map(e => (
                  <button type="button" key={e.code}
                    onMouseDown={ev => ev.preventDefault()}
                    onClick={() => { setDiagnosis(e.name); setDiagnosisCode(e.code); setIcdOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50">
                    <span className="font-mono text-xs text-gray-500 mr-2">{e.code}</span>{e.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <PresetSuggestions
          complaint={booking?.complaint ?? ""}
          age={booking?.patientAge}
          onApply={applyPreset}
        />

        {mode === "voice" && medicines.some(m => m.name.trim()) && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" /> Added manually ({medicines.filter(m => m.name.trim()).length})
              </span>
              <button onClick={() => setMode("manual")} className="text-xs text-blue-700 underline">Edit in Manual</button>
            </div>
            {medicines.filter(m => m.name.trim()).map((m, i) => (
              <div key={"ms" + i} className="flex items-start gap-2 text-sm bg-white border rounded-lg px-3 py-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">{[dosageText(m), formatDuration(m.durationAmount, m.durationUnit), m.instructions].filter(Boolean).join(", ")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className={mode === "voice" ? "" : "hidden"}>
          <VoicePrescription
            saving={saving}
            notes={notes}
            onNotesChange={setNotes}
            onSkip={handleSkip}
            onItemsChange={(items, pending) => { setVoiceItems(items); setVoicePending(pending ?? []); }}
            onConfirm={items => submitPrescription([...items, ...buildManualItems()], true)}
          />
        </div>

        {mode === "manual" && (<>
        <div className="space-y-4">
          {(voiceItems.length > 0 || voicePending.length > 0) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-700 flex items-center gap-1">
                  <Mic className="w-3.5 h-3.5" /> Added by voice ({voiceItems.length + voicePending.length})
                </span>
                <button onClick={() => setMode("voice")} className="text-xs text-blue-700 underline">Edit in Speak</button>
              </div>
              {voiceItems.map((v, i) => (
                <div key={"vs" + i} className="flex items-start gap-2 text-sm bg-white border rounded-lg px-3 py-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-gray-500">{[v.dosage, v.duration, v.instructions].filter(Boolean).join(", ")}</div>
                  </div>
                </div>
              ))}
              {voicePending.map((n, i) => (
                <div key={"vp" + i} className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <Mic className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{n}</div>
                    <div className="text-xs text-amber-700">Needs details. Tap "Edit in Speak" to finish it.</div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    <span className="text-gray-500">{dosageText(med)} · {med.duration}</span>
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
                          key={s.name}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2"
                          onClick={() => pickSuggestion(idx, s.name)}
                        >
                          <span>{s.name}</span>
                          {s.inStock && <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">In Stock</span>}
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
                        value={coerceUnit(guessForm(med), med.dosageUnit)}
                        onChange={e => updateDosageUnit(idx, e.target.value)}
                        disabled={getFormConfig(guessForm(med)).allowedUnits.length === 1}
                        className="border rounded-md text-sm px-2 bg-white shrink-0"
                      >
                        {getFormConfig(guessForm(med)).allowedUnits.map(u => <option key={u} value={u}>{u}</option>)}
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

                {guessForm(med) === "tablet" && (
                  <div>
                    <Label className="text-xs text-gray-500">Tablets / capsules per dose</Label>
                    <Input
                      type="number" min="0.25" step="0.25" className="w-28"
                      value={med.perDose ?? "1"}
                      onChange={e => setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, perDose: e.target.value, qtyOverride: "" } : m))}
                    />
                  </div>
                )}

                <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-gray-500">Medicine type</Label>
                      <select
                        value={guessForm(med)}
                        onChange={e => changeForm(idx, e.target.value as MedForm)}
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
            {saving ? "Saving..." : "Save Procedure / Prescription"}
          </Button>
        </DialogFooter>
        </>)}
      </DialogContent>
    </Dialog>
    </>
  );
}
