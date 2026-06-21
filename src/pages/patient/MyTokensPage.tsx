import { Button } from "@/components/ui/button";
import { Activity, Calendar, Clock, Hospital } from "lucide-react";
import { motion } from "motion/react";
import { useStore } from "../../context/StoreContext";
import { hasSessionEnded, SESSION_TIMES } from "../../data/seed";
import { useRouter } from "../../router/RouterContext";
import type { SessionType } from "../../types";

const STATUS_BADGE: Record<string, { label: string; className: string; description: string }> = {
  confirmed: {
    label: "In Queue",
    className: "bg-teal-100 text-teal-700",
    description: "You are in the queue. Track your token for live updates.",
  },
  expired: {
    label: "Session Expired",
    className: "bg-gray-100 text-gray-500",
    description: "This session expired without any action. Your refund will be credited within 4 to 5 working days.",
  },
  completed: {
    label: "Consultation Done",
    className: "bg-green-100 text-green-700",
    description: "Your consultation was completed.",
  },
  unvisited: {
    label: "Skipped / Not Seen",
    className: "bg-orange-100 text-orange-700",
    description: "Session ended without your token being called. Your refund will be credited within 4 to 5 working days.",
  },
  cancelled: {
    label: "Session Cancelled",
    className: "bg-red-100 text-red-700",
    description: "This session was cancelled. Your refund will be credited within 4 to 5 working days.",
  },
};

