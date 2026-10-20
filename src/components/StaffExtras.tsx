import { useEffect, useState, type ReactNode } from "react";
import { BedDouble, ClipboardList, FlaskConical, IndianRupee, Loader2, Package, Stethoscope, type LucideIcon } from "lucide-react";
import usePermissions from "../hooks/usePermissions";
import { getToken } from "../api";
import { useStore } from "../context/StoreContext";
import ErrorBoundary from "./ErrorBoundary";
import { Users, Receipt, Fingerprint, Pill } from "lucide-react";
import HAAllPatients from "../pages/hospital-admin/HAAllPatients";
import HAPatients from "../pages/hospital-admin/HAPatients";
import HABilling from "../pages/hospital-admin/HABilling";
import HAAttendance from "../pages/hospital-admin/HAAttendance";
import { PharmRevenue, PharmInventory, PharmPatients, PharmSold, PharmStockUpdate } from "../pages/hospital-admin/PharmacyModule";
import HAInward from "../pages/hospital-admin/HAInward";
import HAInventory from "../pages/hospital-admin/HAInventory";
import HALab from "../pages/hospital-admin/HALab";
import HAHR from "../pages/hospital-admin/HAHR";
import HAWards from "../pages/hospital-admin/HAWards";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

function ymd(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
const inr = (n: number | null | undefined) =>
  n == null ? "\u2014" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const PERIODS = [["today", "Today"], ["week", "This week"], ["month", "This month"], ["year", "This year"]] as const;

function rangeFor(p: string) {
  const now = new Date(), today = ymd(now);
  if (p === "week") { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { from: ymd(d), to: today }; }
  if (p === "month") return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (p === "year") return { from: now.getFullYear() + "-01-01", to: today };
  return { from: today, to: today };
}

function RevenuePanel() {
  const { user } = useStore() as any;
  const [period, setPeriod] = useState("today");
  const [k, setK] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setErr("");
      try {
        const { from, to } = rangeFor(period);
        const qs = new URLSearchParams({ hospitalId: user?.hospitalId || "", from, to });
        const res = await fetch(BASE + "/dashboard/kpis?" + qs.toString(), { headers: { Authorization: "Bearer " + getToken() } });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Could not load revenue");
        if (live) setK(d);
      } catch (e: any) { if (live) setErr(e.message); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [period, user?.hospitalId]);

  const card = (label: string, value: string, sub?: string) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setPeriod(id)}
            className={"px-3 py-1.5 rounded-full text-xs font-medium " + (period === id ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600")}>{label}</button>
        ))}
      </div>
      {loading ? <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
        : err ? <p className="text-sm text-red-600">{err}</p>
        : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {card("Revenue", inr(k?.revenue), k?.revenuePrevious != null ? "Previous period " + inr(k.revenuePrevious) : undefined)}
            {card("Cash", inr(k?.paymentSplit?.cash))}
            {card("UPI", inr(k?.paymentSplit?.upi))}
            {card("TPA", inr(k?.paymentSplit?.tpa))}
            {card("Receivables", inr(k?.receivables))}
            {card("Bookings", k?.bookings ? String(k.bookings.total) : "\u2014", k?.bookings ? k.bookings.completed + " completed" : undefined)}
          </div>
        )}
    </div>
  );
}

function PharmacyPanel() {
  const [t, setT] = useState("revenue");
  const tabs: [string, string][] = [["revenue", "Revenue"], ["inventory", "Inventory"], ["patients", "Purchases"], ["sold", "Sales"], ["stock", "Stock Update"]];
  return (
    <div>
      <div className="flex flex-wrap gap-2 px-4 pt-4 md:px-6">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setT(k)}
            className={"px-3 py-1.5 rounded-full text-xs font-medium " + (t === k ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600")}>{l}</button>
        ))}
      </div>
      {t === "revenue" ? <PharmRevenue /> : t === "inventory" ? <PharmInventory /> : t === "patients" ? <PharmPatients /> : t === "sold" ? <PharmSold /> : <PharmStockUpdate />}
    </div>
  );
}

type Extra = { label: string; icon: LucideIcon; render: () => ReactNode };
const EXTRAS: Record<string, Extra> = {
  revenue: { label: "Revenue", icon: IndianRupee, render: () => <RevenuePanel /> },
  ipd: { label: "IPD / Inward", icon: BedDouble, render: () => <HAInward /> },
  inventory: { label: "Inventory", icon: Package, render: () => <HAInventory /> },
  lab: { label: "Laboratory", icon: FlaskConical, render: () => <HALab /> },
  hr: { label: "HR / Staff", icon: ClipboardList, render: () => <HAHR /> },
  beds_wards: { label: "Beds & Wards", icon: Stethoscope, render: () => <HAWards /> },
  all_patients: { label: "All Patients", icon: Users, render: () => <HAAllPatients /> },
  live_patients: { label: "Live Patients", icon: Users, render: () => <HAPatients /> },
  billing: { label: "Revenue", icon: Receipt, render: () => <HABilling /> },
  attendance: { label: "Attendance", icon: Fingerprint, render: () => <HAAttendance /> },
  pharmacy: { label: "Pharmacy", icon: Pill, render: () => <PharmacyPanel /> },
};
const EXTRA_KEYS = Object.keys(EXTRAS);

export function useExtraNav(native: string[]) {
  const { can, loading } = usePermissions();
  const nav = EXTRA_KEYS.filter(k => can(k) && !native.includes(k))
    .map(k => ({ key: "x:" + k, label: EXTRAS[k].label, icon: EXTRAS[k].icon }));
  return { nav, can, loading };
}

export function ExtraPanel({ moduleKey }: { moduleKey: string }) {
  const e = EXTRAS[moduleKey];
  if (!e) return null;
  return <ErrorBoundary fallbackLabel={e.label}>{e.render()}</ErrorBoundary>;
}
