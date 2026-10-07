import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "../../context/StoreContext";
import { inward as inwardApi } from "../../api";
import { normalizeBookingStatus } from "../../lib/bookingStatus";
import { useRouter, type Route } from "@/router/RouterContext";

type Visit = {
  key: string;
  type: "OPD" | "Inward";
  doctor: string;
  detail: string;
  place: string;
  date: string;
  status: string;
  doctorId?: string;
  session?: string;
  paid?: boolean;
};

type Raw = Visit & { name: string; phone: string; age: string; gender: string };

type Person = {
  id: string;
  name: string;
  phone: string;
  age: string;
  gender: string;
  visits: Visit[];
};

function pick(o: any, ...keys: string[]): string {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
}

function fmtDate(d: string) {
  if (!d) return "-";
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : t.toLocaleDateString();
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  unvisited: "bg-red-50 text-red-700 border-red-200",
  admitted: "bg-orange-50 text-orange-700 border-orange-200",
  discharged: "bg-gray-100 text-gray-600 border-gray-200",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs capitalize ${STATUS_STYLES[status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {status || "-"}
    </span>
  );
}

type Drill = {
  doctorIds: string[]; statuses: string[]; payment: string; session: string;
  date: string; from: string; to: string; day: string;
};
const NO_DRILL: Drill = { doctorIds: [], statuses: [], payment: "", session: "", date: "", from: "", to: "", day: "" };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const splitCsv = (s?: string) => (s ? s.split(",").filter(Boolean) : []);

// Filters sent by the Billing charts arrive as route.query
function drillFromRoute(r: Route): Drill {
  const q = r.path === "/hospital-admin/all-patients" ? r.query : undefined;
  if (!q) return NO_DRILL;
  return {
    doctorIds: splitCsv(q.doctorId), statuses: splitCsv(q.status), payment: q.payment ?? "",
    session: q.session ?? "", date: q.date ?? "", from: q.from ?? "", to: q.to ?? "", day: q.day ?? "",
  };
}

function isDrillActive(d: Drill) {
  return d.doctorIds.length > 0 || d.statuses.length > 0 ||
    !!(d.payment || d.session || d.date || d.from || d.to || d.day);
}

function matchesDrill(v: Visit, d: Drill) {
  if (v.type !== "OPD") return false; // the Billing charts only count outpatient bookings
  if (d.doctorIds.length && !d.doctorIds.includes(v.doctorId ?? "")) return false;
  if (d.statuses.length && !d.statuses.includes(v.status)) return false;
  if (d.payment && (v.status !== "completed" || !!v.paid !== (d.payment === "paid"))) return false;
  if (d.session && v.session !== d.session) return false;
  const day = v.date.slice(0, 10);
  if (d.date && day !== d.date) return false;
  if (d.from && day < d.from) return false;
  if (d.to && day > d.to) return false;
  if (d.day) {
    const [y, m, dd] = day.split("-").map(Number);
    if (new Date(y, m - 1, dd).getDay() !== Number(d.day)) return false;
  }
  return true;
}

export default function HAAllPatients() {
  const { bookings, doctors, patients, user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";

  const { route } = useRouter();
  const [drill, setDrill] = useState<Drill>(() => drillFromRoute(route));
  // a new chart click (or a sidebar click) arrives as a new route object
  useEffect(() => { setDrill(drillFromRoute(route)); }, [route]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "OPD" | "Inward">("all");
  const [inwardList, setInwardList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    inwardApi.list()
      .then(list => { if (!cancelled) setInwardList(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setError("Could not load inward patients."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const myDoctorIds = useMemo(
    () => new Set((doctors as any[]).filter(d => d.hospitalId === hospitalId).map(d => d.id)),
    [doctors, hospitalId]
  );

  // Every visit (outpatient booking or inward admission) as a flat list
  const raw = useMemo<Raw[]>(() => {
    const out: Raw[] = [];

    for (const b of bookings as any[]) {
      if (!myDoctorIds.has(b.doctorId)) continue;
      const status = normalizeBookingStatus(b.status);
      if (status === "cancelled" && !drill.statuses.includes("cancelled")) continue;
      const rec: any = (patients as any[]).find(p => p.id === b.patientId);
      out.push({
        key: `opd-${b.id}`,
        type: "OPD",
        name: pick(b, "patientName") || pick(rec, "name"),
        phone: pick(b, "phone") || pick(rec, "phone"),
        age: pick(b, "age", "patientAge") || pick(rec, "age"),
        gender: pick(b, "gender") || pick(rec, "gender"),
        doctor: pick(b, "doctorName"),
        doctorId: b.doctorId,
        session: pick(b, "session"),
        paid: !!b.paymentDone,
        detail: b.tokenNumber != null ? `Token #${b.tokenNumber}` : "",
        place: "",
        date: pick(b, "date"),
        status,
      });
    }

    const seen = new Set<string>();
    for (const p of inwardList) {
      const id = pick(p, "id");
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      const discharged = pick(p, "dischargedAt", "discharged_at", "dischargeDate", "discharge_date");
      const ward = pick(p, "ward");
      const bed = pick(p, "bed_number", "bedNumber");
      out.push({
        key: `ipd-${id || out.length}`,
        type: "Inward",
        name: pick(p, "patientName", "patient_name", "name"),
        phone: pick(p, "phone", "patientPhone", "patient_phone"),
        age: pick(p, "age", "patientAge", "patient_age"),
        gender: pick(p, "gender"),
        doctor: pick(p, "admittingDoctorName", "admitting_doctor_name", "admittingDoctor", "doctorName", "doctor_name", "doctor"),
        detail: pick(p, "diagnosis", "reason", "reasonForAdmission"),
        place: [ward, bed].filter(Boolean).join(" · "),
        date: pick(p, "admittedAt", "admitted_at", "admissionDate", "createdAt", "created_at"),
        status: (pick(p, "status") || (discharged ? "discharged" : "admitted")).toLowerCase(),
      });
    }

    return out;
  }, [bookings, inwardList, patients, myDoctorIds, drill.statuses]);

  // Only the visits that match the filter coming from a Billing chart
  const visibleRaw = useMemo(
    () => (isDrillActive(drill) ? raw.filter(v => matchesDrill(v, drill)) : raw),
    [raw, drill]
  );

  // One entry per patient, with all their visits (newest first)
  const people = useMemo<Person[]>(() => {
    const sorted = [...visibleRaw].sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10)));
    const map = new Map<string, Person>();
    for (const r of sorted) {
      const digits = r.phone.replace(/\D/g, "").slice(-10);
      const nameKey = r.name.trim().toLowerCase().replace(/\s+/g, " ");
      const id = `${digits}|${nameKey}`;
      let p = map.get(id);
      if (!p) {
        p = { id, name: r.name, phone: r.phone, age: r.age, gender: r.gender, visits: [] };
        map.set(id, p);
      }
      if (!p.age && r.age) p.age = r.age;
      if (!p.gender && r.gender) p.gender = r.gender;
      if (!p.phone && r.phone) p.phone = r.phone;
      p.visits.push({
        key: r.key, type: r.type, doctor: r.doctor, detail: r.detail,
        place: r.place, date: r.date, status: r.status,
      });
    }
    return Array.from(map.values());
  }, [visibleRaw]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter(p => {
      if (typeFilter !== "all" && !p.visits.some(v => v.type === typeFilter)) return false;
      if (!q) return true;
      const hay = [
        p.name, p.phone,
        ...p.visits.flatMap(v => [v.doctor, v.detail, v.place, v.status]),
      ];
      return hay.some(v => v.toLowerCase().includes(q));
    });
  }, [people, search, typeFilter]);

  const counts = {
    all: people.length,
    OPD: people.filter(p => p.visits.some(v => v.type === "OPD")).length,
    Inward: people.filter(p => p.visits.some(v => v.type === "Inward")).length,
  };

  const selected = selectedId ? people.find(p => p.id === selectedId) ?? null : null;

  const drillParts: string[] = [];
  if (drill.doctorIds.length === 1) drillParts.push((doctors as any[]).find(d => d.id === drill.doctorIds[0])?.name ?? "1 doctor");
  else if (drill.doctorIds.length > 1) drillParts.push(`${drill.doctorIds.length} doctors`);
  if (drill.statuses.length) drillParts.push(drill.statuses.join(" / "));
  if (drill.payment) drillParts.push(drill.payment);
  if (drill.session) drillParts.push(`${drill.session} session`);
  if (drill.day) drillParts.push(DAY_NAMES[Number(drill.day)] ?? drill.day);
  if (drill.date) drillParts.push(drill.date);
  else if (drill.from || drill.to) drillParts.push(`${drill.from || "..."} to ${drill.to || "..."}`);
  const drillActive = drillParts.length > 0;

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">All Patients</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {people.length} patient{people.length === 1 ? "" : "s"} ({visibleRaw.length} total visits)
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, phone, doctor, diagnosis..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {([["all", "All"], ["OPD", "Outpatient"], ["Inward", "Inward"]] as const).map(([val, label]) => (
            <button key={val} type="button" onClick={() => setTypeFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                typeFilter === val ? "bg-teal-600 text-white border-teal-600" : "bg-white hover:bg-gray-50"
              }`}>
              {label} ({counts[val]})
            </button>
          ))}
        </div>
      </div>

      {drillActive && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          <span className="font-medium">Filtered from Billing:</span>
          <span>{drillParts.join(" | ")}</span>
          <span className="text-teal-700">({visibleRaw.length} of {raw.length} visits)</span>
          <button type="button" onClick={() => setDrill(NO_DRILL)}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium hover:underline">
            <X className="w-3.5 h-3.5" /> Clear filter
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Age / Gender</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Visits</TableHead>
              <TableHead>Last Visit</TableHead>
              <TableHead>Last Doctor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">History</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No patients found.</TableCell></TableRow>
            )}
            {filtered.map(p => {
              const last = p.visits[0];
              const opd = p.visits.filter(v => v.type === "OPD").length;
              const ipd = p.visits.length - opd;
              const admitted = p.visits.some(v => v.type === "Inward" && v.status === "admitted");
              return (
                <TableRow key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedId(p.id)}>
                  <TableCell className="font-medium">{p.name || "-"}</TableCell>
                  <TableCell>{[p.age, p.gender].filter(Boolean).join(" / ") || "-"}</TableCell>
                  <TableCell>{p.phone || "-"}</TableCell>
                  <TableCell>
                    <span className="font-semibold">{p.visits.length}</span>
                    <span className="block text-xs text-muted-foreground">
                      {opd} outpatient{ipd > 0 ? ` · ${ipd} inward` : ""}
                    </span>
                  </TableCell>
                  <TableCell>{fmtDate(last.date)}</TableCell>
                  <TableCell>{last.doctor || "-"}</TableCell>
                  <TableCell>
                    {admitted ? <StatusPill status="admitted" /> : <StatusPill status={last.status} />}
                  </TableCell>
                  <TableCell className="text-right">
                    <button type="button"
                      onClick={e => { e.stopPropagation(); setSelectedId(p.id); }}
                      className="text-xs text-teal-600 font-medium hover:underline">
                      View history
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b">
              <div>
                <h2 className="font-semibold text-lg">{selected.name || "Patient"}</h2>
                <p className="text-sm text-gray-500">
                  {[selected.age && `${selected.age} yrs`, selected.gender, selected.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="px-6 py-4 grid grid-cols-3 gap-3 text-center border-b">
              <div className="rounded-lg bg-gray-50 py-2">
                <p className="text-lg font-bold">{selected.visits.length}</p>
                <p className="text-xs text-gray-500">Total visits</p>
              </div>
              <div className="rounded-lg bg-blue-50 py-2">
                <p className="text-lg font-bold text-blue-700">{selected.visits.filter(v => v.type === "OPD").length}</p>
                <p className="text-xs text-gray-500">Outpatient</p>
              </div>
              <div className="rounded-lg bg-orange-50 py-2">
                <p className="text-lg font-bold text-orange-700">{selected.visits.filter(v => v.type === "Inward").length}</p>
                <p className="text-xs text-gray-500">Inward</p>
              </div>
            </div>

            <div className="px-6 py-3 text-sm space-y-1 border-b">
              <p><span className="text-gray-500">First visit here:</span> {fmtDate(selected.visits[selected.visits.length - 1].date)}</p>
              <p><span className="text-gray-500">Doctors seen:</span> {Array.from(new Set(selected.visits.map(v => v.doctor).filter(Boolean))).join(", ") || "-"}</p>
            </div>

            <div className="px-6 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">History</h3>
              {selected.visits.map(v => (
                <div key={v.key} className="border rounded-lg p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={v.type === "Inward" ? "border-orange-300 text-orange-700" : "border-blue-300 text-blue-700"}>
                        {v.type === "OPD" ? "Outpatient" : "Inward"}
                      </Badge>
                      <span className="text-gray-500">{fmtDate(v.date)}</span>
                    </div>
                    <StatusPill status={v.status} />
                  </div>
                  <p><span className="text-gray-500">Doctor:</span> {v.doctor || "-"}</p>
                  {v.detail && <p><span className="text-gray-500">{v.type === "Inward" ? "Diagnosis:" : "Token:"}</span> {v.type === "Inward" ? v.detail : v.detail.replace("Token ", "")}</p>}
                  {v.place && <p><span className="text-gray-500">Ward / Bed:</span> {v.place}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
