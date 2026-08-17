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
import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { normalizeBookingStatus } from "../../lib/bookingStatus";
import { getToken } from "../../api";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  unvisited: "bg-red-50 text-red-700 border-red-200",
  cancelled:  "bg-gray-100 text-gray-500 border-gray-200",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

function weekEndStr() {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export default function HAPatients() {
  const { bookings, doctors, user } = useStore();
  const hospitalId =
    user?.role === "hospital_admin" ? user.hospitalId : "";

  const [search, setSearch]         = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week">("all");
  const [exporting, setExporting]   = useState(false);
  const [fallbackBookings, setFallbackBookings] = useState<any[]>([]);

  const myDoctorIds = useMemo(
    () => new Set(doctors.filter((d) => d.hospitalId === hospitalId).map((d) => d.id)),
    [doctors, hospitalId]
  );

  const { from, to } = useMemo(() => {
    if (dateFilter === "today") return { from: todayStr(), to: todayStr() };
    if (dateFilter === "week")  return { from: weekStartStr(), to: weekEndStr() };
    return { from: "", to: "" };
  }, [dateFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sourceBookings = bookings.length > 0 ? bookings : fallbackBookings;
    return sourceBookings
      .filter((b) => {
        const status = normalizeBookingStatus(b.status);
        if (!myDoctorIds.has(b.doctorId)) return false;
        if (status === "cancelled") return false;
        if (from && b.date < from) return false;
        if (to   && b.date > to)   return false;
        if (q && !(
          b.patientName?.toLowerCase().includes(q) ||
          b.doctorName?.toLowerCase().includes(q) ||
          b.phone?.includes(q) ||
          String(b.tokenNumber).includes(q)
        )) return false;
        return true;
      })
      .sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.tokenNumber - a.tokenNumber;
      });
  }, [bookings, fallbackBookings, myDoctorIds, from, to, search]);

  useEffect(() => {
    if (bookings.length > 0 || !hospitalId) {
      setFallbackBookings([]);
      return;
    }

    let cancelled = false;
    async function fetchFallbackPatients() {
      const API = (import.meta.env.VITE_API_URL as string ?? "").replace(/\/api$/, "");
      const headers = { Authorization: `Bearer ${getToken() ?? ""}` };
      const candidates = [
        `${API}/api/hospital/patients?hospitalId=${encodeURIComponent(hospitalId)}`,
        `${API}/api/hospital/bookings?hospitalId=${encodeURIComponent(hospitalId)}`,
        `${API}/api/bookings?hospitalId=${encodeURIComponent(hospitalId)}`,
      ];

      for (const url of candidates) {
        try {
          const res = await fetch(url, { headers });
          if (!res.ok) continue;
          const data = await res.json();
          if (Array.isArray(data)) {
            if (!cancelled) setFallbackBookings(data);
            return;
          }
        } catch {
          // Try next candidate endpoint.
        }
      }
    }

    void fetchFallbackPatients();
    return () => { cancelled = true; };
  }, [bookings.length, hospitalId]);

  // export uses same from/to but falls back to ±7 days if "all"
  const exportFrom = from || weekStartStr();
  const exportTo   = to   || weekEndStr();

  async function handleExport() {
    setExporting(true);
    try {
      const token = localStorage.getItem("db_jwt") ?? "";
      const API = (import.meta.env.VITE_API_URL as string ?? "").replace(/\/api$/, "");
      const res = await fetch(`${API}/api/hospital/patients/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ from: exportFrom, to: exportTo }),
      });
      if (res.status === 404) { alert("No patient records found for this period."); return; }
      if (!res.ok) { alert("Export failed. Please try again."); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `patients_${exportFrom}_to_${exportTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Live Patients</h1>
            <p className="text-muted-foreground mt-1">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""} shown
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

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setDateFilter("all")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                dateFilter === "all"
                  ? "bg-teal-600 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("today")}
              className={`px-4 py-2 text-sm font-medium border-l border-border transition-colors ${
                dateFilter === "today"
                  ? "bg-teal-600 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("week")}
              className={`px-4 py-2 text-sm font-medium border-l border-border transition-colors ${
                dateFilter === "week"
                  ? "bg-teal-600 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              This Week
            </button>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Downloading…" : "Download Excel"}
          </button>
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
              <TableHead>Complaint</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                  {search ? "No results match your search." : "No patient bookings found."}
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
                <TableCell className="max-w-[180px]">
                  <p className="text-xs text-muted-foreground italic truncate">
                    {b.complaint || "—"}
                  </p>
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={`capitalize text-xs ${STATUS_STYLES[normalizeBookingStatus(b.status)] ?? ""}`}
                  >
                    {normalizeBookingStatus(b.status)}
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
