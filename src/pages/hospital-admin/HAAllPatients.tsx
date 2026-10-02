import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "../../context/StoreContext";
import { inward as inwardApi } from "../../api";
import { normalizeBookingStatus } from "../../lib/bookingStatus";

type Row = {
  key: string;
  type: "OPD" | "Inward";
  name: string;
  phone: string;
  age: string;
  gender: string;
  doctor: string;
  detail: string;
  date: string;
  status: string;
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

export default function HAAllPatients() {
  const { bookings, doctors, patients, user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "OPD" | "Inward">("all");
  const [inwardList, setInwardList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];

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
      out.push({
        key: `ipd-${id || out.length}`,
        type: "Inward",
        name: pick(p, "patientName", "patient_name", "name"),
        phone: pick(p, "phone", "patientPhone", "patient_phone"),
        age: pick(p, "age", "patientAge", "patient_age"),
        gender: pick(p, "gender"),
        doctor: pick(p, "admittingDoctorName", "admitting_doctor_name", "admittingDoctor", "doctorName", "doctor_name", "doctor"),
        detail: pick(p, "diagnosis", "reason", "reasonForAdmission"),
        date: pick(p, "admittedAt", "admitted_at", "admissionDate", "createdAt", "created_at"),
        status: (pick(p, "status") || (discharged ? "discharged" : "admitted")).toLowerCase(),
      });
    }

    return out.sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10)));
  }, [bookings, inwardList, patients, myDoctorIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!q) return true;
      return [r.name, r.phone, r.doctor, r.detail, r.type, r.status].some(v => v.toLowerCase().includes(q));
    });
  }, [rows, search, typeFilter]);

  const counts = {
    all: rows.length,
    OPD: rows.filter(r => r.type === "OPD").length,
    Inward: rows.filter(r => r.type === "Inward").length,
  };

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">All Patients</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {rows.length} patient record{rows.length === 1 ? "" : "s"} (outpatient and inward)
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
              <TableHead>Type</TableHead>
              <TableHead>Age / Gender</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No patients found.</TableCell></TableRow>
            )}
            {filtered.map(r => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.name || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={r.type === "Inward" ? "border-orange-300 text-orange-700" : "border-blue-300 text-blue-700"}>
                    {r.type === "OPD" ? "Outpatient" : "Inward"}
                  </Badge>
                </TableCell>
                <TableCell>{[r.age, r.gender].filter(Boolean).join(" / ") || "-"}</TableCell>
                <TableCell>{r.phone || "-"}</TableCell>
                <TableCell>{r.doctor || "-"}</TableCell>
                <TableCell className="max-w-[220px] truncate">{r.detail || "-"}</TableCell>
                <TableCell>{fmtDate(r.date)}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-full border text-xs capitalize ${STATUS_STYLES[r.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {r.status || "-"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
