import { useEffect, useState } from "react";
import { CheckCircle, FlaskConical, LogOut, X, XCircle } from "lucide-react";
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FlaskConical className="w-5 h-5 text-teal-600 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight">Lab</h1>
            <p className="text-xs text-gray-500 truncate">{user?.hospitalName}</p>
          </div>
          {pendingCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{pendingCount} pending</span>}
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

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
  );
}