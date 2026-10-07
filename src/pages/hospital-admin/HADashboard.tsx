import { useMemo, useState, useEffect, type ReactNode } from "react";
import {
  UserCog, Users2, CalendarCheck, Pill, Activity, BedDouble, FlaskConical, Package,
  IndianRupee, TrendingUp, TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { isLiveBookingStatus, normalizeBookingStatus } from "../../lib/bookingStatus";
import { useRouter } from "../../router/RouterContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Local (not UTC) date as YYYY-MM-DD, so "today" matches the user's calendar day.
function ymd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function todayStr() {
  return ymd(new Date());
}

const DASH = "\u2014";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Period = "today" | "week" | "month" | "year" | "custom";

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
  { id: "custom", label: "Custom" },
];

function rangeFor(p: Period, customFrom: string, customTo: string) {
  const now = new Date();
  const today = ymd(now);
  if (p === "today") return { from: today, to: today };
  if (p === "week") {
    const d = new Date(now);
    const sinceMonday = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - sinceMonday);
    return { from: ymd(d), to: today };
  }
  if (p === "month") return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (p === "year") return { from: `${now.getFullYear()}-01-01`, to: today };
  return { from: customFrom, to: customTo };
}

// Shape returned by GET {BASE}/dashboard/kpis?hospitalId=...&from=...&to=...
// Any field the backend doesn't send stays null and the card shows a dash.
type Kpis = {
  revenue: number | null;
  revenuePrevious: number | null;
  paymentSplit: { cash: number; upi: number; tpa: number } | null;
  receivables: number | null;
  unbilledAccounts: number | null;
  tpaApproved: number | null;
  tpaPendingPreAuth: number | null;
  avgWaitMins: number | null;
  dischargesScheduled: number | null;
  dischargesDone: number | null;
  labTatMins: number | null;
  criticalAlerts: number | null;
  bookings: { total: number; completed: number; unvisited: number; confirmed: number } | null;
};

const EMPTY_KPIS: Kpis = {
  revenue: null,
  revenuePrevious: null,
  paymentSplit: null,
  receivables: null,
  unbilledAccounts: null,
  tpaApproved: null,
  tpaPendingPreAuth: null,
  avgWaitMins: null,
  dischargesScheduled: null,
  dischargesDone: null,
  labTatMins: null,
  criticalAlerts: null,
  bookings: null,
};

type Tab = "all" | "opd" | "ipd" | "fin";
type Group = Exclude<Tab, "all">;

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "opd", label: "OPD & Operations" },
  { id: "ipd", label: "IPD & Beds" },
  { id: "fin", label: "Financials" },
];

const money = (v: number | null) =>
  v === null
    ? DASH
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);


