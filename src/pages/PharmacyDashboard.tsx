import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../context/StoreContext";
import { getToken } from "@/api";
import { printInvoice, showInvoicePopup } from "@/lib/printInvoice";
import { detectFormFromText } from "@/lib/medicineTypes";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useExtraNav, ExtraPanel } from "@/components/StaffExtras";
import useModules from "@/hooks/useModules";
import GstInvoice from "./hospital-admin/GstInvoice";
import { PharmRevenue, PharmInventory, PharmPatients, PharmSold, PharmStockUpdate, usePharmacySocket } from "./hospital-admin/PharmacyModule";
import {
  Pill, LogOut, RefreshCw, HandMetal, Search, Inbox, ArrowUpDown, Clock, CheckCircle2, Package, BarChart3, ShoppingCart, Users, FileText,
} from "lucide-react";

// pharmacy-layout-v3
const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type PrescStatus = "pending" | "packed" | "ready" | "handed_over";

interface RxItem { name: string; dosage: string; duration: string; instructions: string; form?: string; quantity?: number; quantityUnit?: string }
interface Prescription {
  id: string; patient_name: string; doctor_name: string; items: RxItem[];
  notes: string; status: PrescStatus; created_at: string; dispensed_items?: string | null; patient_type?: "IP" | "OP"; inward_id?: string | null;
}
interface StockItem { id: string; name: string; unit: string; quantity: number; pack_size: number; selling_price?: number | null; med_category?: string | null; pack_unit?: string | null }
interface Plan { itemId: string; qty: string; reason: string; price?: string }

// IP = inpatient (admitted when the prescription was written), OP = outpatient
function TypeBadge({ type }: { type?: string }) {
  const ip = type === "IP";
  return <span className={"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold border mr-1 " + (ip ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50 text-gray-600 border-gray-200")}>{ip ? "IP" : "OP"}</span>;
}

const LIQUID_RE = /bottle|vial|syrup|tonic|suspension|elixir|drops|liquid|ointment|cream|lotion/i;
const isBottle = (item?: RxItem, st?: StockItem): boolean => {
  if (st && st.med_category) return st.med_category !== 'Tablet' && st.med_category !== 'Capsule';
  if (st) return LIQUID_RE.test([st.unit, st.name].filter(Boolean).join(" "));
  const u = (item?.quantityUnit || "").trim();
  if (/bottle|vial|tube|sachet/i.test(u)) return true;
  if (/^(ml|milli|tablet|capsule|strip|pack)/i.test(u)) return false;
  return LIQUID_RE.test([item?.name, item?.form].filter(Boolean).join(" "));
};
const packOf = (st?: StockItem) => Number(st?.pack_size) || 1;
const PACK_BY_CAT: Record<string, string> = { 'Ointment/Cream': 'tube', 'Injection': 'vial', 'Powder': 'sachet', 'Others': 'pack' };
const packName = (st?: StockItem): string => st?.pack_unit || (st?.med_category ? PACK_BY_CAT[st.med_category] : '') || 'bottle';
// For a dispensed line saved in ml: is it a whole number of bottles?
const lineBottles = (d: any, stock: StockItem[]): { pack: number; st: StockItem } | null => {
  const st = stock.find(s => s.id === d?.inventoryItemId) || stock.find(s => s.name === d?.inventoryName);
  const pack = packOf(st);
  const n = Number(d?.tablets) || 0;
  return st && isBottle(undefined, st) && pack > 1 && n >= pack && n % pack === 0 ? { pack, st } : null;
};
const fmtQty = (d: any, stock: StockItem[]) => {
  const b = lineBottles(d, stock);
  return b ? `${Math.round((Number(d.tablets) / b.pack) * 100) / 100} ${packName(b.st)}(s)` : String(d.tablets);
};
const toLineUnits = (d: any, stock: StockItem[], v: string) => {
  const b = lineBottles(d, stock);
  return b && v !== "" ? String(Math.round(Number(v) * b.pack)) : v;
};
const fromLineUnits = (d: any, stock: StockItem[], v: string) => {
  const b = lineBottles(d, stock);
  return b && v !== "" ? String(Math.round((Number(v) / b.pack) * 100) / 100) : v;
};

// Anything that is not a tablet is dispensed as 1 pack (bottle / vial / tube / inhaler), never multiplied by dose x days.
const isPackaged = (item: RxItem): boolean => {
  const f = (item.form || "").toLowerCase();
  if (f) return f !== "tablet" && f !== "other";
  const d = detectFormFromText(item.name);
  if (d) return d !== "tablet";
  return /\d\s*mls?\b/i.test(item.dosage || "") && !/tablet|capsule/i.test(item.dosage || "");
};

// tablets = tablets per dose x doses per day x days
function calcTablets(item: RxItem): number {
  if (Number(item.quantity) > 0) return Math.round(Number(item.quantity)); if (isBottle(item) || isPackaged(item)) return 1; // doctor's quantity wins
  const dm = /([\d.]+)\s*(tablet|capsule)/i.exec(item.dosage || "");
  const perDose = dm ? parseFloat(dm[1]) : 1;
  const times = ["Morning", "Afternoon", "Evening", "Night"].filter(t => (item.instructions || "").includes(t)).length || 1;
  const du = /([\d.]+)\s*(day|week)/i.exec(item.duration || "");
  const days = du ? Math.ceil(parseFloat(du[1]) * (du[2].toLowerCase() === "week" ? 7 : 1)) : 1;
  return Math.max(1, Math.ceil(perDose * times * days));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
function matchStock(name: string, stock: StockItem[]): StockItem | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return stock.find(s => norm(s.name) === n)
    || stock.find(s => norm(s.name).includes(n) || n.includes(norm(s.name)));
}
const tabletsAvailable = (s: StockItem) => Math.round(s.quantity * (s.pack_size || 1));

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const agoLabel = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });
const exactLabel = (iso: string) => {
  const d = new Date(iso);
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return isToday(iso) ? t : `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${t}`;
};
const splitList = (s: string) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
const TIMES = ["morning", "afternoon", "evening", "night"];
const isTime = (t: string) => TIMES.includes(t.toLowerCase());

