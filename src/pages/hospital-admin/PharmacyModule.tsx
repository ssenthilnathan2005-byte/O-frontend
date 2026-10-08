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
  purchasePrice: number | null; sellingPrice: number | null; supplier: string | null; batchNo: string | null;
  expiryDate: string | null; location: string | null; status: InvStatus;
};
const STATUS_UI: Record<InvStatus, [string, string]> = {
  ok: ["In stock", "bg-emerald-50 text-emerald-700"],
  low_stock: ["Low stock", "bg-amber-50 text-amber-700"],
  out_of_stock: ["Out of stock", "bg-red-50 text-red-700"],
  expiring_soon: ["Expiring soon", "bg-orange-50 text-orange-700"],
  expired: ["Expired", "bg-red-100 text-red-800"],
};
export function PharmInventory({ readOnly = false }: { readOnly?: boolean }) {
  const hid = useHid();
  const [rows, setRows] = useState<Inv[]>([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState("all");
  const [edit, setEdit] = useState<Inv | null>(null);
  const [f, setF] = useState({ batchNo: "", expiryDate: "", supplier: "", location: "", sellingPrice: "" });
  const [saving, setSaving] = useState(false);
  const [stock, setStock] = useState<Inv | null>(null);
  const [sMode, setSMode] = useState<"add" | "set">("add");
  const [sQty, setSQty] = useState("");
  const [sReason, setSReason] = useState("");
  const [sErr, setSErr] = useState("");
  const BLANK = { name: "", packSize: "1", openingTablets: "", reorderLevel: "", purchasePrice: "", sellingPrice: "", supplier: "", batchNo: "", expiryDate: "", location: "" };
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState(BLANK);
  const [nErr, setNErr] = useState("");
  useLive(async () => {
    try { setRows(await pm<Inv[]>("/inventory")); setErr(""); } catch (e: any) { setErr(e.message); }
  }, [hid]);
  const alerts = rows.filter(r => r.status !== "ok");
  const shown = rows.filter(r => (flt === "all" || r.status === flt) && r.name.toLowerCase().includes(q.trim().toLowerCase()));
  function openEdit(r: Inv) {
    setEdit(r);
    setF({ batchNo: r.batchNo || "", expiryDate: r.expiryDate || "", supplier: r.supplier || "", location: r.location || "", sellingPrice: r.sellingPrice == null ? "" : String(r.sellingPrice) });
  }
  async function saveStock() {
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
    if (!nf.name.trim()) { setNErr("Medicine name is required"); return; }
    setSaving(true); setNErr("");
    try {
      await pm("/inventory", { method: "POST", body: JSON.stringify({
        name: nf.name.trim(),
        packSize: nf.packSize === "" ? 1 : Number(nf.packSize),
        openingTablets: nf.openingTablets === "" ? 0 : Number(nf.openingTablets),
        reorderLevel: nf.reorderLevel === "" ? undefined : Number(nf.reorderLevel),
        purchasePrice: nf.purchasePrice === "" ? undefined : Number(nf.purchasePrice),
        sellingPrice: nf.sellingPrice === "" ? undefined : Number(nf.sellingPrice),
        supplier: nf.supplier || undefined, batchNo: nf.batchNo || undefined,
        expiryDate: nf.expiryDate || undefined, location: nf.location || undefined,
      }) });
      setAdding(false);
      setRows(await pm<Inv[]>("/inventory"));
    } catch (e: any) { setNErr(e.message); }
    setSaving(false);
  }
  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      await pm("/inventory/" + edit.id + "/meta", {
        method: "PATCH",
        body: JSON.stringify({
          batchNo: f.batchNo || undefined, expiryDate: f.expiryDate || undefined,
          supplier: f.supplier || undefined, location: f.location.trim(), sellingPrice: f.sellingPrice === "" ? undefined : Number(f.sellingPrice),
        }),
      });
      setEdit(null);
      setRows(await pm<Inv[]>("/inventory"));
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  }
  return (
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
            {["Medicine", "Batch no.", "Available", "Expiry", "Supplier", "Location", "Reorder level", "Sell price/pack", "Status", ""].map(h => <th key={h} className={TH}>{h}</th>)}
          </tr></thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className={TD + " font-medium"}>{r.name}</td>
                <td className={TD}>{r.batchNo || "-"}</td>
                <td className={TD}>{r.tabletsAvailable} <span className="text-xs text-gray-400">({r.quantity} packs)</span></td>
                <td className={TD}>{r.expiryDate || "-"}</td>
                <td className={TD}>{r.supplier || "-"}</td>
                <td className={TD}>{r.location || "-"}</td>
                <td className={TD}>{r.reorderLevel}</td>
                <td className={TD}>{inr(r.sellingPrice)}</td>
                <td className={TD}><span className={"px-2 py-0.5 rounded-full text-xs font-medium " + STATUS_UI[r.status][1]}>{STATUS_UI[r.status][0]}</span></td>
                <td className={TD + " whitespace-nowrap"}>{!readOnly && (
                  <>
                    <button type="button" onClick={() => { setStock(r); setSMode("add"); setSQty(""); setSReason(""); setSErr(""); }} className="text-teal-700 text-sm hover:underline mr-3">Update stock</button>
                    <button type="button" onClick={() => openEdit(r)} className="text-teal-700 text-sm hover:underline">Edit</button>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([["Medicine name *", "name", "text"], ["Tablets per pack", "packSize", "number"], ["Opening stock (tablets)", "openingTablets", "number"], ["Reorder level", "reorderLevel", "number"], ["Purchase price per pack (\u20B9)", "purchasePrice", "number"], ["Selling price per pack (\u20B9)", "sellingPrice", "number"], ["Supplier", "supplier", "text"], ["Batch number", "batchNo", "text"], ["Expiry date", "expiryDate", "date"], ["Location (shelf / rack)", "location", "text"]] as const).map(([l, k, t]) => (
                <label key={k} className={"block text-sm text-gray-600" + (k === "name" ? " sm:col-span-2" : "")}>{l}
                  <input type={t} value={nf[k]} onChange={e => setNf(prev => ({ ...prev, [k]: e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm" />
                </label>
              ))}
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-900">{edit.name}</p>
            {([["Batch number", "batchNo", "text"], ["Expiry date", "expiryDate", "date"], ["Supplier", "supplier", "text"], ["Location (shelf / rack)", "location", "text"], ["Selling price per pack (\u20B9)", "sellingPrice", "number"]] as const).map(([l, k, t]) => (
              <label key={k} className="block text-sm text-gray-600">{l}
                <input type={t} value={f[k]} onChange={e => setF(prev => ({ ...prev, [k]: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm" />
              </label>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEdit(null)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white">{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ── 3. Medicine Buying by Patient ────────────────────────────────────────────
type Log = {
  prescriptionId: string; patientId: string; patientName: string; doctorName: string;
  medicines: { name: string; tablets: number | null; dosage: string | null }[];
  billAmount: number | null; paymentMode: string | null; billStatus: "Billed" | "Pending"; timestamp: string;
};
type Invoice = {
  invoiceNo: string; hospitalName: string; patientId: string; patientName: string; doctorName: string; issuedAt: string | null;
  paymentMode: string | null; lines: { name: string; tablets: number; unitPrice: number; amount: number }[]; total: number | null; status: string;
};
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
              <div><p className="font-bold text-gray-900">Pharmacy invoice</p><p className="text-xs text-gray-500">{inv.invoiceNo} | {inv.hospitalName}</p></div>
              <span className={"px-2 py-0.5 rounded-full text-xs font-medium " + (inv.status === "Billed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{inv.status}</span>
            </div>
            <p className="text-sm text-gray-700">{inv.patientName} <span className="text-gray-400">({inv.patientId})</span> | Dr. {inv.doctorName}</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Medicine</th><th>Qty</th><th>Rate</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{inv.lines.map((l, i) => (
                <tr key={i} className="border-t border-gray-100"><td className="py-1.5">{l.name}</td><td>{l.tablets}</td><td>{inr(l.unitPrice)}</td><td className="text-right">{inr(l.amount)}</td></tr>
              ))}</tbody>
            </table>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold"><span>Total ({inv.paymentMode || "cash"})</span><span>{inr(inv.total)}</span></div>
            <p className="text-xs text-gray-400">{fmtTime(inv.issuedAt)}</p>
            <div className="flex justify-end"><button type="button" onClick={() => setInv(null)} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Close</button></div>
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