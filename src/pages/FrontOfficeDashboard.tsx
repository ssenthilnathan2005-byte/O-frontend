import { hasSessionEndedForDate, getSessionLabelForDate } from "../data/seed";
import VitalsScanAll from "@/components/VitalsScanAll";
import DateInput from "@/components/DateInput";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { LogOut, RefreshCw, UserCheck, BedDouble, Undo2, ClipboardList, Activity, Receipt, Printer, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSymptomsForSpecialty } from "@/data/doctorSymptoms";
import { getToken } from "@/api";
import { useStore } from "../context/StoreContext";
import { Vitals, vitalsText } from "@/lib/vitals";
import { useExtraNav, ExtraPanel } from "@/components/StaffExtras";
import useModules from "@/hooks/useModules";
import HABedRequests from "./hospital-admin/HABedRequests";
import IPDBillModal from "./hospital-admin/IPDBillModal";
import { maternityApi } from "@/lib/maternityApi";
import { printMaternityRecord } from "@/lib/maternityRecord";

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
  doctor_name: string; session: string; token_number: number; status: string; checked_in_at: string | null; vitals?: Vitals | null;
  booking_source?: string | null; fee_amount?: number | null; fee_mode?: string | null; fee_paid_at?: string | null; doctor_fee?: number | null;
}
interface Bed { bed_id: string; bed_number: string; ward_id: string; ward_name: string }
interface Admitted {
  id: string; patient_name: string; phone: string | null; age: number | null; gender: string | null;
  ward: string | null; bed_number: string | null; admitting_doctor_name: string | null; diagnosis: string | null; admitted_at: string;
}

