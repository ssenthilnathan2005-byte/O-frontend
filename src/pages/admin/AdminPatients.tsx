import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Trash2, Building2 } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { useMemo, useState } from "react";

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/api$/, "");

const NO_BOOKINGS = "__none__";

interface Row {
  patient: { id: string; name: string; email?: string; createdAt: string };
  bookingsHere: number;
  doctors: string[];
}

interface Group {
  key: string;
  name: string;
  rows: Row[];
  totalBookings: number;
}

export default function AdminPatients() {
  const { patients, bookings } = useStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("all");

  const { groups, noBookingRows } = useMemo(() => {
    const patientById = new Map(patients.map((p) => [p.id, p]));
    // hospitalName -> patientId -> { count, doctors }
    const byHospital = new Map<string, Map<string, { count: number; doctors: Set<string> }>>();
    const patientsWithBookings = new Set<string>();

    for (const b of bookings) {
      if (!patientById.has(b.patientId)) continue;
      const hName = (b.hospitalName || "Unknown hospital").trim();
      patientsWithBookings.add(b.patientId);
      if (!byHospital.has(hName)) byHospital.set(hName, new Map());
      const pm = byHospital.get(hName)!;
      if (!pm.has(b.patientId)) pm.set(b.patientId, { count: 0, doctors: new Set() });
      const entry = pm.get(b.patientId)!;
      entry.count += 1;
      if (b.doctorName) entry.doctors.add(b.doctorName);
    }

    const groups: Group[] = Array.from(byHospital.entries()).map(([name, pm]) => {
      const rows: Row[] = Array.from(pm.entries()).map(([pid, v]) => ({
        patient: patientById.get(pid)!,
        bookingsHere: v.count,
        doctors: Array.from(v.doctors),
      }));
      rows.sort((a, b) => b.bookingsHere - a.bookingsHere);
      return {
        key: name,
        name,
        rows,
        totalBookings: rows.reduce((s, r) => s + r.bookingsHere, 0),
      };
    });
    groups.sort((a, b) => b.rows.length - a.rows.length);

    const noBookingRows: Row[] = patients
      .filter((p) => !patientsWithBookings.has(p.id))
      .map((p) => ({ patient: p, bookingsHere: 0, doctors: [] }));

    return { groups, noBookingRows };
  }, [patients, bookings]);

  async function deletePatient(id: string) {
    setDeletingId(id);
    try {
      const token = localStorage.getItem("db_jwt") ?? "";
      const r = await fetch(`${API}/api/patients/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { alert("Failed to delete patient. Please try again."); setDeletingId(null); return; }
      setConfirmId(null);
      window.location.reload();
    } catch {
      alert("Something went wrong. Please try again.");
    }
    setDeletingId(null);
  }

  function renderActions(id: string) {
    return confirmId === id ? (
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => deletePatient(id)}
          disabled={deletingId === id}
          className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-60"
        >
          {deletingId === id ? "Deleting..." : "Confirm"}
        </button>
        <button
          onClick={() => setConfirmId(null)}
          className="px-3 py-1 rounded-lg border border-border text-xs font-medium hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    ) : (
      <button
        onClick={() => setConfirmId(id)}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </button>
    );
  }

  function renderTable(rows: Row[]) {
    return (
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-center">Bookings Here</TableHead>
              <TableHead>Doctors</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={r.patient.id}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium">{r.patient.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.patient.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(r.patient.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-center font-medium">{r.bookingsHere}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {r.doctors.length ? r.doctors.join(", ") : "—"}
                </TableCell>
                <TableCell className="text-center">{renderActions(r.patient.id)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const cardBase =
    "text-left rounded-xl border p-4 transition-colors cursor-pointer bg-card hover:bg-muted/40";
  const cardActive = "border-primary ring-1 ring-primary";
  const cardIdle = "border-border";

  const visibleGroups =
    selected === "all" ? groups : groups.filter((g) => g.key === selected);
  const showNoBookings = selected === "all" || selected === NO_BOOKINGS;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Patient Management</h1>
        <p className="text-muted-foreground mt-1">
          {patients.length} registered patients across {groups.length} hospitals
        </p>
      </div>

      {patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No patients registered yet</p>
          <p className="text-sm mt-1">Patients will appear here after they log in</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
            <button
              onClick={() => setSelected("all")}
              className={`${cardBase} ${selected === "all" ? cardActive : cardIdle}`}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" /> All hospitals
              </div>
              <div className="text-2xl font-bold mt-2">{patients.length}</div>
              <div className="text-xs text-muted-foreground">registered patients</div>
            </button>

            {groups.map((g) => (
              <button
                key={g.key}
                onClick={() => setSelected(g.key)}
                className={`${cardBase} ${selected === g.key ? cardActive : cardIdle}`}
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">{g.name}</span>
                </div>
                <div className="text-2xl font-bold mt-2">{g.rows.length}</div>
                <div className="text-xs text-muted-foreground">
                  patients · {g.totalBookings} bookings
                </div>
              </button>
            ))}

            {noBookingRows.length > 0 && (
              <button
                onClick={() => setSelected(NO_BOOKINGS)}
                className={`${cardBase} ${selected === NO_BOOKINGS ? cardActive : cardIdle}`}
              >
                <div className="text-sm text-muted-foreground">No bookings yet</div>
                <div className="text-2xl font-bold mt-2">{noBookingRows.length}</div>
                <div className="text-xs text-muted-foreground">not linked to a hospital</div>
              </button>
            )}
          </div>

          {/* Hospital sections */}
          <div className="space-y-8">
            {visibleGroups.map((g) => (
              <section key={g.key}>
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{g.name}</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {g.rows.length} patients
                  </span>
                </div>
                {renderTable(g.rows)}
              </section>
            ))}

            {showNoBookings && noBookingRows.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">No bookings yet</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {noBookingRows.length} patients
                  </span>
                </div>
                {renderTable(noBookingRows)}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
