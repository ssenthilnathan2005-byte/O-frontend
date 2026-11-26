import { useEffect, useState } from "react";
import { X, Droplet, MapPin, Phone, User, Stethoscope, BedDouble, CalendarDays, Hospital } from "lucide-react";
import { getToken } from "@/api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Query = { inwardId?: string; uhid?: string; phone?: string; name?: string };
type Opd = { id: string; date: string; session: string; token_number: number; doctor_name: string; specialty: string; status: string; complaint: string; paid: boolean };
type Ipd = { id: string; ward: string; bed_number: string; doctor_name: string; diagnosis: string; status: string; admitted_at: string; discharged_at: string | null };
type Doc = { name: string; specialty: string; opd: number; ipd: number; last: string };
type Profile = {
  patient: { name: string; uhid: string | null; gender: string | null; age: number | null; phone: string | null; area: string | null; blood_group: string | null };
  opd: Opd[]; ipd: Ipd[]; doctors: Doc[];
};

function fmt(d?: string | null) {
  if (!d) return "-";
  const t = new Date(d);
  return isNaN(t.getTime()) ? String(d) : t.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
const STATUS: Record<string, string> = {
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  unvisited: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  admitted: "bg-orange-50 text-orange-700 border-orange-200",
  discharged: "bg-gray-100 text-gray-600 border-gray-200",
};
function Pill({ s }: { s: string }) {
  return <span className={"px-2 py-0.5 rounded-full border text-[11px] capitalize " + (STATUS[s] || "bg-gray-50 text-gray-600 border-gray-200")}>{s || "-"}</span>;
}

export default function PatientProfileModal({ query, onClose }: { query: Query; onClose: () => void }) {
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) qs.set(k, String(v));
    fetch(BASE + "/front-office/patient-profile?" + qs.toString(), { headers: { Authorization: "Bearer " + getToken() } })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Could not load the patient");
        if (!cancelled) setData(j);
      })
      .catch((e) => { if (!cancelled) setError(e.message || "Could not load the patient"); });
    return () => { cancelled = true; };
  }, [JSON.stringify(query)]);

  const p = data?.patient;
  const total = (data?.opd.length ?? 0) + (data?.ipd.length ?? 0);
  const allDates = [...(data?.opd.map((v) => v.date) ?? []), ...(data?.ipd.map((v) => v.admitted_at) ?? [])].filter(Boolean).sort();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white flex items-start justify-between gap-3 px-5 py-4 border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{p?.name || query.name || "Patient"}</h2>
            {p && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {p.uhid && <span className="rounded-md bg-teal-50 border border-teal-100 px-2 py-1 font-semibold text-teal-800">UHID {p.uhid}</span>}
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 border border-gray-100 px-2 py-1 text-gray-700"><User className="w-3 h-3" />{[p.age != null ? p.age + " yrs" : "", p.gender || ""].filter(Boolean).join(" · ") || "Age / gender not set"}</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 border border-gray-100 px-2 py-1 text-gray-700"><MapPin className="w-3 h-3" />{p.area || "Area not set"}</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-100 px-2 py-1 text-red-700 font-semibold"><Droplet className="w-3 h-3" />{p.blood_group || "Blood group not set"}</span>
                {p.phone && <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 border border-gray-100 px-2 py-1 text-gray-700"><Phone className="w-3 h-3" />{p.phone}</span>}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
        </div>

        {!data && !error && <p className="py-16 text-center text-sm text-gray-400">Loading...</p>}
        {error && <p className="py-16 text-center text-sm text-red-600">{error}</p>}

        {data && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="rounded-xl bg-gray-50 py-3"><p className="text-xl font-bold">{total}</p><p className="text-xs text-gray-500">Total visits</p></div>
              <div className="rounded-xl bg-blue-50 py-3"><p className="text-xl font-bold text-blue-700">{data.opd.length}</p><p className="text-xs text-gray-500">Outpatient</p></div>
              <div className="rounded-xl bg-orange-50 py-3"><p className="text-xl font-bold text-orange-700">{data.ipd.length}</p><p className="text-xs text-gray-500">Inpatient</p></div>
              <div className="rounded-xl bg-teal-50 py-3"><p className="text-sm font-bold text-teal-800">{fmt(allDates[0])}</p><p className="text-xs text-gray-500">First visit here</p></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <section className="rounded-xl border p-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-3"><CalendarDays className="w-4 h-4" />Outpatient visits ({data.opd.length})</h3>
                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {data.opd.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">No outpatient visits</p>}
                  {data.opd.map((v) => (
                    <div key={v.id} className="rounded-lg border border-gray-100 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold text-gray-800">{fmt(v.date)}</span><Pill s={v.status} /></div>
                      <p className="text-gray-700">{v.doctor_name}{v.specialty ? " · " + v.specialty : ""}</p>
                      <p className="text-gray-500 capitalize">{v.session} · Token #{v.token_number}</p>
                      {v.complaint && <p className="text-gray-500">Complaint: {v.complaint}</p>}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border p-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-orange-700 mb-3"><BedDouble className="w-4 h-4" />Inpatient visits ({data.ipd.length})</h3>
                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {data.ipd.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">No inpatient stays</p>}
                  {data.ipd.map((v) => (
                    <div key={v.id} className="rounded-lg border border-gray-100 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold text-gray-800">{fmt(v.admitted_at)}{v.discharged_at ? " → " + fmt(v.discharged_at) : ""}</span><Pill s={v.status} /></div>
                      <p className="text-gray-700">{v.doctor_name || "Doctor not set"}</p>
                      <p className="text-gray-500">{[v.ward, v.bed_number].filter(Boolean).join(" / ") || "Ward not set"}</p>
                      {v.diagnosis && <p className="text-gray-500">Diagnosis: {v.diagnosis}</p>}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border p-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-teal-700 mb-3"><Hospital className="w-4 h-4" />Doctors and hospital ({data.doctors.length})</h3>
                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {data.doctors.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">No doctor records</p>}
                  {data.doctors.map((d) => (
                    <div key={d.name} className="rounded-lg border border-gray-100 p-2.5 text-xs space-y-1">
                      <p className="flex items-center gap-1.5 font-semibold text-gray-800"><Stethoscope className="w-3.5 h-3.5 text-teal-600" />{d.name}</p>
                      {d.specialty && <p className="text-gray-500">{d.specialty}</p>}
                      <p className="text-gray-700">{d.opd} outpatient{d.ipd > 0 ? " · " + d.ipd + " inpatient" : ""}</p>
                      <p className="text-gray-400">Last seen {fmt(d.last)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
