import { useState } from "react";
import { toast } from "sonner";
import { Ambulance, MapPin, Phone, User, AlertTriangle, CheckCircle2, Clock, Navigation } from "lucide-react";
import * as api from "../../api";
import type { AmbulanceBooking } from "../../api";
import { useStore } from "../../context/StoreContext";

const EMERGENCY_TYPES = [
  { value: "general",   label: "General Emergency" },
  { value: "cardiac",   label: "Cardiac / Chest Pain" },
  { value: "accident",  label: "Accident / Trauma" },
  { value: "stroke",    label: "Stroke" },
  { value: "maternity", label: "Maternity" },
  { value: "other",     label: "Other" },
];

const STATUS_META: Record<AmbulanceBooking["status"], { label: string; color: string }> = {
  requested:  { label: "Requested",  color: "bg-yellow-100 text-yellow-800" },
  dispatched: { label: "Dispatched", color: "bg-blue-100 text-blue-800" },
  en_route:   { label: "En Route",   color: "bg-indigo-100 text-indigo-800" },
  arrived:    { label: "Arrived",    color: "bg-teal-100 text-teal-800" },
  completed:  { label: "Completed",  color: "bg-green-100 text-green-800" },
  cancelled:  { label: "Cancelled",  color: "bg-red-100 text-red-800" },
};

export default function AmbulancePage() {
  const { user } = useStore();
  const [step, setStep] = useState<"form" | "success">("form");
  const [booked, setBooked] = useState<AmbulanceBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);

  const [form, setForm] = useState({
    patientName:   user?.role === "patient" ? user.name : "",
    phone:         "",
    pickupAddress: "",
    landmark:      "",
    emergencyType: "general",
    latitude:      undefined as number | undefined,
    longitude:     undefined as number | undefined,
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function locateMe() {
    if (!navigator.geolocation) { toast.error("Geolocation not supported on this device"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setForm(f => ({ ...f, latitude, longitude }));
        setAccuracyMeters(accuracy ?? null);

        if (accuracy && accuracy > 100) {
          toast.warning(
            `Location accuracy is low (±${Math.round(accuracy)}m). Please double-check or edit the address below.`
          );
        }

        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const d = await r.json();
          const addr = d.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setForm(f => ({ ...f, pickupAddress: addr }));
        } catch {
          setForm(f => ({ ...f, pickupAddress: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` }));
        }
        setLocating(false);
      },
      (err) => {
        const msg = err.code === err.PERMISSION_DENIED
          ? "Location permission denied. Please allow location access or type your address."
          : "Could not get your precise location. Please type your address.";
        toast.error(msg);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function handleSubmit() {
    if (!form.patientName.trim())   { toast.error("Please enter patient name"); return; }
    if (!form.phone.trim())         { toast.error("Please enter phone number"); return; }
    if (!form.pickupAddress.trim()) { toast.error("Please enter pickup address"); return; }

    setLoading(true);
    try {
      const result = await api.ambulance.book({
        patientName:   form.patientName.trim(),
        phone:         form.phone.trim(),
        pickupAddress: form.pickupAddress.trim(),
        landmark:      form.landmark.trim() || undefined,
        emergencyType: form.emergencyType,
        latitude:      form.latitude,
        longitude:     form.longitude,
      });
      setBooked(result);
      setStep("success");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to book ambulance");
    } finally {
      setLoading(false);
    }
  }

  if (step === "success" && booked) {
    const meta = STATUS_META[booked.status];
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-teal-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Ambulance Booked</h2>
          <p className="text-gray-500 text-sm mb-6">Help is on the way. Keep your phone nearby.</p>

          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
              <span>{booked.pickup_address}</span>
            </div>
            {booked.landmark && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Navigation className="w-4 h-4 text-gray-400" />
                <span>{booked.landmark}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Phone className="w-4 h-4 text-gray-400" />
              <span>{booked.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>{new Date(booked.created_at).toLocaleTimeString()}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-4">Booking ID: {booked.id}</p>

          <button
            type="button"
            onClick={() => { setStep("form"); setBooked(null); }}
            className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Book Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 text-white px-4 py-6">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Ambulance className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Emergency Ambulance</h1>
            <p className="text-red-100 text-sm">Book instantly — help arrives at your location</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Warning banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            For life-threatening emergencies, also call <strong>108</strong> (national ambulance). This service dispatches the nearest available ambulance from our network.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Patient Details</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Patient Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.patientName}
                onChange={e => set("patientName", e.target.value)}
                placeholder="Full name"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contact Phone *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={form.phone}
                onChange={e => set("phone", e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Emergency Type</label>
            <select
              value={form.emergencyType}
              onChange={e => set("emergencyType", e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              {EMERGENCY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Pickup Location</h2>

          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 border border-teal-500 text-teal-600 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-50 transition-colors disabled:opacity-50"
          >
            <Navigation className="w-4 h-4" />
            {locating ? "Detecting location…" : "Use My Current Location"}
          </button>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Address *</label>
            <textarea
              value={form.pickupAddress}
              onChange={e => set("pickupAddress", e.target.value)}
              placeholder="House/flat no., street, area, city…"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Landmark (optional)</label>
            <input
              type="text"
              value={form.landmark}
              onChange={e => set("landmark", e.target.value)}
              placeholder="Near temple, opposite school…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          {form.latitude && (
            <p className={`text-xs flex items-center gap-1 ${accuracyMeters && accuracyMeters > 100 ? "text-amber-600" : "text-teal-600"}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              GPS coordinates captured ({form.latitude.toFixed(4)}, {form.longitude?.toFixed(4)})
              {accuracyMeters ? ` — accuracy ±${Math.round(accuracyMeters)}m` : ""}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold py-4 rounded-2xl text-base transition-colors flex items-center justify-center gap-2"
        >
          <Ambulance className="w-5 h-5" />
          {loading ? "Booking…" : "Book Ambulance Now"}
        </button>

        <p className="text-center text-xs text-gray-400">
          We will call you to confirm dispatch. Keep your phone reachable.
        </p>
      </div>
    </div>
  );
}