const PATIENT_TONES = [
  { bar: "bg-sky-400", head: "bg-sky-50", avatar: "bg-sky-500" },
  { bar: "bg-violet-400", head: "bg-violet-50", avatar: "bg-violet-500" },
  { bar: "bg-rose-400", head: "bg-rose-50", avatar: "bg-rose-500" },
  { bar: "bg-amber-400", head: "bg-amber-50", avatar: "bg-amber-500" },
  { bar: "bg-emerald-400", head: "bg-emerald-50", avatar: "bg-emerald-500" },
  { bar: "bg-indigo-400", head: "bg-indigo-50", avatar: "bg-indigo-500" },
  { bar: "bg-fuchsia-400", head: "bg-fuchsia-50", avatar: "bg-fuchsia-500" },
  { bar: "bg-orange-400", head: "bg-orange-50", avatar: "bg-orange-500" },
];
const patientTone = (name: string) => {
  void name;
  return { bar: "bg-teal-500", head: "bg-teal-50", avatar: "bg-teal-600" };
};

function Pillbox({ text, tone }: { text: string; tone: "time" | "food" }) {
  const cls = tone === "time"
    ? "bg-teal-50 text-teal-700 border-teal-100"
    : "bg-amber-50 text-amber-700 border-amber-100";
  return <span className={`text-[11px] border rounded-md px-1.5 py-0.5 ${cls}`}>{text}</span>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2">
      <p className={`text-xl font-bold leading-tight ${tone}`}>{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

export default function PharmacyDashboard() {
  const { user, logout } = useStore();
  const hospitalId = (user as any)?.hospitalId ?? "";
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [plans, setPlans] = useState<Record<string, Record<number, Plan>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [handover, setHandover] = useState<Record<string, Record<number, { qty: string; reason: string }>>>({});
  const [payModes, setPayModes] = useState<Record<string, string>>({});
  const [chargeIp, setChargeIp] = useState<Record<string, boolean>>({});
  const [taxes, setTaxes] = useState<Record<string, { cgst: string; sgst: string; disc: string }>>({});
  const [filter, setFilter] = useState<"received" | "given">("received");
  const [manualDeduct, setManualDeduct] = useState<Record<string, boolean>>({});
  const [manualLines, setManualLines] = useState<Record<string, Record<number, { qty: string; price: string }>>>({});
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(false); // oldest first: patients are served in order
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [openRx, setOpenRx] = useState<Record<string, boolean>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("rx");
  const { nav: extraNav } = useExtraNav(["pharmacy", "inventory"]);
  const { has } = useModules();
  usePharmacySocket(hospitalId);
  const headers = { Authorization: `Bearer ${getToken()}` };

  const fetchPrescriptions = useCallback(async (silent = false) => {
    try {
      const url = `${BASE}/pharmacy/prescriptions?hospitalId=${hospitalId}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (Array.isArray(data)) setPrescriptions(data);
      else if (!silent) setPrescriptions([]);
    } catch { if (!silent) toast.error("Failed to load prescriptions"); }
    finally { setLoading(false); }
  }, [hospitalId]);

  const fetchStock = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/pharmacy/stock?hospitalId=${hospitalId}`, { headers });
      const data = await res.json();
      setStock(Array.isArray(data) ? data : []);
    } catch { /* stock is optional */ }
  }, [hospitalId]);

  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);
  useEffect(() => { fetchStock(); }, [fetchStock]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [pStats, setPStats] = useState<{ patientsServed: number; tabletsSold: number; revenue: number } | null>(null);
  const [soldSplit, setSoldSplit] = useState<{ tablets: number; bottles: number } | null>(null);
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/pharmacy-stats`, { headers });
      if (res.ok) setPStats(await res.json());
      try {
        const sr = await fetch(`${BASE}/pharmacy-module/medicines-sold`, { headers });
        if (sr.ok) {
          const rows = await sr.json();
          if (Array.isArray(rows)) {
            let tablets = 0, bottles = 0;
            for (const r of rows) {
              const units = Number(r.unitsToday) || 0;
              const nm = String(r.name || "");
              const ml = /(\d+(?:\.\d+)?)\s*ml\b/i.exec(nm);
              const liquid = /bottle|vial|syrup|tonic|suspension|elixir|drops|liquid/i.test(nm) && ml && Number(ml[1]) > 1;
              if (liquid) bottles += units / Number(ml![1]); else tablets += units;
            }
            setSoldSplit({ tablets: Math.round(tablets), bottles: Math.round(bottles * 100) / 100 });
          }
        }
      } catch { /* split is optional */ }
    } catch { /* stats are optional */ }
  }, [hospitalId]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh every 3s so new prescriptions appear without a manual refresh
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      fetchPrescriptions(true);
      fetchStats();
    };
    const t = setInterval(tick, 3000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetchPrescriptions, fetchStats]);

  function getPlan(p: Prescription, idx: number): Plan {
    return plans[p.id]?.[idx] ?? {
      itemId: matchStock(p.items[idx].name, stock)?.id ?? "",
      qty: String(calcTablets(p.items[idx])),
      reason: "",
    };
  }
  function setPlan(p: Prescription, idx: number, patch: Partial<Plan>) {
    const base = getPlan(p, idx);
    setPlans(prev => ({ ...prev, [p.id]: { ...(prev[p.id] ?? {}), [idx]: { ...base, ...patch } } }));
  }

  const round2 = (n: number) => Math.round((n || 0) * 100) / 100;
  const round4 = (n: number) => Math.round((n || 0) * 10000) / 10000;
  const defaultUnitPrice = (st?: StockItem, bottle = false) =>
    st && Number(st.selling_price) > 0 ? (bottle ? round2(Number(st.selling_price)) : round4(Number(st.selling_price) / (Number(st.pack_size) || 1))) : 0;
  function unitPriceFor(p: Prescription, i: number): number {
    const pl = getPlan(p, i);
    const st = stock.find(s => s.id === pl.itemId);
    return pl.price === undefined ? defaultUnitPrice(st, isBottle(p.items[i], st)) : round4(Number(pl.price) || 0);
  }
  function lineTotal(p: Prescription, i: number): number {
    const pl = getPlan(p, i);
    if (!pl.itemId) return 0;
    return round2((Number(pl.qty) || 0) * unitPriceFor(p, i));
  }
  function manualLine(p: Prescription, i: number) {
    return manualLines[p.id]?.[i] ?? { qty: "", price: "" };
  }
  function setManualLine(p: Prescription, i: number, patch: Partial<{ qty: string; price: string }>) {
    const base = manualLine(p, i);
    setManualLines(prev => ({ ...prev, [p.id]: { ...(prev[p.id] ?? {}), [i]: { ...base, ...patch } } }));
  }
  function manualTotal(p: Prescription, i: number): number {
    if (getPlan(p, i).itemId) return 0;
    const m = manualLine(p, i);
    return round2((Number(m.qty) || 0) * (Number(m.price) || 0));
  }
  function grandTotal(p: Prescription): number {
    return round2(p.items.reduce((s, _it, i) => s + lineTotal(p, i) + manualTotal(p, i), 0));
  }
  async function printInvoiceFor(id: string, preview = false) {
    try {
      const res = await fetch(`${BASE}/pharmacy-module/invoice/${encodeURIComponent(id)}`, { headers });
      const inv = await res.json();
      if (!res.ok) return toast.error(inv.error || "Could not load invoice");
      try {
        const rx = prescriptions.find(x => String(x.id) === String(id));
        if (rx && Array.isArray(inv.lines)) {
          const noteOf = (it: RxItem) => [it.dosage, (it.instructions || "").trim(), it.duration].filter(Boolean).join(" \u00b7 ");
          const sameLen = inv.lines.length === rx.items.length && !inv.lines.some((l: any) => l.manual);
          inv.lines = inv.lines.map((l: any, i: number) => {
            if (l.note) return l;
            let it: RxItem | undefined = sameLen ? rx.items[i] : undefined;
            if (!it) {
              const ln = String(l.name || "").toLowerCase();
              it = rx.items.find(x => { const b = String(x.name || "").toLowerCase().replace(/\s*\(.*$/, "").trim(); return b.length > 2 && ln.includes(b); });
            }
            return it ? { ...l, note: noteOf(it) } : l;
          });
        }
      } catch {}
      if (preview) showInvoicePopup(inv); else if (!printInvoice(inv)) toast.error("Allow pop-ups to print the invoice");
    } catch { toast.error("Could not load invoice"); }
  }

  function getHo(pid: string, i: number, max: number) {
    return handover[pid]?.[i] ?? { qty: String(max), reason: "" };
  }
  function setHo(pid: string, i: number, max: number, patch: Partial<{ qty: string; reason: string }>) {
    const base = getHo(pid, i, max);
    setHandover(prev => ({ ...prev, [pid]: { ...(prev[pid] ?? {}), [i]: { ...base, ...patch } } }));
  }

  // One tap: runs packed -> ready -> handed_over in order, skipping steps already done.
  async function markGiven(p: Prescription) { if (p.inward_id && p.patient_type === "IP" && chargeIp[p.id] === undefined) { toast.error("Choose: Paid at Pharmacy Counter or Charge to IP Main Bill"); return; }
    if (busy) return;
    const rxLines: any[] = (() => { try { return p.dispensed_items ? JSON.parse(p.dispensed_items) : []; } catch { return []; } })();
    const legacyManual = p.status !== "pending" && rxLines.some(l => l.unitPrice == null);
    const billTotal = p.status === "pending"
      ? grandTotal(p)
      : legacyManual
        ? Number(amounts[p.id])
        : round2(rxLines.reduce((s, l, idx) => s + round2((Number(getHo(p.id, idx, l.tablets).qty) || 0) * Number(l.unitPrice)), 0));
    const amt = String(billTotal);
    for (const v of [taxes[p.id]?.disc, taxes[p.id]?.cgst, taxes[p.id]?.sgst]) { const n = Number(v || 0); if (!(n >= 0 && n <= 100)) return toast.error("Discount and GST must be between 0 and 100"); }
    if (amt === undefined || String(amt).trim() === "" || !(Number(amt) >= 0))
      return toast.error("Enter the bill amount first (enter 0 if free)");
    const dispense: any[] = [];
    let handoverPayload: any[] = [];
    const manualItems: any[] = [];
    if (p.status === "pending") {
      for (let i = 0; i < p.items.length; i++) {
        if (getPlan(p, i).itemId) continue;
        const m = manualLine(p, i);
        if (!(Number(m.qty) > 0)) continue;
        if (String(m.price).trim() === "" || !(Number(m.price) >= 0)) return toast.error(`Enter the rate for ${p.items[i].name}`);
        manualItems.push({ name: p.items[i].name, quantity: Number(m.qty), unitPrice: Number(m.price) });
      }
    }
    if (p.status === "pending") {
      for (let i = 0; i < p.items.length; i++) {
        const pl = getPlan(p, i);
        if (!pl.itemId) continue;
        const st = stock.find(s => s.id === pl.itemId);
        const qty = Number(pl.qty);
        if (!(qty > 0)) return toast.error(`Enter a quantity for ${p.items[i].name}`);
        if (!Number.isInteger(qty)) return toast.error(isBottle(p.items[i], st) ? `${p.items[i].name} is dispensed in whole ${packName(st)}s only` : `Enter a whole number for ${p.items[i].name}`);
        if (st && qty * (isBottle(p.items[i], st) ? packOf(st) : 1) > tabletsAvailable(st)) return toast.error(`Only ${isBottle(p.items[i], st) ? Math.floor(tabletsAvailable(st) / packOf(st)) + " " + packName(st) + "(s)" : tabletsAvailable(st)} available for ${st.name}`);
        const pk = isBottle(p.items[i], st) ? packOf(st) : 1; dispense.push({ index: i, inventoryItemId: pl.itemId, quantity: pk === 1 ? qty : Math.round(qty * pk), reason: pl.reason, unitPrice: pk === 1 ? unitPriceFor(p, i) : Math.round(unitPriceFor(p, i) / pk * 1e6) / 1e6 });
      }
      handoverPayload = dispense.map((d, line) => ({ line, quantity: d.quantity, reason: "" }));
    } else {
      let lines: any[] = [];
      try { lines = p.dispensed_items ? JSON.parse(p.dispensed_items) : []; } catch {}
      for (let i = 0; i < lines.length; i++) {
        const h = getHo(p.id, i, lines[i].tablets);
        const q = Number(h.qty);
        if (!(q >= 0) || q > lines[i].tablets) return toast.error(`Enter 0 to ${lines[i].tablets} for ${lines[i].inventoryName}`);
        handoverPayload.push({ line: i, quantity: q, reason: h.reason });
      }
    }
    const send = async (status: PrescStatus, extra: Record<string, any>) => {
      const res = await fetch(`${BASE}/pharmacy/prescriptions/${p.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        let e: any = {};
        try { e = await res.json(); } catch {}
        throw new Error(e.error ?? "Failed");
      }
    };
    setBusy(p.id);
    try {
      if (p.status === "pending") await send("packed", { dispense });
      if (p.status === "pending" || p.status === "packed") await send("ready", {});
      await send("handed_over", { handover: handoverPayload, billAmount: billTotal, paymentMode: payModes[p.id] || "cash", chargeToIpBill: !!(p.inward_id && p.patient_type === "IP" && chargeIp[p.id]), billingMode: (p.inward_id && p.patient_type === "IP" && chargeIp[p.id] === true) ? "IP_BILL" : "COUNTER", discountPct: Number(taxes[p.id]?.disc) || 0, cgstPct: Number(taxes[p.id]?.cgst) || 0, sgstPct: Number(taxes[p.id]?.sgst) || 0, manualItems });
      toast.success("Marked as given. Patient notified");
      await printInvoiceFor(p.id, true);
    } catch (err: any) {
      toast.error(err?.message || "Network error");
    } finally {
      setBusy(null);
      fetchPrescriptions();
      fetchStats();
      fetchStock();
    }
  }

  const seenRx = useRef<Set<string> | null>(null);
  useEffect(() => {
    const pending = prescriptions.filter(p => p.status === "pending").map(p => p.id);
    if (seenRx.current === null) { if (!loading) seenRx.current = new Set(pending); return; }
    const fresh = pending.filter(id => !seenRx.current!.has(id));
    fresh.forEach(id => seenRx.current!.add(id));
    if (fresh.length > 0) {
      toast.success(fresh.length === 1 ? "New prescription received" : fresh.length + " new prescriptions received");
      try {
        const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        o.connect(ctx.destination); o.frequency.value = 880; o.start();
        setTimeout(() => { o.stop(); ctx.close(); }, 300);
      } catch { /* sound is optional */ }
    }
  }, [prescriptions, loading]);
  const receivedList = prescriptions.filter(p => p.status !== "handed_over");
  const givenList = prescriptions.filter(p => p.status === "handed_over");
  const givenToday = givenList.filter(p => isToday(p.created_at)).length;
  const q = query.trim().toLowerCase();
  const dir = newestFirst ? -1 : 1;
  const shown = (filter === "given" ? givenList : receivedList)
    .filter(p => !q || (p.patient_name || "").toLowerCase().includes(q))
    .sort((a, b) => dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (isToday(iso)) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  };
  const dayGroups = (list: Prescription[]) => {
    const map = new Map<string, Prescription[]>();
    for (const p of list) {
      const k = new Date(p.created_at).toDateString();
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return Array.from(map.values()).map(items => ({ label: dayLabel(items[0].created_at) + " (" + items.length + ")", items }));
  };
  const sections: { label: string; items: Prescription[] }[] = filter === "given"
    ? [
        ...dayGroups(shown),
        
      ].filter(g => g.items.length > 0)
    : [{ label: "", items: shown }];

  // group prescriptions of the same patient together (keeps sorted order of first appearance)
  function byPatient(list: Prescription[]) {
    if (filter === "given") return list.map(p => [p]);
    const map = new Map<string, Prescription[]>();
    for (const p of list) {
      const k = (p.patient_name || "").trim().toLowerCase();
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return Array.from(map.values());
  }

  function renderMedicine(p: Prescription, item: RxItem, i: number) {
    const editable = p.status === "pending";
    const isGiven = p.status === "handed_over";
    const suggested = calcTablets(item);
    const pl = getPlan(p, i);
    const st = stock.find(s => s.id === pl.itemId);
    const qty = Number(pl.qty);
    const bottle = isBottle(item, st); const short = st && qty * (bottle ? packOf(st) : 1) > tabletsAvailable(st);
    const reduced = qty > 0 && qty < suggested;
    const key = `${p.id}-${i}`;
    const deduct = !!pl.itemId || !!manualDeduct[key];
    const parts = splitList(item.instructions);
    const times = parts.filter(isTime);
    const food = parts.filter(t => !isTime(t));
    return (
      <div key={i} className="px-3 py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">{item.name}</p>
          {!isGiven && (
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 rounded-md px-2 py-0.5 whitespace-nowrap">
              Prescribed: {suggested} {bottle ? packName(st) + "(s)" : (item.quantityUnit || "tablets")}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div><span className="text-gray-400">Dosage </span><span className="text-gray-700">{item.dosage || "-"}</span></div>
          <div><span className="text-gray-400">Duration </span><span className="text-gray-700">{item.duration || "-"}</span></div>
        </div>
        {(times.length > 0 || food.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {times.map((t, n) => <Pillbox key={`t${n}`} text={t} tone="time" />)}
            {food.map((t, n) => <Pillbox key={`f${n}`} text={t} tone="food" />)}
          </div>
        )}

        {editable && (
          <div className="pt-1 space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={deduct} className="w-4 h-4 accent-teal-600"
                onChange={e => {
                  if (e.target.checked) {
                    setManualDeduct(prev => ({ ...prev, [key]: true }));
                    if (!pl.itemId) setPlan(p, i, { itemId: matchStock(item.name, stock)?.id ?? "" });
                  } else {
                    setManualDeduct(prev => ({ ...prev, [key]: false }));
                    setPlan(p, i, { itemId: "" });
                  }
                }} />
              Deduct from stock
              {st && qty > 0 && <span className="text-gray-400">({qty} from {st.name})</span>}
            </label>
            {deduct && (
              <div className="space-y-2 pl-6">
                <select value={pl.itemId} onChange={e => setPlan(p, i, { itemId: e.target.value })}
                  className="w-full border border-gray-200 rounded-md text-xs px-2 py-1.5 bg-white">
                  <option value="">Select stock item...</option>
                  {stock.map(s => <option key={s.id} value={s.id}>{s.name} ({isBottle(undefined, s) ? (Math.round(tabletsAvailable(s) / packOf(s) * 10) / 10) + " " + packName(s) + "s" : tabletsAvailable(s)} in stock)</option>)}
                </select>
                {pl.itemId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Dispensed</span>
                    <input type="number" min={1} step={1} value={pl.qty}
                      onChange={e => setPlan(p, i, { qty: e.target.value })}
                      className="w-20 border border-gray-200 rounded-md text-sm px-2 py-1 bg-white" />
                    <span className="text-xs text-gray-500">{bottle ? packName(st) + "(s)" : (item.quantityUnit || "tablets")}</span>
                  </div>
                )}
                {pl.itemId && st && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-gray-500">Price per {bottle ? packName(st) : (item.quantityUnit || "tablets").replace(/\(s\)$|s$/, "")} {"\u20b9"}</span>
                    <input type="number" min={0} step="any" value={pl.price ?? String(defaultUnitPrice(st, bottle))}
                      onChange={e => setPlan(p, i, { price: e.target.value })}
                      className="w-24 border border-gray-200 rounded-md text-sm px-2 py-1 bg-white" />
                    <span className="text-gray-500">{"\u00d7"} {qty > 0 ? qty : 0} =</span>
                    <b className="text-gray-900">{"\u20b9"}{lineTotal(p, i).toFixed(2)}</b>
                  </div>
                )}
                {reduced && pl.itemId && (
                  <input placeholder="Reason for reducing (e.g. patient can't afford)" value={pl.reason}
                    onChange={e => setPlan(p, i, { reason: e.target.value })}
                    className="w-full border border-gray-200 rounded-md text-xs px-2 py-1.5 bg-white" />
                )}
                {short && <p className="text-xs text-red-600">Not enough stock: only {bottle ? Math.floor(tabletsAvailable(st!) / packOf(st)) + " bottle(s)" : tabletsAvailable(st!)} available.</p>}
              </div>
            )}
            {!deduct && (
              <div className="flex flex-wrap items-center gap-2 pl-6 text-xs">
                <span className="text-gray-500">Not from stock. Qty</span>
                <input type="number" min={0} step={1} placeholder="0" value={manualLine(p, i).qty}
                  onChange={e => setManualLine(p, i, { qty: e.target.value })}
                  className="w-16 border border-gray-200 rounded-md text-sm px-2 py-1 bg-white" />
                <span className="text-gray-500">Rate {"\u20b9"}</span>
                <input type="number" min={0} step="any" placeholder="0" value={manualLine(p, i).price}
                  onChange={e => setManualLine(p, i, { price: e.target.value })}
                  className="w-24 border border-gray-200 rounded-md text-sm px-2 py-1 bg-white" />
                <span className="text-gray-500">=</span>
                <b className="text-gray-900">{"\u20b9"}{manualTotal(p, i).toFixed(2)}</b>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderRx(p: Prescription, multi: boolean) {
    const editable = p.status === "pending";
    const isGiven = p.status === "handed_over";
    let dispensed: any[] = [];
    try { dispensed = p.dispensed_items ? JSON.parse(p.dispensed_items) : []; } catch {}
    const confirming = confirmId === p.id;
    const showMeds = !isGiven || !!openRx[p.id];
    const legacyManual = !editable && dispensed.some((d: any) => d.unitPrice == null);
    const autoBill = editable ? true : !legacyManual;
    const billShown = editable
      ? grandTotal(p)
      : round2(dispensed.reduce((s: number, d: any, idx: number) => s + round2((Number(getHo(p.id, idx, d.tablets).qty) || 0) * Number(d.unitPrice)), 0));
    return (
      <div key={p.id} className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1 min-w-0 truncate">
            <Clock className="w-3 h-3 shrink-0" />
            <TypeBadge type={p.patient_type} />Dr. {p.doctor_name} {"\u00b7"} <span title={exactLabel(p.created_at)}>{agoLabel(p.created_at)}</span>
          </span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium border ${isGiven
            ? "bg-gray-100 text-gray-500 border-gray-200"
            : p.status === "ready"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-yellow-100 text-yellow-800 border-yellow-200"}`}>
            {isGiven ? "Given" : p.status === "ready" ? "Ready" : "Received"}
          </span>
        </div>

        {isGiven && (
          <button type="button"
            onClick={() => setOpenRx(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold px-3 py-2 transition-colors">
            <Package className="w-3.5 h-3.5" />
            {showMeds ? "Hide medicines" : "View medicines (" + p.items.length + ")"}
            <span aria-hidden="true">{showMeds ? "\u25b4" : "\u25be"}</span>
          </button>
        )}

        {showMeds && (
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 divide-y divide-gray-100">
            {p.items.map((item, i) => renderMedicine(p, item, i))}
          </div>
        )}

        {isGiven && (
          <Button variant="outline" className="w-full h-9 text-xs" onClick={() => printInvoiceFor(p.id)}>
            Print invoice
          </Button>
        )}

        {isGiven && showMeds && dispensed.length > 0 && (
          <p className="text-xs text-gray-500 flex items-start gap-1.5">
            <Package className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Handed over: {dispensed.map(d => `${d.inventoryName} \u00d7${fmtQty(d, stock)}`).join(", ")}
              {dispensed.some(d => d.returned) ? " (some returned to stock)" : ""}
            </span>
          </p>
        )}

        {!editable && !isGiven && dispensed.length > 0 && (
          <div className="text-xs text-gray-500 space-y-2">
            {dispensed.map((d, i) => (
              <div key={i} className="space-y-1">
                <p>Dispensed <b>{fmtQty(d, stock)}</b> {"\u00d7"} {d.inventoryName}{d.reduced ? ` (reduced from ${d.suggested})` : ""}</p>
                {p.status === "ready" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Patient takes</span>
                      <input type="number" min={0} max={fromLineUnits(d, stock, String(d.tablets))} value={fromLineUnits(d, stock, getHo(p.id, i, d.tablets).qty)}
                        onChange={e => setHo(p.id, i, d.tablets, { qty: toLineUnits(d, stock, e.target.value) })}
                        className="w-20 border border-gray-200 rounded-md text-sm px-2 py-1 bg-white" />
                      <span className="text-xs text-gray-600">of {fmtQty(d, stock)}{lineBottles(d, stock) ? "" : " tablets"}</span>
                    </div>
                    {Number(getHo(p.id, i, d.tablets).qty) < d.tablets && (
                      <>
                        <input placeholder="Reason (e.g. patient needs fewer)" value={getHo(p.id, i, d.tablets).reason}
                          onChange={e => setHo(p.id, i, d.tablets, { reason: e.target.value })}
                          className="w-full border border-gray-200 rounded-md text-xs px-2 py-1.5 bg-white" />
                        <p className="text-xs text-amber-700">{fromLineUnits(d, stock, String(d.tablets - Number(getHo(p.id, i, d.tablets).qty || 0)))} {lineBottles(d, stock) ? "bottle(s)" : "tablets"} will be returned to stock.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {p.notes && (
          <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 italic">
            Note: {p.notes}
          </p>
        )}

        {!isGiven && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 shrink-0">Grand Total ({"\u20b9"})</label>
            <input type="number" min={0} step="0.01" inputMode="decimal" placeholder="Auto total"
              value={autoBill ? billShown.toFixed(2) : (amounts[p.id] ?? "")}
              readOnly={autoBill}
              onChange={e => setAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
              className="flex-1 border border-gray-200 rounded-md text-sm px-2 py-1.5 bg-white" />
            <select hidden={!!(p.inward_id && p.patient_type === "IP" && chargeIp[p.id])} value={payModes[p.id] ?? "cash"} onChange={e => setPayModes(prev => ({ ...prev, [p.id]: e.target.value }))}
              className="border border-gray-200 rounded-md text-sm px-2 py-1.5 bg-white">
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="insurance">Insurance / TPA</option>
            </select>
          </div>
        )}
        {!isGiven && p.inward_id && p.patient_type === "IP" && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-2 space-y-1.5">
              <p className="text-xs font-semibold text-purple-800">Inpatient prescription: how is this paid?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setChargeIp(prev => ({ ...prev, [p.id]: false }))}
                  className={"flex-1 rounded-md border px-2 py-1.5 text-xs font-medium " + (chargeIp[p.id] === false ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 border-gray-200")}>
                  Paid at Pharmacy Counter
                </button>
                <button type="button" onClick={() => setChargeIp(prev => ({ ...prev, [p.id]: true }))}
                  className={"flex-1 rounded-md border px-2 py-1.5 text-xs font-medium " + (chargeIp[p.id] ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-700 border-gray-200")}>
                  Charge to IP Main Bill
                </button>
              </div>
              {chargeIp[p.id] && <p className="text-[11px] text-purple-700">No cash is collected here. This amount is added to the patient's IP bill.</p>}
            </div>
          )}
          {!isGiven && (() => {
          const t = taxes[p.id] ?? { cgst: "", sgst: "", disc: "" };
          const setT = (patch: Partial<{ cgst: string; sgst: string; disc: string }>) => setTaxes(prev => ({ ...prev, [p.id]: { ...t, ...patch } }));
          const sub = autoBill ? billShown : Number(amounts[p.id]);
          const d = Number(t.disc) || 0, c = Number(t.cgst) || 0, sg = Number(t.sgst) || 0;
          const show = Number.isFinite(sub) && (d > 0 || c > 0 || sg > 0);
          const discAmt = round2(sub * d / 100), taxable = round2(sub - discAmt);
          const cgAmt = round2(taxable * c / 100), sgAmt = round2(taxable * sg / 100);
          const field = (label: string, key: "disc" | "cgst" | "sgst") => (
            <label className="flex-1 text-xs text-gray-600">{label}
              <input type="number" min={0} max={100} step="0.01" inputMode="decimal" placeholder="0" value={t[key]}
                onChange={e => setT({ [key]: e.target.value })}
                className="mt-0.5 w-full border border-gray-200 rounded-md text-sm px-2 py-1.5 bg-white" />
            </label>
          );
          return (
            <div className="space-y-1">
              <div className="flex gap-2">{field("Discount %", "disc")}{field("CGST %", "cgst")}{field("SGST %", "sgst")}</div>
              {show && <p className="text-xs text-gray-700 text-right">Amount payable: <b>{"\u20b9"}{round2(taxable + cgAmt + sgAmt).toFixed(2)}</b></p>}
            </div>
          );
        })()}
        {!isGiven && (
          confirming ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-10 text-sm" disabled={busy === p.id}
                onClick={() => setConfirmId(null)}>
                Cancel
              </Button>
              <Button className="flex-[2] h-10 text-sm bg-teal-600 hover:bg-teal-700" disabled={busy === p.id}
                onClick={async () => { await markGiven(p); setConfirmId(null); }}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {busy === p.id ? "Please wait..." : "Yes, mark as given"}
              </Button>
            </div>
          ) : (
            <Button className="w-full h-10 text-sm bg-teal-600 hover:bg-teal-700" disabled={busy === p.id}
              onClick={() => setConfirmId(p.id)}>
              <HandMetal className="w-4 h-4 mr-2" />
              Mark as Given
            </Button>
          )
        )}
      </div>
    );
  }

  function renderGivenCard(p: Prescription) {
    let dispensed: any[] = [];
    try { dispensed = p.dispensed_items ? JSON.parse(p.dispensed_items) : []; } catch {}
    const open = detailId === p.id;
    const tone = patientTone(p.patient_name);
    const billAmt: number | null = (() => {
      if (!dispensed.length || dispensed.some((d: any) => d.unitPrice == null)) return null;
      return round2(dispensed.reduce((s: number, d: any) => {
        const kept = Math.max(0, (Number(d.tablets) || 0) - (typeof d.returned === "number" ? d.returned : 0));
        return s + round2(kept * Number(d.unitPrice));
      }, 0));
    })();
    return (
      <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className={"h-1 " + tone.bar} />
        <div role="button" tabIndex={0} onClick={() => setDetailId(p.id)}
          className="flex items-center gap-3 px-3 py-3 cursor-pointer active:bg-gray-50">
          <div className={"w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold text-sm shrink-0 " + tone.avatar}>
            {(p.patient_name || "?").trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{p.patient_name}</p>
            <p className="text-xs text-gray-500 truncate">
              <TypeBadge type={p.patient_type} />{exactLabel(p.created_at)} {"\u00b7"} {p.items.length} medicine{p.items.length === 1 ? "" : "s"}{billAmt != null && <>{" "}{"\u00b7"}{" "}<b className="text-gray-800">{"\u20b9"}{billAmt.toFixed(2)}</b></>}
            </p>
          </div>
          <Button variant="outline" className="h-9 px-3 text-xs shrink-0"
            onClick={e => { e.stopPropagation(); printInvoiceFor(p.id); }}>
            Print invoice
          </Button>
        </div>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setDetailId(null)}>
            <div className="bg-white w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{p.patient_name}</p>
                  <p className="text-xs text-gray-500">
                    <TypeBadge type={p.patient_type} />Dr. {p.doctor_name} {"\u00b7"} {exactLabel(p.created_at)}
                  </p>
                </div>
                <button type="button" onClick={() => setDetailId(null)}
                  className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1">{"\u2715"}</button>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 divide-y divide-gray-100">
                  {p.items.map((item, i) => renderMedicine(p, item, i))}
                </div>
                {dispensed.length > 0 && (
                  <p className="text-xs text-gray-500 flex items-start gap-1.5">
                    <Package className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      Handed over: {dispensed.map(d => `${d.inventoryName} \u00d7${fmtQty(d, stock)}`).join(", ")}
                      {dispensed.some(d => d.returned) ? " (some returned to stock)" : ""}
                    </span>
                  </p>
                )}
                {p.notes && (
                  <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 italic">
                    Note: {p.notes}
                  </p>
                )}
                <Button variant="outline" className="w-full h-10 text-sm" onClick={() => printInvoiceFor(p.id)}>
                  Print invoice
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderPatient(list: Prescription[]) {
    if (list[0].status === "handed_over") return renderGivenCard(list[0]);
    const first = list[0];
    const tone = patientTone(first.patient_name);
    const multi = list.length > 1;
    return (
      <div key={first.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className={"h-1 " + tone.bar} />
        <div className={"flex items-center gap-3 px-4 py-3 border-b border-gray-100 " + tone.head}>
          <div className={"w-9 h-9 rounded-full text-white flex items-center justify-center font-semibold text-sm shrink-0 " + tone.avatar}>
            {(first.patient_name || "?").trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{first.patient_name}</p>
            <p className="text-xs text-gray-400">{multi ? `${list.length} prescriptions` : "1 prescription"}</p>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {list.map(p => renderRx(p, multi))}
        </div>
      </div>
    );
  }

  const NAV_ITEMS = [
    { key: "rx", label: "Prescriptions", icon: Pill },
    { key: "revenue", label: "Pharmacy Revenue", icon: BarChart3 },
    { key: "inventory", label: "Inventory Management", icon: Package },
    { key: "patients", label: "Patient Purchases", icon: Users },
    { key: "sold", label: "Sales History", icon: ShoppingCart },
    { key: "gst", label: "GST Invoice", icon: FileText },
    { key: "stock", label: "Stock Update", icon: RefreshCw },
  ] as const;
  const ALL_NAV: { key: string; label: string; icon: any }[] = [...NAV_ITEMS, ...extraNav];
  const sidebar = (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-admin-sidebar text-admin-sidebar-fg sticky top-0 h-screen">
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
          <Pill className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white text-sm truncate">{(user as any)?.hospitalName ?? "Pharmacy"}</p>
          <p className="text-[10px] text-white/50 uppercase tracking-wider">Pharmacy Console</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {ALL_NAV.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors " + (tab === key ? "bg-white/15 text-white border-l-2 border-teal-400" : "text-white/60 hover:bg-white/8 hover:text-white/90")}>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="text-left leading-tight">{label}</span>
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <button type="button" onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white transition-colors">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
  const mobileTabs = (
    <div className="md:hidden flex gap-2 overflow-x-auto bg-admin-sidebar px-3 py-2">
      {ALL_NAV.map(({ key, label }) => (
        <button key={key} type="button" onClick={() => setTab(key)}
          className={"whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium " + (tab === key ? "bg-white/20 text-white" : "text-white/60")}>
          {label}
        </button>
      ))}
    </div>
  );
  if (!has("pharmacy")) return (<div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 p-6 text-center"><p className="text-lg font-semibold text-gray-800">Pharmacy is not enabled for this hospital.</p><p className="text-sm text-gray-500">Ask your hospital admin to turn it on in Hospital Functioning.</p><button type="button" onClick={logout} className="px-4 py-2 rounded-lg bg-teal-500 text-white text-sm font-medium">Logout</button></div>);
  if (tab !== "rx") {
    return (
      <div className="flex min-h-screen bg-gray-50">
        {sidebar}
        <div className="flex-1 min-w-0">
          {mobileTabs}
          {tab.startsWith("x:") ? <ExtraPanel moduleKey={tab.slice(2)} /> : tab === "revenue" ? <PharmRevenue /> : tab === "inventory" ? <PharmInventory iconActions /> : tab === "patients" ? <PharmPatients /> : tab === "stock" ? <PharmStockUpdate /> : tab === "gst" ? <GstInvoice /> : <PharmSold />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {sidebar}
      <div className="flex-1 min-w-0">
      {mobileTabs}
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-teal-600" />
          <div>
            <p className="font-bold text-sm">Pharmacy Dashboard</p>
            <p className="text-xs text-gray-400">{(user as any)?.hospitalName ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { fetchPrescriptions(); fetchStock(); }} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={logout} className="text-gray-400 hover:text-red-500">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {pStats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2">
              <p className="text-xl font-bold leading-tight text-teal-700">{pStats.patientsServed}</p>
              <p className="text-[11px] text-gray-500">Patients served today</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2">
              <p className="text-xl font-bold leading-tight text-blue-700">{soldSplit ? soldSplit.tablets : pStats.tabletsSold}</p>
              <p className="text-[11px] text-gray-500">Tablets sold today{soldSplit && soldSplit.bottles > 0 ? " + " + soldSplit.bottles + " bottle(s)" : ""}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2">
              <p className="text-xl font-bold leading-tight text-emerald-700">{"\u20b9"}{Number(pStats.revenue).toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-gray-500">Revenue today</p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Stat label="Waiting" value={receivedList.length} tone="text-yellow-600" />
          <Stat label="Given today" value={givenToday} tone="text-teal-600" />
          <Stat label="Total given" value={givenList.length} tone="text-gray-700" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {(["received", "given"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
                  filter === f ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200"}`}>
                {f === "received" ? `Received (${receivedList.length})` : `Given (${givenList.length})`}
              </button>
            ))}
            <button type="button" onClick={() => setTab("stock")}
              className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors bg-white text-gray-600 border-gray-200">
              Stock Update
            </button>
          </div>
          <button onClick={() => setNewestFirst(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 bg-white rounded-full px-3 py-1.5">
            <ArrowUpDown className="w-3 h-3" />
            {newestFirst ? "Newest" : "Oldest"}
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search patient name"
            className="w-full border border-gray-200 rounded-full text-sm pl-9 pr-3 py-2 bg-white" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5 pb-28">
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : shown.length === 0 ? (
          <div className="text-center text-gray-400 py-12 space-y-2">
            <Inbox className="w-8 h-8 mx-auto" />
            <p className="text-sm">
              {q ? `No patients match "${query.trim()}".`
                : filter === "received" ? "Nothing waiting. New prescriptions from doctors will appear here."
                : "No prescriptions given yet."}
            </p>
          </div>
        ) : sections.map(g => (
          <div key={g.label || "all"} className="space-y-3">
            {g.label && <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{g.label}</p>}
            {byPatient(g.items).map(renderPatient)}
          </div>
        ))}
      </div>
    </div>
      </div>
    </div>
  );
}