function Badge({ children, tone }: { children: ReactNode; tone: "green" | "amber" | "red" | "gray" | "blue" }) {
  const tones = {
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-100 text-gray-500",
    blue: "bg-blue-50 text-blue-700",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function MetricCard({
  label, icon: Icon, color, bg, children,
}: { label: string; icon: LucideIcon; color: string; bg: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      {children}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function HADashboard() {
  const { doctors, bookings, user } = useStore();
  const { navigate } = useRouter();

  const hospitalId = user?.role === "hospital_admin" ? user.hospitalId : "";
  const hospitalName = user?.role === "hospital_admin" ? user.hospitalName : "Hospital";

  const [tab, setTab] = useState<Tab>("all");
  const show = (g: Group) => tab === "all" || tab === g;

  const [period, setPeriod] = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  const range = rangeFor(period, customFrom, customTo);
  const rangeValid = DATE_RE.test(range.from) && DATE_RE.test(range.to) && range.from <= range.to;
  const rangeKey = `${range.from}|${range.to}`;
  const isToday = period === "today";

  const [pharmacyCount, setPharmacyCount] = useState(0);
  const [hasPharmacy, setHasPharmacy] = useState(false);
  const [bedStats, setBedStats] = useState({ occupied: 0, total: 0, maintenance: 0 });
  const [pendingLabOrders, setPendingLabOrders] = useState(0);
  const [activeInward, setActiveInward] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [kpisState, setKpisState] = useState<{ key: string; data: Kpis }>({ key: "", data: EMPTY_KPIS });
  // Only show KPI data that belongs to the period currently selected.
  const kpis = kpisState.key === rangeKey ? kpisState.data : EMPTY_KPIS;

  const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

  useEffect(() => {
    if (!hospitalId) return;
    async function fetchPharmacy() {
      try {
        const { getToken } = await import("../../api");
        const res = await fetch(`${BASE}/pharmacy/staff?hospitalId=${hospitalId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        setPharmacyCount(Array.isArray(data) ? data.filter((s: any) => s.is_active).length : 0);
        setHasPharmacy(Array.isArray(data) && data.length > 0);
      } catch { }
    }
    fetchPharmacy();

    async function fetchOpsStats() {
      try {
        const { getToken } = await import("../../api");
        const headers = { Authorization: `Bearer ${getToken()}` };

        const [wardsRes, labRes, inwardRes, invRes] = await Promise.all([
          fetch(`${BASE}/wards?hospitalId=${hospitalId}`, { headers }).then(r => r.json()).catch(() => []),
          fetch(`${BASE}/hospital-lab/orders?hospitalId=${hospitalId}`, { headers }).then(r => r.json()).catch(() => []),
          fetch(`${BASE}/inward?hospitalId=${hospitalId}`, { headers }).then(r => r.json()).catch(() => []),
          fetch(`${BASE}/inventory?hospitalId=${hospitalId}`, { headers }).then(r => r.json()).catch(() => []),
        ]);

        if (Array.isArray(wardsRes)) {
          const totals = wardsRes.reduce((acc: any, w: any) => ({
            occupied: acc.occupied + Number(w.occupied_beds || 0),
            total: acc.total + Number(w.total_beds_actual ?? w.total_beds ?? 0),
            maintenance: acc.maintenance + Number(w.maintenance_beds || 0),
          }), { occupied: 0, total: 0, maintenance: 0 });
          setBedStats(totals);
        }

        if (Array.isArray(labRes)) {
          setPendingLabOrders(labRes.filter((o: any) => ["ordered", "sample_collected", "processing"].includes(o.status)).length);
        }

        if (Array.isArray(inwardRes)) {
          setActiveInward(inwardRes.filter((p: any) => p.status === "admitted").length);
        }

        if (Array.isArray(invRes)) {
          setLowStockCount(invRes.filter((i: any) => Number(i.quantity) <= Number(i.min_quantity)).length);
        }
      } catch { }
    }
    fetchOpsStats();
  }, [hospitalId]);

  // Financial + operational KPIs for the selected period.
  // If the endpoint is unavailable, cards show a dash.
  useEffect(() => {
    if (!hospitalId || !rangeValid) return;
    let cancelled = false;
    (async () => {
      try {
        const { getToken } = await import("../../api");
        const qs = new URLSearchParams({ hospitalId, from: range.from, to: range.to });
        const res = await fetch(`${BASE}/dashboard/kpis?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && typeof data === "object") {
          setKpisState({ key: rangeKey, data: { ...EMPTY_KPIS, ...data } });
        }
      } catch { }
    })();
    return () => { cancelled = true; };
  }, [hospitalId, rangeKey, rangeValid]);

  // Pharmacy stats for the selected period (auto-refresh every 30s).
  const [pharm, setPharm] = useState<{ key: string; patientsServed: number; tabletsSold: number; revenue: number; daily: { date: string; revenue: number }[] } | null>(null);
  useEffect(() => {
    if (!hospitalId || !rangeValid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { getToken } = await import("../../api");
        const qs = new URLSearchParams({ hospitalId, from: range.from, to: range.to });
        const res = await fetch(`${BASE}/pharmacy-stats?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data) {
          setPharm({
            key: rangeKey,
            patientsServed: Number(data.patientsServed) || 0,
            tabletsSold: Number(data.tabletsSold) || 0,
            revenue: Number(data.revenue) || 0,
            daily: Array.isArray(data.daily) ? data.daily : [],
          });
        }
      } catch { }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [hospitalId, rangeKey, rangeValid]);
  const pharmNow = pharm && pharm.key === rangeKey ? pharm : null;
  const pharmSeries = useMemo<{ label: string; amount: number }[]>(() => {
    if (!pharmNow) return [];
    const byMonth = pharmNow.daily.length > 62;
    const out = new Map<string, number>();
    for (const d of pharmNow.daily) {
      const key = byMonth ? d.date.slice(0, 7) : d.date;
      out.set(key, (out.get(key) ?? 0) + Number(d.revenue || 0));
    }
    return Array.from(out, ([key, amount]) => ({ label: byMonth ? key : key.slice(5), amount }));
  }, [pharmNow]);
  const myDoctors = useMemo(
    () => doctors.filter((d) => d.hospitalId === hospitalId),
    [doctors, hospitalId]
  );

  const myBookings = useMemo(
    () => bookings.filter((b) => myDoctors.some((d) => d.id === b.doctorId)),
    [bookings, myDoctors]
  );

  // Doctor Status always stays "today".
  const todayBookings = useMemo(
    () => myBookings.filter((b) => b.date === todayStr()),
    [myBookings]
  );

  // Booking counts for the selected period: server value if available, else from loaded bookings.
  const rangeBookings = useMemo(
    () => (rangeValid ? myBookings.filter((b) => b.date >= range.from && b.date <= range.to) : []),
    [myBookings, rangeKey, rangeValid]
  );
  const bTotal = kpis.bookings?.total ?? rangeBookings.length;
  const bConfirmed = kpis.bookings?.confirmed ?? rangeBookings.filter((b) => isLiveBookingStatus(b.status)).length;
  const bCompleted = kpis.bookings?.completed ?? rangeBookings.filter((b) => normalizeBookingStatus(b.status) === "completed").length;
  const bUnvisited = kpis.bookings?.unvisited ?? rangeBookings.filter((b) => normalizeBookingStatus(b.status) === "unvisited").length;

  const availableDoctors = myDoctors.filter((d) => d.isAvailable).length;

  const stats: {
    group: Group; label: string; value: string | number; sub: string;
    icon: LucideIcon; color: string; bg: string; to?: string;
  }[] = [
    { group: "opd", label: "Total Doctors", value: myDoctors.length, sub: `${availableDoctors} available today`, icon: UserCog, color: "text-teal-600", bg: "bg-teal-50", to: "/hospital-admin/doctors" },
    { group: "opd", label: isToday ? "Today's Bookings" : "Bookings", value: bTotal, sub: `${bConfirmed} confirmed`, icon: CalendarCheck, color: "text-blue-600", bg: "bg-blue-50" },
    { group: "opd", label: isToday ? "Completed Today" : "Completed", value: bCompleted, sub: `${bUnvisited} unvisited`, icon: Activity, color: "text-green-600", bg: "bg-green-50" },
    { group: "opd", label: "Pharmacy Staff", value: pharmacyCount, sub: hasPharmacy ? "pharmacy active" : "no pharmacy", icon: Pill, color: "text-orange-600", bg: "bg-orange-50", to: "/hospital-admin/pharmacy" },
    { group: "ipd", label: "Bed Occupancy", value: `${bedStats.occupied}/${bedStats.total}`, sub: bedStats.maintenance > 0 ? `${bedStats.maintenance} cleaning` : "beds occupied", icon: BedDouble, color: "text-red-600", bg: "bg-red-50", to: "/hospital-admin/wards" },
    { group: "ipd", label: "Admitted Patients", value: activeInward, sub: "currently inward", icon: Users2, color: "text-indigo-600", bg: "bg-indigo-50", to: "/hospital-admin/ipd" },
    { group: "opd", label: "Pending Lab Orders", value: pendingLabOrders, sub: "awaiting results", icon: FlaskConical, color: "text-purple-600", bg: "bg-purple-50", to: "/hospital-admin/lab" },
    {
      group: "opd", label: "Low Stock Items", value: lowStockCount,
      sub: lowStockCount > 0 ? "needs reordering" : "all stocked",
      icon: Package,
      color: lowStockCount > 0 ? "text-amber-600" : "text-gray-500",
      bg: lowStockCount > 0 ? "bg-amber-50" : "bg-gray-50",
      to: "/hospital-admin/inventory",
    },
  ];
  const visibleStats = stats.filter((s) => show(s.group));

  // ---- Financial derived values ----
  const revChange =
    kpis.revenue !== null && kpis.revenuePrevious !== null && kpis.revenuePrevious > 0
      ? ((kpis.revenue - kpis.revenuePrevious) / kpis.revenuePrevious) * 100
      : null;
  const compareText = isToday ? "vs yesterday" : "vs previous period";

  const split = kpis.paymentSplit;
  const splitTotal = split ? split.cash + split.upi + split.tpa : 0;
  const splitPct = (v: number) => (splitTotal > 0 ? Math.round((v / splitTotal) * 100) : 0);

  // ---- Revenue chart: completed visits x doctor fee, per day (per month for long ranges) ----
  const revenueSeries = useMemo<{ label: string; amount: number }[]>(() => {
    if (!rangeValid) return [];
    const fee = new Map(myDoctors.map((doc) => [doc.id, Number(doc.doctorFee ?? 0)]));
    const perDay = new Map<string, number>();
    for (const b of rangeBookings) {
      if (normalizeBookingStatus(b.status) !== "completed") continue;
      perDay.set(b.date, (perDay.get(b.date) ?? 0) + (fee.get(b.doctorId) ?? 0));
    }
    const [y, m, dd] = range.from.split("-").map(Number);
    const cur = new Date(y, m - 1, dd);
    const days: string[] = [];
    while (ymd(cur) <= range.to && days.length < 1100) {
      days.push(ymd(cur));
      cur.setDate(cur.getDate() + 1);
    }
    const byMonth = days.length > 62;
    const out = new Map<string, number>();
    for (const day of days) {
      const key = byMonth ? day.slice(0, 7) : day;
      out.set(key, (out.get(key) ?? 0) + (perDay.get(day) ?? 0));
    }
    return Array.from(out, ([key, amount]) => ({ label: byMonth ? key : key.slice(5), amount }));
  }, [rangeBookings, myDoctors, rangeKey, rangeValid]);
  const revenueChartTotal = revenueSeries.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {hospitalName} &mdash; system stats at a glance
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto bg-gray-100 rounded-lg p-1 w-full md:w-fit" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Period filter */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-all ${
                period === p.id
                  ? "bg-teal-600 border-teal-600 text-white font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:border-teal-300"
              }`}
            >
              {p.label}
            </button>
          ))}
          {period === "custom" && (
            <>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-sm text-gray-700"
              />
              <span className="text-sm text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-sm text-gray-700"
              />
            </>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {rangeValid
            ? isToday ? "Showing today" : `Showing ${range.from} to ${range.to}`
            : "Pick a valid from and to date"}
        </p>
      </div>

      {/* 1. Financial Overview (top) */}
      {show("fin") && (
        <Section title="Financial Overview" subtitle="Revenue for the selected period">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label={isToday ? "Today's Revenue" : "Revenue"} icon={IndianRupee} color="text-emerald-600" bg="bg-emerald-50">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-3xl font-bold text-gray-900">{money(kpis.revenue)}</span>
                  {revChange !== null && (
                    <Badge tone={revChange >= 0 ? "green" : "red"}>
                      {revChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(revChange).toFixed(0)}% {compareText}
                    </Badge>
                  )}
                </div>
                {split && splitTotal > 0 ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                      <div className="bg-emerald-500" style={{ width: `${splitPct(split.cash)}%` }} />
                      <div className="bg-indigo-500" style={{ width: `${splitPct(split.upi)}%` }} />
                      <div className="bg-amber-500" style={{ width: `${splitPct(split.tpa)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Cash {splitPct(split.cash)}%</span>
                      <span><span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-1" />UPI {splitPct(split.upi)}%</span>
                      <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />TPA {splitPct(split.tpa)}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">Cash / UPI / TPA split: {DASH}</p>
                )}
              </div>
            </MetricCard>

            <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Revenue trend</span>
                <span className="text-xs text-gray-400">{money(revenueChartTotal)} from completed visits</span>
              </div>
              {revenueSeries.some((r) => r.amount > 0) ? (
                <div style={{ width: "100%", height: 190 }}>
                  <ResponsiveContainer>
                    <BarChart data={revenueSeries} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
                      <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => [money(Number(v)), "Revenue"]} />
                      <Bar dataKey="amount" name="Revenue" fill="#10b981" maxBarSize={32} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-10 text-center">No revenue in this period</p>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Pharmacy statistics + revenue chart */}
      {show("fin") && (
        <Section title="Pharmacy" subtitle="Pharmacy sales for the selected period, updates automatically">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{isToday ? "Patients served today" : "Patients served"}</span>
                  <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center"><UserCog className="w-4 h-4 text-teal-600" /></div>
                </div>
                <span className="text-3xl font-bold text-gray-900">{pharmNow ? pharmNow.patientsServed : DASH}</span>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{isToday ? "Tablets sold today" : "Tablets sold"}</span>
                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center"><Pill className="w-4 h-4 text-orange-600" /></div>
                </div>
                <span className="text-3xl font-bold text-gray-900">{pharmNow ? pharmNow.tabletsSold : DASH}</span>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{isToday ? "Pharmacy revenue today" : "Pharmacy revenue"}</span>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center"><IndianRupee className="w-4 h-4 text-emerald-600" /></div>
                </div>
                <span className="text-3xl font-bold text-gray-900">{pharmNow ? money(pharmNow.revenue) : DASH}</span>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
              <span className="text-sm text-gray-500">Pharmacy revenue</span>
              {pharmSeries.some((r) => r.amount > 0) ? (
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={pharmSeries} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
                      <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => [money(Number(v)), "Pharmacy revenue"]} />
                      <Bar dataKey="amount" name="Pharmacy revenue" fill="#f97316" maxBarSize={32} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-10 text-center">No pharmacy revenue in this period</p>
              )}
            </div>
          </div>
        </Section>
      )}
      {/* 3. Hospital detail cards (middle) */}
      {visibleStats.length > 0 && (
        <Section title="Hospital Details">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibleStats.map(({ label, value, sub, icon: Icon, color, bg, to }) => (
              <div key={label}
                onClick={to ? () => navigate({ path: to } as Parameters<typeof navigate>[0]) : undefined}
                className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 transition-all ${to ? "cursor-pointer hover:shadow-md hover:border-teal-200" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{label}</span>
                  <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
                <div>
                  <span className="text-3xl font-bold text-gray-900">{value}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 4. Doctor Status Table (last, always today) */}
      {show("opd") && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <UserCog className="w-4 h-4 text-teal-500" />
              Doctor Status &mdash; Today
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {myDoctors.length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-6 text-center">No doctors added yet.</p>
            ) : (
              myDoctors.map((doc) => {
                const docBookings = todayBookings.filter((b) => b.doctorId === doc.id);
                const completed = docBookings.filter((b) => normalizeBookingStatus(b.status) === "completed").length;
                const confirmed = docBookings.filter((b) => isLiveBookingStatus(b.status)).length;
                return (
                  <div key={doc.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                      <p className="text-xs text-gray-400">{doc.specialty}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-600 font-medium">{completed} done</span>
                      <span className="text-blue-500">{confirmed} waiting</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${doc.isAvailable ? "bg-teal-50 text-teal-600" : "bg-gray-100 text-gray-400"}`}>
                        {doc.isAvailable ? "Available" : "Unavailable"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
