import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getToken } from "@/api";
import { useStore } from "../../context/StoreContext";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
const inr = (n: number | null | undefined) =>
  n == null ? "-" : "\u20B9" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
};

async function pm<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + "/pharmacy-module" + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken(), ...(init?.headers || {}) },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

// Opens one WebSocket for the hospital and tells every pharmacy page to refresh.
export function usePharmacySocket(hospitalId: string) {
  useEffect(() => {
    if (!hospitalId) return;
    const wsBase = BASE.replace(/^http/, "ws").replace(/\/api\/?$/, "");
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dead = false;
    let backoff = 2000;
    const connect = () => {
      if (dead) return;
      try {
        ws = new WebSocket(wsBase + "/ws?session=" + encodeURIComponent("hospital_" + hospitalId));
        ws.onopen = () => { backoff = 2000; };
        ws.onmessage = (e) => {
          try { if (JSON.parse(e.data).type === "pharmacy_update") window.dispatchEvent(new CustomEvent("pharmacy-updated")); } catch {}
        };
        ws.onclose = () => { if (!dead) { timer = setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 30000); } };
        ws.onerror = () => ws?.close();
      } catch { if (!dead) timer = setTimeout(connect, backoff); }
    };
    connect();
    return () => { dead = true; if (timer) clearTimeout(timer); try { ws?.close(); } catch {} };
  }, [hospitalId]);
}

function useHid() {
  const { user } = useStore();
  return user?.role === "hospital_admin" || user?.role === "pharmacy" ? user.hospitalId : "";
}

