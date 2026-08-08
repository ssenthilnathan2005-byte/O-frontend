import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "../../context/StoreContext";

const STATUS_STYLES: Record<string, string> = {
  confirmed:  "bg-blue-50 text-blue-700 border-blue-200",
  completed:  "bg-green-50 text-green-700 border-green-200",
  unvisited:  "bg-red-50 text-red-700 border-red-200",
  cancelled:  "bg-gray-100 text-gray-500 border-gray-200",
};

export default function HAPatients() {
  const { bookings, doctors, user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";

  const myDoctorIds = useMemo(
    () => new Set(doctors.filter((d) => d.hospitalId === hospitalId).map((d) => d.id)),
    [doctors, hospitalId]
  );

  const myBookings = useMemo(
    () =>
      bookings
        .filter((b) => myDoctorIds.has(b.doctorId) && b.status !== "cancelled")
        .sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return b.tokenNumber - a.tokenNumber;
        }),
    [bookings, myDoctorIds]
  );

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return myBookings;
    return myBookings.filter(
      (b) =>
        b.patientName?.toLowerCase().includes(q) ||
        b.doctorName?.toLowerCase().includes(q) ||
        b.phone?.includes(q) ||
        String(b.tokenNumber).includes(q)
    );
  }, [myBookings, search]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Live Patients</h1>
          <p className="text-muted-foreground mt-1">
            {myBookings.length} booking{myBookings.length !== 1 ? "s" : ""} across all your doctors
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search patient, doctor, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-center w-16">Token</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                  {search ? "No results match your search." : "No patient bookings yet."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="text-center">
                  <span className="text-xl font-bold text-teal-600">#{b.tokenNumber}</span>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{b.patientName || "—"}</p>
                  {b.patientAge != null && (
                    <p className="text-xs text-muted-foreground">{b.patientAge} yrs</p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {b.phone || "—"}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {b.doctorName || "—"}
                </TableCell>
                <TableCell>
                  <span className="capitalize text-sm">{b.session}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {b.date}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={`capitalize text-xs ${STATUS_STYLES[b.status] ?? ""}`}
                  >
                    {b.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