export default function MyTokensPage() {
  const { user, bookings, doctors } = useStore();
  const { navigate } = useRouter();

  function openTokenTracker(sessionId: string, tokenNumber: number) {
    navigate({ path: "/patient/track", sessionId, tokenNumber });
  }

  const RETENTION_DAYS = 6;
  const FINISHED_STATUSES = new Set(["completed", "unvisited", "cancelled", "confirmed"]);
  const patientId = (user as { id: string }).id;

  const allMyBookings = bookings
    .filter((b) => b.patientId === patientId)
    .sort((a, b) => {
      const timeA = new Date(`${a.date}T00:00:00`).getTime();
      const timeB = new Date(`${b.date}T00:00:00`).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

  const cutoffDate = new Date();
  cutoffDate.setHours(0, 0, 0, 0);
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  // A booking stays "live" (tracker available, shown at top) until its
  // session has actually ended — not based on this patient's individual
  // status. A token marked "completed" (seen) or "unvisited" (skipped)
  // mid-session should still be trackable while the session is ongoing,
  // since the patient may want to check back on the queue. Cancelled
  // bookings have nothing left to track, so they move to past immediately.
  const liveBookings = allMyBookings.filter((b) => {
    if (b.status === "cancelled") return false;
    if (!FINISHED_STATUSES.has(b.status) && b.status !== "confirmed") return false;
    const doctor = doctors.find((d) => d.id === b.doctorId);
    return !hasSessionEnded(b.date, b.session, doctor?.sessionTimings);
  });
  const pastBookings = allMyBookings.filter((b) => {
    if (!FINISHED_STATUSES.has(b.status)) return false;
    const bookingDate = new Date(`${b.date}T00:00:00`);
    if (bookingDate < cutoffDate) return false;
    if (b.status === "cancelled") return true;
    const doctor = doctors.find((d) => d.id === b.doctorId);
    return hasSessionEnded(b.date, b.session, doctor?.sessionTimings);
  });
  const hiddenPastCount = allMyBookings.filter((b) => {
    if (!FINISHED_STATUSES.has(b.status)) return false;
    const bookingDate = new Date(`${b.date}T00:00:00`);
    return bookingDate < cutoffDate;
  }).length;

  function formatDate(d: string) {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
        <p className="text-gray-500 text-sm mt-1">Track all your booked tokens and appointments</p>
      </div>

      {allMyBookings.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm" data-ocid="tokens.empty_state">
          <Activity className="w-14 h-14 mx-auto mb-4 text-gray-200" />
          <p className="text-xl font-semibold text-gray-900">No appointments yet</p>
          <p className="text-sm text-gray-500 mt-1">Book your first appointment from the hospitals page</p>
          <Button
            className="mt-6 bg-teal-500 hover:bg-teal-600 rounded-full"
            onClick={() => navigate({ path: "/patient/hospitals" })}
            data-ocid="tokens.primary_button"
          >
            Find a Hospital
          </Button>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Live Bookings ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Live Bookings</h2>
              <span className="text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 text-blue-700">
                {liveBookings.length}
              </span>
            </div>

            {liveBookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-500">
                No live bookings in queue right now.
              </div>
            ) : (
              <div className="space-y-4">
                {liveBookings.map((booking, idx) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    data-ocid={`tokens.item.live.${idx + 1}`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openTokenTracker(booking.sessionId, booking.tokenNumber)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openTokenTracker(booking.sessionId, booking.tokenNumber);
                        }
                      }}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 cursor-pointer transition hover:border-teal-200 hover:shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-900">{booking.doctorName}</h3>
                            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_BADGE[booking.status]?.className ?? "bg-gray-100 text-gray-600"}`}>
                              {STATUS_BADGE[booking.status]?.label ?? booking.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1.5">
                            <Hospital className="w-3 h-3" />
                            {booking.hospitalName}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(booking.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {SESSION_TIMES[booking.session as SessionType]?.label}
                            </span>
                          </div>
                        </div>

                        {/* Right: token number + button */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-baseline gap-0.5">
                            <span className="text-lg font-bold text-teal-500">#</span>
                            <span className="text-3xl font-bold text-teal-600">{booking.tokenNumber}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-teal-300 text-teal-600 hover:bg-teal-50 rounded-full text-xs px-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTokenTracker(booking.sessionId, booking.tokenNumber);
                            }}
                            data-ocid={`tokens.secondary_button.live.${idx + 1}`}
                          >
                            Track Token
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* ── Past Bookings ── */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Past Bookings</h2>
                <span className="text-sm font-semibold text-gray-500">{pastBookings.length}</span>
              </div>
              <p className="text-xs text-gray-400">Finished bookings are shown for {RETENTION_DAYS} days only.</p>
            </div>

            {hiddenPastCount > 0 && (
              <p className="text-xs text-gray-500">
                {hiddenPastCount} older finished booking{hiddenPastCount > 1 ? "s" : ""} hidden after {RETENTION_DAYS} days.
              </p>
            )}

            {pastBookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-500">
                No past bookings in the last {RETENTION_DAYS} days.
              </div>
            ) : (
              <div className="space-y-4">
                {pastBookings.map((booking, idx) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    data-ocid={`tokens.item.past.${idx + 1}`}
                  >
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-900">{booking.doctorName}</h3>
                            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_BADGE[booking.status]?.className ?? "bg-gray-100 text-gray-600"}`}>
                              {booking.status === "unvisited" ? "Skipped / Not Seen"
                                : booking.status === "cancelled" ? "Session Cancelled"
                                : STATUS_BADGE[booking.status]?.label ?? booking.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1.5">
                            <Hospital className="w-3 h-3" />
                            {booking.hospitalName}
                          </div>

                          {booking.status === "cancelled" && (
                            <p className="text-xs text-orange-600 mt-1.5 bg-orange-50 rounded-lg px-2 py-1 border border-orange-100">
                              Session was cancelled. Refund will be credited within 4–5 working days.
                            </p>
                          )}
                          {booking.status === "confirmed" && (
                            <p className="text-xs text-orange-600 mt-1.5 bg-orange-50 rounded-lg px-2 py-1 border border-orange-100">
                              This session expired. Refund will be credited within 4–5 working days.
                            </p>
                          )}
                          {booking.status === "unvisited" && (
                            <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded-lg px-2 py-1 border border-gray-100">
                              You were not seen during this session. No refund applicable.
                            </p>
                          )}
                          {booking.status === "completed" && (
                            <p className="text-xs text-green-600 mt-1.5 bg-green-50 rounded-lg px-2 py-1 border border-green-100">
                              Consultation completed successfully.
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(booking.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {SESSION_TIMES[booking.session as SessionType]?.label}
                            </span>
                          </div>

                          {booking.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() => openTokenTracker(booking.sessionId, booking.tokenNumber)}
                              className="mt-3 text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline"
                            >
                              View Tracker (session history)
                            </button>
                          )}
                      </div>
                      <div className="flex items-baseline gap-0.5 shrink-0">
                        <span className="text-lg font-bold text-teal-500">#</span>
                        <span className="text-3xl font-bold text-teal-600">{booking.tokenNumber}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