const sel = "w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function RegisterWalkIn() {
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const [docs, setDocs] = useState<any[]>([]);
  const empty = { patientName: "", phone: "", age: "", complaint: "", description: "", doctorId: "", session: "morning", date: today };
  const [spec, setSpec] = useState("");
  const [syms, setSyms] = useState<string[]>([]);
  const [dateText, setDateText] = useState(today.split("-").reverse().join("-"));
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<any>(null);
  const selDoc: any = docs.find((d: any) => d.id === f.doctorId);
  const specialties = Array.from(new Set(docs.map((d: any) => d.specialty).filter(Boolean))).sort() as string[];
  const shownDocs = spec ? docs.filter((d: any) => d.specialty === spec) : docs;
  const symData = selDoc ? getSymptomsForSpecialty(selDoc.specialty || "") : null;
  const onDateText = (v: string) => {
    const t = v.replace(/[^\d-]/g, "").slice(0, 10);
    setDateText(t);
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(t);
    if (!m) return;
    const iso = m[3] + "-" + m[2] + "-" + m[1];
    const d = new Date(iso + "T00:00:00Z");
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso) setF((p) => ({ ...p, date: iso }));
  };
  const parseJ = (v: any) => { if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } } return v ?? null; };
  const sessionOptions: string[] = ["morning", "afternoon", "evening"].filter((sn) => {
    if (!selDoc) return false;
    const cfg = parseJ(selDoc.schedule_config);
    const tim = parseJ(selDoc.session_timings);
    const list = parseJ(selDoc.sessions);
    if (Array.isArray(list) && list.length) {
      if (!list.includes(sn)) return false;
    } else if (!(tim && tim[sn]) && !(cfg && ((cfg.weekday && cfg.weekday[sn]) || (cfg.weekend && cfg.weekend[sn])))) {
      return false;
    }
    const [yy, mm, dd] = f.date.split("-").map(Number);
    const dow = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
    const bucket = cfg && cfg[dow === 0 || dow === 6 ? "weekend" : "weekday"];
    const raw = bucket ? bucket[sn] : undefined;
    const cnt = raw && typeof raw === "object" ? raw.count : raw;
    if (cnt !== undefined && cnt !== null && cnt !== "" && Number(cnt) === 0) return false;
    return !hasSessionEndedForDate(f.date, sn as any, cfg as any, tim as any);
  });
  useEffect(() => {
    if (sessionOptions.length && !sessionOptions.includes(f.session)) setF((p) => ({ ...p, session: sessionOptions[0] }));
  }, [f.doctorId, f.date, sessionOptions.join()]);
  useEffect(() => { call("/walkin/doctors").then((r) => setDocs(r.doctors || [])).catch((e) => toast.error(e.message)); }, []);
  async function submit() {
    if (!f.patientName.trim()) return toast.error("Enter patient name");
    if (!f.doctorId) return toast.error("Choose a doctor");
    if (dateText !== f.date.split("-").reverse().join("-")) return toast.error("Enter a valid date as dd-mm-yyyy");
    if (!sessionOptions.includes(f.session)) return toast.error("No session available for this doctor on this date");
    setSaving(true);
    try {
      const { description, ...rest } = f;
      const r = await call("/walkin", "POST", { ...rest, complaint: [[...syms, f.complaint.trim()].filter(Boolean).join(", "), description.trim()].filter(Boolean).join(" - ") });
      setDone(r);
      setF({ ...empty, doctorId: f.doctorId, session: f.session, date: f.date });
      setSyms([]);
      toast.success("Token " + r.tokenNumber + " created");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-gray-500">For patients without the app. The patient gets the next token in the doctor's queue.</p>
      {done && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
          <b>{done.patientName}</b>: token <b>{done.tokenNumber}</b>, {done.doctorName} ({done.session}, {String(done.date || "").split("-").reverse().join("-")})
        </div>
      )}
      <div className="space-y-1.5"><Label className="block">Patient name *</Label><Input style={{ height: 40 }} value={f.patientName} onChange={(e) => setF({ ...f, patientName: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label className="block">Phone (optional)</Label><Input style={{ height: 40 }} inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div className="space-y-1.5"><Label className="block">Age</Label><Input style={{ height: 40 }} inputMode="numeric" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} /></div>
      </div>
      
      <div className="space-y-1.5"><Label className="block">Type of doctor</Label>
        <select className={sel} value={spec} onChange={(e) => { const v = e.target.value; setSpec(v); if (v && selDoc && selDoc.specialty !== v) { setF({ ...f, doctorId: "" }); setSyms([]); } }}>
          <option value="">All types</option>
          {specialties.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
        </select>
      </div>
      <div className="space-y-1.5"><Label className="block">Doctor *</Label>
        <select className={sel} value={f.doctorId} onChange={(e) => { setF({ ...f, doctorId: e.target.value }); setSyms([]); }}>
          <option value="">Select doctor</option>
          {shownDocs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.specialty ? " - " + d.specialty : ""}</option>)}
        </select>
      </div>
      {symData ? (
        <div className="space-y-1.5"><Label className="block">Symptoms / Reason for visit <span className="text-xs text-gray-400">({symData.label})</span></Label>
          <div className="rounded-md border border-gray-200 bg-white max-h-52 overflow-y-auto p-1">
            <p className="text-xs text-gray-400 px-2 pt-1 pb-1">Select all that apply</p>
            {symData.symptoms.map((sy) => (
              <label key={sy} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={syms.includes(sy)} onChange={() => setSyms((p) => p.includes(sy) ? p.filter((x) => x !== sy) : [...p, sy])} />
                {sy}
              </label>
            ))}
          </div>
          {syms.length > 0 && <p className="text-xs text-teal-600 font-medium">{syms.length} selected</p>}
        </div>
      ) : (
        <div className="space-y-1.5"><Label className="block">Complaint</Label><Input style={{ height: 40 }} value={f.complaint} onChange={(e) => setF({ ...f, complaint: e.target.value })} /></div>
      )}
      <div className="space-y-1.5"><Label className="block">Any other details (optional)</Label>
        <textarea rows={3} className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm" placeholder="Anything else the doctor should know" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label className="block">Session</Label>
          <select className={sel} value={f.session} onChange={(e) => setF({ ...f, session: e.target.value })}>
            {sessionOptions.length === 0 ? <option value="">{f.doctorId ? "Doctor not available on this date" : "Select doctor first"}</option> : sessionOptions.map((sn) => <option key={sn} value={sn}>{getSessionLabelForDate(f.date, sn as any, parseJ(selDoc?.schedule_config) as any, parseJ(selDoc?.session_timings) as any)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label className="block">Date (dd-mm-yyyy)</Label>
          <div className="relative">
            <Input style={{ height: 40 }} inputMode="numeric" placeholder="dd-mm-yyyy" maxLength={10} value={dateText} onChange={(e) => onDateText(e.target.value)} />
            <button type="button" aria-label="Pick date" className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-gray-500"
              onClick={(e) => { const el = e.currentTarget.nextElementSibling as HTMLInputElement | null; try { el?.showPicker(); } catch { el?.focus(); } }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            </button>
            <input type="date" tabIndex={-1} aria-hidden="true" className="absolute right-0 bottom-0 h-10 w-10 opacity-0 pointer-events-none" value={f.date}
              onChange={(e) => { if (e.target.value) { setF({ ...f, date: e.target.value }); setDateText(e.target.value.split("-").reverse().join("-")); } }} />
          </div>
        </div>
      </div>
      <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Create token"}</Button>
    </div>
  );
}

function Outpatients() {
  const [date, setDate] = useState("");
  const { user: foUser } = useStore() as any;
  function printReceipt(b: OPBooking) {
    const esc = (x: any) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]);
    const w = window.open("", "_blank", "width=380,height=560");
    if (!w) { toast.error("Allow pop-ups to print"); return; }
    w.document.write("<html><head><title>Receipt</title><style>body{font-family:Arial,sans-serif;padding:18px;font-size:13px}h2{margin:0 0 2px}hr{margin:10px 0}td{padding:3px 0}.r{text-align:right}</style></head><body>" +
      "<h2>" + esc(foUser?.hospitalName) + "</h2><div>Consultation fee receipt</div><hr/><table width='100%'>" +
      "<tr><td>Date</td><td class='r'>" + esc(new Date(b.fee_paid_at as string).toLocaleString()) + "</td></tr>" +
      "<tr><td>Patient</td><td class='r'>" + esc(b.patient_name) + "</td></tr>" +
      "<tr><td>Doctor</td><td class='r'>" + esc(b.doctor_name) + "</td></tr>" +
      "<tr><td>Token</td><td class='r'>" + esc(b.token_number) + "</td></tr>" +
      "<tr><td>Paid by</td><td class='r'>" + esc(String(b.fee_mode).toUpperCase()) + "</td></tr>" +
      "<tr><td><b>Amount</b></td><td class='r'><b>Rs. " + esc(b.fee_amount) + "</b></td></tr></table><hr/><div>Thank you</div></body></html>");
    w.document.close(); w.focus(); w.print();
  }
  const [rows, setRows] = useState<OPBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState({ phone: "", patientAge: "", complaint: "" });
  const [q, setQ] = useState("");
  const [vitalsId, setVitalsId] = useState<string | null>(null);
  const [feeId, setFeeId] = useState<string | null>(null);
  const [feeAmt, setFeeAmt] = useState("");
  const [feeMode, setFeeMode] = useState("cash");
  const emptyV = { temperature: "", tempUnit: "F", bpSystolic: "", bpDiastolic: "", pulse: "", spo2: "", weight: "", notes: "" };
  const [vf, setVf] = useState(emptyV);
  const [intake, setIntake] = useState<any>(null);
  useEffect(() => { call("/intake-config").then(setIntake).catch(() => {}); }, []);
  const ik = (k: string) => !intake || (intake.fields || []).some((x: any) => x.key === k);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await call("/today" + (date ? "?date=" + date : ""));
      setRows(res.bookings);
      if (!date) setDate(res.date);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

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

  function startVitals(b: OPBooking) {
    setEditId(null); setVitalsId(b.id);
    const v: any = b.vitals || {};
    setVf({ ...emptyV, ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)])) } as any);
  }
  async function saveVitals(id: string) {
    try { await call("/bookings/" + id + "/vitals", "POST", vf); toast.success("Vitals saved"); setVitalsId(null); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  function startFee(b: OPBooking) { setEditId(null); setVitalsId(null); setFeeId(b.id); setFeeAmt(b.doctor_fee != null ? String(b.doctor_fee) : ""); setFeeMode("cash"); }
  async function saveFee(id: string) {
    try { await call("/bookings/" + id + "/fee", "POST", { amount: feeAmt, mode: feeMode }); toast.success("Fee collected"); setFeeId(null); load(); }
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
        <div className="space-y-1"><Label>Date</Label><DateInput value={date} onChange={e => setDate(e.target.value)} /></div>
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
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[2.25rem] h-9 px-1 rounded-lg bg-teal-50 text-teal-700 font-bold flex items-center justify-center">{b.token_number}</div>
                <div className="flex-1 min-w-[140px]">
                  <p className="font-medium text-gray-900 truncate">{b.patient_name}{b.patient_age != null ? ", " + b.patient_age : ""}{b.booking_source === "front_desk" && <span className="ml-2 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">Front desk</span>}</p>
                  <p className="text-xs text-gray-500 truncate">{b.phone || "No phone"}{b.complaint ? " | " + b.complaint : ""}</p>
                </div>
                {(b as any).stage && <span className={"text-xs font-medium rounded-md px-2 py-1 border " + ((b as any).stage === "collected" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : (b as any).stage === "collect_tablets" ? "bg-amber-50 text-amber-700 border-amber-100" : (b as any).stage === "seen" ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-gray-50 text-gray-600 border-gray-200")}>{({ waiting: "Waiting", seen: "Seen doctor", collect_tablets: "Collect tablets", collected: "Tablets collected" } as Record<string, string>)[(b as any).stage]}</span>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {([["Checked in", !!b.checked_in_at], ["Consulted", b.status === "completed"], ["Medicines", (b as any).rx_status === "handed_over"]] as [string, boolean][]).map(([l, d]) => (
                    <span key={l} className={d ? "font-medium text-emerald-700" : "text-gray-300"}>{d ? "\u2713" : "\u25CB"} {l}</span>
                  ))}
                </div>
                {b.status !== "confirmed" ? (
                  <span className="text-xs text-gray-500">{cap(b.status)}</span>
                ) : b.checked_in_at ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1">Checked in</span>
                    <Button size="sm" variant="outline" onClick={() => startVitals(b)}><Activity className="w-4 h-4 mr-1" />{b.vitals ? "Edit vitals" : "Vitals"}</Button>
                    {b.fee_paid_at
                      ? <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1">Paid {"\u20B9"}{b.fee_amount} ({b.fee_mode})</span>
                      : <Button size="sm" variant="outline" onClick={() => startFee(b)}>Collect fee{b.doctor_fee != null ? " \u20B9" + b.doctor_fee : ""}</Button>}
                    {b.fee_paid_at && <Button size="sm" variant="outline" onClick={() => printReceipt(b)}>Receipt</Button>}
                    <Button size="sm" variant="ghost" onClick={() => undo(b.id)}><Undo2 className="w-4 h-4" /></Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => startEdit(b)}><UserCheck className="w-4 h-4 mr-1" />Check in</Button>
                )}
              </div>
              {b.vitals && vitalsId !== b.id && <p className="mt-2 text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-md px-2 py-1">{vitalsText(b.vitals)}</p>}
              {vitalsId === b.id && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-500">All fields are optional. Fill only what was measured.</p>
                  {/* VITALS_GROUPS_V1 */}
                  {(() => {
                    const CORE = ["temperature", "bp", "pulse", "spo2", "weight", "height"];
                    const GROUPS: { title: string; keys: string[] }[] = [
                      { title: "Eye", keys: ["visualAcuityR", "visualAcuityL", "iop", "usesGlasses"] },
                      { title: "Maternity", keys: ["lmp", "edd", "pregnancyNo"] },
                      { title: "Pediatric", keys: ["headCirc", "immunization"] },
                      { title: "ENT", keys: ["affectedPart", "affectedSide"] },
                      { title: "Cardiac", keys: ["ecgDone"] },
                      { title: "Diabetes", keys: ["rbs", "hba1c"] },
                      { title: "Injury & pain", keys: ["painScore", "injurySite", "injuryDate"] },
                      { title: "Skin", keys: ["skinDuration"] },
                      { title: "History & risk", keys: ["dmBpHistory", "allergies", "bloodThinner"] },
                    ];
                    const fields: any[] = intake?.fields || [];
                    const used = new Set<string>(GROUPS.flatMap(g => g.keys));
                    const boxes = GROUPS.map(g => ({ title: g.title, items: fields.filter((x: any) => g.keys.includes(x.key)) }));
                    const other = fields.filter((x: any) => !CORE.includes(x.key) && !used.has(x.key));
                    if (other.length) boxes.push({ title: "Other", items: other });
                    const heightDef = fields.find((x: any) => x.key === "height");
                    const hasCore = CORE.some(k => k === "height" ? !!heightDef : ik(k));
                    const scanOn = ik("temperature") || ik("bp") || ik("pulse") || ik("spo2");
                    const renderField = (x: any) => {
                      const val = String((vf as any)[x.key] ?? "");
                      const set = (v: string) => setVf({ ...vf, [x.key]: v } as any);
                      return (
                        <div key={x.key} className="min-w-0">
                          <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">{x.label}{x.unit ? " (" + x.unit + ")" : ""}</label>
                          {x.kind === "bool" ? (
                            <select className={sel} value={val} onChange={e => set(e.target.value)}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select>
                          ) : x.kind === "select" ? (
                            <select className={sel} value={val} onChange={e => set(e.target.value)}><option value="">-</option>{(x.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}</select>
                          ) : x.kind === "date" ? (
                            <Input type="date" value={val} onChange={e => set(e.target.value)} />
                          ) : (
                            <Input inputMode={x.kind === "number" ? "decimal" : undefined} value={val} onChange={e => set(e.target.value)} />
                          )}
                        </div>
                      );
                    };
                    return (
                      <div className="space-y-3">
                        {hasCore && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1.5">Vitals</p>
                            {scanOn && <div className="mb-2"><VitalsScanAll include={["temperature", "bpSystolic", "bpDiastolic", "pulse", "spo2"]} onApply={v => setVf(f => ({ ...f, ...v }))} /></div>}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {ik("temperature") && (
                                <div className="flex gap-1 min-w-0">
                                  <Input className="min-w-0" placeholder="Temp" value={vf.temperature} onChange={e => setVf({ ...vf, temperature: e.target.value })} />
                                  <select className="h-10 rounded-md border border-gray-200 bg-white px-1 text-sm" value={vf.tempUnit} onChange={e => setVf({ ...vf, tempUnit: e.target.value })}><option value="F">F</option><option value="C">C</option></select>
                                </div>
                              )}
                              {ik("bp") && (
                                <div className="flex gap-1 min-w-0">
                                  <Input className="min-w-0" placeholder="BP high" value={vf.bpSystolic} onChange={e => setVf({ ...vf, bpSystolic: e.target.value })} />
                                  <Input className="min-w-0" placeholder="BP low" value={vf.bpDiastolic} onChange={e => setVf({ ...vf, bpDiastolic: e.target.value })} />
                                </div>
                              )}
                              {ik("pulse") && <Input placeholder="Pulse" value={vf.pulse} onChange={e => setVf({ ...vf, pulse: e.target.value })} />}
                              {ik("spo2") && <Input placeholder="SpO2 %" value={vf.spo2} onChange={e => setVf({ ...vf, spo2: e.target.value })} />}
                              {ik("weight") && <Input placeholder="Weight kg" value={vf.weight} onChange={e => setVf({ ...vf, weight: e.target.value })} />}
                              {heightDef && renderField(heightDef)}
                            </div>
                          </div>
                        )}
                        {boxes.filter(bx => bx.items.length > 0).map(bx => (
                          <div key={bx.title} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 mb-2">{bx.title}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{bx.items.map(renderField)}</div>
                          </div>
                        ))}
                        <Input placeholder="Note" value={vf.notes} onChange={e => setVf({ ...vf, notes: e.target.value })} />
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveVitals(b.id)}>Save vitals</Button>
                    <Button size="sm" variant="ghost" onClick={() => setVitalsId(null)}>Cancel</Button>
                  </div>
                </div>
              )}
              {feeId === b.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input className="w-28" placeholder="Amount" value={feeAmt} onChange={e => setFeeAmt(e.target.value)} />
                  <select className="h-10 rounded-md border border-gray-200 bg-white px-2 text-sm" value={feeMode} onChange={e => setFeeMode(e.target.value)}>
                    <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
                  </select>
                  <Button size="sm" onClick={() => saveFee(b.id)}>Confirm payment</Button>
                  <Button size="sm" variant="ghost" onClick={() => setFeeId(null)}>Cancel</Button>
                </div>
              )}
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
  const [billId, setBillId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [matEligible, setMatEligible] = useState<Set<string>>(new Set());
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
  useEffect(() => {
    maternityApi.eligible().then((r) => setMatEligible(new Set(r.ids))).catch(() => setMatEligible(new Set()));
  }, [inward]);

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
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-900">{p.patient_name}{p.age != null ? ", " + p.age : ""}</p>
                <div className="flex items-center gap-1.5">
                  {matEligible.has(p.id) && (
                    <button type="button" disabled={printingId === p.id}
                      onClick={async () => {
                        setPrintingId(p.id);
                        try { await printMaternityRecord(p.id); }
                        catch (e: any) { toast.error(e?.message || "Could not open the record"); }
                        setPrintingId(null);
                      }}
                      className="flex items-center gap-1 text-xs text-pink-700 border border-pink-200 rounded-md px-2 py-0.5 hover:bg-pink-50 disabled:opacity-50">
                      <Printer className="w-3 h-3" />{printingId === p.id ? "Preparing..." : "Print record"}
                    </button>
                  )}
                  <button type="button" onClick={() => setBillId(p.id)} className="flex items-center gap-1 text-xs text-teal-700 border border-teal-200 rounded-md px-2 py-0.5 hover:bg-teal-50"><Receipt className="w-3 h-3" />Bill</button>
                </div>
              </div>
              <p className="text-xs text-gray-500">{p.ward} / {p.bed_number}{p.admitting_doctor_name ? " | " + p.admitting_doctor_name : ""}</p>
              {p.diagnosis && <p className="text-xs text-gray-400">{p.diagnosis}</p>}
            </div>
          ))}
        </div>
      </div>
      {billId && <IPDBillModal inwardId={billId} onClose={() => setBillId(null)} />}
    </div>
  );
}

