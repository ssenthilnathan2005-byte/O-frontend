import { useEffect, useState, Fragment } from "react";
import * as api from "../../api";
import { useStore } from "../../context/StoreContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BedDouble, Plus, X, Pencil, LogOut, ChevronDown, ChevronUp, Thermometer, HeartPulse, Download } from "lucide-react";
import { getToken } from "../../api";
import { downloadFile } from "../../lib/downloadFile";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

type InwardPatient = {
  id: string; patient_name: string; phone: string | null; age: number | null;
  gender: string | null; ward: string | null; bed_number: string | null;
  admitting_doctor_name: string | null; diagnosis: string | null;
  notes: string | null; status: "admitted" | "discharged";
  admitted_at: string; discharged_at: string | null;
};

const EMPTY_FORM = {
  patientName: "", phone: "", age: "", gender: "", ward: "",
  bedNumber: "", admittingDoctorName: "", diagnosis: "", notes: "",
};

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function HAInward() {
  const { doctors, user } = useStore();
  const [patients, setPatients] = useState<InwardPatient[]>([]);
  const [tab, setTab] = useState<"admitted" | "discharged">("admitted");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, { vitals: any[]; notes: any[] }>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState(monthAgoStr());
  const [exportTo, setExportTo] = useState(todayStr());
  const [exporting, setExporting] = useState(false);

  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";
  const myDoctors = doctors.filter((d: any) => d.hospitalId === hospitalId);

  async function load() {
    try { setPatients(await api.inward.list()); } catch (_) {}
  }

  async function toggleHistory(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!history[id]) {
      setHistoryLoading(id);
      try {
        const [v, n] = await Promise.all([api.nursing.listVitals(id), api.nursing.listNotes(id)]);
        setHistory(h => ({ ...h, [id]: { vitals: Array.isArray(v) ? v : [], notes: Array.isArray(n) ? n : [] } }));
      } catch { setHistory(h => ({ ...h, [id]: { vitals: [], notes: [] } })); } finally { setHistoryLoading(null); }
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = patients.filter(p =>
    p.status === tab &&
    (p.patient_name.toLowerCase().includes(search.toLowerCase()) ||
     (p.ward || "").toLowerCase().includes(search.toLowerCase()) ||
     (p.bed_number || "").toLowerCase().includes(search.toLowerCase()))
  );

  function openAdmit() { setForm({ ...EMPTY_FORM }); setEditId(null); setShowForm(true); }
  function openEdit(p: InwardPatient) {
    setForm({
      patientName: p.patient_name, phone: p.phone || "", age: p.age?.toString() || "",
      gender: p.gender || "", ward: p.ward || "", bedNumber: p.bed_number || "",
      admittingDoctorName: p.admitting_doctor_name || "",
      diagnosis: p.diagnosis || "", notes: p.notes || "",
    });
    setEditId(p.id); setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.patientName.trim()) return;
    setLoading(true);
    try {
      const payload = {
        patientName: form.patientName, phone: form.phone,
        age: form.age ? Number(form.age) : null,
        gender: form.gender, ward: form.ward, bedNumber: form.bedNumber,
        admittingDoctorName: form.admittingDoctorName,
        diagnosis: form.diagnosis, notes: form.notes,
      };
      if (editId) await api.inward.update(editId, payload);
      else await api.inward.admit(payload);
      setShowForm(false); await load();
    } catch (_) {} finally { setLoading(false); }
  }

  async function handleDischarge(id: string) {
    if (!confirm("Mark this patient as discharged?")) return;
    try { await api.inward.discharge(id); await load(); } catch (_) {}
  }

  async function handleExport() {
    if (!exportFrom || !exportTo) return;
    setExporting(true);
    try {
      const qs = new URLSearchParams({ from: exportFrom, to: exportTo });
      if (hospitalId) qs.set("hospitalId", hospitalId);
      const res = await fetch(`${BASE}/inward/export?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 404) { alert("No inward patient records found for this period."); return; }
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      await downloadFile(blob, `inward_${exportFrom}_to_${exportTo}.xlsx`);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BedDouble className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold">Inward Patients</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
            className="border rounded-lg px-2.5 py-2 text-sm bg-background" />
          <span className="text-sm text-muted-foreground">to</span>
          <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
            className="border rounded-lg px-2.5 py-2 text-sm bg-background" />
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> {exporting ? "Exporting..." : "Download"}
          </button>
          <button onClick={openAdmit}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Admit Patient
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["admitted", "discharged"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <Input placeholder="Search by name, ward, bed..." value={search}
        onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Patient", "Ward / Bed", "Doctor", "Diagnosis", "Days", "Status", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No {tab} patients</td></tr>
            )}
            {filtered.map(p => (
              <Fragment key={p.id}>
              <tr className="border-t hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium">{p.patient_name}</p>
                  {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                  {p.age && <p className="text-xs text-muted-foreground">{p.age}y {p.gender || ""}</p>}
                </td>
                <td className="px-4 py-3">
                  <p>{p.ward || "—"}</p>
                  {p.bed_number && <p className="text-xs text-muted-foreground">Bed {p.bed_number}</p>}
                </td>
                <td className="px-4 py-3">{p.admitting_doctor_name || "—"}</td>
                <td className="px-4 py-3 max-w-[180px] truncate">{p.diagnosis || "—"}</td>
                <td className="px-4 py-3">{daysSince(p.admitted_at)}d</td>
                <td className="px-4 py-3">
                  <Badge className={p.status === "admitted" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                    {p.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => toggleHistory(p.id)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Vitals & notes">
                      {expandedId === p.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-muted transition-colors">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {p.status === "admitted" && (
                      <button onClick={() => handleDischarge(p.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                        <LogOut className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {expandedId === p.id && (
                <tr className="border-t bg-muted/10">
                  <td colSpan={7} className="px-4 py-3">
                    {historyLoading === p.id ? (
                      <p className="text-xs text-muted-foreground">Loading history...</p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Vitals</p>
                          {(history[p.id]?.vitals.length ?? 0) === 0 ? (
                            <p className="text-xs text-muted-foreground">No vitals recorded.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {history[p.id].vitals.slice(0, 5).map((v: any) => (
                                <div key={v.id} className="text-xs bg-background rounded px-2 py-1.5 border">
                                  <div className="flex flex-wrap gap-x-3 text-muted-foreground">
                                    {v.temperature != null && <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> {v.temperature}°F</span>}
                                    {v.pulse != null && <span className="flex items-center gap-1"><HeartPulse className="w-3 h-3" /> {v.pulse} bpm</span>}
                                    {(v.bp_systolic != null && v.bp_diastolic != null) && <span>BP {v.bp_systolic}/{v.bp_diastolic}</span>}
                                    {v.spo2 != null && <span>SpO2 {v.spo2}%</span>}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                    {new Date(v.recorded_at).toLocaleString()}{v.recorded_by ? ` · ${v.recorded_by}` : ""}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Notes</p>
                          {(history[p.id]?.notes.length ?? 0) === 0 ? (
                            <p className="text-xs text-muted-foreground">No notes recorded.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {history[p.id].notes.slice(0, 5).map((n: any) => (
                                <div key={n.id} className="text-xs bg-background rounded px-2 py-1.5 border">
                                  <p className="text-muted-foreground">{n.note}</p>
                                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 capitalize">
                                    {n.shift} shift · {new Date(n.recorded_at).toLocaleString()}{n.recorded_by ? ` · ${n.recorded_by}` : ""}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">{editId ? "Update Patient" : "Admit Patient"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {[
                { label: "Patient Name *", key: "patientName", placeholder: "Full name" },
                { label: "Phone", key: "phone", placeholder: "Mobile number" },
                { label: "Age", key: "age", placeholder: "Age in years" },
                { label: "Ward", key: "ward", placeholder: "e.g. General Ward, ICU" },
                { label: "Bed Number", key: "bedNumber", placeholder: "e.g. B-12" },
                { label: "Diagnosis", key: "diagnosis", placeholder: "Primary diagnosis" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">{label}</label>
                  <Input placeholder={placeholder} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Gender</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Admitting Doctor</label>
                <select value={form.admittingDoctorName} onChange={e => setForm(f => ({ ...f, admittingDoctorName: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="">Select doctor</option>
                  {myDoctors.map((d: any) => (
                    <option key={d.id} value={d.name}>{d.name} — {d.specialty}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Additional notes..." rows={3}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                {loading ? "Saving..." : editId ? "Update" : "Admit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
