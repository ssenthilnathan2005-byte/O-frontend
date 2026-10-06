import { useState, useEffect, useCallback } from "react";
import { useStore } from "../context/StoreContext";
import { getToken } from "@/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pill, LogOut, RefreshCw, HandMetal, Search, Inbox } from "lucide-react";

// pharmacy-layout-v2
const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type PrescStatus = "pending" | "packed" | "ready" | "handed_over";

interface RxItem { name: string; dosage: string; duration: string; instructions: string }
interface Prescription {
  id: string; patient_name: string; doctor_name: string; items: RxItem[];
  notes: string; status: PrescStatus; created_at: string; dispensed_items?: string | null;
}
interface StockItem { id: string; name: string; unit: string; quantity: number; pack_size: number }
interface Plan { itemId: string; qty: string; reason: string }

// tablets = tablets per dose x doses per day x days
function calcTablets(item: RxItem): number {
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
const tabletsAvailable = (s: StockItem) => Math.floor(s.quantity * (s.pack_size || 1) + 1e-6);

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
function whenLabel(iso: string) {
  const d = new Date(iso);
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return isToday(iso) ? t : `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${t}`;
}
const splitList = (s: string) => (s || "").split(",").map(x => x.trim()).filter(Boolean);

function Chip({ text }: { text: string }) {
  return <span className="text-xs bg-white border border-gray-200 text-gray-700 rounded-full px-2 py-0.5">{text}</span>;
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
  const [filter, setFilter] = useState<"received" | "given">("received");
  const [openStock, setOpenStock] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const headers = { Authorization: `Bearer ${getToken()}` };

  const fetchPrescriptions = useCallback(async () => {
    try {
      const url = `${BASE}/pharmacy/prescriptions?hospitalId=${hospitalId}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load prescriptions"); }
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

  function getHo(pid: string, i: number, max: number) {
    return handover[pid]?.[i] ?? { qty: String(max), reason: "" };
  }
  function setHo(pid: string, i: number, max: number, patch: Partial<{ qty: string; reason: string }>) {
    const base = getHo(pid, i, max);
    setHandover(prev => ({ ...prev, [pid]: { ...(prev[pid] ?? {}), [i]: { ...base, ...patch } } }));
  }

  // One tap: runs packed -> ready -> handed_over in order, skipping steps already done.
  async function markGiven(p: Prescription) {
    if (busy) return;
    const dispense: any[] = [];
    let handoverPayload: any[] = [];
    if (p.status === "pending") {
      for (let i = 0; i < p.items.length; i++) {
        const pl = getPlan(p, i);
        if (!pl.itemId) continue;
        const st = stock.find(s => s.id === pl.itemId);
        const qty = Number(pl.qty);
        if (!(qty > 0)) return toast.error(`Enter a quantity for ${p.items[i].name}`);
        if (st && qty > tabletsAvailable(st)) return toast.error(`Only ${tabletsAvailable(st)} available for ${st.name}`);
        dispense.push({ index: i, inventoryItemId: pl.itemId, quantity: qty, reason: pl.reason });
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
      await send("handed_over", { handover: handoverPayload });
      toast.success("Marked as Given");
    } catch (err: any) {
      toast.error(err?.message || "Network error");
    } finally {
      setBusy(null);
      fetchPrescriptions();
      fetchStock();
    }
  }

  const receivedList = prescriptions.filter(p => p.status !== "handed_over");
  const givenList = prescriptions.filter(p => p.status === "handed_over");
  const q = query.trim().toLowerCase();
  const shown = (filter === "given" ? givenList : receivedList)
    .filter(p => !q || (p.patient_name || "").toLowerCase().includes(q))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const groups: { label: string; items: Prescription[] }[] = filter === "given"
    ? [
        { label: "Today", items: shown.filter(p => isToday(p.created_at)) },
        { label: "Earlier", items: shown.filter(p => !isToday(p.created_at)) },
      ].filter(g => g.items.length > 0)
    : [{ label: "", items: shown }];

  function renderCard(p: Prescription) {
    const editable = p.status === "pending";
    const isGiven = p.status === "handed_over";
    let dispensed: any[] = [];
    try { dispensed = p.dispensed_items ? JSON.parse(p.dispensed_items) : []; } catch {}
    return (
      <Card key={p.id}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-base truncate">{p.patient_name}</p>
              <p className="text-xs text-gray-400">Dr. {p.doctor_name} {"\u00b7"} {whenLabel(p.created_at)}</p>
            </div>
            <Badge className={`text-xs border shrink-0 ${isGiven
              ? "bg-gray-100 text-gray-500 border-gray-200"
              : "bg-yellow-100 text-yellow-800 border-yellow-200"}`}>
              {isGiven ? "Given" : "Received"}
            </Badge>
          </div>

          <div className="rounded-lg bg-gray-50 divide-y divide-gray-200">
            {p.items.map((item, i) => {
              const suggested = calcTablets(item);
              const pl = getPlan(p, i);
              const st = stock.find(s => s.id === pl.itemId);
              const qty = Number(pl.qty);
              const short = st && qty > tabletsAvailable(st);
              const reduced = qty > 0 && qty < suggested;
              const key = p.id + "-" + i;
              const open = !!openStock[key];
              return (
                <div key={i} className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{item.name}</p>
                    {!isGiven && <span className="text-xs text-teal-700 whitespace-nowrap">{suggested} tablets</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.dosage && <Chip text={item.dosage} />}
                    {item.duration && <Chip text={item.duration} />}
                    {splitList(item.instructions).map((t, n) => <Chip key={`${t}-${n}`} text={t} />)}
                  </div>

                  {editable && (
                    <div className="space-y-2 pt-0.5">
                      <button type="button"
                        onClick={() => setOpenStock(prev => ({ ...prev, [key]: !open }))}
                        className="text-xs text-teal-700 underline">
                        {open ? "Hide stock options" : "Deduct from stock (optional)"}
                      </button>
                      {!open && st && qty > 0 && (
                        <p className="text-xs text-gray-500">{qty} tablets will be deducted from {st.name}</p>
                      )}
                      {open && (
                        <div className="space-y-2">
                          <select value={pl.itemId} onChange={e => setPlan(p, i, { itemId: e.target.value })}
                            className="w-full border rounded-md text-xs px-2 py-1.5 bg-white">
                            <option value="">Don't deduct from stock</option>
                            {stock.map(s => <option key={s.id} value={s.id}>{s.name} ({tabletsAvailable(s)} tablets in stock)</option>)}
                          </select>
                          {pl.itemId && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500">Give</label>
                              <input type="number" min={1} value={pl.qty}
                                onChange={e => setPlan(p, i, { qty: e.target.value })}
                                className="w-20 border rounded-md text-sm px-2 py-1 bg-white" />
                              <span className="text-xs text-gray-500">tablets</span>
                            </div>
                          )}
                          {reduced && pl.itemId && (
                            <input placeholder="Reason for reducing (e.g. patient can't afford)" value={pl.reason}
                              onChange={e => setPlan(p, i, { reason: e.target.value })}
                              className="w-full border rounded-md text-xs px-2 py-1.5 bg-white" />
                          )}
                          {short && <p className="text-xs text-red-600">Not enough stock: only {tabletsAvailable(st!)} available.</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isGiven && dispensed.length > 0 && (
            <p className="text-xs text-gray-500">
              Handed over: {dispensed.map(d => `${d.inventoryName} \u00d7${d.tablets}`).join(", ")}
              {dispensed.some(d => d.returned) ? " (some returned to stock)" : ""}
            </p>
          )}

          {!editable && !isGiven && dispensed.length > 0 && (
            <div className="text-xs text-gray-500 space-y-0.5">
              {dispensed.map((d, i) => (
                <div key={i} className="space-y-1">
                  <p>Dispensed <b>{d.tablets}</b> {"\u00d7"} {d.inventoryName}{d.reduced ? ` (reduced from ${d.suggested})` : ""}</p>
                  {p.status === "ready" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Patient takes</span>
                        <input type="number" min={0} max={d.tablets} value={getHo(p.id, i, d.tablets).qty}
                          onChange={e => setHo(p.id, i, d.tablets, { qty: e.target.value })}
                          className="w-20 border rounded-md text-sm px-2 py-1 bg-white" />
                        <span className="text-xs text-gray-600">of {d.tablets} tablets</span>
                      </div>
                      {Number(getHo(p.id, i, d.tablets).qty) < d.tablets && (
                        <input placeholder="Reason (e.g. patient needs fewer)" value={getHo(p.id, i, d.tablets).reason}
                          onChange={e => setHo(p.id, i, d.tablets, { reason: e.target.value })}
                          className="w-full border rounded-md text-xs px-2 py-1.5 bg-white" />
                      )}
                      {Number(getHo(p.id, i, d.tablets).qty) < d.tablets && (
                        <p className="text-xs text-amber-700">{d.tablets - Number(getHo(p.id, i, d.tablets).qty || 0)} tablets will be returned to stock.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {p.notes && <p className="text-xs text-gray-500 italic">Note: {p.notes}</p>}

          {!isGiven && (
            <div className="border-t pt-3">
              <Button className="w-full h-10 text-sm" disabled={busy === p.id} onClick={() => markGiven(p)}>
                <HandMetal className="w-4 h-4 mr-2" />
                {busy === p.id ? "Please wait..." : "Mark Given"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-teal-600" />
          <div>
            <p className="font-bold text-sm">Pharmacy Dashboard</p>
            <p className="text-xs text-gray-400">{(user as any)?.hospitalName ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchPrescriptions(); fetchStock(); }} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={logout} className="text-gray-400 hover:text-red-500">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        <div className="flex gap-2">
          {(["received", "given"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
                filter === f ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200"}`}>
              {f === "received" ? `Received (${receivedList.length})` : `Given (${givenList.length})`}
            </button>
          ))}
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
        ) : groups.map(g => (
          <div key={g.label || "all"} className="space-y-3">
            {g.label && <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{g.label}</p>}
            {g.items.map(renderCard)}
          </div>
        ))}
      </div>
    </div>
  );
}
