import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ambulance, MapPin, Phone, Clock, RefreshCw, User } from "lucide-react";
import * as api from "../../api";
import type { AmbulanceBooking } from "../../api";

const STATUSES: AmbulanceBooking["status"][] = [
  "requested", "dispatched", "en_route", "arrived", "completed", "cancelled",
];

const STATUS_META: Record<AmbulanceBooking["status"], { label: string; color: string }> = {
  requested:  { label: "Requested",  color: "bg-yellow-100 text-yellow-800" },
  dispatched: { label: "Dispatched", color: "bg-blue-100 text-blue-800" },
  en_route:   { label: "En Route",   color: "bg-indigo-100 text-indigo-800" },
  arrived:    { label: "Arrived",    color: "bg-teal-100 text-teal-800" },
  completed:  { label: "Completed",  color: "bg-green-100 text-green-800" },
  cancelled:  { label: "Cancelled",  color: "bg-red-100 text-red-800" },
};

export default function AdminAmbulance() {
  const [bookings, setBookings] = useState<AmbulanceBooking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | AmbulanceBooking["status"]>("all");

  async function load() {
    setLoading(true);
    try {
      const data = await api.ambulance.listAll();
      setBookings(data);
    } catch (err) {
      toast.error("Failed to load ambulance bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function changeStatus(id: string, status: AmbulanceBooking["status"]) {
    try {
      const updated = await api.ambulance.updateStatus(id, { status });
      setBookings(prev => prev.map(b => b.id === id ? updated : b));
      toast.success(`Status updated to ${STATUS_META[status].label}`);
    } catch (err) {
      toast.error("Failed to update status");
    }
  }

  const shown = filter === "all" ? bookings : bookings.filter(b => b.status === filter);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
            <Ambulance className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ambulance Bookings</h1>
            <p className="text-xs text-gray-500">{bookings.length} total requests</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {(["all", ...STATUSES] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "All" : STATUS_META[s].label}
            {s !== "all" && (
              <span className="ml-1 opacity-70">
                ({bookings.filter(b => b.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No bookings found</div>
      ) : (
        <div className="space-y-3">
          {shown.map(b => {
            const meta = STATUS_META[b.status];
            return (
              <div key={b.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {b.emergency_type.replace("_", " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {b.patient_name}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {b.phone}
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <span className="truncate">{b.pickup_address}</span>
                    </div>
                    {b.landmark && (
                      <p className="text-xs text-gray-400 ml-5">Landmark: {b.landmark}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {new Date(b.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Status changer */}
                  <select
                    value={b.status}
                    onChange={e => changeStatus(b.id, e.target.value as AmbulanceBooking["status"])}
                    className="shrink-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
