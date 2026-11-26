import DateInput from "@/components/DateInput";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { getToken } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DoctorVitalsForm from "@/components/DoctorVitalsForm";
import { vitalsText } from "@/lib/vitals";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
async function call(path: string, method = "GET", body?: any) {
  const r = await fetch(BASE + "/doctor-vitals" + path, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

/** Nurse Login > OPD Vitals. The form is built from the appointment's own doctor - nothing to pick. */
export default function NurseOpdVitals() {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [vf, setVf] = useState<Record<string, string>>({ tempUnit: "F" });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHist, setShowHist] = useState(false);

  const load = useCallback(async () => {
    try { const d = await call("/queue" + (date ? "?date=" + date : "")); setRows(d.bookings || []); if (!date) setDate(d.date); }
    catch (e: any) { toast.error(e.message); }
  }, [date]);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  async function open(id: string) {
    try {
      const d = await call("/booking/" + id);
      setDetail(d); setOpenId(id); setReason(""); setShowHist(false);
      const cur: any = d.current?.vitals || {};
      setVf({ tempUnit: "F", ...Object.fromEntries(Object.entries(cur).map(([k, x]) => [k, String(x)])) });
    } catch (e: any) { toast.error(e.message); }
  }
  async function save() {
    if (!openId) return;
    setSaving(true);
    try { await call("/booking/" + openId, "POST", { ...vf, reason }); toast.success("Vitals saved"); setOpenId(null); setDetail(null); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">OPD Vitals</h1>
        <div className="flex items-center gap-2">
          <DateInput className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-400">No appointments for this date.</p>}
      <div className="space-y-2">
        {rows.map((b) => (
          <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">#{b.token_number} &middot; {b.patient_name}{b.patient_age ? ", " + b.patient_age : ""}</p>
                <p className="text-xs text-gray-500">{b.doctor_name}{b.department ? " \u00b7 " + b.department : ""} &middot; {b.session}{b.checked_in_at ? " \u00b7 arrived" : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                {b.has_vitals ? <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Recorded {fmt(b.vitals_at)}</span>
                  : <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5">Pending</span>}
                <Button size="sm" variant={b.has_vitals ? "outline" : "default"} onClick={() => (openId === b.id ? (setOpenId(null), setDetail(null)) : open(b.id))}>{b.has_vitals ? "Correct" : "Record vitals"}</Button>
              </div>
            </div>
            {openId === b.id && detail && (
              <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
                <p className="text-xs text-gray-500">Vitals required by <b>{detail.booking.doctor_name}</b>{detail.booking.department ? " (" + detail.booking.department + ")" : ""}</p>
                <DoctorVitalsForm fields={detail.config.fields} value={vf} onChange={setVf} onSubmit={save} />
                {detail.current && <Input placeholder="Reason for correction (required)" value={reason} onChange={(e) => setReason(e.target.value)} />}
                <div className="flex gap-2">
                  <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : detail.current ? "Save correction" : "Save vitals"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setOpenId(null); setDetail(null); }}>Cancel</Button>
                  {detail.history?.length > 0 && <Button size="sm" variant="ghost" onClick={() => setShowHist(!showHist)}>{showHist ? "Hide history" : "History (" + detail.history.length + ")"}</Button>}
                </div>
                {showHist && (
                  <div className="space-y-1">
                    {detail.history.map((h: any) => (
                      <p key={h.version} className="text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1">v{h.version} &middot; {fmt(h.recorded_at)} &middot; {h.recorded_by_name || "-"}{h.action === "correct" ? " (correction: " + (h.reason || "") + ")" : ""} &mdash; {vitalsText(h.vitals)}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
