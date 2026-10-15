import { useState, useEffect, useCallback } from "react";
import { useStore } from "../../context/StoreContext";
import { getToken } from "@/api";
import { toast } from "sonner";
import { Pill, HandMetal, ArrowLeft, ChevronDown, History as HistoryIcon, Receipt, Loader2 } from "lucide-react";
import { useRouter } from "../../router/RouterContext";
import { showInvoicePopup } from "../../lib/printInvoice";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

// Given prescriptions older than this many days move into the "Past" view
const PAST_DAYS = 20;
// Text shown on the button at the top right (change it here if you want different wording)
const PAST_LABEL = "Past";

const TIMELINE = [
  { status: "pending", label: "Prescribed", icon: Pill, color: "text-blue-500 bg-blue-50 border-blue-200" },
  { status: "handed_over", label: "Given", icon: HandMetal, color: "text-green-500 bg-green-50 border-green-200" },
];

interface Prescription {
  id: string;
  doctor_name: string;
  hospital_name: string;
  items: { name: string; dosage: string; duration: string; instructions: string; form?: string; quantity?: number; quantityUnit?: string }[];
  notes: string;
  status: string;
  created_at: string;
  packed_at: string | null;
  ready_at: string | null;
  handed_over_at: string | null;
}

function getTimestamp(p: Prescription, status: string): string | null {
  if (status === "pending") return p.created_at;
  if (status === "packed") return p.packed_at;
  if (status === "ready") return p.ready_at;
  if (status === "handed_over") return p.handed_over_at;
  return null;
}

function isReached(current: string, check: string): boolean {
  const order = ["pending", "packed", "ready", "handed_over"];
  return order.indexOf(current) >= order.indexOf(check);
}

const TIME_WORDS = ["morning", "afternoon", "evening", "night"];
function splitInstr(s: string) {
  const parts = (s || "").split(",").map(x => x.trim()).filter(Boolean);
  return {
    times: parts.filter(p => TIME_WORDS.includes(p.toLowerCase())),
    other: parts.filter(p => !TIME_WORDS.includes(p.toLowerCase())),
  };
}

