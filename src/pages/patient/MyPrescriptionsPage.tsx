import { useState, useEffect, useCallback } from "react";
import { useStore } from "../../context/StoreContext";
import { getToken } from "@/api";
import { toast } from "sonner";
import { Pill, Clock, Package, CheckCircle, HandMetal, ArrowLeft } from "lucide-react";
import { useRouter } from "../../router/RouterContext";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

const TIMELINE = [
  { status: "pending", label: "Prescribed", icon: Pill, color: "text-blue-500 bg-blue-50 border-blue-200" },
  { status: "packed", label: "Medicines Packed", icon: Package, color: "text-yellow-500 bg-yellow-50 border-yellow-200" },
  { status: "ready", label: "Ready for Pickup", icon: CheckCircle, color: "text-green-500 bg-green-50 border-green-200" },
  { status: "handed_over", label: "Handed Over", icon: HandMetal, color: "text-gray-500 bg-gray-50 border-gray-200" },
];

interface Prescription {
  id: string;
  doctor_name: string;
  hospital_name: string;
  items: { name: string; dosage: string; duration: string; instructions: string }[];
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

export default function MyPrescriptionsPage() {
  const { user } = useStore();
  const { navigate } = useRouter();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-gray-50 pt-0">
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <button onClick={() => navigate({ path: "/patient/tokens" })} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-teal-600" />
          <h1 className="font-bold text-lg">My Prescriptions</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : prescriptions.length === 0 ? (
          <div className="text-center py-16">
            <Pill className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No prescriptions yet.</p>
            <p className="text-gray-300 text-xs mt-1">Prescriptions from your doctor will appear here.</p>
          </div>
        ) : prescriptions.map(p => (
          <div key={p.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="font-semibold text-sm">Dr. {p.doctor_name}</p>
              <p className="text-xs text-gray-400">{p.hospital_name} · {new Date(p.created_at).toLocaleDateString()}</p>
            </div>

            {/* Medicines */}
            <div className="px-4 py-3 space-y-2">
              {p.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Pill className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {item.dosage && (
                        <span className="text-xs text-gray-500">
                          <span className="text-gray-400">Dosage:</span>{" "}
                          <span className="font-medium text-gray-700">{item.dosage}</span>
                        </span>
                      )}
                      {item.duration && (
                        <span className="text-xs text-gray-500">
                          <span className="text-gray-400">Duration:</span>{" "}
                          <span className="font-medium text-gray-700">{item.duration}</span>
                        </span>
                      )}
                      {item.instructions && (
                        <span className="text-xs text-gray-500">
                          <span className="text-gray-400">When to take:</span>{" "}
                          <span className="font-medium text-gray-700">{item.instructions}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {p.notes && <p className="text-xs text-gray-400 italic mt-2">Note: {p.notes}</p>}
            </div>

            {/* Timeline */}
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
                      {p.status === status && (
                        <span className="text-[10px] bg-teal-100 text-teal-600 px-2 py-0.5 rounded-full font-medium">Current</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
