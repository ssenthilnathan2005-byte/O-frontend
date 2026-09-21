import { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { Activity, Plus, X, Trash2, Thermometer, HeartPulse } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Vitals = {
  id: string; patient_name: string; bed_id: string | null; ward_id: string | null;
  temperature: number | null; pulse: number | null; bp_systolic: number | null;
  bp_diastolic: number | null; spo2: number | null; resp_rate: number | null;
  recorded_by: string | null; recorded_at: string;
};

type Note = {
  id: string; patient_name: string; bed_id: string | null; ward_id: string | null;
  note: string; shift: string; recorded_by: string | null; recorded_at: string;
};

const EMPTY_VITALS = {
  patientName: "", bedId: "", wardId: "", temperature: "", pulse: "",
  bpSystolic: "", bpDiastolic: "", spo2: "", respRate: "", recordedBy: "",
};
const EMPTY_NOTE = { patientName: "", bedId: "", wardId: "", note: "", shift: "day", recordedBy: "" };

export default function HANursing() {
  const { user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";

  const [tab, setTab] = useState<"vitals"|"notes">("vitals");
  const [vitals, setVitals] = useState<Vitals[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({ ...EMPTY_VITALS });
  const [noteForm, setNoteForm] = useState({ ...EMPTY_NOTE });
  const [loading, setLoading] = useState(false);

  async function apiFetch(path: string, method="GET", body?: any) {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: { "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async function loadVitals() {
    try { setVitals(await apiFetch("/nursing/vitals")); } catch {}
  }
  async function loadNotes() {
    try { setNotes(await apiFetch("/nursing/notes")); } catch {}
  }

  useEffect(() => { if (hospitalId) { loadVitals(); loadNotes(); } }, [hospitalId]);

  async function handleAddVitals() {
    if (!vitalsForm.patientName.trim()) return;
    setLoading(true);
    try {
      await apiFetch("/nursing/vitals", "POST", {
        patientName: vitalsForm.patientName, bedId: vitalsForm.bedId||null, wardId: vitalsForm.wardId||null,
        temperature: vitalsForm.temperature ? Number(vitalsForm.temperature) : null,
        pulse: vitalsForm.pulse ? Number(vitalsForm.pulse) : null,
        bpSystolic: vitalsForm.bpSystolic ? Number(vitalsForm.bpSystolic) : null,
        bpDiastolic: vitalsForm.bpDiastolic ? Number(vitalsForm.bpDiastolic) : null,
        spo2: vitalsForm.spo2 ? Number(vitalsForm.spo2) : null,
        respRate: vitalsForm.respRate ? Number(vitalsForm.respRate) : null,
        recordedBy: vitalsForm.recordedBy||null,
      });
      setShowVitalsForm(false); setVitalsForm({ ...EMPTY_VITALS }); await loadVitals();
    } catch {} finally { setLoading(false); }
  }

  async function handleAddNote() {
    if (!noteForm.patientName.trim() || !noteForm.note.trim()) return;
    setLoading(true);
    try {
      await apiFetch("/nursing/notes", "POST", {
        patientName: noteForm.patientName, bedId: noteForm.bedId||null, wardId: noteForm.wardId||null,
        note: noteForm.note, shift: noteForm.shift, recordedBy: noteForm.recordedBy||null,
      });
      setShowNoteForm(false); setNoteForm({ ...EMPTY_NOTE }); await loadNotes();
    } catch {} finally { setLoading(false); }
  }

  async function handleDeleteVitals(id: string) {
    if (!confirm("Delete this vitals entry?")) return;
    try { await apiFetch(`/nursing/vitals/${id}`, "DELETE"); await loadVitals(); } catch {}
  }
  async function handleDeleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    try { await apiFetch(`/nursing/notes/${id}`, "DELETE"); await loadNotes(); } catch {}
  }

  const filteredVitals = vitals.filter(v => v.patient_name.toLowerCase().includes(search.toLowerCase()));
  const filteredNotes = notes.filter(n => n.patient_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold">Nursing</h1>
        </div>
        <div className="flex gap-2">
          {tab === "vitals" && (
            <button onClick={() => setShowVitalsForm(true)}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Record Vitals
            </button>
          )}
          {tab === "notes" && (
            <button onClick={() => setShowNoteForm(true)}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add Note
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {(["vitals","notes"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${tab===t ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>
            {t === "vitals" ? `Vitals (${vitals.length})` : `Notes (${notes.length})`}
          </button>
        ))}
      </div>

      <Input placeholder="Search patient..." value={search}
        onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      {tab === "vitals" && (
        filteredVitals.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No vitals recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {filteredVitals.map(v => (
              <div key={v.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{v.patient_name}</p>
                      {(v.bed_id || v.ward_id) && (
                        <span className="text-xs text-gray-400">
                          {v.ward_id ? `Ward ${v.ward_id}` : ""}{v.bed_id ? ` · Bed ${v.bed_id}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                      {v.temperature != null && <span className="flex items-center gap-1"><Thermometer className="w-3.5 h-3.5 text-orange-400" /> {v.temperature}°F</span>}
                      {v.pulse != null && <span className="flex items-center gap-1"><HeartPulse className="w-3.5 h-3.5 text-red-400" /> {v.pulse} bpm</span>}
                      {(v.bp_systolic != null && v.bp_diastolic != null) && <span>BP {v.bp_systolic}/{v.bp_diastolic}</span>}
                      {v.spo2 != null && <span>SpO2 {v.spo2}%</span>}
                      {v.resp_rate != null && <span>RR {v.resp_rate}/min</span>}
                    </div>
                    {v.recorded_by && <p className="text-xs text-gray-400 mt-1">Recorded by {v.recorded_by}</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(v.recorded_at).toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleDeleteVitals(v.id)} className="p-1.5 rounded hover:bg-red-50 shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "notes" && (
        filteredNotes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No nursing notes yet.</div>
        ) : (
          <div className="space-y-2">
            {filteredNotes.map(n => (
              <div key={n.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{n.patient_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${n.shift === "night" ? "bg-indigo-50 text-indigo-600" : "bg-yellow-50 text-yellow-700"}`}>
                        {n.shift} shift
                      </span>
                      {(n.bed_id || n.ward_id) && (
                        <span className="text-xs text-gray-400">
                          {n.ward_id ? `Ward ${n.ward_id}` : ""}{n.bed_id ? ` · Bed ${n.bed_id}` : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1.5">{n.note}</p>
                    {n.recorded_by && <p className="text-xs text-gray-400 mt-1.5">Recorded by {n.recorded_by}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(n.recorded_at).toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleDeleteNote(n.id)} className="p-1.5 rounded hover:bg-red-50 shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Record Vitals Modal */}
      {showVitalsForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Record Vitals</h2>
              <button onClick={() => setShowVitalsForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Patient Name *</label>
                <Input placeholder="Patient name" value={vitalsForm.patientName}
                  onChange={e => setVitalsForm(f => ({ ...f, patientName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Ward</label>
                  <Input placeholder="Ward ID" value={vitalsForm.wardId}
                    onChange={e => setVitalsForm(f => ({ ...f, wardId: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Bed</label>
                  <Input placeholder="Bed ID" value={vitalsForm.bedId}
                    onChange={e => setVitalsForm(f => ({ ...f, bedId: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Temp (°F)</label>
                  <Input type="number" value={vitalsForm.temperature}
                    onChange={e => setVitalsForm(f => ({ ...f, temperature: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Pulse (bpm)</label>
                  <Input type="number" value={vitalsForm.pulse}
                    onChange={e => setVitalsForm(f => ({ ...f, pulse: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">BP Systolic</label>
                  <Input type="number" value={vitalsForm.bpSystolic}
                    onChange={e => setVitalsForm(f => ({ ...f, bpSystolic: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">BP Diastolic</label>
                  <Input type="number" value={vitalsForm.bpDiastolic}
                    onChange={e => setVitalsForm(f => ({ ...f, bpDiastolic: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">SpO2 (%)</label>
                  <Input type="number" value={vitalsForm.spo2}
                    onChange={e => setVitalsForm(f => ({ ...f, spo2: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Resp Rate</label>
                  <Input type="number" value={vitalsForm.respRate}
                    onChange={e => setVitalsForm(f => ({ ...f, respRate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Recorded By</label>
                <Input placeholder="Nurse name" value={vitalsForm.recordedBy}
                  onChange={e => setVitalsForm(f => ({ ...f, recordedBy: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowVitalsForm(false)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddVitals} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50">
                {loading ? "Saving..." : "Save Vitals"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showNoteForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Add Nursing Note</h2>
              <button onClick={() => setShowNoteForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Patient Name *</label>
                <Input placeholder="Patient name" value={noteForm.patientName}
                  onChange={e => setNoteForm(f => ({ ...f, patientName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Ward</label>
                  <Input placeholder="Ward ID" value={noteForm.wardId}
                    onChange={e => setNoteForm(f => ({ ...f, wardId: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Bed</label>
                  <Input placeholder="Bed ID" value={noteForm.bedId}
                    onChange={e => setNoteForm(f => ({ ...f, bedId: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Shift</label>
                <select value={noteForm.shift} onChange={e => setNoteForm(f => ({ ...f, shift: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Note *</label>
                <textarea value={noteForm.note} onChange={e => setNoteForm(f => ({ ...f, note: e.target.value }))}
                  rows={3} placeholder="Patient condition, observations..."
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Recorded By</label>
                <Input placeholder="Nurse name" value={noteForm.recordedBy}
                  onChange={e => setNoteForm(f => ({ ...f, recordedBy: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowNoteForm(false)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddNote} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50">
                {loading ? "Saving..." : "Add Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
