import { createElement, useEffect, useMemo, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { IndianRupee, Pill, Search, UserCog, X } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getToken } from "@/api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
const DASH = "\u2014";
const rupee = (n: number) => `\u20B9${Math.round(n || 0).toLocaleString("en-IN")}`;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localYmd = (iso: string) => ymd(new Date(iso));
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function periodRange(period: string, from: string, to: string): [string, string] {
  const now = new Date();
  if (period === "today") return [ymd(now), ymd(now)];
  if (period === "month") return [`${ymd(now).slice(0, 7)}-01`, ymd(now)];
  if (period === "custom") return from <= to ? [from, to] : [to, from];
  if (period === "all") return ["2000-01-01", ymd(now)];
  const s = new Date();
  s.setDate(s.getDate() - 6);
  return [ymd(s), ymd(now)];
}

export type PharmRow = {
  id: string; bill: string; patientId: string; patient: string; doctor: string; amount: number;
  mode: string; at: string; meds: { name: string; qty: number; type: string }[];
};

function toRow(p: any): PharmRow {
  let lines: any[] = [];
  try { lines = p.dispensed_items ? JSON.parse(p.dispensed_items) : []; } catch { /* ignore */ }
  const src: any[] = Array.isArray(lines) && lines.length ? lines : Array.isArray(p.items) ? p.items : [];
  const meds = src.map((l: any) => {
    const hay = `${l.dosage || ""} ${l.name || ""}`;
    return {
      name: String(l.name || l.medicine || l.item || "Medicine"),
      qty: Number(l.tablets ?? l.qty ?? l.quantity ?? 0) || 0,
      type: /capsule/i.test(hay) ? "Capsule" : /tablet/i.test(hay) ? "Tablet" : DASH,
    };
  });
  return {
    id: String(p.id),
    bill: `#PH-${String(p.id).slice(-6).toUpperCase()}`,
    patientId: String(p.patient_id ?? p.uhid ?? DASH),
    patient: String(p.patient_name || "Patient"),
    doctor: String(p.doctor_name || DASH),
    amount: Number(p.bill_amount ?? p.billAmount ?? p.amount ?? 0) || 0,
    mode: String(p.payment_mode ?? p.paymentMode ?? DASH),
    at: String(p.handed_over_at || p.created_at || new Date().toISOString()),
    meds,
  };
}