// Loads now, every 10s, and whenever a pharmacy update arrives.
function useLive(load: () => void | Promise<void>, deps: unknown[]) {
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    const h = () => { load(); };
    window.addEventListener("pharmacy-updated", h);
    return () => { clearInterval(t); window.removeEventListener("pharmacy-updated", h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

type Preset = "today" | "7d" | "month" | "custom";
function useRange() {
  const [preset, setPreset] = useState<Preset>("today");
  const [cf, setCf] = useState(ymd(new Date()));
  const [ct, setCt] = useState(ymd(new Date()));
  const range = useMemo(() => {
    const now = new Date();
    if (preset === "today") return { from: ymd(now), to: ymd(now) };
    if (preset === "7d") { const s = new Date(now); s.setDate(s.getDate() - 6); return { from: ymd(s), to: ymd(now) }; }
    if (preset === "month") return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
    return cf <= ct ? { from: cf, to: ct } : { from: ct, to: cf };
  }, [preset, cf, ct]);
  const labels: [Preset, string][] = [["today", "Today"], ["7d", "Last 7 days"], ["month", "This month"], ["custom", "Custom"]];
  const ui = (
    <div className="flex flex-wrap items-center gap-2">
      {labels.map(([k, l]) => (
        <button key={k} type="button" onClick={() => setPreset(k)}
          className={"px-3 py-1.5 rounded-full text-sm border " + (preset === k ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")}>{l}</button>
      ))}
      {preset === "custom" && (
        <>
          <input type="date" value={cf} onChange={e => setCf(e.target.value)} className="border border-gray-200 rounded-md text-sm px-2 py-1.5 bg-white" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={ct} onChange={e => setCt(e.target.value)} className="border border-gray-200 rounded-md text-sm px-2 py-1.5 bg-white" />
        </>
      )}
    </div>
  );
  return { range, ui };
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="p-4 md:p-6 space-y-4 min-h-screen bg-gray-50">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={"text-2xl font-bold mt-1 " + (color || "text-gray-900")}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
const TH = "text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2.5 whitespace-nowrap";
const TD = "px-3 py-2.5 text-sm text-gray-800 align-top";

// ── 1. Revenue Pharmacy ──────────────────────────────────────────────────────
type Rev = {
  grossRevenue: number; costOfGoods: number; netMargin: number; netMarginPct: number; tabletsSold: number; prescriptions: number;
  byPayment: { cash: number; upi: number; insurance: number }; daily: { date: string; revenue: number }[];
};
export function PharmRevenue() {
  const hid = useHid();
  const { range, ui } = useRange();
  const [d, setD] = useState<Rev | null>(null);
  const [err, setErr] = useState("");
  useLive(async () => {
    try { setD(await pm<Rev>("/revenue?from=" + range.from + "&to=" + range.to)); setErr(""); }
    catch (e: any) { setErr(e.message); }
  }, [hid, range.from, range.to]);
  return (
    <Shell title="Pharmacy Revenue" subtitle="Earnings, margin and payment modes. Updates live when medicines are handed over.">
      {ui}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Gross revenue" value={inr(d.grossRevenue)} sub={d.prescriptions + " prescriptions"} color="text-teal-700" />
            <Stat label="Cost of goods" value={inr(d.costOfGoods)} sub={d.costOfGoods === 0 ? "Add purchase prices in Inventory" : undefined} />
            <Stat label="Net margin" value={inr(d.netMargin)} sub={Math.round(d.netMarginPct) + "% of gross"} color={d.netMargin < 0 ? "text-red-600" : "text-emerald-700"} />
            <Stat label="Tablets sold" value={String(d.tabletsSold)} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">Revenue per day</p>
              <p className="text-xs text-gray-500">{d.daily.length} day{d.daily.length === 1 ? "" : "s"}</p>
            </div>
            {d.daily.length > 1 ? (
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={d.daily.map(x => ({ date: x.date.slice(8) + "/" + x.date.slice(5, 7), revenue: x.revenue }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => "\u20b9" + (v >= 1000 ? Math.round(v / 100) / 10 + "k" : v)} />
                    <Tooltip formatter={(v: any) => inr(Number(v))} cursor={{ fill: "#f0fdfa" }} />
                    <Bar dataKey="revenue" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-8 text-center">The daily trend appears when the selected range covers more than one day. Pick a longer range above.</p>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

// ── 2. Inventory ─────────────────────────────────────────────────────────────
type InvStatus = "ok" | "low_stock" | "out_of_stock" | "expiring_soon" | "expired";
type Inv = {
  id: string; name: string; quantity: number; packSize: number; tabletsAvailable: number; reorderLevel: number;
  purchasePrice: number | null; sellingPrice: number | null; supplier: string | null; batchNo: string | null; medCategory: string | null;
  expiryDate: string | null; location: string | null; status: InvStatus;
  stripsPerBox?: number | null; tabletsPerBox?: number | null; schedule?: string; gstPercent?: number | null;
  breakdown?: { boxes: number; strips: number; tablets: number };
};
const MED_CATEGORIES = ["Tablet", "Capsule", "Syrup/Tonic", "Injection", "Oil", "Ointment/Cream", "Drops", "Powder", "Others"];
const ADD_CUSTOM = "__add_custom__";
function CategoryPicker({ value, onChange, options, allowBlank = false }: { value: string; onChange: (v: string) => void; options: string[]; allowBlank?: boolean }) {
  const [custom, setCustom] = useState(false);
  const opts = value && !custom && !options.includes(value) ? [...options, value] : options;
  return (
    <label className="block text-sm text-gray-600">Category
      <select value={custom ? ADD_CUSTOM : value}
        onChange={e => {
          if (e.target.value === ADD_CUSTOM) { setCustom(true); onChange(""); }
          else { setCustom(false); onChange(e.target.value); }
        }}
        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white">
        {allowBlank && <option value="">Select category</option>}
        {opts.map(c => <option key={c} value={c}>{c}</option>)}
        <option value={ADD_CUSTOM}>+ Add custom category...</option>
      </select>
      {custom && (
        <input value={value} onChange={e => onChange(e.target.value)} maxLength={40} placeholder="Type new category name"
          className="mt-2 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm" />
      )}
    </label>
  );
}
const STATUS_UI: Record<InvStatus, [string, string]> = {
  ok: ["In stock", "bg-emerald-50 text-emerald-700"],
  low_stock: ["Low stock", "bg-amber-50 text-amber-700"],
  out_of_stock: ["Out of stock", "bg-red-50 text-red-700"],
  expiring_soon: ["Expiring soon", "bg-orange-50 text-orange-700"],
  expired: ["Expired", "bg-red-100 text-red-800"],
};
const nOrNaN = (s: string) => (String(s ?? "").trim() === "" ? NaN : Number(s));
const rs = (n: number) => "\u20B9" + n.toFixed(2);
const SCHEDULE_OPTS: [string, string][] = [["none", "Normal (no schedule)"], ["H", "Schedule H"], ["H1", "Schedule H1"], ["X", "Schedule X"]];
function stockText(r: Inv): string {
  if (!r.stripsPerBox || !r.breakdown) return "packing not set";
  return r.breakdown.boxes + " box, " + r.breakdown.strips + " strip, " + r.breakdown.tablets + " tab";
}
function Fld({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block text-sm text-gray-600">{label}
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm" />
    </label>
  );
}
function ScheduleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm text-gray-600">Schedule
      <select value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white">
        {SCHEDULE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function PackPreview({ tps, spb, mrp, pbox, boxes = "", strips = "", tablets = "" }: { tps: string; spb: string; mrp: string; pbox: string; boxes?: string; strips?: string; tablets?: string }) {
  const t = nOrNaN(tps), s = nOrNaN(spb), m = nOrNaN(mrp), p = nOrNaN(pbox);
  if (!(t >= 1) || !(s >= 1)) return <p className="text-xs text-gray-400">Enter tablets per strip and strips per box to see the calculation.</p>;
  const perBox = t * s;
  const mrpTab = m >= 0 ? m / t : NaN;
  const costTab = p >= 0 ? p / s / t : NaN;
  const margin = mrpTab > 0 && costTab >= 0 ? ((mrpTab - costTab) / mrpTab) * 100 : NaN;
  const recv = (Number(boxes) || 0) * perBox + (Number(strips) || 0) * t + (Number(tablets) || 0);
  return (
    <div className="rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-teal-900 space-y-0.5">
      <p>1 box = {s} strips x {t} tablets = <b>{perBox}</b> tablets</p>
      {Number.isFinite(mrpTab) && <p>MRP per tablet: <b>{rs(mrpTab)}</b></p>}
      {Number.isFinite(costTab) && <p>Cost per tablet: <b>{rs(costTab)}</b>{Number.isFinite(margin) && <> | margin <b>{margin.toFixed(0)}%</b></>}</p>}
      {Number.isFinite(costTab) && Number.isFinite(mrpTab) && costTab > mrpTab && <p className="text-red-600">Purchase price is higher than MRP. Please check the box price.</p>}
      {recv > 0 && <p>Stock being added: <b>{recv}</b> tablets</p>}
    </div>
  );
}
export function PharmInventory({ readOnly = false }: { readOnly?: boolean }) {
  const hid = useHid();
  const [rows, setRows] = useState<Inv[]>([]);
  const [cats, setCats] = useState<string[]>(MED_CATEGORIES);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState("all");
  const [edit, setEdit] = useState<Inv | null>(null);
  const [f, setF] = useState({ batchNo: "", expiryDate: "", supplier: "", location: "", sellingPrice: "", packSize: "1", medCategory: "" });
  const [saving, setSaving] = useState(false);
  const [stock, setStock] = useState<Inv | null>(null);
  const [sMode, setSMode] = useState<"add" | "set">("add");
  const [sQty, setSQty] = useState("");
  const [sReason, setSReason] = useState("");
  const [sErr, setSErr] = useState("");
  const BLANK = { name: "", medCategory: "Tablet", tabletsPerStrip: "", stripsPerBox: "", mrpStrip: "", purchaseBox: "", schedule: "none", gstPercent: "", reorderLevel: "", location: "", supplier: "", boxes: "", strips: "", tablets: "", batchNo: "", expiryDate: "", invoiceNo: "" };
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState(BLANK);
  const [nErr, setNErr] = useState("");
  const [eErr, setEErr] = useState("");
  const [pf, setPf] = useState({ tabletsPerStrip: "", stripsPerBox: "", mrpStrip: "", purchaseBox: "", schedule: "none", gstPercent: "" });
  const [rc, setRc] = useState<Inv | null>(null);
  const [rf, setRf] = useState({ boxes: "", strips: "", tablets: "", batchNo: "", expiryDate: "", supplier: "", invoiceNo: "", mrpStrip: "", purchaseBox: "" });
  const [rErr, setRErr] = useState("");
  const [rm, setRm] = useState<Inv | null>(null);
  const [rmReason, setRmReason] = useState("");
  const [rmErr, setRmErr] = useState("");
  useLive(async () => {
    try { setRows(await pm<Inv[]>("/inventory")); setErr(""); } catch (e: any) { setErr(e.message); }
    try { setCats(await pm<string[]>("/inventory-categories")); } catch (_) { /* keep current list */ }
  }, [hid]);
  const alerts = rows.filter(r => r.status !== "ok");
  const catOptions = Array.from(new Set([...cats, ...rows.map(r => r.medCategory).filter((c): c is string => !!c)]));
  const shown = rows.filter(r => (flt === "all" || r.status === flt) && r.name.toLowerCase().includes(q.trim().toLowerCase()));
  function openEdit(r: Inv) {
    setEdit(r); setEErr("");
    setF({ batchNo: r.batchNo || "", expiryDate: r.expiryDate || "", supplier: r.supplier || "", location: r.location || "", sellingPrice: r.sellingPrice == null ? "" : String(r.sellingPrice), packSize: String(r.packSize || 1), medCategory: r.medCategory || "" });
    setPf({
      tabletsPerStrip: String(r.packSize || 1),
      stripsPerBox: r.stripsPerBox ? String(r.stripsPerBox) : "",
      mrpStrip: r.sellingPrice == null ? "" : String(r.sellingPrice),
      purchaseBox: r.purchasePrice != null && r.stripsPerBox ? String(Math.round(r.purchasePrice * r.stripsPerBox * 100) / 100) : "",
      schedule: r.schedule || "none",
      gstPercent: r.gstPercent == null ? "" : String(r.gstPercent),
    });
  }
  function openReceive(r: Inv) {
    setRc(r); setRErr("");
    setRf({ boxes: "", strips: "", tablets: "", batchNo: "", expiryDate: "", supplier: r.supplier || "", invoiceNo: "",
      mrpStrip: r.sellingPrice == null ? "" : String(r.sellingPrice),
      purchaseBox: r.purchasePrice != null && r.stripsPerBox ? String(Math.round(r.purchasePrice * r.stripsPerBox * 100) / 100) : "" });
  }  async function saveStock() {
    if (!stock) return;
    const n = Number(sQty);
    if (sQty.trim() === "" || !(n >= 0) || (sMode === "add" && !(n > 0))) { setSErr("Enter a valid number of tablets"); return; }
    setSaving(true); setSErr("");
    try {
      await pm("/inventory/" + stock.id + "/stock", { method: "POST", body: JSON.stringify({ mode: sMode, tablets: n, reason: sReason }) });
      setStock(null);
      setRows(await pm<Inv[]>("/inventory"));
    } catch (e: any) { setSErr(e.message); }
    setSaving(false);
  }
  async function saveNew() {
    const name = nf.name.trim();
    const tps = nOrNaN(nf.tabletsPerStrip), spb = nOrNaN(nf.stripsPerBox), mrp = nOrNaN(nf.mrpStrip), pbox = nOrNaN(nf.purchaseBox), gst = nOrNaN(nf.gstPercent);
    const opening = (Number(nf.boxes) || 0) * (spb || 0) * (tps || 0) + (Number(nf.strips) || 0) * (tps || 0) + (Number(nf.tablets) || 0);
    if (!name) { setNErr("Medicine name is required"); return; }
    if (!Number.isInteger(tps) || tps < 1) { setNErr("Tablets per strip must be a whole number of 1 or more"); return; }
    if (!Number.isInteger(spb) || spb < 1) { setNErr("Strips per box must be a whole number of 1 or more"); return; }
    if (!(mrp >= 0)) { setNErr("MRP per strip is required"); return; }
    if (nf.purchaseBox.trim() !== "" && !(pbox >= 0)) { setNErr("Invalid purchase price per box"); return; }
    if (nf.gstPercent.trim() !== "" && !(gst >= 0 && gst <= 40)) { setNErr("GST percent must be between 0 and 40"); return; }
    if (opening > 0 && (!nf.batchNo.trim() || !nf.expiryDate)) { setNErr("Batch number and expiry date are required when adding opening stock"); return; }
    setSaving(true); setNErr("");
    let newId = "";
    try {
      const created = await pm<{ ok: boolean; id: string }>("/inventory", { method: "POST", body: JSON.stringify({
        name, packSize: tps, medCategory: nf.medCategory || undefined, openingTablets: 0,
        reorderLevel: nf.reorderLevel === "" ? undefined : Number(nf.reorderLevel),
        purchasePrice: nf.purchaseBox.trim() === "" ? undefined : pbox / spb, sellingPrice: mrp,
        supplier: nf.supplier || undefined, location: nf.location || undefined,
      }) });
      newId = created.id;
      await pm("/inventory/" + newId + "/packing", { method: "POST", body: JSON.stringify({
        tabletsPerStrip: tps, stripsPerBox: spb, mrpStrip: mrp,
        purchaseBox: nf.purchaseBox.trim() === "" ? undefined : pbox, schedule: nf.schedule,
        gstPercent: nf.gstPercent.trim() === "" ? undefined : gst,
      }) });
      if (opening > 0) {
        await pm("/inventory/" + newId + "/receive", { method: "POST", body: JSON.stringify({
          boxes: Number(nf.boxes) || 0, strips: Number(nf.strips) || 0, tablets: Number(nf.tablets) || 0,
          batchNo: nf.batchNo.trim(), expiryDate: nf.expiryDate,
          supplier: nf.supplier || undefined, invoiceNo: nf.invoiceNo || undefined,
        }) });
      }
      setAdding(false);
    } catch (e: any) {
      setNErr(newId ? "The medicine was created, but a later step failed: " + e.message + ". Close this window, then use Edit or Receive stock on it." : e.message);
    }
    try { setRows(await pm<Inv[]>("/inventory")); } catch (_) { /* keep current list */ }
    setSaving(false);
  }
  async function removeMed() {
    if (!rm) return;
    setSaving(true); setRmErr("");
    try {
      await pm("/inventory/" + rm.id, { method: "DELETE", body: JSON.stringify({ reason: rmReason.trim() }) });
      setRm(null);
      setRows(await pm<Inv[]>("/inventory"));
    } catch (e: any) { setRmErr(e.message); }
    setSaving(false);
  }
  async function saveReceive() {
    if (!rc) return;
    const b = Number(rf.boxes) || 0, s = Number(rf.strips) || 0, t = Number(rf.tablets) || 0;
    if (b + s + t <= 0) { setRErr("Enter the boxes, strips or tablets received"); return; }
    if (!rf.batchNo.trim()) { setRErr("Batch number is required"); return; }
    if (!rf.expiryDate) { setRErr("Expiry date is required"); return; }
    setSaving(true); setRErr("");
    try {
      await pm("/inventory/" + rc.id + "/receive", { method: "POST", body: JSON.stringify({
        boxes: b, strips: s, tablets: t, batchNo: rf.batchNo.trim(), expiryDate: rf.expiryDate,
        supplier: rf.supplier || undefined, invoiceNo: rf.invoiceNo || undefined,
        mrpStrip: rf.mrpStrip.trim() === "" ? undefined : Number(rf.mrpStrip),
        purchaseBox: rf.purchaseBox.trim() === "" ? undefined : Number(rf.purchaseBox),
      }) });
      setRc(null);
      setRows(await pm<Inv[]>("/inventory"));
    } catch (e: any) { setRErr(e.message); }
    setSaving(false);
  }
  async function save() {
    if (!edit) return;
    const tps = nOrNaN(pf.tabletsPerStrip), spb = nOrNaN(pf.stripsPerBox), mrp = nOrNaN(pf.mrpStrip), pbox = nOrNaN(pf.purchaseBox), gst = nOrNaN(pf.gstPercent);
    if (!Number.isInteger(tps) || tps < 1) { setEErr("Tablets per strip must be a whole number of 1 or more"); return; }
    if (!Number.isInteger(spb) || spb < 1) { setEErr("Strips per box must be a whole number of 1 or more"); return; }
    if (!(mrp >= 0)) { setEErr("MRP per strip is required"); return; }
    if (pf.purchaseBox.trim() !== "" && !(pbox >= 0)) { setEErr("Invalid purchase price per box"); return; }
    if (pf.gstPercent.trim() !== "" && !(gst >= 0 && gst <= 40)) { setEErr("GST percent must be between 0 and 40"); return; }
    setSaving(true); setEErr("");
    try {
      await pm("/inventory/" + edit.id + "/meta", {
        method: "PATCH",
        body: JSON.stringify({
          batchNo: f.batchNo || undefined, expiryDate: f.expiryDate || undefined,
          supplier: f.supplier || undefined, location: f.location.trim(), medCategory: f.medCategory || undefined,
        }),
      });
      await pm("/inventory/" + edit.id + "/packing", { method: "POST", body: JSON.stringify({
        tabletsPerStrip: tps, stripsPerBox: spb, mrpStrip: mrp,
        purchaseBox: pf.purchaseBox.trim() === "" ? undefined : pbox, schedule: pf.schedule,
        gstPercent: pf.gstPercent.trim() === "" ? undefined : gst,
      }) });
      setEdit(null);
      setRows(await pm<Inv[]>("/inventory"));
    } catch (e: any) { setEErr(e.message); }
    setSaving(false);
  }  return (
    <Shell title="Pharmacy Inventory" subtitle="Batches, stock, expiry, suppliers and reorder alerts. Stock reduces automatically when medicines are dispensed.">
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {alerts.length} item(s) need attention: {alerts.filter(a => a.status === "low_stock" || a.status === "out_of_stock").length} low/out of stock,{" "}
          {alerts.filter(a => a.status === "expiring_soon" || a.status === "expired").length} expiring/expired.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!readOnly && (
          <button type="button" onClick={() => { setNf(BLANK); setNErr(""); setAdding(true); }} className="px-3 py-2 rounded-md bg-teal-600 text-white text-sm">+ Add medicine</button>
        )}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search medicine"
          className="border border-gray-200 rounded-md text-sm px-3 py-2 bg-white w-64" />
        <select value={flt} onChange={e => setFlt(e.target.value)} className="border border-gray-200 rounded-md text-sm px-2 py-2 bg-white">
          <option value="all">All</option>
          {(Object.keys(STATUS_UI) as InvStatus[]).map(k => <option key={k} value={k}>{STATUS_UI[k][0]}</option>)}
        </select>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-100">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            {["Medicine", "Category", "Available", "Expiry", "Supplier", "Location", "Reorder level", "MRP / strip", "Status", ""].map(h => <th key={h} className={TH}>{h}</th>)}
          </tr></thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className={TD + " font-medium"}>{r.name}{r.schedule && r.schedule !== "none" && <span className="ml-2 px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-xs">{r.schedule}</span>}</td>
                <td className={TD}>{r.medCategory || "-"}</td>
                <td className={TD}>{r.tabletsAvailable} <span className="text-xs text-gray-400">({stockText(r)})</span></td>
                <td className={TD}>{r.expiryDate || "-"}</td>
                <td className={TD}>{r.supplier || "-"}</td>
                <td className={TD}>{r.location || "-"}</td>
                <td className={TD}>{r.reorderLevel}</td>
                <td className={TD}>{inr(r.sellingPrice)}{r.sellingPrice != null && <span className="text-xs text-gray-400"> ({rs(r.sellingPrice / (r.packSize || 1))}/tab)</span>}</td>
                <td className={TD}><span className={"px-2 py-0.5 rounded-full text-xs font-medium " + STATUS_UI[r.status][1]}>{STATUS_UI[r.status][0]}</span></td>
                <td className={TD + " whitespace-nowrap"}>{!readOnly && (
                  <>
                    <button type="button" onClick={() => openReceive(r)} className="text-teal-700 text-sm hover:underline mr-3">Receive stock</button>
                    <button type="button" onClick={() => { setStock(r); setSMode("add"); setSQty(""); setSReason(""); setSErr(""); }} className="text-teal-700 text-sm hover:underline mr-3">Correct count</button>
                    <button type="button" onClick={() => openEdit(r)} className="text-teal-700 text-sm hover:underline mr-3">Edit</button>
                    <button type="button" onClick={() => { setRm(r); setRmReason(""); setRmErr(""); }} className="text-red-600 text-sm hover:underline">Remove</button>
                  </>
                )}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-400">No medicines found</td></tr>}
          </tbody>
        </table>
      </div>
      {stock && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setStock(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-900">{stock.name}</p>
            <p className="text-sm text-gray-500">Currently {stock.tabletsAvailable} tablets in stock</p>
            <div className="flex gap-2">
              {(["add", "set"] as const).map(m => (
                <button key={m} type="button" onClick={() => setSMode(m)}
                  className={"flex-1 px-3 py-1.5 rounded-md text-sm border " + (sMode === m ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 border-gray-200")}>
                  {m === "add" ? "Add received stock" : "Set correct count"}
                </button>
              ))}
            </div>
            <label className="block text-sm text-gray-600">{sMode === "add" ? "Tablets received" : "Correct total tablets"}
              <input type="number" min={0} value={sQty} onChange={e => setSQty(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm" />
            </label>
            {sQty.trim() !== "" && Number(sQty) >= 0 && (
              <p className="text-xs text-gray-500">New total: {sMode === "add" ? stock.tabletsAvailable + Number(sQty) : Number(sQty)} tablets</p>
            )}
            <label className="block text-sm text-gray-600">Reason {sMode === "set" ? "(required if reducing)" : "(optional, e.g. supplier invoice)"}
              <input type="text" value={sReason} onChange={e => setSReason(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm" />
            </label>
            {sErr && <p className="text-sm text-red-600">{sErr}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStock(null)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Cancel</button>
              <button type="button" disabled={saving} onClick={saveStock} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white">{saving ? "Saving..." : "Save stock"}</button>
            </div>
          </div>
        </div>
      )}
      {adding && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setAdding(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-lg space-y-3 my-8" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-900">Add new medicine</p>
            <Fld label="Medicine name *" value={nf.name} onChange={v => setNf(p => ({ ...p, name: v }))} />
            <CategoryPicker value={nf.medCategory} onChange={v => setNf(p => ({ ...p, medCategory: v }))} options={catOptions} />
            <p className="text-xs font-semibold text-gray-500 uppercase pt-1">Packing</p>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Tablets per strip *" type="number" value={nf.tabletsPerStrip} onChange={v => setNf(p => ({ ...p, tabletsPerStrip: v }))} />
              <Fld label="Strips per box *" type="number" value={nf.stripsPerBox} onChange={v => setNf(p => ({ ...p, stripsPerBox: v }))} />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase pt-1">Price and rules</p>
            <div className="grid grid-cols-2 gap-3">
              <Fld label={"MRP per strip (\u20B9) *"} type="number" value={nf.mrpStrip} onChange={v => setNf(p => ({ ...p, mrpStrip: v }))} />
              <Fld label={"Purchase price per box (\u20B9)"} type="number" value={nf.purchaseBox} onChange={v => setNf(p => ({ ...p, purchaseBox: v }))} />
              <ScheduleSelect value={nf.schedule} onChange={v => setNf(p => ({ ...p, schedule: v }))} />
              <Fld label="GST %" type="number" value={nf.gstPercent} onChange={v => setNf(p => ({ ...p, gstPercent: v }))} />
            </div>
            <PackPreview tps={nf.tabletsPerStrip} spb={nf.stripsPerBox} mrp={nf.mrpStrip} pbox={nf.purchaseBox} boxes={nf.boxes} strips={nf.strips} tablets={nf.tablets} />
            <p className="text-xs font-semibold text-gray-500 uppercase pt-1">Opening stock (optional, can be added later with Receive stock)</p>
            <div className="grid grid-cols-3 gap-3">
              <Fld label="Boxes" type="number" value={nf.boxes} onChange={v => setNf(p => ({ ...p, boxes: v }))} />
              <Fld label="Loose strips" type="number" value={nf.strips} onChange={v => setNf(p => ({ ...p, strips: v }))} />
              <Fld label="Loose tablets" type="number" value={nf.tablets} onChange={v => setNf(p => ({ ...p, tablets: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Batch number" value={nf.batchNo} onChange={v => setNf(p => ({ ...p, batchNo: v }))} />
              <Fld label="Expiry date" type="date" value={nf.expiryDate} onChange={v => setNf(p => ({ ...p, expiryDate: v }))} />
              <Fld label="Supplier" value={nf.supplier} onChange={v => setNf(p => ({ ...p, supplier: v }))} />
              <Fld label="Supplier invoice no." value={nf.invoiceNo} onChange={v => setNf(p => ({ ...p, invoiceNo: v }))} />
              <Fld label="Reorder level (strips)" type="number" value={nf.reorderLevel} onChange={v => setNf(p => ({ ...p, reorderLevel: v }))} />
              <Fld label="Location (shelf / rack)" value={nf.location} onChange={v => setNf(p => ({ ...p, location: v }))} />
            </div>
            {nErr && <p className="text-sm text-red-600">{nErr}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Cancel</button>
              <button type="button" disabled={saving} onClick={saveNew} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white">{saving ? "Saving..." : "Add medicine"}</button>
            </div>
          </div>
        </div>
      )}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-lg space-y-3 my-8" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-900">{edit.name}</p>
            <CategoryPicker value={f.medCategory} onChange={v => setF(prev => ({ ...prev, medCategory: v }))} options={catOptions} allowBlank />
            <p className="text-xs font-semibold text-gray-500 uppercase pt-1">Packing and price</p>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Tablets per strip *" type="number" value={pf.tabletsPerStrip} onChange={v => setPf(p => ({ ...p, tabletsPerStrip: v }))} />
              <Fld label="Strips per box *" type="number" value={pf.stripsPerBox} onChange={v => setPf(p => ({ ...p, stripsPerBox: v }))} />
              <Fld label={"MRP per strip (\u20B9) *"} type="number" value={pf.mrpStrip} onChange={v => setPf(p => ({ ...p, mrpStrip: v }))} />
              <Fld label={"Purchase price per box (\u20B9)"} type="number" value={pf.purchaseBox} onChange={v => setPf(p => ({ ...p, purchaseBox: v }))} />
              <ScheduleSelect value={pf.schedule} onChange={v => setPf(p => ({ ...p, schedule: v }))} />
              <Fld label="GST %" type="number" value={pf.gstPercent} onChange={v => setPf(p => ({ ...p, gstPercent: v }))} />
            </div>
            <PackPreview tps={pf.tabletsPerStrip} spb={pf.stripsPerBox} mrp={pf.mrpStrip} pbox={pf.purchaseBox} />
            <p className="text-xs text-amber-700">Changing tablets per strip keeps the total tablet count the same. If the count itself is wrong, fix it with Correct count.</p>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Batch number" value={f.batchNo} onChange={v => setF(prev => ({ ...prev, batchNo: v }))} />
              <Fld label="Expiry date" type="date" value={f.expiryDate} onChange={v => setF(prev => ({ ...prev, expiryDate: v }))} />
              <Fld label="Supplier" value={f.supplier} onChange={v => setF(prev => ({ ...prev, supplier: v }))} />
              <Fld label="Location (shelf / rack)" value={f.location} onChange={v => setF(prev => ({ ...prev, location: v }))} />
            </div>
            {eErr && <p className="text-sm text-red-600">{eErr}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEdit(null)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white">{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
      {rm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setRm(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-900">Remove {rm.name}?</p>
            <p className="text-sm text-gray-600">It will disappear from Inventory and from the dispensing list. Old bills and reports keep their data.</p>
            {rm.tabletsAvailable > 0 && (
              <p className="text-sm text-amber-700">{rm.tabletsAvailable} tablets are still in stock. They will be written off in the stock log.</p>
            )}
            <Fld label="Reason (optional)" value={rmReason} onChange={setRmReason} />
            {rmErr && <p className="text-sm text-red-600">{rmErr}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setRm(null)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Cancel</button>
              <button type="button" disabled={saving} onClick={removeMed} className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white">{saving ? "Removing..." : "Remove"}</button>
            </div>
          </div>
        </div>
      )}
      {rc && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setRc(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-lg space-y-3 my-8" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-900">Receive stock: {rc.name}</p>
            {!rc.stripsPerBox ? (
              <>
                <p className="text-sm text-amber-700">Set the packing first. Close this window, click Edit, and fill tablets per strip and strips per box.</p>
                <div className="flex justify-end"><button type="button" onClick={() => setRc(null)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Close</button></div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">Currently {rc.tabletsAvailable} tablets ({stockText(rc)})</p>
                <div className="grid grid-cols-3 gap-3">
                  <Fld label="Boxes" type="number" value={rf.boxes} onChange={v => setRf(p => ({ ...p, boxes: v }))} />
                  <Fld label="Loose strips" type="number" value={rf.strips} onChange={v => setRf(p => ({ ...p, strips: v }))} />
                  <Fld label="Loose tablets" type="number" value={rf.tablets} onChange={v => setRf(p => ({ ...p, tablets: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Batch number *" value={rf.batchNo} onChange={v => setRf(p => ({ ...p, batchNo: v }))} />
                  <Fld label="Expiry date *" type="date" value={rf.expiryDate} onChange={v => setRf(p => ({ ...p, expiryDate: v }))} />
                  <Fld label="Supplier" value={rf.supplier} onChange={v => setRf(p => ({ ...p, supplier: v }))} />
                  <Fld label="Supplier invoice no." value={rf.invoiceNo} onChange={v => setRf(p => ({ ...p, invoiceNo: v }))} />
                  <Fld label={"MRP per strip (\u20B9)"} type="number" value={rf.mrpStrip} onChange={v => setRf(p => ({ ...p, mrpStrip: v }))} />
                  <Fld label={"Purchase price per box (\u20B9)"} type="number" value={rf.purchaseBox} onChange={v => setRf(p => ({ ...p, purchaseBox: v }))} />
                </div>
                <PackPreview tps={String(rc.packSize)} spb={String(rc.stripsPerBox)} mrp={rf.mrpStrip} pbox={rf.purchaseBox} boxes={rf.boxes} strips={rf.strips} tablets={rf.tablets} />
                {rErr && <p className="text-sm text-red-600">{rErr}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setRc(null)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Cancel</button>
                  <button type="button" disabled={saving} onClick={saveReceive} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white">{saving ? "Saving..." : "Receive stock"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}    </Shell>
  );
}

// ── 3. Medicine Buying by Patient ────────────────────────────────────────────
type Log = {
  prescriptionId: string; patientId: string; patientName: string; doctorName: string;
  medicines: { name: string; tablets: number | null; dosage: string | null }[];
  billAmount: number | null; paymentMode: string | null; billStatus: "Billed" | "Pending"; timestamp: string;
};
type Invoice = {
  invoiceNo?: string; billNo?: number | null; hospitalName: string; patientId: string; patientName: string; doctorName: string; issuedAt: string | null;
  paymentMode: string | null; lines: { name: string; tablets: number; unitPrice: number; amount: number }[]; total: number | null; status: string;
};
import { printInvoice } from "@/lib/printInvoice";
export function PharmPatients() {
  const hid = useHid();
  const { range, ui } = useRange();
  const [rows, setRows] = useState<Log[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [inv, setInv] = useState<Invoice | null>(null);
  useLive(async () => {
    try { setRows(await pm<Log[]>("/dispensing-log?from=" + range.from + "&to=" + range.to + "&q=" + encodeURIComponent(q.trim()))); setErr(""); }
    catch (e: any) { setErr(e.message); }
  }, [hid, range.from, range.to, q]);
  async function openInvoice(id: string) {
    try { setInv(await pm<Invoice>("/invoice/" + encodeURIComponent(id))); } catch (e: any) { setErr(e.message); }
  }
  return (
    <Shell title="Patient Purchases" subtitle="Patient-wise dispensing log with bill status. Open an invoice for the itemized pharmacy bill.">
      {ui}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search patient name"
        className="border border-gray-200 rounded-md text-sm px-3 py-2 bg-white w-64" />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-100">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            {["Patient", "Patient ID", "Prescribing doctor", "Medicines & dosage", "Bill", "Payment", "Date & time", ""].map(h => <th key={h} className={TH}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.prescriptionId} className="border-t border-gray-100">
                <td className={TD + " font-medium"}>{r.patientName}</td>
                <td className={TD + " text-xs text-gray-500"}>{r.patientId}</td>
                <td className={TD}>{r.doctorName}</td>
                <td className={TD}>
                  {r.medicines.map((m, i) => (
                    <div key={i}>{m.name}{m.tablets != null ? " x " + m.tablets : ""}{m.dosage ? <span className="text-xs text-gray-400"> ({m.dosage})</span> : null}</div>
                  ))}
                </td>
                <td className={TD}>
                  <span className={"px-2 py-0.5 rounded-full text-xs font-medium " + (r.billStatus === "Billed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{r.billStatus}</span>
                  <div className="text-xs text-gray-500 mt-1">{inr(r.billAmount)}</div>
                </td>
                <td className={TD + " capitalize"}>{r.paymentMode || "-"}</td>
                <td className={TD + " whitespace-nowrap"}>{fmtTime(r.timestamp)}</td>
                <td className={TD}><button type="button" onClick={() => openInvoice(r.prescriptionId)} className="text-teal-700 text-sm hover:underline">Invoice</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-400">No dispensing records in this period</td></tr>}
          </tbody>
        </table>
      </div>
      {inv && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setInv(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-lg space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div><p className="font-bold text-gray-900">Pharmacy invoice</p><p className="text-base font-bold text-teal-700">Bill No: {inv.billNo != null ? inv.billNo : "-"}</p><p className="text-xs text-gray-500">{inv.hospitalName}</p></div>
              <span className={"px-2 py-0.5 rounded-full text-xs font-medium " + (inv.status === "Billed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{inv.status}</span>
            </div>
            <p className="text-sm text-gray-700">{inv.patientName} | Dr. {inv.doctorName}</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Medicine</th><th>Qty</th><th>Rate</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{inv.lines.map((l, i) => (
                <tr key={i} className="border-t border-gray-100"><td className="py-1.5">{l.name}</td><td>{l.tablets}</td><td>{inr(l.unitPrice)}</td><td className="text-right">{inr(l.amount)}</td></tr>
              ))}</tbody>
            </table>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold"><span>Total ({inv.paymentMode || "cash"})</span><span>{inr(inv.total)}</span></div>
            <p className="text-xs text-gray-400">{fmtTime(inv.issuedAt)}</p>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => { if (!printInvoice(inv)) alert("Allow pop-ups to print the invoice"); }} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white">Print</button><button type="button" onClick={() => setInv(null)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Close</button></div>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ── 4. Medicine Sold ─────────────────────────────────────────────────────────
type Sold = {
  name: string; unitPrice: number; unitsToday: number; unitsWeek: number; unitsMonth: number;
  revenueToday: number; revenueWeek: number; revenueMonth: number;
};
export function PharmSold() {
  const hid = useHid();
  const [rows, setRows] = useState<Sold[]>([]);
  const [per, setPer] = useState<"Today" | "Week" | "Month">("Today");
  const [err, setErr] = useState("");
  useLive(async () => {
    try { setRows(await pm<Sold[]>("/medicines-sold")); setErr(""); } catch (e: any) { setErr(e.message); }
  }, [hid]);
  const units = (r: Sold) => (per === "Today" ? r.unitsToday : per === "Week" ? r.unitsWeek : r.unitsMonth);
  const rev = (r: Sold) => (per === "Today" ? r.revenueToday : per === "Week" ? r.revenueWeek : r.revenueMonth);
  const shown = rows.filter(r => units(r) > 0);
  const totU = shown.reduce((s, r) => s + units(r), 0);
  const totR = shown.reduce((s, r) => s + rev(r), 0);
  return (
    <Shell title="Sales History" subtitle="Real-time sales register: units sold, unit price and line revenue per medicine.">
      <div className="flex gap-2">
        {(["Today", "Week", "Month"] as const).map(k => (
          <button key={k} type="button" onClick={() => setPer(k)}
            className={"px-3 py-1.5 rounded-full text-sm border " + (per === k ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")}>{k === "Week" ? "Last 7 days" : k === "Month" ? "This month" : "Today"}</button>
        ))}
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-100">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            {["Medicine", "Units sold", "Unit price", "Total line revenue"].map(h => <th key={h} className={TH}>{h}</th>)}
          </tr></thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.name} className="border-t border-gray-100">
                <td className={TD + " font-medium"}>{r.name}</td>
                <td className={TD}>{units(r)}</td>
                <td className={TD}>{inr(r.unitPrice)}</td>
                <td className={TD}>{inr(rev(r))}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-400">Nothing sold in this period yet</td></tr>}
          </tbody>
          {shown.length > 0 && (
            <tfoot><tr className="border-t border-gray-200 bg-gray-50 font-semibold">
              <td className={TD}>Total</td><td className={TD}>{totU}</td><td className={TD}></td><td className={TD}>{inr(totR)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </Shell>
  );
}

// ---- 5. Stock Update ----
type PendLine = { rxId: string; patient: string; index: number; name: string; tablets: number };
type PendMed = { name: string; soldTablets: number; deductedTablets: number; pendingTablets: number; pendingLines: number };
type PendData = { date: string; medicines: PendMed[]; pending: PendLine[] };

function matchInv(name: string, inv: Inv[]): Inv | undefined {
  const n = name.toLowerCase().replace(/\s+/g, " ").trim();
  const base = n.replace(/\s*\d+(\.\d+)?\s*(mg|ml|g|mcg)\b.*$/, "").trim();
  return inv.find(i => i.name.toLowerCase().trim() === n)
    || inv.find(i => {
      const m = i.name.toLowerCase().trim();
      return base.length > 2 && (m.includes(base) || base.includes(m));
    });
}

export function PharmStockUpdate() {
  const hid = useHid();
  const [d, setD] = useState<PendData | null>(null);
  const [inv, setInv] = useState<Inv[]>([]);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useLive(async () => {
    try {
      const [a, b] = await Promise.all([pm<PendData>("/stock-pending"), pm<Inv[]>("/inventory")]);
      setD(a); setInv(b); setErr("");
    } catch (e: any) { setErr(e.message); }
  }, [hid]);

  const keyOf = (l: PendLine) => l.rxId + ":" + l.index;
  const itemOf = (l: PendLine) => pick[keyOf(l)] ?? matchInv(l.name, inv)?.id ?? "";
  const qtyOf = (l: PendLine) => qty[keyOf(l)] ?? String(l.tablets);

  async function deduct(l: PendLine): Promise<string | null> {
    const itemId = itemOf(l);
    const n = Number(qtyOf(l));
    if (!itemId) return "Select a stock item for " + l.name;
    if (!(n > 0)) return "Enter a valid quantity for " + l.name;
    try {
      await pm("/stock-deduct", {
        method: "POST",
        body: JSON.stringify({ rxId: l.rxId, index: l.index, inventoryItemId: itemId, tablets: n }),
      });
      return null;
    } catch (e: any) { return l.name + ": " + e.message; }
  }
  async function deductOne(l: PendLine) {
    setBusy(keyOf(l)); setMsg("");
    const e = await deduct(l);
    setBusy("");
    setMsg(e ? e : l.name + " deducted from stock");
    window.dispatchEvent(new CustomEvent("pharmacy-updated"));
  }
  async function deductAll() {
    if (!d) return;
    setBusy("all"); setMsg("");
    let ok = 0; const bad: string[] = [];
    for (const l of d.pending) {
      const e = await deduct(l);
      if (e) bad.push(e); else ok++;
    }
    setBusy("");
    setMsg("Deducted " + ok + " line(s)." + (bad.length ? " Skipped " + bad.length + ": " + bad.slice(0, 3).join("; ") : ""));
    window.dispatchEvent(new CustomEvent("pharmacy-updated"));
  }

  const sum = (f: (m: PendMed) => number) => (d ? d.medicines.reduce((s, m) => s + f(m), 0) : 0);
  return (
    <Shell title="Stock Update" subtitle="Medicines sold today that are not yet deducted from your stock. Check the stock item and quantity, then deduct.">
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm rounded-lg border border-teal-200 bg-teal-50 text-teal-800 px-3 py-2">{msg}</p>}
      {d && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Tablets sold" value={String(sum(m => m.soldTablets))} />
            <Stat label="Already deducted" value={String(sum(m => m.deductedTablets))} color="text-teal-700" />
            <Stat label="Pending" value={String(sum(m => m.pendingTablets))} color={sum(m => m.pendingTablets) > 0 ? "text-amber-600" : "text-gray-900"} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <p className="text-sm font-semibold text-gray-800 px-4 pt-4">Medicines sold on {d.date}</p>
            {d.medicines.length === 0 ? (
              <p className="text-sm text-gray-500 px-4 py-6">No medicines have been given today.</p>
            ) : (
              <table className="w-full mt-2">
                <thead className="bg-gray-50"><tr>
                  <th className={TH}>Medicine</th><th className={TH}>Sold</th><th className={TH}>Deducted</th><th className={TH}>Pending</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {d.medicines.map(m => (
                    <tr key={m.name}>
                      <td className={TD}>{m.name}</td>
                      <td className={TD}>{m.soldTablets}</td>
                      <td className={TD}>{m.deductedTablets}</td>
                      <td className={TD + (m.pendingTablets > 0 ? " text-amber-700 font-semibold" : "")}>{m.pendingTablets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {d.pending.length === 0 ? (
            <p className="text-sm rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3">
              All sold medicines are already deducted from stock.
            </p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
              <div className="flex items-center justify-between gap-2 px-4 pt-4">
                <p className="text-sm font-semibold text-gray-800">Waiting to be deducted ({d.pending.length})</p>
                <button type="button" disabled={busy !== ""} onClick={deductAll}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
                  {busy === "all" ? "Deducting..." : "Deduct all"}
                </button>
              </div>
              <table className="w-full mt-2">
                <thead className="bg-gray-50"><tr>
                  <th className={TH}>Medicine</th><th className={TH}>Patient</th><th className={TH}>Tablets</th>
                  <th className={TH}>Stock item</th><th className={TH}></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {d.pending.map(l => {
                    const k = keyOf(l);
                    return (
                      <tr key={k}>
                        <td className={TD}>{l.name}</td>
                        <td className={TD}>{l.patient}</td>
                        <td className={TD}>
                          <input type="number" min={1} value={qtyOf(l)} onChange={e => setQty(prev => ({ ...prev, [k]: e.target.value }))}
                            className="w-20 border border-gray-200 rounded-md text-sm px-2 py-1 bg-white" />
                        </td>
                        <td className={TD}>
                          <select value={itemOf(l)} onChange={e => setPick(prev => ({ ...prev, [k]: e.target.value }))}
                            className="w-full min-w-[12rem] border border-gray-200 rounded-md text-sm px-2 py-1 bg-white">
                            <option value="">Select stock item...</option>
                            {inv.map(i => <option key={i.id} value={i.id}>{i.name} ({i.tabletsAvailable} in stock)</option>)}
                          </select>
                        </td>
                        <td className={TD}>
                          <button type="button" disabled={busy !== ""} onClick={() => deductOne(l)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-50">
                            {busy === k ? "..." : "Deduct"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