export default function FrontOfficeDashboard() {
  const { user, logout } = useStore() as any;
  const [tab, setTab] = useState<string>("op");
  const { nav: extraNav } = useExtraNav(["live_patients", "ipd", "beds_wards"]);
  const { has } = useModules();
  const tabCls = (on: boolean) => "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium " + (on ? "bg-teal-500 text-white" : "bg-white border border-gray-200 text-gray-600");
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-white" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 leading-tight">Front Office</p>
          <p className="text-xs text-gray-500">{user?.hospitalName}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => logout()}><LogOut className="w-4 h-4 mr-1" />Sign out</Button>
      </header>
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button className={tabCls(tab === "op")} onClick={() => setTab("op")}><UserCheck className="w-4 h-4" />Today's outpatients</button>
          {has("ipd") && <button className={tabCls(tab === "admit")} onClick={() => setTab("admit")}><BedDouble className="w-4 h-4" />Admit inpatient</button>}
          <button className={tabCls(tab === "walkin")} onClick={() => setTab("walkin")}><UserPlus className="w-4 h-4" />Register patient</button>
          {has("bed_bookings") && <button className={tabCls(tab === "beds")} onClick={() => setTab("beds")}><BedDouble className="w-4 h-4" />Bed requests</button>}
        {extraNav.map(n => (<button key={n.key} className={tabCls(tab === n.key)} onClick={() => setTab(n.key)}><n.icon className="w-4 h-4" />{n.label}</button>))}
        </div>
        {tab.startsWith("x:") ? <ExtraPanel moduleKey={tab.slice(2)} /> : tab === "op" ? <Outpatients /> : tab === "walkin" ? <RegisterWalkIn /> : tab === "beds" && has("bed_bookings") ? <HABedRequests /> : tab === "admit" && has("ipd") ? <Admit /> : <Outpatients />}
      </main>
    </div>
  );
}
