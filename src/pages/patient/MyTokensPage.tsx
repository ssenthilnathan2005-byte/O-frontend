import { Button } from "@/components/ui/button";
import { Activity, Calendar, Clock, FlaskConical, Hospital } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import * as api from "../../api";
import type { LabBooking } from "../../api";
import { useStore } from "../../context/StoreContext";
import { hasSessionEndedForDate, getSessionLabelForDate } from "../../data/seed";
import { isLiveBookingStatus, normalizeBookingStatus } from "../../lib/bookingStatus";
import { useRouter } from "../../router/RouterContext";
import type { SessionType } from "../../types";

// Past bookings older than this many days are hidden from the PATIENT view only.
// Nothing is deleted; hospital admin and lab staff still see the full history.
const HIDE_AFTER_DAYS = 6;
// How many past bookings to show before the "Show more" button.
const PAST_PAGE_SIZE = 5;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  confirmed: { label: "In Queue", className: "bg-teal-100 text-teal-700" },
  expired: { label: "Session Expired", className: "bg-gray-100 text-gray-500" },
  completed: { label: "Consultation Done", className: "bg-green-100 text-green-700" },
  unvisited: { label: "Skipped / Not Seen", className: "bg-orange-100 text-orange-700" },
  cancelled: { label: "Session Cancelled", className: "bg-red-100 text-red-700" },
};

const LAB_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  booked: { label: "Booked", className: "bg-teal-100 text-teal-700" },
  technician_assigned: { label: "Technician Assigned", className: "bg-blue-100 text-blue-700" },
  sample_collected: { label: "Sample Collected", className: "bg-blue-100 text-blue-700" },
  processing: { label: "Processing", className: "bg-amber-100 text-amber-700" },
  report_ready: { label: "Report Ready", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700" },
};

// ── date helpers ────────────────────────────────────────────────
function parseDay(d?: string | null): Date | null {
  if (!d) return null;
  const dt = /^\d{4}-\d{2}-\d{2}/.test(d) ? new Date(`${d.slice(0, 10)}T00:00:00`) : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function cutoffDate(): Date {
  const c = new Date();
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - HIDE_AFTER_DAYS);
  return c;
}

// Unknown/unparseable dates are kept visible rather than silently hidden.
function isRecent(d?: string | null): boolean {
  const dt = parseDay(d);
  return !dt || dt >= cutoffDate();
}

function dayLabel(d: string): string {
  const dt = parseDay(d);
  if (!dt) return d;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dt.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function groupByDay<T>(items: T[], getDate: (x: T) => string) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = (getDate(item) || "").slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(key), items: [item] });
  }
  return groups;
}

