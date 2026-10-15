import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BedDouble, Loader2, Stethoscope, Calendar, Building2 } from "lucide-react";
import { bedBookings } from "../../api";
import { useRouter } from "../../router/RouterContext";

const rupee = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");
function daysBetween(from: string, to?: string | null) {
  const a = new Date(from).getTime();
  const b = to ? new Date(to).getTime() : Date.now();
  return Math.max(1, Math.floor((b - a) / 86400000) + 1);
}

export default function MyAdmissionPage() {
  const { navigate } = useRouter();
  const [stays, setStays] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([bedBookings.myStays(), bedBookings.mine()]);
      setStays(s); setRequests(r); setErr("");
    } catch (e: any) { setErr(e.message || "Could not load your admission details"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const current = stays.filter((s) => s.status === "admitted");
  const past = stays.filter((s) => s.status !== "admitted");
  const open = requests.filter((r) => r.status === "requested" || r.status === "confirmed");

  return (
    <div className="min-h-screen bg-gray-50 pt-0">
      <div className="bg-white border-b shadow-sm px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate({ path: "/patient/hospitals" })} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex items-center gap-2">
          <BedDouble className="w-5 h-5 text-teal-600" />
          <h1 className="font-bold text-lg">My Admission</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-28">
        {loading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-teal-600" /></div>}
        {err && <p className="text-sm text-red-600">{err}</p>}

        {!loading && current.map((s) => (
          <div key={s.id} className="rounded-2xl bg-white border-2 border-teal-500 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">Currently admitted</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Day {daysBetween(s.admitted_at)}</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Your bed</p>
              <p className="text-3xl font-extrabold text-gray-900 leading-tight">{s.bed_number || "Not assigned"}</p>
              <p className="text-sm text-gray-700">{s.ward || "-"}</p>
            </div>
            <div className="space-y-1.5 text-sm text-gray-700">
              <p className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400" />{s.hospital_name || "Hospital"}</p>
              <p className="flex items-center gap-2"><Stethoscope className="w-4 h-4 text-gray-400" />{s.admitting_doctor_name ? "Dr. " + String(s.admitting_doctor_name).replace(/^Dr\.?\s*/i, "") : "Doctor not assigned yet"}</p>
              <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />Admitted {fmt(s.admitted_at)}</p>
            </div>
            {s.diagnosis && <p className="text-xs text-gray-600 border-t pt-2">Reason: {s.diagnosis}</p>}
            {s.daily_rate > 0 && <p className="text-xs text-gray-500 border-t pt-2">Bed charge: {rupee(s.daily_rate)} per day</p>}
          </div>
        ))}

        {!loading && open.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-800">Bed requests</h2>
            {open.map((r) => (
              <div key={r.id} className="rounded-xl bg-white border border-gray-200 p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{r.patient_name}</p>
                  <span className={"text-[11px] font-semibold px-2 py-0.5 rounded-full " + (r.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                    {r.status === "confirmed" ? "Bed reserved" : "Waiting for hospital"}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{r.hospital_name} · {r.ward_name}{r.bed_number ? " · Bed " + r.bed_number : ""}</p>
                {r.status === "confirmed" && r.reserved_until && <p className="text-xs text-green-700">Held until {fmt(r.reserved_until)}. Please arrive before then.</p>}
              </div>
            ))}
          </div>
        )}

        {!loading && past.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-800">Past stays</h2>
            {past.map((s) => (
              <div key={s.id} className="rounded-xl bg-white border border-gray-200 p-3 space-y-0.5">
                <p className="text-sm font-semibold text-gray-900">{s.hospital_name || "Hospital"}</p>
                <p className="text-xs text-gray-600">{s.ward || "-"}{s.bed_number ? " · Bed " + s.bed_number : ""}</p>
                <p className="text-xs text-gray-500">{fmt(s.admitted_at)} to {fmt(s.discharged_at)} ({daysBetween(s.admitted_at, s.discharged_at)} days)</p>
              </div>
            ))}
          </div>
        )}

        {!loading && !err && current.length === 0 && open.length === 0 && past.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <BedDouble className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500">You have no admissions or bed requests.</p>
            <button onClick={() => navigate({ path: "/patient/hospitals" })} className="text-sm font-medium text-teal-700">Find a hospital</button>
          </div>
        )}
      </div>
    </div>
  );
}