// One medicine row. compact = smaller text for the opened (already given) view.
function MedItems({ p, compact }: { p: Prescription; compact?: boolean }) {
  return (
    <div className="space-y-2.5">
      {p.items.map((item, i) => {
        const ins = splitInstr(item.instructions);
        const fields: [string, string][] = [];
        if (item.dosage) fields.push(["Dosage", item.dosage]);
        if (item.duration) fields.push(["Duration", item.duration]);
        if (ins.times.length > 0) fields.push(["Frequency", `${ins.times.join(", ")} (${ins.times.length}x a day)`]);
        if (item.quantity) fields.push(["Quantity", `${item.quantity} ${item.quantityUnit || ""}`.trim()]);
        if (ins.other.length > 0) fields.push(["Instructions", ins.other.join(", ")]);
        return (
          <div key={i} className="flex items-start gap-2">
            <Pill className={(compact ? "w-3.5 h-3.5" : "w-4 h-4") + " text-teal-500 mt-0.5 shrink-0"} />
            <div className="flex-1 min-w-0">
              <p className={(compact ? "text-[13px]" : "text-sm") + " font-medium text-gray-800"}>{item.name}</p>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {fields.map(([k, v]) => (
                  <span key={k} className={(compact ? "text-[11px]" : "text-xs") + " text-gray-500"}>
                    <span className="text-gray-400">{k}:</span>{" "}
                    <span className="font-medium text-gray-700">{v}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      {p.notes && <p className="text-[11px] text-gray-400 italic">Note: {p.notes}</p>}
    </div>
  );
}

export default function MyPrescriptionsPage() {
  const { user } = useStore();
  const { navigate } = useRouter();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [showPast, setShowPast] = useState(false);

  function toggleOpen(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const [billBusy, setBillBusy] = useState<string | null>(null);
  async function openBill(id: string) {
    setBillBusy(id);
    try {
      const res = await fetch(`${BASE}/pharmacy-module/my-invoice/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error((data as any)?.error || "Bill not available yet"); return; }
      showInvoicePopup(data, { heading: "Pharmacy bill" });
    } catch { toast.error("Could not load the bill"); }
    finally { setBillBusy(null); }
  }

  const fetchPrescriptions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/prescriptions/my`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load prescriptions"); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

  useEffect(() => {
    if (!user) return;
    const WS_BASE = (import.meta.env.VITE_API_URL as string || "http://localhost:4000/api")
      .replace(/^http/, "ws").replace(/\/api$/, "");
    const ws = new WebSocket(`${WS_BASE}/ws?session=patient_${user.id}`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "prescription_update") {
          fetchPrescriptions();
        }
      } catch (_) {}
    };
    return () => ws.close();
  }, [user, fetchPrescriptions]);

  // Past = already given AND older than PAST_DAYS. Anything still pending stays in the live list.
  const isPast = (p: Prescription) =>
    p.status === "handed_over" && Date.now() - new Date(p.created_at).getTime() > PAST_DAYS * 86400000;
  const pastList = prescriptions.filter(isPast);
  const visible = showPast ? pastList : prescriptions.filter(p => !isPast(p));

  return (
    <div className="min-h-screen bg-gray-50 pt-0">
      <div className="bg-white border-b shadow-sm px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => { if (showPast) setShowPast(false); else navigate({ path: "/patient/tokens" }); }}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-teal-600" />
          <h1 className="font-bold text-lg">{showPast ? "Past Prescriptions" : "My Prescriptions"}</h1>
        </div>
        <button
          onClick={() => setShowPast(v => !v)}
          aria-label="Past prescriptions"
          className={"ml-auto flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium " +
            (showPast ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200")}
        >
          <HistoryIcon className="w-4 h-4" />
          <span>{PAST_LABEL}</span>
          {pastList.length > 0 && (
            <span className={"min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center " +
              (showPast ? "bg-white/25 text-white" : "bg-teal-600 text-white")}>
              {pastList.length}
            </span>
          )}
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {showPast && !loading && pastList.length > 0 && (
          <p className="text-[11px] text-gray-400">Given prescriptions older than {PAST_DAYS} days</p>
        )}
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : prescriptions.length === 0 ? (
          <div className="text-center py-16">
            <Pill className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No prescriptions yet.</p>
            <p className="text-gray-300 text-xs mt-1">Prescriptions from your doctor will appear here.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-14">
            <Pill className="w-9 h-9 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{showPast ? "No past prescriptions." : "No recent prescriptions."}</p>
            {!showPast && pastList.length > 0 && (
              <button onClick={() => setShowPast(true)} className="mt-2 text-xs text-teal-600 underline">
                View {pastList.length} past prescription{pastList.length === 1 ? "" : "s"}
              </button>
            )}
          </div>
        ) : visible.map(p => {
          const given = p.status === "handed_over";

          // ---------- GIVEN: small row, tap the date to open the details ----------
          if (given) {
            const d = new Date(p.created_at);
            const isOpen = openIds.has(p.id);
            const n = p.items.length;
            return (
              <div key={p.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleOpen(p.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-gray-50"
                >
                  <div className="w-11 shrink-0 rounded-lg bg-teal-50 border border-teal-100 text-center py-1">
                    <p className="text-base font-bold leading-none text-teal-700">{d.getDate()}</p>
                    <p className="text-[10px] uppercase text-teal-600 mt-0.5">{d.toLocaleDateString("en-GB", { month: "short" })}</p>
                    <p className="text-[9px] text-teal-500 leading-none">{d.getFullYear()}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">Dr. {p.doctor_name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {n} medicine{n === 1 ? "" : "s"}{p.hospital_name ? " \u00b7 " + p.hospital_name : ""}
                    </p>
                  </div>
                  <span className="text-[10px] bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full font-medium shrink-0">Given</span>
                  <ChevronDown className={"w-4 h-4 text-gray-400 shrink-0 transition-transform " + (isOpen ? "rotate-180" : "")} />
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 pt-2 border-t space-y-3 bg-gray-50/40">
                    <MedItems p={p} compact />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-dashed">
                      {TIMELINE.map(({ status, label, icon: Icon }) => {
                        const ts = getTimestamp(p, status);
                        if (!ts) return null;
                        return (
                          <span key={status} className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Icon className="w-3 h-3" />
                            {label}{" "}
                            <span className="text-gray-400">
                              {new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => openBill(p.id)}
                      disabled={billBusy === p.id}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-teal-600 bg-white px-3 py-2 text-sm font-semibold text-teal-700 active:bg-teal-50 disabled:opacity-60"
                    >
                      {billBusy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} View bill
                    </button>
                  </div>
                )}
              </div>
            );
          }

          // ---------- NOT GIVEN YET: big card with full status ----------
          return (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <p className="font-semibold text-sm">Dr. {p.doctor_name}</p>
                <p className="text-xs text-gray-400">{p.hospital_name} {"\u00b7"} {new Date(p.created_at).toLocaleDateString()}</p>
              </div>

              <div className="px-4 py-3">
                <MedItems p={p} />
              </div>

              <div className="px-4 py-3 border-t">
                <p className="text-xs text-gray-400 font-medium mb-3">Status</p>
                <div className="space-y-2">
                  {TIMELINE.map(({ status, label, icon: Icon, color }) => {
                    const reached = isReached(p.status, status);
                    const ts = getTimestamp(p, status);
                    return (
                      <div key={status} className={`flex items-center gap-3 ${reached ? "" : "opacity-30"}`}>
                        <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${reached ? color : "bg-gray-50 border-gray-200"}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-700">{label}</p>
                          {reached && ts && (
                            <p className="text-[10px] text-gray-400">{new Date(ts).toLocaleTimeString()}</p>
                          )}
                        </div>
                        {(p.status === "handed_over" ? "handed_over" : "pending") === status && (
                          <span className="text-[10px] bg-teal-100 text-teal-600 px-2 py-0.5 rounded-full font-medium">Current</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
