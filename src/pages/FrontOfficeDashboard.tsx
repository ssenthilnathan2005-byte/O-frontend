import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { LogOut, RefreshCw, UserCheck, BedDouble, Undo2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToken } from "@/api";
import { useStore } from "../context/StoreContext";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

async function call(path: string, method = "GET", body?: any) {
  const r = await fetch(BASE + "/front-office" + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}

interface OPBooking {
  id: string; patient_name: string; patient_age: number | null; phone: string | null; complaint: string | null;
  doctor_name: string; session: string; token_number: number; status: string; checked_in_at: string | null;
}
interface Bed { bed_id: string; bed_number: string; ward_id: string; ward_name: string }
interface Admitted {
  id: string; patient_name: string; phone: string | null; age: number | null; gender: string | null;
  ward: string | null; bed_number: string | null; admitting_doctor_name: string | null; diagnosis: string | null; admitted_at: string;
}

const sel = "w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Outpatients() {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<OPBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState({ phone: "", patientAge: "", complaint: "" });
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await call("/today" + (date ? "?date=" + date : ""));
      setRows(res.bookings);
      if (!date) setDate(res.date);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  function startEdit(b: OPBooking) {
    setEditId(b.id);
    setF({ phone: b.phone || "", patientAge: b.patient_age != null ? String(b.patient_age) : "", complaint: b.complaint || "" });
  }
  async function checkIn(id: string) {
    try { await call("/bookings/" + id + "/check-in", "POST", f); toast.success("Checked in"); setEditId(null); load(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function undo(id: string) {
    try { await call("/bookings/" + id + "/undo-check-in", "POST", {}); toast.success("Check-in undone"); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  const ql = q.trim().toLowerCase();
  const shown = rows.filter(b => !ql || b.patient_name.toLowerCase().includes(ql) || (b.phone || "").includes(ql) || String(b.token_number) === ql);
  const groups: Record<string, OPBooking[]> = {};
  shown.forEach(b => { const k = cap(b.session) + " - " + b.doctor_name; (groups[k] = groups[k] || []).push(b); });
  const arrived = rows.filter(b => b.checked_in_at).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="space-y-1 flex-1 min-w-[160px]"><Label>Search</Label><Input placeholder="Name, phone or token" value={q} onChange={e => setQ(e.target.value)} /></div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={"w-4 h-4 " + (loading ? "animate-spin" : "")} /></Button>
      </div>
      <p className="text-sm text-gray-500">{arrived} of {rows.length} patients checked in</p>
      {Object.keys(groups).length === 0 && <p className="text-sm text-gray-400 py-8 text-center">No bookings for this date.</p>}
      {Object.entries(groups).map(([k, list]) => (
        <div key={k} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 text-sm font-semibold text-gray-700">{k}</div>
          {list.map(b => (
            <div key={b.id} className="px-4 py-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 font-bold flex items-center justify-center">{b.token_number}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{b.patient_name}{b.patient_age != null ? ", " + b.patient_age : ""}</p>
                  <p className="text-xs text-gray-500 truncate">{b.phone || "No phone"}{b.complaint ? " | " + b.complaint : ""}</p>
                </div>
                {b.status !== "confirmed" ? (
                  <span className="text-xs text-gray-500">{cap(b.status)}</span>
                ) : b.checked_in_at ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1">Checked in</span>
                    <Button size="sm" variant="ghost" onClick={() => undo(b.id)}><Undo2 className="w-4 h-4" /></Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => startEdit(b)}><UserCheck className="w-4 h-4 mr-1" />Check in</Button>
                )}
              </div>
              {editId === b.id && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input placeholder="Phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
                  <Input placeholder="Age" value={f.patientAge} onChange={e => setF({ ...f, patientAge: e.target.value })} />
                  <Input placeholder="Complaint" value={f.complaint} onChange={e => setF({ ...f, complaint: e.target.value })} />
                  <div className="sm:col-span-3 flex gap-2">
                    <Button size="sm" onClick={() => checkIn(b.id)}>Confirm check-in</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Admit() {
  const [doctors, setDoctors] = useState<{ id: string; name: string; specialty: string }[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [inward, setInward] = useState<Admitted[]>([]);
  const empty = { patientName: "", phone: "", age: "", gender: "", admittingDoctorId: "", bed: "", diagnosis: "", notes: "" };
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, b, i] = await Promise.all([call("/doctors"), call("/beds"), call("/inward")]);
      setDoctors(d); setBeds(b); setInward(i);
    } catch (e: any) { toast.error(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!f.patientName.trim()) { toast.error("Enter the patient name"); return; }
    if (!f.bed) { toast.error("Choose a bed"); return; }
    const [wardId, bedId] = f.bed.split("|");
    setSaving(true);
    try {
      const res = await call("/admit", "POST", {
        patientName: f.patientName, phone: f.phone, age: f.age, gender: f.gender,
        admittingDoctorId: f.admittingDoctorId || null, diagnosis: f.diagnosis, notes: f.notes, wardId, bedId,
      });
      toast.success("Admitted to " + res.ward + " / " + res.bed);
      setF(empty); load();
    } catch (e: any) { toast.error(e.message); load(); }
    finally { setSaving(false); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">Admit inpatient</h2>
        <div className="space-y-1"><Label>Patient name *</Label><Input value={f.patientName} onChange={e => setF({ ...f, patientName: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1 col-span-2"><Label>Phone</Label><Input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
          <div className="space-y-1"><Label>Age</Label><Input value={f.age} onChange={e => setF({ ...f, age: e.target.value })} /></div>
        </div>
        <div className="space-y-1"><Label>Gender</Label>
          <select className={sel} value={f.gender} onChange={e => setF({ ...f, gender: e.target.value })}>
            <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
          </select></div>
        <div className="space-y-1"><Label>Ward / bed *</Label>
          <select className={sel} value={f.bed} onChange={e => setF({ ...f, bed: e.target.value })}>
            <option value="">{beds.length ? "Select an available bed" : "No beds available"}</option>
            {beds.map(b => <option key={b.bed_id} value={b.ward_id + "|" + b.bed_id}>{b.ward_name} - {b.bed_number}</option>)}
          </select></div>
        <div className="space-y-1"><Label>Admitting doctor</Label>
          <select className={sel} value={f.admittingDoctorId} onChange={e => setF({ ...f, admittingDoctorId: e.target.value })}>
            <option value="">Select</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>)}
          </select></div>
        <div className="space-y-1"><Label>Diagnosis</Label><Input value={f.diagnosis} onChange={e => setF({ ...f, diagnosis: e.target.value })} /></div>
        <div className="space-y-1"><Label>Notes</Label><Input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Admitting..." : "Admit patient"}</Button>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Currently admitted ({inward.length})</h2>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
        {inward.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">No admitted patients.</p>}
        <div className="space-y-2">
          {inward.map(p => (
            <div key={p.id} className="border border-gray-100 rounded-lg px-3 py-2">
              <p className="font-medium text-gray-900">{p.patient_name}{p.age != null ? ", " + p.age : ""}</p>
              <p className="text-xs text-gray-500">{p.ward} / {p.bed_number}{p.admitting_doctor_name ? " | " + p.admitting_doctor_name : ""}</p>
              {p.diagnosis && <p className="text-xs text-gray-400">{p.diagnosis}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FrontOfficeDashboard() {
  const { user, logout } = useStore() as any;
  const [tab, setTab] = useState<"op" | "admit">("op");
  const tabCls = (on: boolean) => "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium " + (on ? "bg-teal-500 text-white" : "bg-white border border-gray-200 text-gray-600");
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-white" /></div>
        <div className="flex-1">
          <p className="font-bold text-gray-900 leading-tight">Front Office</p>
          <p className="text-xs text-gray-500">{user?.hospitalName}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => logout()}><LogOut className="w-4 h-4 mr-1" />Sign out</Button>
      </header>
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex gap-2">
          <button className={tabCls(tab === "op")} onClick={() => setTab("op")}><UserCheck className="w-4 h-4" />Today's outpatients</button>
          <button className={tabCls(tab === "admit")} onClick={() => setTab("admit")}><BedDouble className="w-4 h-4" />Admit inpatient</button>
        </div>
        {tab === "op" ? <Outpatients /> : <Admit />}
      </main>
    </div>
  );
}
