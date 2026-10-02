import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "../../context/StoreContext";
import { inward as inwardApi } from "../../api";
import { normalizeBookingStatus } from "../../lib/bookingStatus";

type Visit = {
  key: string;
  type: "OPD" | "Inward";
  doctor: string;
  detail: string;
  place: string;
  date: string;
  status: string;
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

export default function HAAllPatients() {
  const { bookings, doctors, patients, user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";

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
      if (status === "cancelled") continue;
      const rec: any = (patients as any[]).find(p => p.id === b.patientId);
      out.push({
        key: `opd-${b.id}`,
        type: "OPD",
        name: pick(b, "patientName") || pick(rec, "name"),
        phone: pick(b, "phone") || pick(rec, "phone"),
        age: pick(b, "age", "patientAge") || pick(rec, "age"),
        gender: pick(b, "gender") || pick(rec, "gender"),
        doctor: pick(b, "doctorName"),
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
  }, [bookings, inwardList, patients, myDoctorIds]);

  // One entry per patient, with all their visits (newest first)
  const people = useMemo<Person[]>(() => {
    const sorted = [...raw].sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10)));
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
  }, [raw]);

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

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">All Patients</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {people.length} patient{people.length === 1 ? "" : "s"} ({raw.length} total visits)
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
