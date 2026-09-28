import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Building2 } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { useMemo, useState } from "react";
import type { Booking } from "../../types";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  unvisited: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 50;

interface Group {
  name: string;
  bookings: Booking[]; // newest first
  patientCount: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

export default function AdminBookings() {
  const { bookings } = useStore();
  const [selected, setSelected] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, Booking[]>();
    // newest first (same ordering the old page used)
    for (const b of [...bookings].reverse()) {
      const name = (b.hospitalName || "Unknown hospital").trim();
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(b);
    }
    const result: Group[] = Array.from(map.entries()).map(([name, list]) => ({
      name,
      bookings: list,
      patientCount: new Set(list.map((b) => b.patientId)).size,
      confirmed: list.filter((b) => b.status === "confirmed").length,
      completed: list.filter((b) => b.status === "completed").length,
      cancelled: list.filter((b) => b.status === "cancelled").length,
    }));
    result.sort((a, b) => b.bookings.length - a.bookings.length);
    return result;
  }, [bookings]);

  const cardBase =
    "text-left rounded-xl border p-4 transition-colors cursor-pointer bg-card hover:bg-muted/40";
  const cardActive = "border-primary ring-1 ring-primary";
  const cardIdle = "border-border";

  const visibleGroups =
    selected === "all" ? groups : groups.filter((g) => g.name === selected);

  function renderTable(g: Group) {
    const showAll = !!expanded[g.name];
    const rows = showAll ? g.bookings : g.bookings.slice(0, PAGE_SIZE);
    return (
      <>
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Token #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Complaint</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((booking, idx) => (
                <TableRow key={booking.id} data-ocid={`admin.item.${idx + 1}`}>
                  <TableCell className="font-mono font-bold text-primary">
                    #{booking.tokenNumber}
                  </TableCell>
                  <TableCell className="font-medium">{booking.patientName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{booking.doctorName}</TableCell>
                  <TableCell className="text-sm">{booking.date}</TableCell>
                  <TableCell className="text-sm capitalize">{booking.session}</TableCell>
                  <TableCell className="max-w-[180px]">
                    <p className="text-xs text-muted-foreground italic truncate">
                      {booking.complaint || "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[booking.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {g.bookings.length > PAGE_SIZE && (
          <button
            onClick={() => setExpanded((e) => ({ ...e, [g.name]: !showAll }))}
            className="mt-3 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted"
          >
            {showAll ? `Show latest ${PAGE_SIZE} only` : `Show all ${g.bookings.length} bookings`}
          </button>
        )}
      </>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Booking Management</h1>
        <p className="text-muted-foreground mt-1">
          {bookings.length} bookings across {groups.length} hospitals (read-only)
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <BookOpen className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No bookings yet</p>
          <p className="text-sm mt-1">Bookings will appear after patients book tokens</p>
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
                <BookOpen className="w-4 h-4" /> All hospitals
              </div>
              <div className="text-2xl font-bold mt-2">{bookings.length}</div>
              <div className="text-xs text-muted-foreground">total bookings</div>
            </button>

            {groups.map((g) => (
              <button
                key={g.name}
                onClick={() => setSelected(g.name)}
                className={`${cardBase} ${selected === g.name ? cardActive : cardIdle}`}
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">{g.name}</span>
                </div>
                <div className="text-2xl font-bold mt-2">{g.bookings.length}</div>
                <div className="text-xs text-muted-foreground">
                  {g.patientCount} patients · {g.completed} completed · {g.cancelled} cancelled
                </div>
              </button>
            ))}
          </div>

          {/* Hospital sections */}
          <div className="space-y-8">
            {visibleGroups.map((g) => (
              <section key={g.name}>
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{g.name}</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {g.bookings.length} bookings
                  </span>
                </div>
                {renderTable(g)}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
