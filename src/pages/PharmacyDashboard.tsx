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
  pending: "Pending",
  packed: "Packed",
  ready: "Ready for Pickup",
  handed_over: "Handed Over",
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

interface Prescription {
  id: string;
  patient_name: string;
  doctor_name: string;
  items: { name: string; dosage: string; duration: string; instructions: string }[];
  notes: string;
  status: PrescStatus;
  created_at: string;
}

export default function PharmacyDashboard() {
  const { user, logout } = useStore();
  const hospitalId = (user as any)?.hospitalId ?? "";
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PrescStatus | "all">("pending");

  const fetchPrescriptions = useCallback(async () => {
    try {
      const url = filter === "all"
        ? `${BASE}/pharmacy/prescriptions?hospitalId=${hospitalId}`
        : `${BASE}/pharmacy/prescriptions?hospitalId=${hospitalId}&status=${filter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load prescriptions"); }
    finally { setLoading(false); }
  }, [hospitalId, filter]);

  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

  async function updateStatus(id: string, status: PrescStatus) {
    try {
      const res = await fetch(`${BASE}/pharmacy/prescriptions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const e = await res.json(); return toast.error(e.error ?? "Failed"); }
      toast.success(`Marked as ${STATUS_LABELS[status]}`);
      fetchPrescriptions();
    } catch { toast.error("Network error"); }
  }

  const filtered = filter === "all" ? prescriptions : prescriptions.filter(p => p.status === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-teal-600" />
          <div>
            <p className="font-bold text-sm">Pharmacy Dashboard</p>
            <p className="text-xs text-gray-400">{(user as any)?.hospitalName ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchPrescriptions} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={logout} className="text-gray-400 hover:text-red-500">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {(["pending", "packed", "ready", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              filter === f ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {f === "all" ? "All" : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Prescriptions list */}
      <div className="px-4 space-y-3 pb-8">
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No prescriptions found.</p>
        ) : filtered.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{p.patient_name}</p>
                  <p className="text-xs text-gray-400">Dr. {p.doctor_name} · {new Date(p.created_at).toLocaleTimeString()}</p>
                </div>
                <Badge className={`text-xs border ${STATUS_COLORS[p.status]}`}>
                  {STATUS_LABELS[p.status]}
                </Badge>
              </div>

              {/* Medicines */}
              <div className="space-y-1">
                {p.items.map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {[item.dosage, item.duration, item.instructions].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ))}
              </div>

              {p.notes && (
                <p className="text-xs text-gray-500 italic">Note: {p.notes}</p>
              )}

              {NEXT_ACTION[p.status] && (
                <Button
                  className="w-full h-9 text-sm"
                  onClick={() => updateStatus(p.id, NEXT_ACTION[p.status].next)}
                >
                  {(() => { const Icon = NEXT_ACTION[p.status].icon; return <Icon className="w-4 h-4 mr-2" />; })()}
                  {NEXT_ACTION[p.status].label}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