export function usePharmacyRx(hospitalId: string, from: string, to: string) {
  const [rows, setRows] = useState<PharmRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!hospitalId) return;
    let off = false;
    const load = async () => {
      try {
        const res = await fetch(`${BASE}/pharmacy/prescriptions?hospitalId=${encodeURIComponent(hospitalId)}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (off || !Array.isArray(data)) return;
        setRows(
          data
            .filter((p: any) => p.status === "handed_over")
            .map(toRow)
            .filter((r) => { const d = localYmd(r.at); return d >= from && d <= to; })
            .sort((a, b) => (a.at < b.at ? 1 : -1)),
        );
      } catch { /* ignore */ } finally { if (!off) setLoading(false); }
    };
    load();
    const t = setInterval(load, 10000);
    const onUp = () => { load(); };
    window.addEventListener("pharmacy-updated", onUp);
    return () => { off = true; clearInterval(t); window.removeEventListener("pharmacy-updated", onUp); };
  }, [hospitalId, from, to]);
  return { rows, loading };
}

function useLabRevenue(from: string, to: string) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let off = false;
    const h = { Authorization: `Bearer ${getToken()}` };
    const j = (p: string) => fetch(`${BASE}${p}`, { headers: h }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    Promise.all([j("/hospital-lab/orders"), j("/hospital-lab/tests")]).then(([o, t]) => {
      if (off) return;
      const key = (s: string) => (s || "").trim().toLowerCase();
      const byId = new Map<string, number>();
      const byName = new Map<string, number>();
      (Array.isArray(t) ? t : []).forEach((x: any) => { byId.set(x.id, x.price ?? 0); byName.set(key(x.name), x.price ?? 0); });
      let sum = 0;
      (Array.isArray(o) ? o : []).forEach((x: any) => {
        if (x.status !== "report_ready") return;
        const d = (x.ordered_at || "").slice(0, 10);
        if (d < from || d > to) return;
        sum += byId.get(x.test_id) ?? byName.get(key(x.test_name)) ?? 0;
      });
      setV(sum);
    });
    return () => { off = true; };
  }, [from, to]);
  return v;
}

function Shell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-full overflow-y-auto bg-white shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-teal-400" />
    </div>
  );
}

function Tbl({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-gray-400 py-10 text-center">{empty}</p>;
  return (
    <div className="overflow-x-auto border border-gray-100 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>{head.map((h) => <th key={h} className="text-left font-medium px-3 py-2 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100">
              {r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PharmacyBillingDrawer({ hospitalId, from, to, onClose }: { hospitalId: string; from: string; to: string; onClose: () => void }) {
  const { rows, loading } = usePharmacyRx(hospitalId, from, to);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("all");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      const okMode = mode === "all" ? true : mode === "tpa" ? /tpa|insur/i.test(r.mode) : r.mode.toLowerCase().includes(mode);
      const okQ = !s || r.patient.toLowerCase().includes(s) || r.patientId.toLowerCase().includes(s) || r.bill.toLowerCase().includes(s) || r.id.toLowerCase().includes(s);
      return okMode && okQ;
    });
  }, [rows, q, mode]);
  const total = shown.reduce((s, r) => s + r.amount, 0);
  return (
    <Shell title="Pharmacy Billing Breakdown" subtitle={`${from} to ${to}`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-3">
        {[["Total pharmacy revenue", rupee(total)], ["Invoices", String(shown.length)], ["Average bill", rupee(shown.length ? total / shown.length : 0)]].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-gray-100 p-3">
            <p className="text-xs text-gray-500">{l}</p>
            <p className="text-lg font-bold text-gray-900">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <SearchBox value={q} onChange={setQ} placeholder="Search patient name, patient ID or bill ID" />
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="all">All</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="tpa">Insurance/TPA</option>
        </select>
      </div>
      <Tbl
        empty={loading ? "Loading..." : "No pharmacy bills in this period"}
        head={["Bill No", "Patient", "Prescribed By", "Medications", "Payment", "Amount (\u20B9)", "Date & Time"]}
        rows={shown.map((r) => [
          <span className="font-medium">{r.bill}</span>,
          <div><p>{r.patient}</p><p className="text-[11px] text-gray-400">{r.patientId}</p></div>,
          r.doctor,
          <div className="flex flex-wrap gap-1">{r.meds.map((m, i) => (
            <span key={i} className="text-[11px] bg-orange-50 text-orange-700 border border-orange-100 rounded px-1.5 py-0.5">{m.name}{m.qty ? ` x${m.qty}` : ""}</span>
          ))}</div>,
          r.mode,
          <span className="font-semibold">{rupee(r.amount)}</span>,
          <span className="whitespace-nowrap">{timeLabel(r.at)}</span>,
        ])}
      />
    </Shell>
  );
}

function TabletsDrawer({ rows, onClose }: { rows: PharmRow[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const m = new Map<string, { name: string; type: string; qty: number }>();
    rows.forEach((r) => r.meds.forEach((x) => {
      const k = x.name.trim().toLowerCase();
      const cur = m.get(k) ?? { name: x.name, type: x.type, qty: 0 };
      cur.qty += x.qty;
      m.set(k, cur);
    }));
    const s = q.trim().toLowerCase();
    return Array.from(m.values()).filter((x) => !s || x.name.toLowerCase().includes(s)).sort((a, b) => b.qty - a.qty);
  }, [rows, q]);
  return (
    <Shell title="Tablets Sold" subtitle="Medicines dispensed in the selected period" onClose={onClose}>
      <SearchBox value={q} onChange={setQ} placeholder="Search medicine" />
      <Tbl
        empty="No medicines dispensed in this period"
        head={["Medicine", "Type", "Batch No", "Qty Sold", "Unit Price", "Total Billed"]}
        rows={items.map((x) => [x.name, x.type, DASH, <span className="font-semibold">{x.qty}</span>, DASH, DASH])}
      />
    </Shell>
  );
}

function PatientsDrawer({ rows, onClose }: { rows: PharmRow[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const shown = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    return !s || r.patient.toLowerCase().includes(s) || r.patientId.toLowerCase().includes(s);
  });
  return (
    <Shell title="Patients Served" subtitle="Patients who received medicines in the selected period" onClose={onClose}>
      <SearchBox value={q} onChange={setQ} placeholder="Search patient name or ID" />
      <Tbl
        empty="No patients served in this period"
        head={["Patient ID", "Patient", "Age & Gender", "Prescribed By", "Dispensed At", "Status"]}
        rows={shown.map((r) => [
          r.patientId, r.patient, DASH, r.doctor,
          <span className="whitespace-nowrap">{timeLabel(r.at)}</span>,
          <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5">Given</span>,
        ])}
      />
    </Shell>
  );
}

// Open the Pharmacy Billing drawer from any page (used by the Billing page chart)
export function openPharmacyDrawer(hospitalId: string, from: string, to: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => setTimeout(() => { root.unmount(); host.remove(); }, 0);
  root.render(createElement(PharmacyBillingDrawer, { hospitalId, from, to, onClose: close }));
}

type Props = {
  hospitalId: string; from: string; to: string; isToday: boolean;
  stats: { patientsServed: number; tabletsSold: number; revenue: number } | null;
  consultRevenue: number;
};

export default function PharmacyAnalytics({ hospitalId, from, to, isToday, stats, consultRevenue }: Props) {
  const { rows } = usePharmacyRx(hospitalId, from, to);
  const lab = useLabRevenue(from, to);
  const [view, setView] = useState<null | "revenue" | "tablets" | "patients">(null);
  const close = () => setView(null);
  const pharmRevenue = stats ? stats.revenue : rows.reduce((s, r) => s + r.amount, 0);
  const slices = [
    { name: "Consultations", value: consultRevenue, color: "#0f766e" },
    { name: "Laboratory", value: lab, color: "#2563eb" },
    { name: "Pharmacy", value: pharmRevenue, color: "#f97316" },
  ];
  const total = slices.reduce((s, x) => s + x.value, 0);
  const cardCls = "bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2 cursor-pointer transition-shadow hover:shadow-md";
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-4">
          <div className={cardCls} onClick={() => setView("revenue")}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{isToday ? "Pharmacy revenue today" : "Pharmacy revenue"}</span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center"><IndianRupee className="w-4 h-4 text-emerald-600" /></div>
            </div>
            <span className="text-3xl font-bold text-gray-900">{stats ? rupee(stats.revenue) : DASH}</span>
          </div>
          <div className={cardCls} onClick={() => setView("tablets")}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{isToday ? "Tablets sold today" : "Tablets sold"}</span>
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center"><Pill className="w-4 h-4 text-orange-600" /></div>
            </div>
            <span className="text-3xl font-bold text-gray-900">{stats ? stats.tabletsSold : DASH}</span>
          </div>
          <div className={cardCls} onClick={() => setView("patients")}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{isToday ? "Patients served today" : "Patients served"}</span>
              <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center"><UserCog className="w-4 h-4 text-teal-600" /></div>
            </div>
            <span className="text-3xl font-bold text-gray-900">{stats ? stats.patientsServed : DASH}</span>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Revenue distribution</span>
            <span className="text-xs text-gray-400">Consultations vs Laboratory vs Pharmacy</span>
          </div>
          {total === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">No revenue in this period</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
              <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
                <ResponsiveContainer>
                  <PieChart className="[&_.recharts-pie-sector]:cursor-pointer [&_.recharts-pie-sector]:transition-opacity [&_.recharts-pie-sector:hover]:opacity-80">
                    <Pie data={slices.filter((s) => s.value > 0)} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105}
                      paddingAngle={2} stroke="none"
                      onClick={(d: any) => { if (d?.name === "Pharmacy") setView("revenue"); }}>
                      {slices.filter((s) => s.value > 0).map((s) => <Cell key={s.name} fill={s.color} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      const pct = total ? Math.round((p.value / total) * 100) : 0;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs shadow-sm">
                          <p className="font-semibold">{p.name} Revenue: {rupee(p.value)} ({pct}% of Total Billing)</p>
                          {p.name === "Pharmacy" && <p className="text-teal-700 text-[10px]">Click to view pharmacy breakdown</p>}
                        </div>
                      );
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-gray-400">Total</span>
                  <span className="text-xl font-bold text-gray-900">{rupee(total)}</span>
                </div>
              </div>
              <ul className="flex-1 w-full space-y-2">
                {slices.map((s) => (
                  <li key={s.name} onClick={s.name === "Pharmacy" ? () => setView("revenue") : undefined}
                    title={s.name === "Pharmacy" ? "Click to view pharmacy breakdown" : undefined}
                    className={`flex items-center gap-2 text-sm ${s.name === "Pharmacy" ? "cursor-pointer rounded -mx-1 px-1 hover:bg-gray-50" : ""}`}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="flex-1 text-gray-600">{s.name}</span>
                    <span className="font-medium">{rupee(s.value)}</span>
                    <span className="text-xs text-gray-400 w-10 text-right">{total ? Math.round((s.value / total) * 100) : 0}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {view === "revenue" && <PharmacyBillingDrawer hospitalId={hospitalId} from={from} to={to} onClose={close} />}
      {view === "tablets" && <TabletsDrawer rows={rows} onClose={close} />}
      {view === "patients" && <PatientsDrawer rows={rows} onClose={close} />}
    </>
  );
}