function DayHeading({ label }: { label: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 pt-2">{label}</h3>;
}

export default function MyTokensPage() {
  const { user, bookings, doctors } = useStore();
  const { navigate } = useRouter();

  const [tab, setTab] = useState<"hospital" | "lab">("hospital");
  const [pastVisible, setPastVisible] = useState(PAST_PAGE_SIZE);
  const [labVisible, setLabVisible] = useState(PAST_PAGE_SIZE);

  const [labBookings, setLabBookings] = useState<LabBooking[]>([]);
  const [labBookingsLoading, setLabBookingsLoading] = useState(true);
  useEffect(() => {
    api.labs.myBookings()
      .then(setLabBookings)
      .catch(() => {})
      .finally(() => setLabBookingsLoading(false));
  }, []);

  function openTokenTracker(sessionId: string, tokenNumber: number) {
    navigate({ path: "/patient/track", sessionId, tokenNumber });
  }

  const FINISHED_STATUSES = new Set(["completed", "unvisited", "cancelled", "confirmed", "booked", "waiting", "live", "checked_in"]);
  const patientId = (user as { id: string }).id;

  const allMyBookings = bookings
    .filter((b) => b.patientId === patientId)
    .sort((a, b) => {
      const timeA = new Date(`${a.date}T00:00:00`).getTime();
      const timeB = new Date(`${b.date}T00:00:00`).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

  const sessionEnded = (b: (typeof allMyBookings)[number]) => {
    const doctor = doctors.find((d) => d.id === b.doctorId);
    return hasSessionEndedForDate(b.date, b.session, (doctor as any)?.scheduleConfig, doctor?.sessionTimings);
  };

  // Live: session not ended yet (cancelled ones go straight to past).
  const liveBookings = allMyBookings.filter((b) => {
    const status = normalizeBookingStatus(b.status);
    if (status === "cancelled") return false;
    if (!FINISHED_STATUSES.has(status) && !isLiveBookingStatus(b.status)) return false;
    return !sessionEnded(b);
  });

  // Past: finished, and not older than HIDE_AFTER_DAYS.
  const pastBookings = allMyBookings.filter((b) => {
    const status = normalizeBookingStatus(b.status);
    if (!FINISHED_STATUSES.has(status)) return false;
    if (!isRecent(b.date)) return false;
    if (status === "cancelled") return true;
    return sessionEnded(b);
  });

  const pastShown = pastBookings.slice(0, pastVisible);
  const pastGroups = groupByDay(pastShown, (b) => b.date);

  // Lab bookings: newest first, hidden once older than HIDE_AFTER_DAYS.
  const recentLab = [...labBookings]
    .filter((b) => isRecent(b.slot_date))
    .sort((a, b) => (parseDay(b.slot_date)?.getTime() ?? 0) - (parseDay(a.slot_date)?.getTime() ?? 0));
  const labShown = recentLab.slice(0, labVisible);
  const labGroups = groupByDay(labShown, (b) => b.slot_date);

  const hospitalCount = liveBookings.length + pastBookings.length;
  const labCount = recentLab.length;

  const tabClass = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-full transition ${
      active ? "bg-teal-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
        <p className="text-gray-500 text-sm mt-1">Track all your booked tokens and appointments</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-full p-1 mb-6 shadow-sm">
        <button type="button" className={tabClass(tab === "hospital")} onClick={() => setTab("hospital")}>
          <Hospital className="w-4 h-4" /> Hospital
          <span className={`text-xs px-1.5 rounded-full ${tab === "hospital" ? "bg-white/25" : "bg-gray-100"}`}>{hospitalCount}</span>
        </button>
        <button type="button" className={tabClass(tab === "lab")} onClick={() => setTab("lab")}>
          <FlaskConical className="w-4 h-4" /> Lab
          <span className={`text-xs px-1.5 rounded-full ${tab === "lab" ? "bg-white/25" : "bg-gray-100"}`}>{labCount}</span>
        </button>
      </div>

      {/* ───────── LAB TAB ───────── */}
      {tab === "lab" && (
        <section className="space-y-3">
          {labBookingsLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-500">Loading lab bookings…</div>
          ) : recentLab.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-500">No lab bookings in the last {HIDE_AFTER_DAYS} days.</div>
          ) : (
            <>
              {labGroups.map((g) => (
                <div key={g.key} className="space-y-2">
                  <DayHeading label={g.label} />
                  {g.items.map((b) => (
                    <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate({ path: "/labs/track", bookingId: b.id })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate({ path: "/labs/track", bookingId: b.id });
                          }
                        }}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 cursor-pointer transition hover:border-sky-200 hover:shadow"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-900">{b.test_name || "Lab Test"}</h4>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${LAB_STATUS_BADGE[b.status]?.className ?? "bg-gray-100 text-gray-600"}`}>
                                {LAB_STATUS_BADGE[b.status]?.label ?? b.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                              <FlaskConical className="w-3 h-3" /> {b.lab_name} · {b.lab_area}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                              <Clock className="w-3 h-3" /> {api.labSessionLabel(b.slot_time)}
                            </div>
                          </div>
                          {b.token_number != null && (
                            <div className="text-right shrink-0 leading-none">
                              <span className="text-sm font-bold italic text-teal-500 mr-0.5">#</span>
                              <span className="text-3xl font-extrabold text-teal-500">{b.token_number}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ))}
              {recentLab.length > labVisible && (
                <Button variant="outline" className="w-full rounded-full" onClick={() => setLabVisible((v) => v + PAST_PAGE_SIZE)}>
                  Show more ({recentLab.length - labVisible} more)
                </Button>
              )}
            </>
          )}
        </section>
      )}

      {/* ───────── HOSPITAL TAB ───────── */}
      {tab === "hospital" &&
        (allMyBookings.length === 0 ? (
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
            {/* Live */}
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
                <div className="space-y-3">
                  {liveBookings.map((booking, idx) => {
                    const doctor = doctors.find((d) => d.id === booking.doctorId) as any;
                    return (
                      <motion.div key={booking.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} data-ocid={`tokens.item.live.${idx + 1}`}>
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
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-gray-900">{booking.doctorName}</h3>
                                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_BADGE[booking.status]?.className ?? "bg-gray-100 text-gray-600"}`}>
                                  {STATUS_BADGE[booking.status]?.label ?? booking.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1.5">
                                <Hospital className="w-3 h-3" /> {booking.hospitalName}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(booking.date)}</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {getSessionLabelForDate(booking.date, booking.session as SessionType, doctor?.scheduleConfig, doctor?.sessionTimings)}
                                </span>
                              </div>
                            </div>
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
                    );
                  })}
                </div>
              )}
            </section>

            {/* Past */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">Past Bookings</h2>
                  <span className="text-sm font-semibold text-gray-500">{pastBookings.length}</span>
                </div>
                <p className="text-xs text-gray-400">Showing the last {HIDE_AFTER_DAYS} days.</p>
              </div>

              {pastBookings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-500">No past bookings in the last {HIDE_AFTER_DAYS} days.</div>
              ) : (
                <>
                  {pastGroups.map((g) => (
                    <div key={g.key} className="space-y-2">
                      <DayHeading label={g.label} />
                      {g.items.map((booking) => {
                        const doctor = doctors.find((d) => d.id === booking.doctorId) as any;
                        const clickable = booking.status !== "cancelled";
                        const note =
                          booking.status === "cancelled" ? { t: "Session was cancelled.", c: "text-orange-600 bg-orange-50 border-orange-100" }
                          : booking.status === "confirmed" ? { t: "This session expired.", c: "text-orange-600 bg-orange-50 border-orange-100" }
                          : booking.status === "unvisited" ? { t: "You were not seen during this session.", c: "text-gray-500 bg-gray-50 border-gray-100" }
                          : booking.status === "completed" ? { t: "Consultation completed successfully.", c: "text-green-600 bg-green-50 border-green-100" }
                          : null;
                        return (
                          <div
                            key={booking.id}
                            data-ocid="tokens.item.past"
                            role={clickable ? "button" : undefined}
                            tabIndex={clickable ? 0 : undefined}
                            onClick={clickable ? () => openTokenTracker(booking.sessionId, booking.tokenNumber) : undefined}
                            onKeyDown={
                              clickable
                                ? (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      openTokenTracker(booking.sessionId, booking.tokenNumber);
                                    }
                                  }
                                : undefined
                            }
                            className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 transition ${clickable ? "cursor-pointer hover:border-teal-200 hover:shadow" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-gray-900">{booking.doctorName}</h4>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[booking.status]?.className ?? "bg-gray-100 text-gray-600"}`}>
                                    {STATUS_BADGE[booking.status]?.label ?? booking.status}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                                  <span className="flex items-center gap-1"><Hospital className="w-3 h-3" /> {booking.hospitalName}</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {getSessionLabelForDate(booking.date, booking.session as SessionType, doctor?.scheduleConfig, doctor?.sessionTimings)}
                                  </span>
                                </div>
                                {note && <p className={`text-xs mt-2 rounded-lg px-2 py-1 border ${note.c}`}>{note.t}</p>}
                              </div>
                              <div className="flex items-baseline gap-0.5 shrink-0">
                                <span className="text-base font-bold text-teal-500">#</span>
                                <span className="text-2xl font-bold text-teal-600">{booking.tokenNumber}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {pastBookings.length > pastVisible && (
                    <Button variant="outline" className="w-full rounded-full" onClick={() => setPastVisible((v) => v + PAST_PAGE_SIZE)}>
                      Show more ({pastBookings.length - pastVisible} more)
                    </Button>
                  )}
                </>
              )}
            </section>
          </div>
        ))}
    </div>
  );
}
