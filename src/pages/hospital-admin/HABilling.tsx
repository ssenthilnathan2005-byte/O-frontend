import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IndianRupee, Stethoscope, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bookings as bookingsApi } from "@/api";
import type { Booking } from "../../api";
import { useStore } from "../../context/StoreContext";

type Period = "today" | "week" | "month" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

const rupee = (n: number) => `\u20B9${n.toLocaleString("en-IN")}`;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function inPeriod(date: string, period: Period): boolean {
  if (period === "all") return true;
  const now = new Date();
  if (period === "today") return date === ymd(now);
  if (period === "month") return date.startsWith(ymd(now).slice(0, 7));
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return date >= ymd(from) && date <= ymd(now);
}

export default function HABilling() {
  const { doctors, user } = useStore();
  const hospitalId = user && user.role === "hospital_admin" ? user.hospitalId : "";
  const myDoctors = doctors.filter((d) => d.hospitalId === hospitalId);

  const [period, setPeriod] = useState<Period>("month");
  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hospitalId) return;
    setLoading(true);
    bookingsApi
      .list(hospitalId)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Failed to load bookings"))
      .finally(() => setLoading(false));
  }, [hospitalId]);

  const rows = useMemo(() => {
    const visited = list.filter((b) => b.status === "completed" && inPeriod(b.date, period));
    return myDoctors
      .map((d) => {
        const visits = visited.filter((b) => b.doctorId === d.id).length;
        const fee = d.doctorFee ?? 0;
        return { id: d.id, name: d.name, specialty: d.specialty, hasFee: d.doctorFee != null, fee, visits, total: visits * fee };
      })
      .sort((a, b) => b.total - a.total);
  }, [list, myDoctors, period]);

  const totalVisits = rows.reduce((s, r) => s + r.visits, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.total, 0);
  const missingFee = rows.filter((r) => !r.hasFee).length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">Consultation fee revenue from completed patient visits</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              period === p.key ? "bg-teal-600 text-white border-teal-600" : "bg-card text-muted-foreground border-border"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5" />Consultation revenue</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{rupee(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Patients visited</p>
          <p className="text-2xl font-bold mt-1">{totalVisits}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" />Doctors</p>
          <p className="text-2xl font-bold mt-1">{rows.length}</p>
        </div>
      </div>

      {missingFee > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          {missingFee} doctor{missingFee === 1 ? " has" : "s have"} no consultation fee set, so their revenue shows as {rupee(0)}.
          Set it on the Doctors page.
        </p>
      )}

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Doctor</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead className="text-right">Patients visited</TableHead>
              <TableHead className="text-right">Fee per visit</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">Loading...</TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">No doctors yet.</TableCell>
              </TableRow>
            )}
            {!loading && rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.specialty}</TableCell>
                <TableCell className="text-right">{r.visits}</TableCell>
                <TableCell className="text-right">{r.hasFee ? rupee(r.fee) : "\u2014"}</TableCell>
                <TableCell className="text-right font-semibold">{rupee(r.total)}</TableCell>
              </TableRow>
            ))}
            {!loading && rows.length > 0 && (
              <TableRow className="bg-muted/40">
                <TableCell className="font-bold" colSpan={2}>Total</TableCell>
                <TableCell className="text-right font-bold">{totalVisits}</TableCell>
                <TableCell />
                <TableCell className="text-right font-bold text-teal-600">{rupee(totalRevenue)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
