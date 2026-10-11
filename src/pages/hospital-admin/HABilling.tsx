import { type ReactNode, useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { toast } from "sonner";
import { Download, FlaskConical, IndianRupee, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bookings as bookingsApi, getToken } from "@/api";
import type { Booking } from "../../api";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "@/router/RouterContext";
import { openPharmacyDrawer, periodRange } from "./PharmacyAnalytics";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type LabTest = { id: string; name: string; price: number };
type LabOrder = { id: string; test_id?: string | null; test_name: string; status: string; ordered_at: string };
type SoldRow = {
  name: string; unitPrice: number;
  unitsToday: number; unitsWeek: number; unitsMonth: number;
  revenueToday: number; revenueWeek: number; revenueMonth: number;
};

type Period = "today" | "week" | "month" | "all" | "custom";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

const rupee = (n: number) => `\u20B9${n.toLocaleString("en-IN")}`;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nameKey = (s: string) => (s || "").trim().toLowerCase();
const COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#0ea5e9", "#84cc16", "#a855f7", "#ec4899"];

const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb", padding: "4px 8px" };

type Slice = { name: string; value: number; go?: () => void };
const CLICK_HINT = "Click to view patient list";
// pointer cursor + hover highlight for clickable bars and donut slices (Recharts draws them as SVG)
const CLICKABLE_CHART =
  "[&_.recharts-bar-rectangle]:cursor-pointer [&_.recharts-pie-sector]:cursor-pointer " +
  "[&_.recharts-bar-rectangle]:transition-opacity [&_.recharts-pie-sector]:transition-opacity " +
  "[&_.recharts-bar-rectangle:hover]:opacity-80 [&_.recharts-pie-sector:hover]:opacity-80";

// tooltip body with a click hint line
function HintTip({ active, payload, label, fmt, hint }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TOOLTIP_STYLE, background: "#fff" }}>
      {label != null && label !== "" && <p style={{ fontWeight: 600 }}>{label}</p>}
      {payload.map((p: any) => (
        <p key={String(p.dataKey ?? p.name)}>
          {p.name}: {fmt ? fmt(Number(p.value)) : p.value}
        </p>
      ))}
      {hint && <p style={{ fontSize: 10, color: "#0f766e", marginTop: 2 }}>{hint}</p>}
    </div>
  );
}

