import { useEffect, useState } from "react";
import { useLabStatusNotifications } from "../../hooks/useLabStatusNotifications";
import { enablePushNotifications } from "../../lib/push";
import { ArrowLeft, CheckCircle2, Circle, Loader2, FlaskConical, FileText, Home } from "lucide-react";
import * as api from "../../api";
import { useRouter } from "../../router/RouterContext";
import LabQueuePanel from "./LabQueuePanel";

interface Props {
  bookingId: string;
}

const ALL_STEPS: { key: api.LabBooking["status"]; label: string }[] = [
  { key: "booked", label: "Booked" },
  { key: "technician_assigned", label: "Technician Assigned" },
  { key: "sample_collected", label: "Sample Collected" },
  { key: "processing", label: "Processing" },
  { key: "report_ready", label: "Report Ready" },
];

export default function LabTrackingPage({ bookingId }: Props) {
  const { goBack, navigate } = useRouter();
  const [booking, setBooking] = useState<api.LabBooking | null>(null);
  const [loading, setLoading] = useState(true);

  // Request push permission once, so background notifications work
  useEffect(() => { enablePushNotifications(); }, []);

  // Fire system notifications whenever lab status changes
  useLabStatusNotifications(booking);

  useEffect(() => {
    let mounted = true;

    async function fetchStatus() {
      try {
        const bookings = await api.labs.myBookings();
        const found = bookings.find((b) => b.id === bookingId);
        if (mounted && found) setBooking(found);
      } catch {
        // silent — keep last known state on transient errors
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 10_000); // poll every 10s
    return () => { mounted = false; clearInterval(interval); };
  }, [bookingId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading booking status...</p>
      </div>
    );
  }

  if (!booking) return <div className="p-8 text-center text-gray-500">Booking not found.</div>;

  const steps = booking.collection_type === "home" ? ALL_STEPS : ALL_STEPS.filter((x) => x.key !== "technician_assigned");
  const isCancelled = booking.status === "cancelled";
  const currentIndex = steps.findIndex((s) => s.key === booking.status);

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-2 pb-6">
      <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm">{booking.test_name || "Lab Test"}</p>
            <p className="text-xs text-gray-500">{booking.lab_name} · {booking.lab_area}</p>
          </div>
          {booking.token_number != null && (
            <div className="text-center bg-teal-50 border border-teal-100 rounded-xl px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-teal-600 font-semibold">Token</p>
              <p className="text-xl font-extrabold text-teal-700 leading-none">#{booking.token_number}</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
          <span>Date: <span className="text-gray-800 font-medium">{booking.slot_date}</span></span>
          <span>Session: <span className="text-gray-800 font-medium">{api.labSessionLabel(booking.slot_time)}</span></span>
          <span>Type: <span className="text-gray-800 font-medium">{booking.collection_type === "home" ? "Home Collection" : "Walk-in"}</span></span>
          <span>Amount: <span className="text-gray-800 font-medium">₹{booking.price}</span></span>
        </div>
      </div>

      {!isCancelled && <LabQueuePanel booking={booking} />}

      {isCancelled ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <p className="font-semibold text-red-700 text-sm">This booking was cancelled.</p>
          {booking.notes && <p className="text-xs text-red-600 mt-1">{booking.notes}</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Sample Status</p>
          <div className="space-y-0">
            {steps.map((step, idx) => {
              const done = idx <= currentIndex;
              const active = idx === currentIndex;
              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    {done ? (
                      <CheckCircle2 className={`w-5 h-5 ${active ? "text-teal-500" : "text-teal-400"}`} />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300" />
                    )}
                    {idx < steps.length - 1 && (
                      <div className={`w-0.5 h-8 ${done && idx < currentIndex ? "bg-teal-300" : "bg-gray-200"}`} />
                    )}
                  </div>
                  <div className={`pb-8 ${active ? "" : ""}`}>
                    <p className={`text-sm font-medium ${done ? "text-gray-900" : "text-gray-400"}`}>{step.label}</p>
                    {active && <p className="text-xs text-teal-600 mt-0.5">Current status</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {booking.status === "report_ready" && booking.report_url && (
            <a
              href={booking.report_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 w-full bg-teal-500 hover:bg-teal-600 text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" /> View Report
            </a>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate({ path: "/labs" })}
        className="w-full mt-4 border border-gray-200 rounded-full py-3 text-sm font-medium text-gray-600 flex items-center justify-center gap-2 hover:bg-gray-50"
      >
        <Home className="w-4 h-4" /> Back to Labs
      </button>
    </div>
  );
}
