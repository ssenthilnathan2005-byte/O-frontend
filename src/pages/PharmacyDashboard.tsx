import { useState, useEffect, useCallback } from "react";
import { useStore } from "../context/StoreContext";
import { getToken } from "@/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pill, LogOut, RefreshCw, CheckCircle, Package, HandMetal } from "lucide-react";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

const STATUS_FLOW = ["pending", "packed", "ready", "handed_over"] as const;
type PrescStatus = typeof STATUS_FLOW[number];

const STATUS_LABELS: Record<PrescStatus, string> = {
  pending: "Pending", packed: "Packed", ready: "Ready for Pickup", handed_over: "Handed Over",
};
const STATUS_COLORS: Record<PrescStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  packed: "bg-blue-100 text-blue-800 border-blue-200",
  ready: "bg-green-100 text-green-800 border-green-200",
  handed_over: "bg-gray-100 text-gray-500 border-gray-200",
};
const NEXT_ACTION: Record<string, { label: string; next: PrescStatus; icon: any }> = {
  pending: { label: "Mark Packed", next: "packed", icon: Package },
  packed: { label: "Mark Ready", next: "ready", icon: CheckCircle },
  ready: { label: "Hand Over", next: "handed_over", icon: HandMetal },
};

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

  async function updateStatus(p: Prescription, status: PrescStatus) {
    if (busy) return;
    let dispense: any[] | undefined;
    if (status === "packed") {
      dispense = [];
      for (let i = 0; i < p.items.length; i++) {
        const pl = getPlan(p, i);
        if (!pl.itemId) continue;
        const st = stock.find(s => s.id === pl.itemId);
        const qty = Number(pl.qty);
        if (!(qty > 0)) return toast.error(`Enter a quantity for ${p.items[i].name}`);
        if (st && qty > tabletsAvailable(st)) return toast.error(`Only ${tabletsAvailable(st)} available for ${st.name}`);
        dispense.push({ index: i, inventoryItemId: pl.itemId, quantity: qty, reason: pl.reason });
      }
    }
    let handoverPayload: any[] | undefined;
    if (status === "handed_over") {
      let lines: any[] = [];
      try { lines = p.dispensed_items ? JSON.parse(p.dispensed_items) : []; } catch {}
      handoverPayload = [];
      for (let i = 0; i < lines.length; i++) {
        const h = getHo(p.id, i, lines[i].tablets);
        const q = Number(h.qty);
        if (!(q >= 0) || q > lines[i].tablets) return toast.error(`Enter 0 to ${lines[i].tablets} for ${lines[i].inventoryName}`);
        handoverPayload.push({ line: i, quantity: q, reason: h.reason });
      }
    }
    setBusy(p.id);
    try {
      const res = await fetch(`${BASE}/pharmacy/prescriptions/${p.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ status, dispense, handover: handoverPayload }),
      });
      if (!res.ok) { const e = await res.json(); return toast.error(e.error ?? "Failed"); }
      toast.success(`Marked as ${STATUS_LABELS[status]}`);
      fetchPrescriptions();
      fetchStock();
    } catch { toast.error("Network error"); }
    finally { setBusy(null); }
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

  // old step-by-step flow, no longer used by the buttons
  void updateStatus; void NEXT_ACTION;

  const filtered = prescriptions.filter(p =>
    filter === "given" ? p.status === "handed_over" : p.status !== "handed_over");

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

      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {(["received", "given"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              filter === f ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {f === "received" ? "Received" : "Given"}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3 pb-8">
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No prescriptions found.</p>
        ) : filtered.map(p => {
          const editable = p.status === "pending";
          let dispensed: any[] = [];
          try { dispensed = p.dispensed_items ? JSON.parse(p.dispensed_items) : []; } catch {}
          return (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{p.patient_name}</p>
                    <p className="text-xs text-gray-400">Dr. {p.doctor_name} · {new Date(p.created_at).toLocaleTimeString()}</p>
                  </div>
                  <Badge className={`text-xs border ${STATUS_COLORS[p.status]}`}>{p.status === "handed_over" ? "Given" : "Received"}</Badge>
                </div>

                <div className="space-y-2">
                  {p.items.map((item, i) => {
                    const suggested = calcTablets(item);
                    const pl = getPlan(p, i);
                    const st = stock.find(s => s.id === pl.itemId);
                    const qty = Number(pl.qty);
                    const short = st && qty > tabletsAvailable(st);
                    const reduced = qty > 0 && qty < suggested;
                    return (
                      <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 space-y-2">
                        <p className="text-sm font-medium">{item.name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {item.dosage && <span className="text-xs text-gray-500"><span className="text-gray-400">Dosage:</span> <span className="font-medium text-gray-700">{item.dosage}</span></span>}
                          {item.duration && <span className="text-xs text-gray-500"><span className="text-gray-400">Duration:</span> <span className="font-medium text-gray-700">{item.duration}</span></span>}
                          {item.instructions && <span className="text-xs text-gray-500"><span className="text-gray-400">When:</span> <span className="font-medium text-gray-700">{item.instructions}</span></span>}
                        </div>

                        {editable && (
                          <div className="border-t pt-2 space-y-1">
                            <button type="button"
                              onClick={() => setOpenStock(prev => ({ ...prev, [p.id + "-" + i]: !prev[p.id + "-" + i] }))}
                              className="text-xs text-teal-700 underline">
                              {openStock[p.id + "-" + i] ? "Hide stock options" : "Deduct from stock (optional)"}
                            </button>
                            {!openStock[p.id + "-" + i] && st && qty > 0 && (
                              <p className="text-xs text-gray-500">{qty} tablets will be deducted from {st.name}</p>
                            )}
                            {openStock[p.id + "-" + i] && (
                          <div className="space-y-2">
                            <p className="text-xs text-teal-700">Calculated: <b>{suggested}</b> tablets</p>
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

                {!editable && dispensed.length > 0 && (
                  <div className="text-xs text-gray-500 space-y-0.5">
                    {dispensed.map((d, i) => (
                      <div key={i} className="space-y-1">
                        <p>Dispensed <b>{d.tablets}</b> × {d.inventoryName}{d.reduced ? ` (reduced from ${d.suggested})` : ""}{d.returned ? ` - patient took ${d.tablets}, ${d.returned} returned to stock` : ""}</p>
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

                {p.status !== "handed_over" && (
                  <Button className="w-full h-9 text-sm" disabled={busy === p.id}
                    onClick={() => markGiven(p)}>
                    <HandMetal className="w-4 h-4 mr-2" />
                    {busy === p.id ? "Please wait..." : "Mark Given"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
