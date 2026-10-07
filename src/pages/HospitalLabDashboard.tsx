import { useEffect, useMemo, useState } from "react";
import { CheckCircle, FlaskConical, LogOut, Phone, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { getToken } from "../api";
import { useStore } from "../context/StoreContext";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Order = {
  id: string; patient_name: string; phone?: string | null; test_name: string; status: string;
  priority: string; result_value: string | null; ordered_at: string;
  slot_date?: string | null; slot_time?: string | null; token_number?: number | null; source?: string | null;
};

const PENDING = ["ordered", "sample_collected", "processing"];
const FILTERS: [string, string][] = [["pending", "Pending"], ["report_ready", "Report ready"], ["cancelled", "Cancelled"], ["all", "All"]];
const BADGE: Record<string, { label: string; cls: string }> = {
  ordered: { label: "Booked", cls: "bg-blue-50 text-blue-700" },
  sample_collected: { label: "Sample collected", cls: "bg-amber-50 text-amber-700" },
  processing: { label: "Processing", cls: "bg-amber-50 text-amber-700" },
  report_ready: { label: "Report ready", cls: "bg-green-50 text-green-700" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-500" },
};
const NEXT: Record<string, { to: string; label: string }> = {
  ordered: { to: "sample_collected", label: "Sample collected" },
  sample_collected: { to: "processing", label: "Start processing" },
};

export default function HospitalLabDashboard() {
  const store = useStore() as any;
  const user = store.user;
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [resultFor, setResultFor] = useState<Order | null>(null);
  const [resultValue, setResultValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"board" | "orders">("board");

  async function call(path: string, method = "GET", body?: any) {
    const res = await fetch(`${BASE}/hospital-lab-staff${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  async function load() {
    try { const d = await call("/orders"); if (Array.isArray(d)) setOrders(d); } catch {}
  }
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  async function update(o: Order, status?: string, resultValue?: string) {
    setBusy(true);
    try {
      await call(`/orders/${o.id}`, "PATCH", { status, resultValue });
      toast.success("Updated");
      await load();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  }
  function logout() {
    if (typeof store.logout === "function") store.logout();
    else { localStorage.clear(); sessionStorage.clear(); window.location.href = "/"; }
  }

  const q = search.toLowerCase();
  const shown = orders.filter((o) => {
    const okStatus = filter === "all" ? true : filter === "pending" ? PENDING.includes(o.status) : o.status === filter;
    return okStatus && (o.patient_name.toLowerCase().includes(q) || o.test_name.toLowerCase().includes(q));
  });
  const pendingCount = orders.filter((o) => PENDING.includes(o.status)).length;

  const tabCls = (on: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-colors ${on ? "bg-teal-500 text-white" : "bg-white text-gray-600 border border-gray-200"}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 text-sm truncate">{user?.hospitalName || "Hospital Lab"}</h1>
            <p className="text-xs text-gray-400">Lab Staff Dashboard</p>
          </div>
          {pendingCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{pendingCount} pending</span>}
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-50">
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("board")} className={tabCls(tab === "board")}>Token Board</button>
        <button type="button" onClick={() => setTab("orders")} className={tabCls(tab === "orders")}>Bookings</button>
      </div>

      {tab === "board" && <TokenBoard orders={orders} busy={busy} update={update} onResult={(o) => { setResultFor(o); setResultValue(o.result_value || ""); }} />}

      {tab === "orders" && (<>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${filter === k ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600"}`}>{l}</button>
        ))}
      </div>
      <Input placeholder="Search patient or test..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {shown.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No orders found.</div>
      ) : (
        <div className="space-y-2">
          {shown.map((o) => {
            const b = BADGE[o.status] || { label: o.status, cls: "bg-gray-100 text-gray-500" };
            const next = NEXT[o.status];
            const open = o.status !== "report_ready" && o.status !== "cancelled";
            return (
              <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{o.patient_name}</p>
                      {o.priority === "urgent" && <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600">Urgent</span>}
                    </div>
                    <p className="text-sm text-gray-500">{o.test_name}</p>
                    {o.source === "patient" && (
                      <p className="text-xs text-teal-700 mt-0.5">
                        {o.slot_date} · {o.slot_time}{o.token_number != null ? ` · Token #${o.token_number}` : ""}{o.phone ? ` · ${o.phone}` : ""}
                      </p>
                    )}
                    {o.result_value && <p className="text-xs text-green-700 mt-1 font-medium">Result: {o.result_value}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${b.cls}`}>{b.label}</span>
                </div>
                {open && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {next && (
                      <button disabled={busy} onClick={() => update(o, next.to)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50">{next.label}</button>
                    )}
                    <button disabled={busy} onClick={() => { setResultFor(o); setResultValue(o.result_value || ""); }}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-700 hover:bg-teal-100">
                      <CheckCircle className="w-3 h-3" /> Add result
                    </button>
                    <button disabled={busy} onClick={() => { if (confirm(`Cancel ${o.test_name} for ${o.patient_name}?`)) update(o, "cancelled"); }}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">
                      <XCircle className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                )}
                {o.status === "report_ready" && (
                  <button onClick={() => { setResultFor(o); setResultValue(o.result_value || ""); }}
                    className="text-xs text-teal-600 hover:underline mt-2">Edit result</button>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {resultFor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold">Enter Result</h2>
              <button onClick={() => setResultFor(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-2">
              <p className="text-sm text-gray-500">{resultFor.patient_name} — {resultFor.test_name}</p>
              <textarea value={resultValue} onChange={(e) => setResultValue(e.target.value)} rows={4}
                placeholder="e.g. Hb: 13.2 g/dL, WBC: 7500..." className="w-full border rounded-md px-3 py-2 text-sm resize-none" />
            </div>
            <div className="px-5 py-3 border-t flex gap-3 justify-end">
              <button onClick={() => setResultFor(null)} className="px-4 py-2 rounded-lg text-sm border">Cancel</button>
              <button disabled={busy} onClick={async () => { await update(resultFor, "report_ready", resultValue); setResultFor(null); }}
                className="px-4 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50">Mark Report Ready</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ── Token board (same idea as the independent lab's Token Control) ───────────
function localDate(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
}
const TOKEN_CLS: Record<string, string> = {
  ordered: "bg-red-50 text-red-600 border-red-300",
  sample_collected: "bg-orange-500 text-white border-orange-600",
  processing: "bg-orange-500 text-white border-orange-600",
  report_ready: "bg-green-100 text-green-700 border-green-400",
  cancelled: "bg-gray-100 text-gray-400 border-gray-300 line-through",
};
const TOKEN_LEGEND: [string, string][] = [
  ["ordered", "Waiting"], ["sample_collected", "In progress"], ["report_ready", "Report ready"], ["cancelled", "Cancelled"],
];
const SESSIONS: [string, string][] = [["morning", "Morning"], ["afternoon", "Afternoon"]];

function TokenBoard({ orders, busy, update, onResult }: {
  orders: Order[]; busy: boolean;
  update: (o: Order, status?: string, resultValue?: string) => Promise<void>;
  onResult: (o: Order) => void;
}) {
  const dates = useMemo(() => [0, 1, 2, 3, 4].map(localDate), []);
  const [date, setDate] = useState(dates[0]);
  const [session, setSession] = useState(new Date().getHours() < 12 ? "morning" : "afternoon");
  const [testName, setTestName] = useState("");
  const [selId, setSelId] = useState<string | null>(null);

  const tokened = orders.filter((o) => o.token_number != null && o.slot_date);
  const tests = Array.from(new Set(tokened.map((o) => o.test_name)));
  const activeTest = tests.includes(testName) ? testName : tests[0] || "";
  const sess = (o: Order) => String(o.slot_time || "").toLowerCase();

  const forDate = tokened.filter((o) => o.test_name === activeTest && o.slot_date === date);
  const inSession = forDate.filter((o) => sess(o) === session).sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
  const testCount = (t: string) => tokened.filter((o) => o.test_name === t && o.slot_date === date && o.status !== "cancelled").length;
  const sessionCount = (k: string) => forDate.filter((o) => sess(o) === k && o.status !== "cancelled").length;
  const countOf = (f: (o: Order) => boolean) => inSession.filter(f).length;
  const sel = selId ? orders.find((o) => o.id === selId) || null : null;
  const next = sel ? NEXT[sel.status] : undefined;
  const open = sel ? sel.status !== "report_ready" && sel.status !== "cancelled" : false;

  const pill = (on: boolean) =>
    `shrink-0 px-3 py-2 rounded-xl border text-sm font-medium ${on ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 bg-white text-gray-600"}`;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">Token Board</h2>
        <p className="text-xs text-gray-500 mt-0.5">Every test has its own tokens for each date and session.</p>
      </div>

      {tests.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No bookings yet. Tokens appear here as patients book.</div>
      ) : (
        <>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Test</p>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {tests.map((t) => (
              <button key={t} type="button" onClick={() => setTestName(t)} className={pill(activeTest === t)}>
                {t} <span className="ml-1 text-xs opacity-70">({testCount(t)})</span>
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Date</p>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {dates.map((d, i) => (
              <button key={d} type="button" onClick={() => setDate(d)} className={pill(date === d)}>
                {i === 0 ? "Today" : new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Session</p>
          <div className="flex gap-2 mb-5">
            {SESSIONS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setSession(k)} className={pill(session === k)}>
                {l} <span className="ml-1 text-xs opacity-70">({sessionCount(k)})</span>
              </button>
            ))}
          </div>

          {inSession.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-gray-400 text-sm">
              No bookings for this test in the {session} session on this date.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex gap-4 mb-4 pb-3 border-b border-gray-100 text-xs text-gray-500">
                <span>Waiting <b className="text-gray-800">{countOf((o) => o.status === "ordered")}</b></span>
                <span>In progress <b className="text-gray-800">{countOf((o) => o.status === "sample_collected" || o.status === "processing")}</b></span>
                <span>Report ready <b className="text-gray-800">{countOf((o) => o.status === "report_ready")}</b></span>
                <span>Total <b className="text-gray-800">{inSession.length}</b></span>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tokens · tap to manage</p>
              <div className="flex flex-wrap gap-2">
                {inSession.map((o) => (
                  <button key={o.id} type="button" onClick={() => setSelId(o.id)} title={o.patient_name}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 text-sm font-semibold transition-all hover:scale-105 ${TOKEN_CLS[o.status] || TOKEN_CLS.ordered}`}>
                    {o.token_number}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4">
                {TOKEN_LEGEND.map(([k, label]) => (
                  <span key={k} className="flex items-center gap-1 text-[11px] text-gray-500">
                    <span className={`w-2.5 h-2.5 rounded-sm border ${TOKEN_CLS[k]}`} /> {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold">Token #{sel.token_number}</h2>
              <button onClick={() => setSelId(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm">
              <p className="font-semibold text-gray-900">{sel.patient_name}</p>
              {sel.phone && <p className="flex items-center gap-1.5 text-gray-600"><Phone className="w-3.5 h-3.5" /> {sel.phone}</p>}
              <p className="text-gray-500">{sel.test_name}</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(BADGE[sel.status] || BADGE.cancelled).cls}`}>
                {(BADGE[sel.status] || { label: sel.status }).label}
              </span>
              {sel.result_value && <p className="text-xs text-green-700 font-medium">Result: {sel.result_value}</p>}
              {sel.status === "cancelled" && <p className="text-xs font-semibold text-red-600">This booking was cancelled.</p>}
            </div>
            <div className="px-5 py-3 border-t flex flex-wrap gap-2 justify-end">
              {open && next && (
                <button disabled={busy} onClick={() => update(sel, next.to)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-60">{next.label} →</button>
              )}
              {sel.status !== "cancelled" && (
                <button disabled={busy} onClick={() => { onResult(sel); setSelId(null); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-teal-50 text-teal-700 hover:bg-teal-100">
                  {sel.status === "report_ready" ? "Edit result" : "Add result"}
                </button>
              )}
              {open && (
                <button disabled={busy} onClick={() => { if (confirm(`Cancel ${sel.test_name} for ${sel.patient_name}?`)) update(sel, "cancelled"); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">Cancel booking</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
