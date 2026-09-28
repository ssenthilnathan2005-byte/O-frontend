import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FlaskConical, Loader2, RefreshCw, Check, Home, Building2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as api from "../../api";
import type { LabBooking } from "../../api";

type S = LabBooking["status"];

const FLOW: S[] = ["booked", "technician_assigned", "sample_collected", "processing", "report_ready"];
const STEP_LABEL: Record<string, string> = {
  booked: "Booked",
  technician_assigned: "Technician",
  sample_collected: "Sample",
  processing: "Processing",
  report_ready: "Report",
};
const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  technician_assigned: "Technician assigned",
  sample_collected: "Sample collected",
  processing: "Processing",
  report_ready: "Report ready",
  cancelled: "Cancelled",
};

const PAGE_SIZE = 50;
type Filter = "all" | "active" | "report_ready" | "cancelled";

function Stepper({ status }: { status: S }) {
  if (status === "cancelled") {
    return (
      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        Cancelled
      </span>
    );
  }
  const idx = FLOW.indexOf(status);
  return (
    <div className="flex min-w-[400px]">
      {FLOW.map((s, i) => {
        const done = i <= idx;
        const current = i === idx;
        return (
          <div key={s} className="flex-1 relative flex flex-col items-center">
            {i > 0 && (
              <div className={`absolute top-2.5 right-1/2 w-full h-0.5 ${i <= idx ? "bg-green-500" : "bg-muted"}`} />
            )}
            <div
              className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                done ? "bg-green-500 border-green-500 text-white" : "bg-card border-muted-foreground/30"
              } ${current && status !== "report_ready" ? "ring-2 ring-green-300" : ""}`}
            >
              {done && <Check className="w-3 h-3" />}
            </div>
            <span className={`text-[10px] mt-1 leading-tight text-center ${current ? "font-semibold" : "text-muted-foreground"}`}>
              {STEP_LABEL[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface Group {
  name: string;
  bookings: LabBooking[];
  active: number;
  ready: number;
  cancelled: number;
}

function LabRow({ b }: { b: LabBooking }) {
  const showReport = !!b.report_url && b.status === "report_ready";
  return (
    <TableRow>
      <TableCell className="font-mono font-bold text-primary">
        {b.token_number ? `#${b.token_number}` : "—"}
      </TableCell>
      <TableCell>
        <div className="font-medium">{b.patient_name}</div>
        <div className="text-xs text-muted-foreground">{b.phone}</div>
      </TableCell>
      <TableCell className="text-sm">{b.test_name ?? "—"}</TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        {b.slot_date}
        <div className="text-xs text-muted-foreground">{api.labSessionLabel(b.slot_time)}</div>
      </TableCell>
      <TableCell className="text-sm">
        {b.collection_type === "home" ? (
          <span className="inline-flex items-center gap-1">
            <Home className="w-3.5 h-3.5" /> Home
          </span>
        ) : (
          "Walk-in"
        )}
      </TableCell>
      <TableCell className="text-sm">{b.payment_done ? "Yes" : "No"}</TableCell>
      <TableCell>
        <Stepper status={b.status} />
        <div className="mt-1 text-xs text-muted-foreground">
          {STATUS_LABEL[b.status] ?? b.status}
          {b.late_flag ? " · running late" : ""}
        </div>
        {showReport && (
          <a href={b.report_url ?? "#"} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
            View report
          </a>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        <div>Booked {new Date(b.created_at).toLocaleString()}</div>
        <div>Updated {new Date(b.updated_at).toLocaleString()}</div>
      </TableCell>
    </TableRow>
  );
}

export default function AdminLabBookings() {
  const [all, setAll] = useState<LabBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function load() {
    setLoading(true);
    api.labs.allBookings()
      .then(setAll)
      .catch(() => toast.error("Failed to load lab bookings"))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const matches = (b: LabBooking) =>
    filter === "all" ||
    (filter === "active" && b.status !== "report_ready" && b.status !== "cancelled") ||
    b.status === filter;

  const groups = useMemo(() => {
    const sorted = [...all].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const map = new Map<string, LabBooking[]>();
    for (const b of sorted) {
      const name = (b.lab_name || "Unknown lab").trim();
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(b);
    }
    const res: Group[] = Array.from(map.entries()).map(([name, list]) => ({
      name,
      bookings: list,
      active: list.filter((b) => b.status !== "report_ready" && b.status !== "cancelled").length,
      ready: list.filter((b) => b.status === "report_ready").length,
      cancelled: list.filter((b) => b.status === "cancelled").length,
    }));
    res.sort((a, b) => b.bookings.length - a.bookings.length);
    return res;
  }, [all]);

  const cardBase = "text-left rounded-xl border p-4 transition-colors cursor-pointer bg-card hover:bg-muted/40";
  const cardActive = "border-primary ring-1 ring-primary";
  const cardIdle = "border-border";
  const visible = selected === "all" ? groups : groups.filter((g) => g.name === selected);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "In progress" },
    { key: "report_ready", label: "Report ready" },
    { key: "cancelled", label: "Cancelled" },
  ];

  function renderSection(g: Group) {
    const list = g.bookings.filter(matches);
    const showAll = !!expanded[g.name];
    const rows = showAll ? list : list.slice(0, PAGE_SIZE);
    return (
      <section key={g.name}>
        <div className="flex items-center gap-3 mb-3">
          <FlaskConical className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{g.name}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {list.length} bookings
          </span>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings match this filter.</p>
        ) : (
          <div>
            <div className="rounded-xl border border-border overflow-x-auto bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Token</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Last update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((b) => (
                    <LabRow key={b.id} b={b} />
                  ))}
                </TableBody>
              </Table>
            </div>
            {list.length > PAGE_SIZE && (
              <button
                onClick={() => setExpanded((e) => ({ ...e, [g.name]: !showAll }))}
                className="mt-3 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted"
              >
                {showAll ? "Show latest " + PAGE_SIZE + " only" : "Show all " + list.length + " bookings"}
              </button>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lab Bookings</h1>
          <p className="text-muted-foreground mt-1">
            {all.length} lab bookings across {groups.length} labs (read-only)
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading && all.length === 0 ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : all.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FlaskConical className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No lab bookings yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
            <button
              onClick={() => setSelected("all")}
              className={`${cardBase} ${selected === "all" ? cardActive : cardIdle}`}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FlaskConical className="w-4 h-4" /> All labs
              </div>
              <div className="text-2xl font-bold mt-2">{all.length}</div>
              <div className="text-xs text-muted-foreground">total lab bookings</div>
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
                  {g.active} in progress · {g.ready} ready · {g.cancelled} cancelled
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-8">{visible.map(renderSection)}</div>
        </>
      )}
    </div>
  );
}
