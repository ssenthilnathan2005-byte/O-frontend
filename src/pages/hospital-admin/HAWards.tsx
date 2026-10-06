import { useEffect, useRef, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { BedDouble, Plus, X, Trash2, ChevronDown, ChevronUp, Clock, Settings, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Ward = {
  id: string; name: string; type: string; total_beds: number;
  available_beds: number; occupied_beds: number; maintenance_beds: number;
  cleaning_minutes?: number | null;
};

type Bed = {
  id: string; bed_number: string; status: "available" | "occupied" | "maintenance";
  patient_name: string | null;
  occupant_name: string | null;
  occupant_phone: string | null;
  occupant_age: number | null;
  occupant_gender: string | null;
  occupant_doctor: string | null;
  occupant_diagnosis: string | null;
  occupant_notes: string | null;
  occupant_admitted_at: string | null;
  inward_id?: string | null;
  cleaning_started_at?: string | null;
  cleaning_ends_at?: string | null;
  cleaning_duration_minutes?: number | null;
  cleaning_override_minutes?: number | null;
  effective_cleaning_minutes?: number | null;
  cleaning_source?: "bed" | "ward" | "hospital";
  server_now?: string;
};

const EMPTY_OCCUPY = { patientName:"", phone:"", age:"", gender:"", admittingDoctorName:"", diagnosis:"", notes:"" };

type Vitals = {
  id: string; temperature: number | null; pulse: number | null;
  bp_systolic: number | null; bp_diastolic: number | null;
  spo2: number | null; resp_rate: number | null;
  recorded_by: string | null; recorded_at: string;
};
type NoteEntry = {
  id: string; note: string; shift: string;
  recorded_by: string | null; recorded_at: string;
};
const EMPTY_VITALS = { temperature:"", pulse:"", bpSystolic:"", bpDiastolic:"", spo2:"", respRate:"", recordedBy:"" };
const EMPTY_NOTE = { note:"", shift:"day", recordedBy:"" };

const WARD_TYPES = ["general", "icu", "emergency", "maternity", "paediatric", "surgical", "orthopaedic", "private"];

const STATUS_COLORS: Record<string, string> = {
  available:   "bg-green-50 text-green-700 border-green-200",
  occupied:    "bg-red-50 text-red-700 border-red-200",
  maintenance: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

// ---------------------------------------------------------------------------
// Bed cleaning time helpers
// ---------------------------------------------------------------------------
const CLEANING_PRESETS: { label: string; minutes: number }[] = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "45 minutes", minutes: 45 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
  { label: "8 hours", minutes: 480 },
  { label: "12 hours", minutes: 720 },
  { label: "1 day", minutes: 1440 },
  { label: "2 days", minutes: 2880 },
  { label: "3 days", minutes: 4320 },
];
const EXTEND_PRESETS: { label: string; minutes: number }[] = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
];

type PickerValue = { choice: string; days: string; hours: string; mins: string };

function minutesToPicker(m: number | null | undefined, presets = CLEANING_PRESETS): PickerValue {
  if (m === null || m === undefined) return { choice: "inherit", days: "", hours: "", mins: "" };
  if (presets.some(p => p.minutes === m)) return { choice: String(m), days: "", hours: "", mins: "" };
  return {
    choice: "custom",
    days: String(Math.floor(m / 1440)),
    hours: String(Math.floor((m % 1440) / 60)),
    mins: String(m % 60),
  };
}

// null = use the default, number = minutes, undefined = invalid custom value
function pickerToMinutes(v: PickerValue): number | null | undefined {
  if (v.choice === "inherit") return null;
  if (v.choice !== "custom") return Number(v.choice);
  const d = Number(v.days || 0), h = Number(v.hours || 0), m = Number(v.mins || 0);
  if (![d, h, m].every(n => Number.isInteger(n) && n >= 0)) return undefined;
  const total = d * 1440 + h * 60 + m;
  return total >= 1 && total <= 43200 ? total : undefined;
}

function formatDuration(mins: number): string {
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} ${d === 1 ? "day" : "days"}`);
  if (h) parts.push(`${h} ${h === 1 ? "hour" : "hours"}`);
  if (m) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
  return parts.join(" ") || "0 minutes";
}

function formatDurationShort(mins: number): string {
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(" ") || "0m";
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Finishing...";
  return formatDuration(Math.ceil(ms / 60000)) + " remaining";
}

function formatRemainingShort(ms: number): string {
  if (ms <= 0) return "Finishing...";
  return formatDurationShort(Math.ceil(ms / 60000)) + " left";
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function CleaningTimePicker({ value, onChange, presets = CLEANING_PRESETS, inheritLabel }: {
  value: PickerValue;
  onChange: (v: PickerValue) => void;
  presets?: { label: string; minutes: number }[];
  inheritLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <select value={value.choice} onChange={e => onChange({ ...value, choice: e.target.value })}
        className="w-full border rounded-md px-3 py-2 text-sm bg-white">
        {inheritLabel && <option value="inherit">{inheritLabel}</option>}
        {presets.map(p => <option key={p.minutes} value={String(p.minutes)}>{p.label}</option>)}
        <option value="custom">Custom</option>
      </select>
      {value.choice === "custom" && (
        <div className="grid grid-cols-3 gap-2">
          {([["days", "Days"], ["hours", "Hours"], ["mins", "Minutes"]] as const).map(([k, label]) => (
            <div key={k}>
              <label className="text-xs text-gray-500 mb-1 block">{label}</label>
              <Input type="number" min="0" placeholder="0" value={value[k]}
                onChange={e => onChange({ ...value, [k]: e.target.value })} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HAWards() {
  const { user, doctors } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";
  const availableDoctors = ((doctors as any[]) || []).filter((d: any) => d.hospitalId === hospitalId && (d.isAvailable ?? true));

  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Record<string, Bed[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "general", totalBeds: "10" });
  const [loading, setLoading] = useState(false);
  const [bedLoading, setBedLoading] = useState<string | null>(null);
  const [occupyTarget, setOccupyTarget] = useState<{ wardId: string; bed: Bed } | null>(null);
  const [occupyForm, setOccupyForm] = useState({ ...EMPTY_OCCUPY });
  const [dutyMode, setDutyMode] = useState(false);
  useEffect(() => { setDutyMode(false); }, [occupyTarget]);
  const [detailsTarget, setDetailsTarget] = useState<{ wardId: string; bed: Bed } | null>(null);
  const [vitals, setVitals] = useState<Vitals[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showVitalsAdd, setShowVitalsAdd] = useState(false);
  const [showNoteAdd, setShowNoteAdd] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({ ...EMPTY_VITALS });
  const [noteForm, setNoteForm] = useState({ ...EMPTY_NOTE });
  const [vitalsSaving, setVitalsSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  // ---- Manage wards & beds: edit ward, add / edit / remove bed ----
  const [editWard, setEditWard] = useState<Ward | null>(null);
  const [editWardForm, setEditWardForm] = useState({ name: "", type: "general" });
  const [bedDialog, setBedDialog] = useState<{ mode: "add" | "edit"; wardId: string; bed?: Bed } | null>(null);
  const [bedNumberInput, setBedNumberInput] = useState("");
  const [manageSaving, setManageSaving] = useState(false);
  const [manageError, setManageError] = useState("");

  function openEditWard(ward: Ward) {
    setManageError("");
    setEditWardForm({ name: ward.name, type: ward.type });
    setEditWard(ward);
  }

  async function saveEditWard() {
    if (!editWard) return;
    if (!editWardForm.name.trim()) { setManageError("Ward name is required."); return; }
    setManageSaving(true); setManageError("");
    try {
      const r = await api(`/wards/${editWard.id}`, "PATCH", { name: editWardForm.name.trim(), type: editWardForm.type });
      if (r && r.error) throw new Error(r.error);
      setEditWard(null);
      await loadWards();
    } catch (e: any) {
      setManageError(e?.message || "Could not update ward.");
    } finally { setManageSaving(false); }
  }

  function openAddBed(wardId: string) {
    setManageError(""); setBedNumberInput("");
    setBedDialog({ mode: "add", wardId });
  }

  function openEditBed(wardId: string, bed: Bed) {
    setManageError(""); setBedNumberInput(bed.bed_number);
    setBedDialog({ mode: "edit", wardId, bed });
  }

  async function saveBedDialog() {
    if (!bedDialog) return;
    const num = bedNumberInput.trim();
    if (bedDialog.mode === "edit" && !num) { setManageError("Bed number is required."); return; }
    const wardId = bedDialog.wardId;
    setManageSaving(true); setManageError("");
    try {
      const r = bedDialog.mode === "add"
        ? await api(`/wards/${wardId}/beds`, "POST", num ? { bedNumber: num } : {})
        : await api(`/wards/${wardId}/beds/${bedDialog.bed!.id}`, "PATCH", { bedNumber: num });
      if (r && r.error) throw new Error(r.error);
      setBedDialog(null);
      await loadBeds(wardId);
      await loadWards();
    } catch (e: any) {
      setManageError(e?.message || "Could not save bed.");
    } finally { setManageSaving(false); }
  }

  async function handleRemoveBed(wardId: string, bed: Bed) {
    if (bed.status === "occupied") {
      alert("This bed has a patient. Discharge the patient before removing the bed.");
      return;
    }
    if (!confirm(`Remove bed ${bed.bed_number}?`)) return;
    setBedLoading(bed.id);
    try {
      const r = await api(`/wards/${wardId}/beds/${bed.id}`, "DELETE");
      if (r && r.error) alert(r.error);
      await loadBeds(wardId);
      await loadWards();
    } catch {} finally { setBedLoading(null); }
  }

  // ---- Bed cleaning time ----
  const [showCleaningSettings, setShowCleaningSettings] = useState(false);
  const [hospitalCleaning, setHospitalCleaning] = useState<PickerValue>(minutesToPicker(30));
  const [wardCleaning, setWardCleaning] = useState<Record<string, PickerValue>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [editCleaning, setEditCleaning] = useState<{ wardId: string; bed: Bed } | null>(null);
  const [editCleaningValue, setEditCleaningValue] = useState<PickerValue>(minutesToPicker(null));
  const [editCleaningSaving, setEditCleaningSaving] = useState(false);
  const [editCleaningError, setEditCleaningError] = useState("");
  const [cleaningTarget, setCleaningTarget] = useState<{ wardId: string; bedId: string } | null>(null);
  const [cleaningView, setCleaningView] = useState<"main" | "confirm" | "extend">("main");
  const [extendValue, setExtendValue] = useState<PickerValue>(minutesToPicker(30, EXTEND_PRESETS));
  const [extendSaving, setExtendSaving] = useState(false);
  const [extendError, setExtendError] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const clockOffset = useRef(0); // server time minus this device's time, so countdowns use the server clock
  const nowAdj = nowMs + clockOffset.current;
  const cleaningBed: Bed | null = cleaningTarget
    ? (beds[cleaningTarget.wardId] || []).find(b => b.id === cleaningTarget.bedId) || null
    : null;
  const cleaningRemainingMs = cleaningBed && cleaningBed.cleaning_ends_at
    ? Date.parse(cleaningBed.cleaning_ends_at) - nowAdj
    : 0;

  // Live countdown tick
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // When a bed's cleaning time has ended, reload its ward (the server makes it Available)
  useEffect(() => {
    const now = nowMs + clockOffset.current;
    let changed = false;
    Object.keys(beds).forEach(wardId => {
      const list = beds[wardId] || [];
      if (list.some(b => b.status === "maintenance" && b.cleaning_ends_at && Date.parse(b.cleaning_ends_at) <= now)) {
        changed = true;
        loadBeds(wardId);
      }
    });
    if (changed) loadWards();
  }, [nowMs]);

  // Close the cleaning dialog if that bed is no longer in Cleaning
  useEffect(() => {
    if (cleaningTarget && (!cleaningBed || cleaningBed.status !== "maintenance")) setCleaningTarget(null);
  }, [cleaningTarget, cleaningBed]);

  async function openCleaningSettings() {
    setSettingsError("");
    setWardCleaning(wards.reduce((acc, w) => {
      acc[w.id] = minutesToPicker(w.cleaning_minutes === undefined ? null : w.cleaning_minutes);
      return acc;
    }, {} as Record<string, PickerValue>));
    setShowCleaningSettings(true);
    try {
      const r = await api("/wards/cleaning-settings");
      if (r && typeof r.defaultMinutes === "number") setHospitalCleaning(minutesToPicker(r.defaultMinutes));
    } catch {}
  }

  async function saveCleaningSettings() {
    setSettingsError("");
    const hm = pickerToMinutes(hospitalCleaning);
    if (typeof hm !== "number") { setSettingsError("Enter a valid hospital default (1 minute to 30 days)."); return; }
    const changes: { wardId: string; minutes: number | null }[] = [];
    for (const w of wards) {
      const v = wardCleaning[w.id];
      if (!v) continue;
      const m = pickerToMinutes(v);
      if (m === undefined) { setSettingsError(`Enter a valid cleaning time for ${w.name}.`); return; }
      const current = w.cleaning_minutes === undefined ? null : w.cleaning_minutes;
      if (m !== current) changes.push({ wardId: w.id, minutes: m });
    }
    setSettingsSaving(true);
    try {
      const r = await api("/wards/cleaning-settings", "PUT", { minutes: hm });
      if (r && r.error) throw new Error(r.error);
      for (const c of changes) {
        const rr = await api(`/wards/${c.wardId}/cleaning-time`, "PATCH", { minutes: c.minutes });
        if (rr && rr.error) throw new Error(rr.error);
      }
      await loadWards();
      setShowCleaningSettings(false);
    } catch (e: any) {
      setSettingsError(e?.message || "Could not save cleaning settings.");
    } finally { setSettingsSaving(false); }
  }

  function openEditCleaning(wardId: string, bed: Bed) {
    setEditCleaningError("");
    setEditCleaningValue(minutesToPicker(bed.cleaning_override_minutes === undefined ? null : bed.cleaning_override_minutes));
    setEditCleaning({ wardId, bed });
  }

  async function saveEditCleaning() {
    if (!editCleaning) return;
    const m = pickerToMinutes(editCleaningValue);
    if (m === undefined) { setEditCleaningError("Enter a valid time (1 minute to 30 days)."); return; }
    setEditCleaningSaving(true); setEditCleaningError("");
    try {
      const r = await api(`/wards/${editCleaning.wardId}/beds/${editCleaning.bed.id}/cleaning-time`, "PATCH", { minutes: m });
      if (r && r.error) throw new Error(r.error);
      await loadBeds(editCleaning.wardId);
      setEditCleaning(null);
    } catch (e: any) {
      setEditCleaningError(e?.message || "Could not save cleaning time.");
    } finally { setEditCleaningSaving(false); }
  }

  function openExtend() {
    setExtendError("");
    setExtendValue(minutesToPicker(30, EXTEND_PRESETS));
    setCleaningView("extend");
  }

  async function saveExtend() {
    if (!cleaningTarget) return;
    const m = pickerToMinutes(extendValue);
    if (typeof m !== "number") { setExtendError("Enter a valid extra time (1 minute to 30 days)."); return; }
    setExtendSaving(true); setExtendError("");
    try {
      const r = await api(`/wards/${cleaningTarget.wardId}/beds/${cleaningTarget.bedId}/extend`, "PATCH", { minutes: m });
      if (r && r.error) throw new Error(r.error);
      await loadBeds(cleaningTarget.wardId);
      setCleaningView("main");
    } catch (e: any) {
      setExtendError(e?.message || "Could not extend cleaning.");
    } finally { setExtendSaving(false); }
  }


  async function api(path: string, method = "GET", body?: any) {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async function loadWards() {
    try { setWards(await api("/wards")); } catch {}
  }

  async function loadBeds(wardId: string) {
    try {
      const data = await api(`/wards/${wardId}/beds`);
      if (!Array.isArray(data)) return;
      if (data[0] && data[0].server_now) clockOffset.current = Date.parse(data[0].server_now) - Date.now();
      setBeds(prev => ({ ...prev, [wardId]: data }));
    } catch {}
  }

  useEffect(() => { if (hospitalId) loadWards(); }, [hospitalId]);

  async function handleExpand(wardId: string) {
    if (expanded === wardId) { setExpanded(null); return; }
    setExpanded(wardId);
    if (!beds[wardId]) await loadBeds(wardId);
  }

  async function handleCreateWard() {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await api("/wards", "POST", { name: form.name, type: form.type, totalBeds: Number(form.totalBeds) });
      setShowForm(false);
      setForm({ name: "", type: "general", totalBeds: "10" });
      await loadWards();
    } catch {} finally { setLoading(false); }
  }

  async function handleOccupy() {
    if (!occupyTarget || !occupyForm.patientName.trim()) return;
    const { wardId, bed } = occupyTarget;
    setBedLoading(bed.id);
    try {
      await api(`/wards/${wardId}/beds/${bed.id}/occupy`, "POST", {
        patientName: occupyForm.patientName,
        phone: occupyForm.phone || null,
        age: occupyForm.age ? Number(occupyForm.age) : null,
        gender: occupyForm.gender || null,
        admittingDoctorName: occupyForm.admittingDoctorName || null,
        diagnosis: occupyForm.diagnosis || null,
        notes: occupyForm.notes || null,
      });
      setOccupyTarget(null);
      setOccupyForm({ ...EMPTY_OCCUPY });
      await loadBeds(wardId);
      await loadWards();
    } catch {} finally { setBedLoading(null); }
  }

  async function handleVacate(wardId: string, bedId: string) {
    if (!confirm("Discharge this patient and send the bed for cleaning?")) return;
    setBedLoading(bedId);
    try {
      const vacateRes = await api(`/wards/${wardId}/beds/${bedId}/vacate`, "PATCH", {});
      if (vacateRes && vacateRes.error) alert(vacateRes.error);
      setDetailsTarget(null);
      await loadBeds(wardId);
      await loadWards();
    } catch {} finally { setBedLoading(null); }
  }

  async function handleReady(wardId: string, bedId: string) {
    setBedLoading(bedId);
    try {
      const readyRes = await api(`/wards/${wardId}/beds/${bedId}/ready`, "PATCH", {});
      if (readyRes && readyRes.error) alert(readyRes.error);
      setCleaningTarget(null);
      await loadBeds(wardId);
      await loadWards();
    } catch {} finally { setBedLoading(null); }
  }

  async function loadHistory(bed: Bed) {
    if (!bed.inward_id) { setVitals([]); setNotes([]); return; }
    setHistoryLoading(true);
    try {
      const [v, n] = await Promise.all([
        api(`/nursing/vitals?patientId=${bed.inward_id}`),
        api(`/nursing/notes?patientId=${bed.inward_id}`),
      ]);
      setVitals(Array.isArray(v) ? v : []);
      setNotes(Array.isArray(n) ? n : []);
    } catch { setVitals([]); setNotes([]); } finally { setHistoryLoading(false); }
  }

  async function handleAddVitalsInline() {
    if (!detailsTarget) return;
    const { wardId, bed } = detailsTarget;
    setVitalsSaving(true);
    try {
      await api("/nursing/vitals", "POST", {
        patientName: bed.occupant_name || bed.patient_name,
        patientId: bed.inward_id, bedId: bed.id, wardId,
        temperature: vitalsForm.temperature ? Number(vitalsForm.temperature) : null,
        pulse: vitalsForm.pulse ? Number(vitalsForm.pulse) : null,
        bpSystolic: vitalsForm.bpSystolic ? Number(vitalsForm.bpSystolic) : null,
        bpDiastolic: vitalsForm.bpDiastolic ? Number(vitalsForm.bpDiastolic) : null,
        spo2: vitalsForm.spo2 ? Number(vitalsForm.spo2) : null,
        respRate: vitalsForm.respRate ? Number(vitalsForm.respRate) : null,
        recordedBy: vitalsForm.recordedBy || null,
      });
      setVitalsForm({ ...EMPTY_VITALS }); setShowVitalsAdd(false);
      await loadHistory(bed);
    } catch {} finally { setVitalsSaving(false); }
  }

  async function handleAddNoteInline() {
    if (!detailsTarget || !noteForm.note.trim()) return;
    const { wardId, bed } = detailsTarget;
    setNoteSaving(true);
    try {
      await api("/nursing/notes", "POST", {
        patientName: bed.occupant_name || bed.patient_name,
        patientId: bed.inward_id, bedId: bed.id, wardId,
        note: noteForm.note, shift: noteForm.shift, recordedBy: noteForm.recordedBy || null,
      });
      setNoteForm({ ...EMPTY_NOTE }); setShowNoteAdd(false);
      await loadHistory(bed);
    } catch {} finally { setNoteSaving(false); }
  }

  function handleBedClick(wardId: string, bed: Bed) {
    if (bed.status === "available") {
      setOccupyForm({ ...EMPTY_OCCUPY });
      setOccupyTarget({ wardId, bed });
    } else if (bed.status === "occupied") {
      setDetailsTarget({ wardId, bed });
      setShowVitalsAdd(false); setShowNoteAdd(false);
      setVitalsForm({ ...EMPTY_VITALS }); setNoteForm({ ...EMPTY_NOTE });
      loadHistory(bed);
    } else {
      setCleaningView("main");
      setCleaningTarget({ wardId, bedId: bed.id });
    }
  }

  async function handleDeleteWard(wardId: string) {
    if (!confirm("Delete this ward and all its beds?")) return;
    try { await api(`/wards/${wardId}`, "DELETE"); await loadWards(); } catch {}
  }

  const totalBeds = wards.reduce((s, w) => s + Number(w.total_beds || 0), 0);
  const totalOccupied = wards.reduce((s, w) => s + Number(w.occupied_beds || 0), 0);
  const totalAvailable = wards.reduce((s, w) => s + Number(w.available_beds || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BedDouble className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold">Beds & Wards</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCleaningSettings}
            className="flex items-center gap-2 border border-teal-600 text-teal-700 hover:bg-teal-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Cleaning Settings</span>
            <span className="sm:hidden">Cleaning</span>
          </button>

<button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Ward
        </button>
</div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Beds", value: totalBeds, color: "text-gray-800" },
          { label: "Occupied", value: totalOccupied, color: "text-red-600" },
          { label: "Available", value: totalAvailable, color: "text-green-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Ward List */}
      {wards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No wards added yet. Add your first ward.</div>
      ) : (
        <div className="space-y-3">
          {wards.map(ward => (
            <div key={ward.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div onClick={() => handleExpand(ward.id)}
                className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{ward.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{ward.type} ward</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700">{ward.available_beds} free</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700">{ward.occupied_beds} occupied</span>
                    {Number(ward.maintenance_beds) > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">{ward.maintenance_beds} cleaning</span>
                    )}
                  </div>
                  <button onClick={e => { e.stopPropagation(); openEditWard(ward); }} title="Edit Ward" aria-label="Edit Ward" className="p-1.5 rounded hover:bg-gray-100 transition-colors">
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteWard(ward.id); }} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleExpand(ward.id); }} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
                    {expanded === ward.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Bed Grid */}
              {expanded === ward.id && (
                <div className="border-t px-5 py-4">
                  <div className="flex justify-end mb-3">
                    <button onClick={() => openAddBed(ward.id)}
                      className="flex items-center gap-1 border border-teal-600 text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add Bed
                    </button>
                  </div>
                  {!beds[ward.id] ? (
                    <p className="text-sm text-gray-400">Loading beds...</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {beds[ward.id].map(bed => (
                        <div key={bed.id} className={`relative rounded-lg border p-2 text-center text-xs cursor-pointer transition-all ${STATUS_COLORS[bed.status]}`}
                          onClick={() => handleBedClick(ward.id, bed)}>
                          <div className="absolute top-1 left-1 flex gap-0.5">
                            <button type="button" title="Edit Bed" aria-label="Edit Bed"
                              onClick={e => { e.stopPropagation(); openEditBed(ward.id, bed); }}
                              className="p-0.5 rounded opacity-50 hover:opacity-100 hover:bg-black/10">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button type="button" title="Remove Bed" aria-label="Remove Bed"
                              onClick={e => { e.stopPropagation(); handleRemoveBed(ward.id, bed); }}
                              className="p-0.5 rounded opacity-50 hover:opacity-100 hover:bg-black/10">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <button type="button" title="Edit Cleaning Time"
                            onClick={e => { e.stopPropagation(); openEditCleaning(ward.id, bed); }}
                            className="absolute top-1 right-1 p-0.5 rounded opacity-50 hover:opacity-100 hover:bg-black/10">
                            <Clock className="w-3 h-3" />
                          </button>
                          <p className="font-bold">{bed.bed_number}</p>
                          <p className="capitalize mt-0.5 opacity-80">
                            {bed.status === "maintenance" ? "Cleaning" : bed.status}
                          </p>
                          {bed.patient_name && <p className="truncate mt-0.5 font-medium">{bed.patient_name}</p>}
                          {bed.status === "maintenance" && bed.cleaning_ends_at && (
                            <div className="mt-0.5">
                              <p className="font-medium leading-tight">
                                {formatRemainingShort(Date.parse(bed.cleaning_ends_at) - nowAdj)}
                              </p>
                              <p className="text-[10px] opacity-80 leading-tight">Free: {formatDateTime(bed.cleaning_ends_at)}</p>
                            </div>
                          )}
                          {bed.cleaning_source === "bed" && bed.cleaning_override_minutes ? (
                            <p className="text-[10px] opacity-70 leading-tight mt-0.5" title="Individual cleaning time">
                              Custom: {formatDurationShort(bed.cleaning_override_minutes)}
                            </p>
                          ) : null}

                          {bedLoading === bed.id && <p className="text-[10px] opacity-60">saving...</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Ward Modal */}
      {editWard && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Edit Ward</h2>
              <button onClick={() => setEditWard(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Ward Name *</label>
                <Input value={editWardForm.name}
                  onChange={e => setEditWardForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Ward Type</label>
                <select value={editWardForm.type} onChange={e => setEditWardForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  {(WARD_TYPES.includes(editWardForm.type) ? WARD_TYPES : [editWardForm.type, ...WARD_TYPES]).map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              {manageError && <p className="text-xs text-red-600">{manageError}</p>}
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setEditWard(null)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={saveEditWard} disabled={manageSaving}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                {manageSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Bed Modal */}
      {bedDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">
                {bedDialog.mode === "add"
                  ? `Add Bed - ${wards.find(w => w.id === bedDialog.wardId)?.name || "Ward"}`
                  : `Edit Bed - ${bedDialog.bed?.bed_number}`}
              </h2>
              <button onClick={() => setBedDialog(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">
                  Bed Number{bedDialog.mode === "edit" ? " *" : ""}
                </label>
                <Input placeholder={bedDialog.mode === "add" ? "Leave blank to auto-number" : "e.g. MA-22"}
                  value={bedNumberInput} maxLength={30}
                  onChange={e => setBedNumberInput(e.target.value)} />
              </div>
              {manageError && <p className="text-xs text-red-600">{manageError}</p>}
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setBedDialog(null)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={saveBedDialog} disabled={manageSaving}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                {manageSaving ? "Saving..." : bedDialog.mode === "add" ? "Add Bed" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Ward Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Add Ward</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Ward Name *</label>
                <Input placeholder="e.g. General Ward A" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Ward Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  {WARD_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Number of Beds</label>
                <Input type="number" min="1" max="100" placeholder="10" value={form.totalBeds}
                  onChange={e => setForm(f => ({ ...f, totalBeds: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreateWard} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                {loading ? "Creating..." : "Create Ward"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Occupy Bed Modal */}
      {occupyTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Admit Patient — Bed {occupyTarget.bed.bed_number}</h2>
              <button onClick={() => setOccupyTarget(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Patient Name *</label>
                <Input placeholder="Full name" value={occupyForm.patientName}
                  onChange={e => setOccupyForm(f => ({ ...f, patientName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Phone</label>
                  <Input placeholder="Mobile number" value={occupyForm.phone}
                    onChange={e => setOccupyForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Age</label>
                  <Input type="number" min="0" placeholder="Age" value={occupyForm.age}
                    onChange={e => setOccupyForm(f => ({ ...f, age: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Gender</label>
                <select value={occupyForm.gender} onChange={e => setOccupyForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Admitting Doctor</label>
                <select
                  value={dutyMode ? "__duty__" : occupyForm.admittingDoctorName}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "__duty__") { setDutyMode(true); setOccupyForm(f => ({ ...f, admittingDoctorName: "" })); }
                    else { setDutyMode(false); setOccupyForm(f => ({ ...f, admittingDoctorName: v })); }
                  }}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  <option value="">Select doctor</option>
                  {availableDoctors.map((d: any) => (
                    <option key={d.id} value={d.name}>{d.name} — {d.specialty}</option>
                  ))}
                  <option value="__duty__">Duty Doctor</option>
                </select>
                {dutyMode && (
                  <Input className="mt-2" placeholder="Enter duty doctor's name" value={occupyForm.admittingDoctorName}
                    onChange={e => setOccupyForm(f => ({ ...f, admittingDoctorName: e.target.value }))} />
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Reason for Admission / Diagnosis *</label>
                <textarea value={occupyForm.diagnosis} onChange={e => setOccupyForm(f => ({ ...f, diagnosis: e.target.value }))}
                  rows={2} placeholder="e.g. Maternity — delivery, Post-op recovery, Fracture..."
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Notes</label>
                <textarea value={occupyForm.notes} onChange={e => setOccupyForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Additional notes..."
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setOccupyTarget(null)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleOccupy} disabled={bedLoading === occupyTarget.bed.id || !occupyForm.patientName.trim() || (dutyMode && !occupyForm.admittingDoctorName.trim())}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50">
                {bedLoading === occupyTarget.bed.id ? "Admitting..." : "Admit & Occupy Bed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bed Details Modal */}
      {detailsTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Bed {detailsTarget.bed.bed_number}</h2>
              <button onClick={() => setDetailsTarget(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-2 text-sm">
              <p><span className="text-gray-500">Patient:</span> <span className="font-medium">{detailsTarget.bed.occupant_name || detailsTarget.bed.patient_name || "—"}</span></p>
              {detailsTarget.bed.occupant_age != null && (
                <p><span className="text-gray-500">Age / Gender:</span> {detailsTarget.bed.occupant_age} {detailsTarget.bed.occupant_gender ? `/ ${detailsTarget.bed.occupant_gender}` : ""}</p>
              )}
              {detailsTarget.bed.occupant_phone && (
                <p><span className="text-gray-500">Phone:</span> {detailsTarget.bed.occupant_phone}</p>
              )}
              {detailsTarget.bed.occupant_doctor && (
                <p><span className="text-gray-500">Admitting Doctor:</span> {detailsTarget.bed.occupant_doctor}</p>
              )}
              {detailsTarget.bed.occupant_diagnosis && (
                <p><span className="text-gray-500">Reason / Diagnosis:</span> {detailsTarget.bed.occupant_diagnosis}</p>
              )}
              {detailsTarget.bed.occupant_notes && (
                <p><span className="text-gray-500">Notes:</span> {detailsTarget.bed.occupant_notes}</p>
              )}
              {detailsTarget.bed.occupant_admitted_at && (
                <p><span className="text-gray-500">Admitted:</span> {new Date(detailsTarget.bed.occupant_admitted_at).toLocaleString()}</p>
              )}
            </div>

            <div className="px-6 pb-2 space-y-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Vitals</h3>
                <button onClick={() => setShowVitalsAdd(s => !s)} className="text-xs text-teal-600 font-medium hover:underline">
                  {showVitalsAdd ? "Cancel" : "+ Add"}
                </button>
              </div>
              {showVitalsAdd && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="Temp (°F)" value={vitalsForm.temperature}
                      onChange={e => setVitalsForm(f => ({ ...f, temperature: e.target.value }))} />
                    <Input type="number" placeholder="Pulse (bpm)" value={vitalsForm.pulse}
                      onChange={e => setVitalsForm(f => ({ ...f, pulse: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="BP Systolic" value={vitalsForm.bpSystolic}
                      onChange={e => setVitalsForm(f => ({ ...f, bpSystolic: e.target.value }))} />
                    <Input type="number" placeholder="BP Diastolic" value={vitalsForm.bpDiastolic}
                      onChange={e => setVitalsForm(f => ({ ...f, bpDiastolic: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="SpO2 (%)" value={vitalsForm.spo2}
                      onChange={e => setVitalsForm(f => ({ ...f, spo2: e.target.value }))} />
                    <Input type="number" placeholder="Resp Rate" value={vitalsForm.respRate}
                      onChange={e => setVitalsForm(f => ({ ...f, respRate: e.target.value }))} />
                  </div>
                  <Input placeholder="Recorded by (nurse name)" value={vitalsForm.recordedBy}
                    onChange={e => setVitalsForm(f => ({ ...f, recordedBy: e.target.value }))} />
                  <button onClick={handleAddVitalsInline} disabled={vitalsSaving}
                    className="w-full px-3 py-1.5 rounded-md text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50">
                    {vitalsSaving ? "Saving..." : "Save Vitals"}
                  </button>
                </div>
              )}
              {historyLoading ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : vitals.length === 0 ? (
                <p className="text-xs text-gray-400">No vitals recorded yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {vitals.slice(0, 5).map(v => (
                    <div key={v.id} className="text-xs bg-gray-50 rounded px-2 py-1.5">
                      <div className="flex flex-wrap gap-x-3 text-gray-600">
                        {v.temperature != null && <span>{v.temperature}°F</span>}
                        {v.pulse != null && <span>{v.pulse} bpm</span>}
                        {(v.bp_systolic != null && v.bp_diastolic != null) && <span>BP {v.bp_systolic}/{v.bp_diastolic}</span>}
                        {v.spo2 != null && <span>SpO2 {v.spo2}%</span>}
                        {v.resp_rate != null && <span>RR {v.resp_rate}</span>}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(v.recorded_at).toLocaleString()}{v.recorded_by ? ` · ${v.recorded_by}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 pb-4 space-y-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Notes</h3>
                <button onClick={() => setShowNoteAdd(s => !s)} className="text-xs text-teal-600 font-medium hover:underline">
                  {showNoteAdd ? "Cancel" : "+ Add"}
                </button>
              </div>
              {showNoteAdd && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <select value={noteForm.shift} onChange={e => setNoteForm(f => ({ ...f, shift: e.target.value }))}
                    className="w-full border rounded-md px-2 py-1.5 text-xs bg-white">
                    <option value="day">Day shift</option>
                    <option value="night">Night shift</option>
                  </select>
                  <textarea value={noteForm.note} onChange={e => setNoteForm(f => ({ ...f, note: e.target.value }))}
                    rows={2} placeholder="Observation, condition update..."
                    className="w-full border rounded-md px-2 py-1.5 text-xs bg-white resize-none" />
                  <Input placeholder="Recorded by (nurse name)" value={noteForm.recordedBy}
                    onChange={e => setNoteForm(f => ({ ...f, recordedBy: e.target.value }))} />
                  <button onClick={handleAddNoteInline} disabled={noteSaving || !noteForm.note.trim()}
                    className="w-full px-3 py-1.5 rounded-md text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50">
                    {noteSaving ? "Saving..." : "Save Note"}
                  </button>
                </div>
              )}
              {historyLoading ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : notes.length === 0 ? (
                <p className="text-xs text-gray-400">No notes yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {notes.slice(0, 5).map(n => (
                    <div key={n.id} className="text-xs bg-gray-50 rounded px-2 py-1.5">
                      <p className="text-gray-600">{n.note}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 capitalize">
                        {n.shift} shift · {new Date(n.recorded_at).toLocaleString()}{n.recorded_by ? ` · ${n.recorded_by}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setDetailsTarget(null)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Close</button>
              <button onClick={() => handleVacate(detailsTarget.wardId, detailsTarget.bed.id)}
                disabled={bedLoading === detailsTarget.bed.id}
                className="px-4 py-2 rounded-lg text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:opacity-50">
                {bedLoading === detailsTarget.bed.id ? "Discharging..." : "Discharge & Send for Cleaning"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCleaningSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Cleaning Settings</h2>
              <button onClick={() => setShowCleaningSettings(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              <p className="text-xs text-gray-500">
                A bed's own cleaning time is used first, then its ward's, then the hospital default.
                Use the clock icon on a bed to set that bed's own time.
              </p>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Hospital default</label>
                <CleaningTimePicker value={hospitalCleaning} onChange={setHospitalCleaning} />
              </div>
              {wards.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-600">Ward defaults</p>
                  {wards.map(w => (
                    <div key={w.id}>
                      <label className="text-xs text-gray-500 mb-1 block">{w.name}</label>
                      <CleaningTimePicker
                        value={wardCleaning[w.id] || minutesToPicker(null)}
                        onChange={v => setWardCleaning(prev => ({ ...prev, [w.id]: v }))}
                        inheritLabel="Use hospital default" />
                    </div>
                  ))}
                </div>
              )}
              {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowCleaningSettings(false)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={saveCleaningSettings} disabled={settingsSaving}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                {settingsSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editCleaning && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Edit Cleaning Time - Bed {editCleaning.bed.bed_number}</h2>
              <button onClick={() => setEditCleaning(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <CleaningTimePicker value={editCleaningValue} onChange={setEditCleaningValue}
                inheritLabel="Use ward / hospital default" />
              <p className="text-xs text-gray-500">Applies the next time this bed is cleaned after a discharge.</p>
              {editCleaningError && <p className="text-xs text-red-600">{editCleaningError}</p>}
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setEditCleaning(null)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={saveEditCleaning} disabled={editCleaningSaving}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                {editCleaningSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cleaningTarget && cleaningBed && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Bed {cleaningBed.bed_number}</h2>
              <button onClick={() => setCleaningTarget(null)}><X className="w-4 h-4" /></button>
            </div>

            {cleaningView === "main" && (
              <>
                <div className="px-6 py-4 space-y-2 text-sm">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">Cleaning</span>
                  <p className="text-lg font-semibold text-gray-800">{formatRemaining(cleaningRemainingMs)}</p>
                  <p><span className="text-gray-500">Available after:</span> {formatDateTime(cleaningBed.cleaning_ends_at)}</p>
                  <p><span className="text-gray-500">Cleaning started:</span> {formatDateTime(cleaningBed.cleaning_started_at)}</p>
                  {cleaningBed.cleaning_duration_minutes ? (
                    <p><span className="text-gray-500">Cleaning time:</span> {formatDuration(cleaningBed.cleaning_duration_minutes)}</p>
                  ) : null}
                </div>
                <div className="px-6 py-4 border-t flex flex-wrap gap-3 justify-end">
                  <button onClick={() => setCleaningTarget(null)}
                    className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Close</button>
                  <button onClick={openExtend}
                    className="px-4 py-2 rounded-lg text-sm border border-teal-600 text-teal-700 hover:bg-teal-50 transition-colors">Extend Cleaning</button>
                  <button onClick={() => setCleaningView("confirm")}
                    className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors">Mark Cleaning Completed</button>
                </div>
              </>
            )}

            {cleaningView === "confirm" && (
              <>
                <div className="px-6 py-5 text-sm text-gray-700">
                  Cleaning for {cleaningBed.bed_number} is completed. Do you want to make this bed available now?
                </div>
                <div className="px-6 py-4 border-t flex gap-3 justify-end">
                  <button onClick={() => setCleaningView("main")}
                    className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={() => handleReady(cleaningTarget.wardId, cleaningTarget.bedId)}
                    disabled={bedLoading === cleaningBed.id}
                    className="px-4 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50">
                    {bedLoading === cleaningBed.id ? "Saving..." : "Mark Available"}
                  </button>
                </div>
              </>
            )}

            {cleaningView === "extend" && (
              <>
                <div className="px-6 py-4 space-y-3 text-sm">
                  <p className="font-medium text-gray-700">Extend cleaning by</p>
                  <CleaningTimePicker value={extendValue} onChange={setExtendValue} presets={EXTEND_PRESETS} />
                  {cleaningBed.cleaning_ends_at && typeof pickerToMinutes(extendValue) === "number" && (
                    <p className="text-xs text-gray-500">
                      Current end: {formatDateTime(cleaningBed.cleaning_ends_at)} - New end:{" "}
                      {formatDateTime(new Date(Date.parse(cleaningBed.cleaning_ends_at) + (pickerToMinutes(extendValue) as number) * 60000).toISOString())}
                    </p>
                  )}
                  {extendError && <p className="text-xs text-red-600">{extendError}</p>}
                </div>
                <div className="px-6 py-4 border-t flex gap-3 justify-end">
                  <button onClick={() => setCleaningView("main")}
                    className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Back</button>
                  <button onClick={saveExtend} disabled={extendSaving}
                    className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                    {extendSaving ? "Saving..." : "Extend"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
