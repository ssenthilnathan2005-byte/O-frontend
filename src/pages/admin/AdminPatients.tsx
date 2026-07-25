import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Trash2 } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { useState } from "react";

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/api$/, "");

export default function AdminPatients() {
  const { patients, bookings } = useStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function getBookingCount(patientId: string) {
    return bookings.filter((b) => b.patientId === patientId).length;
  }

  async function deletePatient(id: string) {
    setDeletingId(id);
    try {
      const token = localStorage.getItem("db_jwt") ?? "";
      const r = await fetch(`${API}/api/patients/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { alert("Failed to delete patient. Please try again."); return; }
      setConfirmId(null);
      window.location.reload();
    } catch {
      alert("Something went wrong. Please try again.");
    }
    setDeletingId(null);
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Patient Management</h1>
        <p className="text-muted-foreground mt-1">
          {patients.length} registered patients (read-only)
        </p>
      </div>
      {patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No patients registered yet</p>
          <p className="text-sm mt-1">Patients will appear here after they log in</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-center">Total Bookings</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((patient, idx) => (
                <TableRow key={patient.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell className="text-muted-foreground">{patient.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(patient.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {getBookingCount(patient.id)}
                  </TableCell>
                  <TableCell className="text-center">
                    {confirmId === patient.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => deletePatient(patient.id)}
                          disabled={deletingId === patient.id}
                          className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-60"
                        >
                          {deletingId === patient.id ? "Deleting..." : "Confirm"}
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
                        onClick={() => setConfirmId(patient.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