function ChartCard({ title, sub, children, className }: { title: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card px-4 py-3 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-xs font-semibold">{title}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <p className="text-[11px] text-muted-foreground h-[120px] flex items-center justify-center">No data for this period</p>;
}

function PieCard({ title, data, money }: { title: string; data: Slice[]; money?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const clickable = data.some((d) => d.go);
  const fmt = (n: number) => (money ? rupee(n) : String(n));
  return (
    <ChartCard title={title} sub={total > 0 ? fmt(total) : undefined}>
      {total === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex items-center gap-3">
          <div style={{ width: 120, height: 120 }} className="shrink-0">
            <ResponsiveContainer>
              <PieChart className={clickable ? CLICKABLE_CHART : undefined}>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={34} outerRadius={56}
                  onClick={(_: unknown, i: number) => data[i]?.go?.()}
                  paddingAngle={data.length > 1 ? 2 : 0} stroke="none">
                  {data.map((d, i) => (
                    <Cell key={d.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<HintTip fmt={fmt} hint={clickable ? CLICK_HINT : undefined} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 min-w-0 space-y-1.5">
            {data.map((d, i) => (
              <li
                key={d.name}
                title={d.go ? CLICK_HINT : undefined}
                onClick={d.go}
                className={`flex items-center gap-2 text-xs ${d.go ? "cursor-pointer rounded -mx-1 px-1 transition-colors hover:bg-muted/60" : ""}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate text-muted-foreground flex-1">{d.name}</span>
                <span className="font-medium">{fmt(d.value)}</span>
                <span className="text-[11px] text-muted-foreground w-9 text-right">{Math.round((d.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

async function getJson(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export default function HABilling() {
  const { doctors, user } = useStore();
  const { navigate } = useRouter();
  const hospitalId = user && user.role === "hospital_admin" ? user.hospitalId : "";
  const myDoctors = useMemo(() => doctors.filter((d) => d.hospitalId === hospitalId), [doctors, hospitalId]);

  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(ymd(new Date()));
  const [to, setTo] = useState(ymd(new Date()));
  const [list, setList] = useState<Booking[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const pharmRange = periodRange(period, from, to);
  const [pharmStats, setPharmStats] = useState<{ revenue: number; patientsServed: number; daily: { date: string; revenue: number }[] }>({ revenue: 0, patientsServed: 0, daily: [] });
  const [medSold, setMedSold] = useState<SoldRow[]>([]);
  useEffect(() => {
    if (!hospitalId) return;
    let off = false;
    const h = { Authorization: `Bearer ${getToken()}` };
    const load = async () => {
      try {
        const qs = new URLSearchParams({ hospitalId, from: pharmRange[0], to: pharmRange[1] });
        const res = await fetch(`${BASE}/pharmacy-stats?${qs.toString()}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          if (!off && d) {
            setPharmStats({
              revenue: Number(d.revenue) || 0,
              patientsServed: Number(d.patientsServed) || 0,
              daily: Array.isArray(d.daily) ? d.daily : [],
            });
          }
        }
      } catch { /* ignore */ }
      try {
        const res = await fetch(`${BASE}/pharmacy-module/medicines-sold`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          if (!off && Array.isArray(d)) setMedSold(d);
        }
      } catch { /* ignore */ }
    };
    load();
    const timer = setInterval(load, 10000);
    const onUp = () => { load(); };
    window.addEventListener("pharmacy-updated", onUp);
    return () => { off = true; clearInterval(timer); window.removeEventListener("pharmacy-updated", onUp); };
  }, [hospitalId, pharmRange[0], pharmRange[1]]);

  useEffect(() => {
    if (!hospitalId) return;
    setLoading(true);
    const bookingsReq = bookingsApi
      .list(hospitalId)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Failed to load bookings"));
    // lab is optional: a hospital without a lab simply shows no lab section
    const ordersReq = getJson("/hospital-lab/orders")
      .then((d) => setLabOrders(Array.isArray(d) ? d : []))
      .catch(() => setLabOrders([]));
    const testsReq = getJson("/hospital-lab/tests")
      .then((d) => setLabTests(Array.isArray(d) ? d : []))
      .catch(() => setLabTests([]));
    Promise.all([bookingsReq, ordersReq, testsReq]).finally(() => setLoading(false));
  }, [hospitalId]);

  // inclusive [start, end] as YYYY-MM-DD strings, or null for all time
  const range = useMemo<[string, string] | null>(() => {
    const now = new Date();
    if (period === "all") return null;
    if (period === "today") return [ymd(now), ymd(now)];
    if (period === "month") return [`${ymd(now).slice(0, 7)}-01`, ymd(now)];
    if (period === "custom") return from <= to ? [from, to] : [to, from];
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return [ymd(start), ymd(now)];
  }, [period, from, to]);

  const { rows, labRows, daily, labTotals, outcomes, weekday, sessions } = useMemo(() => {
    const inRange = (date: string) => !range || (date >= range[0] && date <= range[1]);
    const feeOf = new Map(myDoctors.map((d) => [d.id, d.doctorFee ?? 0]));
    const scoped = list.filter((b) => inRange(b.date));
    const visited = scoped.filter((b) => b.status === "completed");

    const rows = myDoctors
      .map((d) => {
        const fee = d.doctorFee ?? 0;
        const mine = visited.filter((b) => b.doctorId === d.id);
        const paid = mine.filter((b) => b.paymentDone).length;
        const lost = scoped.filter(
          (b) => b.doctorId === d.id && (b.status === "cancelled" || b.status === "unvisited"),
        ).length;
        return {
          id: d.id, name: d.name, specialty: d.specialty, hasFee: d.doctorFee != null, fee,
          visits: mine.length, total: mine.length * fee,
          paidAmt: paid * fee, unpaidAmt: (mine.length - paid) * fee,
          lost, lostAmt: lost * fee,
        };
      })
      .sort((a, b) => b.total - a.total);

    // lab: price of each order comes from its test's current price
    const priceById = new Map(labTests.map((t) => [t.id, t.price ?? 0]));
    const priceByName = new Map(labTests.map((t) => [nameKey(t.name), t.price ?? 0]));
    const labScoped = labOrders.filter((o) => inRange((o.ordered_at || "").slice(0, 10)));
    const byTest = new Map<string, { name: string; price: number; done: number; cancelled: number }>();
    let unpriced = 0;
    for (const o of labScoped) {
      if (o.status !== "report_ready" && o.status !== "cancelled") continue;
      const price = (o.test_id ? priceById.get(o.test_id) : undefined) ?? priceByName.get(nameKey(o.test_name));
      if (price === undefined) unpriced += 1;
      const key = nameKey(o.test_name);
      const row = byTest.get(key) ?? { name: o.test_name, price: price ?? 0, done: 0, cancelled: 0 };
      if (o.status === "report_ready") row.done += 1;
      else row.cancelled += 1;
      byTest.set(key, row);
    }
    const labRows = Array.from(byTest.values())
      .map((r) => ({ ...r, total: r.done * r.price, lostAmt: r.cancelled * r.price }))
      .sort((a, b) => b.total - a.total);
    const labTotals = {
      done: labRows.reduce((s, r) => s + r.done, 0),
      cancelled: labRows.reduce((s, r) => s + r.cancelled, 0),
      revenue: labRows.reduce((s, r) => s + r.total, 0),
      lost: labRows.reduce((s, r) => s + r.lostAmt, 0),
      unpriced,
    };

    const byDay = new Map<string, { consultation: number; lab: number; pharmacy: number }>();
    const bump = (date: string, k: "consultation" | "lab" | "pharmacy", n: number) => {
      const cur = byDay.get(date) ?? { consultation: 0, lab: 0, pharmacy: 0 };
      cur[k] += n;
      byDay.set(date, cur);
    };
    for (const b of visited) bump(b.date, "consultation", feeOf.get(b.doctorId) ?? 0);
    for (const o of labScoped) {
      if (o.status !== "report_ready") continue;
      const price = (o.test_id ? priceById.get(o.test_id) : undefined) ?? priceByName.get(nameKey(o.test_name)) ?? 0;
      bump((o.ordered_at || "").slice(0, 10), "lab", price);
    }
    for (const r of pharmStats.daily) {
      const d = String(r.date).slice(0, 10);
      if (inRange(d)) bump(d, "pharmacy", Number(r.revenue) || 0);
    }
    const daily = Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date: date.slice(5), full: date, ...v, amount: v.consultation + v.lab + v.pharmacy }));

    const count = (s: string) => scoped.filter((b) => b.status === s).length;
    const outcomes = [
      { name: "Completed", value: count("completed") },
      { name: "Booked / waiting", value: count("confirmed") },
      { name: "Cancelled", value: count("cancelled") },
      { name: "Not visited", value: count("unvisited") },
    ].filter((x) => x.value > 0);

    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({ day, visits: 0 }));
    for (const b of visited) {
      const [y, m, d] = b.date.split("-").map(Number);
      const idx = new Date(y, m - 1, d).getDay();
      if (weekday[idx]) weekday[idx].visits += 1;
    }
    const sessions = (["morning", "afternoon", "evening"] as const)
      .map((s) => ({ name: s[0].toUpperCase() + s.slice(1), value: visited.filter((b) => b.session === s).length }))
      .filter((x) => x.value > 0);

    return { rows, labRows, daily, labTotals, outcomes, weekday, sessions };
  }, [list, myDoctors, labOrders, labTests, range, pharmStats.daily]);

  const sum = (k: "visits" | "total" | "paidAmt" | "unpaidAmt" | "lost" | "lostAmt") =>
    rows.reduce((s, r) => s + r[k], 0);
  const totalVisits = sum("visits");
  const consultRevenue = sum("total");
  const grandRevenue = consultRevenue + labTotals.revenue + pharmStats.revenue;
  const lostRevenue = sum("lostAmt") + labTotals.lost;
  const lostCount = sum("lost") + labTotals.cancelled;
  const pharmTotal = pharmStats.revenue;
  const showPharm = pharmTotal > 0;
  const hasLab = labTests.length > 0 || labOrders.length > 0;
  const showLab = hasLab && labTotals.revenue > 0;
  const missingFee = rows.filter((r) => !r.hasFee).length;
  const avgPerDay = daily.length ? Math.round(grandRevenue / daily.length) : 0;
  const bestDay = daily.reduce<{ date: string; amount: number } | null>(
    (best, d) => (!best || d.amount > best.amount ? d : best),
    null,
  );

  // Where a chart click goes: All Patients, pre-filtered. The selected period is carried
  // along so the list matches the number shown on the chart.
  const drillTo = (q: Record<string, string>) =>
    navigate({
      path: "/hospital-admin/all-patients",
      query: { ...(range ? { from: range[0], to: range[1] } : {}), ...q },
    });

  const shareAll = rows.filter((r) => r.total > 0).map((r) => ({
    name: r.name, value: r.total, id: r.id,
    go: () => drillTo({ status: "completed", doctorId: r.id }),
  }));
  const doctorShare =
    shareAll.length > 5
      ? [...shareAll.slice(0, 4), {
          name: "Others", value: shareAll.slice(4).reduce((s, d) => s + d.value, 0), id: "",
          go: () => drillTo({ status: "completed", doctorId: shareAll.slice(4).map((d) => d.id).join(",") }),
        }]
      : shareAll;
  const sourceSplit = [
    { name: "Consultations", value: consultRevenue, go: () => drillTo({ status: "completed" }) },
    { name: "Laboratory", value: labTotals.revenue, go: () => navigate({ path: "/hospital-admin/lab" }) },
    { name: "Pharmacy", value: pharmStats.revenue, go: () => openPharmacyDrawer(hospitalId, pharmRange[0], pharmRange[1]) },
  ].filter((x) => x.value > 0);
  const paidSplit = [
    { name: "Paid", value: sum("paidAmt"), go: () => drillTo({ status: "completed", payment: "paid" }) },
    { name: "Unpaid", value: sum("unpaidAmt"), go: () => drillTo({ status: "completed", payment: "unpaid" }) },
  ].filter((x) => x.value > 0);
  const topTests = labRows.filter((r) => r.total > 0).slice(0, 6).map((r) => ({ name: r.name, total: r.total }));

  const onDayClick = (_: unknown, i: number) => {
    const d = daily[i];
    if (d) drillTo({ status: "completed", date: d.full });
  };
  const onWeekdayClick = (_: unknown, i: number) => drillTo({ status: "completed", day: String(i) });
  const OUTCOME_STATUS: Record<string, string> = {
    Completed: "completed", "Booked / waiting": "confirmed", Cancelled: "cancelled", "Not visited": "unvisited",
  };
  const outcomeSlices = outcomes.map((o) => ({ ...o, go: () => drillTo({ status: OUTCOME_STATUS[o.name] }) }));
  const sessionSlices = sessions.map((s) => ({
    ...s, go: () => drillTo({ status: "completed", session: s.name.toLowerCase() }),
  }));

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const line = (r: (string | number)[]) => r.map(esc).join(",");
    const out: string[] = [
      line(["Doctor", "Specialty", "Patients visited", "Fee per visit", "Total", "Paid", "Unpaid", "Lost visits", "Lost revenue"]),
      ...rows.map((r) => line([r.name, r.specialty, r.visits, r.fee, r.total, r.paidAmt, r.unpaidAmt, r.lost, r.lostAmt])),
    ];
    if (hasLab) {
      out.push("", line(["Lab test", "Reports done", "Price", "Total", "Cancelled", "Lost revenue"]));
      for (const r of labRows) out.push(line([r.name, r.done, r.price, r.total, r.cancelled, r.lostAmt]));
    }
    out.push("", line(["Grand total revenue", grandRevenue]));
    const url = URL.createObjectURL(new Blob([out.join("\n")], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-${range ? `${range[0]}_to_${range[1]}` : "all-time"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const medKey = period === "today" ? "Today" : period === "week" ? "Week" : period === "month" ? "Month" : null;
  const medUnits = (r: SoldRow) => (medKey === "Today" ? r.unitsToday : medKey === "Week" ? r.unitsWeek : r.unitsMonth);
  const medRev = (r: SoldRow) => (medKey === "Today" ? r.revenueToday : medKey === "Week" ? r.revenueWeek : r.revenueMonth);
  const medRows = medKey ? medSold.filter((r) => medUnits(r) > 0) : [];
  const medTotU = medRows.reduce((s, r) => s + medUnits(r), 0);
  const medTotR = medRows.reduce((s, r) => s + medRev(r), 0);
  const card = "rounded-xl border border-border bg-card p-4";
  const cardLabel = "text-xs text-muted-foreground flex items-center gap-1.5";

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-muted-foreground mt-1">Consultation fees from completed visits{hasLab ? " and laboratory reports" : ""}</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={loading || rows.length === 0}
          className="flex items-center gap-2 text-sm font-medium border border-border bg-card rounded-lg px-3 py-2 hover:bg-muted disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
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
        {period === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <DateInput value={from} max={to} onChange={(e) => setFrom(e.target.value)}
              className="border border-border rounded-md px-2 py-1 bg-card" />
            <span className="text-muted-foreground">to</span>
            <DateInput value={to} min={from} onChange={(e) => setTo(e.target.value)}
              className="border border-border rounded-md px-2 py-1 bg-card" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className={card}>
          <p className={cardLabel}><IndianRupee className="w-3.5 h-3.5" />Total revenue</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{rupee(grandRevenue)}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}><Users className="w-3.5 h-3.5" />Patients visited</p>
          <p className="text-2xl font-bold mt-1">{totalVisits}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}><TrendingUp className="w-3.5 h-3.5" />Avg per active day</p>
          <p className="text-2xl font-bold mt-1">{rupee(avgPerDay)}</p>
          {bestDay && <p className="text-[11px] text-muted-foreground mt-0.5">Best day {bestDay.date}: {rupee(bestDay.amount)}</p>}
        </div>
      </div>

      <div className={`grid grid-cols-2 ${hasLab ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-4 mb-6`}>
        <div className={card}>
          <p className="text-xs text-muted-foreground">Consultations</p>
          <p className="text-xl font-bold mt-1">{rupee(consultRevenue)}</p>
        </div>
        {hasLab && (
          <div className={card}>
            <p className={cardLabel}><FlaskConical className="w-3.5 h-3.5" />Laboratory</p>
            <p className="text-xl font-bold mt-1">{rupee(labTotals.revenue)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{labTotals.done} reports</p>
          </div>
        )}
        <div className={card}>
          <p className="text-xs text-muted-foreground">Pharmacy</p>
          <p className="text-xl font-bold mt-1">{rupee(pharmTotal)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{pharmStats.patientsServed} patients</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">Consultations paid</p>
          <p className="text-xl font-bold text-green-600 mt-1">{rupee(sum("paidAmt"))}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Unpaid {rupee(sum("unpaidAmt"))}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">Lost (cancelled / not visited)</p>
          <p className="text-xl font-bold text-red-600 mt-1">{rupee(lostRevenue)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{lostCount} bookings / orders</p>
        </div>
      </div>

      {missingFee > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          {missingFee} doctor{missingFee === 1 ? " has" : "s have"} no consultation fee set, so their revenue shows as {rupee(0)}.
          Set it on the Doctors page.
        </p>
      )}
      {labTotals.unpriced > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          {labTotals.unpriced} lab order{labTotals.unpriced === 1 ? "" : "s"} could not be matched to a test price (the test may have been deleted or renamed), so they count as {rupee(0)}.
        </p>
      )}

      {!loading && (
        <div className="space-y-3 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {daily.length > 0 && (
            <ChartCard title="Revenue per day" sub={`${rupee(grandRevenue)} total`}>
              {(showLab || showPharm) && (
                <div className="flex gap-3 text-[11px] text-muted-foreground mb-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#0d9488" }} />Consultations</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#6366f1" }} />Laboratory</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#f97316" }} />Pharmacy</span>
                </div>
              )}
              <div style={{ width: "100%", height: 170 }}>
                <ResponsiveContainer>
                  <BarChart data={daily} className={CLICKABLE_CHART} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<HintTip fmt={rupee} hint={CLICK_HINT} />} />
                    <Bar dataKey="consultation" name="Consultations" stackId="rev" fill="#0d9488" maxBarSize={32} onClick={onDayClick}
                      radius={showLab || showPharm ? undefined : [3, 3, 0, 0]} />
                    {showLab && <Bar dataKey="lab" name="Laboratory" stackId="rev" fill="#6366f1" maxBarSize={32} radius={showPharm ? undefined : [3, 3, 0, 0]} onClick={() => navigate({ path: "/hospital-admin/lab" })} />}
                    {showPharm && <Bar dataKey="pharmacy" name="Pharmacy" stackId="rev" fill="#f97316" maxBarSize={32} radius={[3, 3, 0, 0]} onClick={() => openPharmacyDrawer(hospitalId, pharmRange[0], pharmRange[1])} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}
            <ChartCard title="Visits by weekday" sub={`${totalVisits} total`}>
              <div style={{ width: "100%", height: 170 }}>
                <ResponsiveContainer>
                  <BarChart data={weekday} className={CLICKABLE_CHART} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<HintTip hint={CLICK_HINT} />} />
                    <Bar dataKey="visits" name="Visits" fill="#0d9488" maxBarSize={20} radius={[3, 3, 0, 0]} onClick={onWeekdayClick} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <PieCard title="Revenue by doctor" data={doctorShare} money />
            {showLab || showPharm ? (
              <PieCard title="Consultations vs laboratory vs pharmacy" data={sourceSplit} money />
            ) : (
              <PieCard title="Paid vs unpaid" data={paidSplit} money />
            )}
            <PieCard title="Booking outcomes" data={outcomeSlices} />
            <PieCard title="Visits by session" data={sessionSlices} />
            {showLab && (
              <ChartCard title="Top lab tests" sub="by revenue" className="lg:col-span-2">
                {topTests.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <div style={{ width: "100%", height: 120 }}>
                    <ResponsiveContainer>
                      <BarChart data={topTests} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={84} />
                        <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={TOOLTIP_STYLE} formatter={(v) => rupee(Number(v))} />
                        <Bar dataKey="total" name="Revenue" fill="#6366f1" maxBarSize={14} radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            )}
          </div>
        </div>
      )}

      <p className="text-sm font-semibold mb-2">Consultations by doctor</p>
      <div className="rounded-xl border border-border overflow-x-auto bg-card mb-6">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Doctor</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead className="text-right">Visited</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Unpaid</TableHead>
              <TableHead className="text-right">Lost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">Loading...</TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">No doctors yet.</TableCell>
              </TableRow>
            )}
            {!loading && rows.map((r) => (
              <TableRow key={r.id} title={CLICK_HINT}
                className="cursor-pointer transition-colors hover:bg-muted/60"
                onClick={() => drillTo({ status: "completed", doctorId: r.id })}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.specialty}</TableCell>
                <TableCell className="text-right">{r.visits}</TableCell>
                <TableCell className="text-right">{r.hasFee ? rupee(r.fee) : "\u2014"}</TableCell>
                <TableCell className="text-right font-semibold">{rupee(r.total)}</TableCell>
                <TableCell className="text-right text-green-700 hover:underline" title="Click to view paid visits"
                  onClick={(e) => { e.stopPropagation(); drillTo({ status: "completed", doctorId: r.id, payment: "paid" }); }}>{rupee(r.paidAmt)}</TableCell>
                <TableCell className="text-right text-amber-700 hover:underline" title="Click to view unpaid visits"
                  onClick={(e) => { e.stopPropagation(); drillTo({ status: "completed", doctorId: r.id, payment: "unpaid" }); }}>{rupee(r.unpaidAmt)}</TableCell>
                <TableCell className="text-right text-red-600 hover:underline" title="Click to view cancelled / not visited"
                  onClick={(e) => { e.stopPropagation(); drillTo({ status: "cancelled,unvisited", doctorId: r.id }); }}>{r.lost > 0 ? `${r.lost} (${rupee(r.lostAmt)})` : "0"}</TableCell>
              </TableRow>
            ))}
            {!loading && rows.length > 0 && (
              <TableRow className="bg-muted/40">
                <TableCell className="font-bold" colSpan={2}>Total</TableCell>
                <TableCell className="text-right font-bold">{totalVisits}</TableCell>
                <TableCell />
                <TableCell className="text-right font-bold text-teal-600">{rupee(consultRevenue)}</TableCell>
                <TableCell className="text-right font-bold text-green-700">{rupee(sum("paidAmt"))}</TableCell>
                <TableCell className="text-right font-bold text-amber-700">{rupee(sum("unpaidAmt"))}</TableCell>
                <TableCell className="text-right font-bold text-red-600">{sum("lost")} ({rupee(sum("lostAmt"))})</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {hasLab && !loading && (
        <>
          <p className="text-sm font-semibold mb-2">Laboratory by test</p>
          <div className="rounded-xl border border-border overflow-x-auto bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Test</TableHead>
                  <TableHead className="text-right">Reports done</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Cancelled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No completed or cancelled lab orders in this period.</TableCell>
                  </TableRow>
                )}
                {labRows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.done}</TableCell>
                    <TableCell className="text-right">{rupee(r.price)}</TableCell>
                    <TableCell className="text-right font-semibold">{rupee(r.total)}</TableCell>
                    <TableCell className="text-right text-red-600">{r.cancelled > 0 ? `${r.cancelled} (${rupee(r.lostAmt)})` : "0"}</TableCell>
                  </TableRow>
                ))}
                {labRows.length > 0 && (
                  <TableRow className="bg-muted/40">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{labTotals.done}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold text-teal-600">{rupee(labTotals.revenue)}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">{labTotals.cancelled} ({rupee(labTotals.lost)})</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!loading && (
        <div className="mt-6">
          <p className="text-sm font-semibold mb-2">Pharmacy by medicine</p>
          <div className="rounded-xl border border-border overflow-x-auto bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Medicine</TableHead>
                  <TableHead className="text-right">Units sold</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!medKey && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Medicine breakdown is available for Today, Last 7 days and This month.</TableCell>
                  </TableRow>
                )}
                {medKey && medRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nothing sold in this period.</TableCell>
                  </TableRow>
                )}
                {medRows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{medUnits(r)}</TableCell>
                    <TableCell className="text-right">{rupee(r.unitPrice)}</TableCell>
                    <TableCell className="text-right font-semibold">{rupee(medRev(r))}</TableCell>
                  </TableRow>
                ))}
                {medRows.length > 0 && (
                  <TableRow className="bg-muted/40">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{medTotU}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold text-teal-600">{rupee(medTotR)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

