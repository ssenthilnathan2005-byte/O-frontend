import {
  Activity, AlertCircle, ArrowLeft, Calendar,
  CheckCircle, Clock, X,
} from "lucide-react";
import { motion } from "motion/react";
import React, { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { hasSessionEnded, SESSION_TIMES } from "../../data/seed";
import { useRouter } from "../../router/RouterContext";
import type { SessionType, TokenStatus } from "../../types";
import { useQueueNotifications } from "../../hooks/useQueueNotifications";

const TOKEN_CLASSES: Record<TokenStatus, string> = {
  white:    "bg-gray-100 border-2 border-gray-200 text-gray-400",
  red:      "token-red",
  orange:   "token-orange",
  yellow:   "token-yellow",
  green:    "token-green",
  unvisited:"bg-gray-100 border-2 border-gray-200 text-gray-400",
};

const STATUS_LABELS: Record<TokenStatus, string> = {
  white:    "Available",
  red:      "Booked",
  orange:   "Ongoing",
  yellow:   "Next Up",
  green:    "Completed",
  unvisited:"Unvisited",
};

interface Props {
  sessionId: string;
  tokenNumber: number;
}

export default function TokenTrackerPage({ sessionId, tokenNumber }: Props) {
  const { goBack } = useRouter();
  const { tokenStates, bookings, doctors, refreshFromStorage, getOrCreateTokenState } = useStore();

  // Warning popup shown every time the page is opened
  const [showWarningPopup, setShowWarningPopup] = useState(true);
  // "You're Next" banner (dismissable)
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const booking = bookings.find(
    (b) => b.sessionId === sessionId && b.tokenNumber === tokenNumber,
  );

  // Show loading state if booking data hasn't loaded yet (free hospital race condition protection)
  if (!booking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="text-center py-20">
          <div className="animate-spin inline-block mb-4">
            <Activity className="w-12 h-12 text-teal-500" />
          </div>
          <p className="text-lg font-semibold text-gray-900">Loading your booking details...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait, redirecting to tracker</p>
        </div>
      </div>
    );
  }

  // The "stay on this page, don't close the app" warning only makes sense
  // for a live, ongoing session. For a past booking the patient is just
  // looking back at history, so this popup shouldn't appear at all.
  const doctorForSession = doctors.find((d) => d.id === booking?.doctorId);
  const isPastSession = booking
    ? hasSessionEnded(booking.date, booking.session, doctorForSession?.sessionTimings)
    : false;

  useEffect(() => {
    getOrCreateTokenState(
      sessionId,
      booking?.doctorId ?? "",
      booking?.date ?? "",
      booking?.session ?? "morning",
    );
    const id = setInterval(refreshFromStorage, 5000);
    return () => clearInterval(id);
  }, [sessionId, booking?.doctorId, booking?.date, booking?.session, getOrCreateTokenState, refreshFromStorage]);

  const tokenState = tokenStates[sessionId];
  const doctor = booking ? doctors.find((d) => d.id === booking.doctorId) : null;
  const maxTokens = doctor?.tokensPerSession ?? 30;
  const statuses = tokenState?.tokenStatuses ?? {};
  const myStatus: TokenStatus = (statuses[tokenNumber] as TokenStatus) ?? "red";

  useEffect(() => {
    if (myStatus !== "yellow") setBannerDismissed(false);
  }, [myStatus]);

  const completedFromStatuses = Object.values(statuses).filter((s) => s === "green").length;
  const totalBookedFromStatuses = Object.values(statuses).filter((s) => s !== "white").length;
  const ongoingTokenFromStatuses = Object.entries(statuses).find(([, s]) => s === "orange")?.[0];
  const sessionBookings = bookings.filter((b) => b.sessionId === sessionId);

  const completedCount = Math.max(completedFromStatuses, sessionBookings.filter((b) => b.status === "completed").length);
  const totalBookedCount = Math.max(totalBookedFromStatuses, sessionBookings.length);
  const nowSeeingToken = tokenState?.currentToken ?? (ongoingTokenFromStatuses ? Number(ongoingTokenFromStatuses) : null);

  const tokensAheadFromStatuses = ongoingTokenFromStatuses
    ? Object.entries(statuses).filter(([n, s]) => (s === "red" || s === "yellow") && Number(n) < tokenNumber).length
    : 0;
  const tokensAheadFromCurrent = nowSeeingToken !== null ? Math.max(tokenNumber - nowSeeingToken - 1, 0) : null;
  const tokensAhead = myStatus === "green" || myStatus === "orange"
    ? 0
    : (tokensAheadFromCurrent ?? tokensAheadFromStatuses);

  useQueueNotifications(
    sessionId, tokenNumber, myStatus, nowSeeingToken,
    booking?.doctorName, booking?.hospitalName,
  );

  function getStatusMsg() {
    switch (myStatus) {
      case "green":   return { text: "Your consultation is complete.", color: "text-green-600", bg: "bg-green-50 border-green-200" };
      case "orange":  return { text: "You are currently being seen by the doctor!", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" };
      case "yellow":  return { text: "You're next! Please be ready at the counter.", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" };
      case "red":     return { text: `You're in the queue. ${tokensAhead} token${tokensAhead !== 1 ? "s" : ""} ahead.`, color: "text-teal-600", bg: "bg-teal-50 border-teal-200" };
      case "unvisited": return { text: "Session closed. Refund will be processed.", color: "text-red-600", bg: "bg-red-50 border-red-200" };
      default:        return { text: "", color: "", bg: "" };
    }
  }

  const msg = getStatusMsg();
  const showNextBanner = myStatus === "yellow" && !bannerDismissed;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">

      {/* ── "You're Next!" top notification (Image 2) ── */}
      {showNextBanner && (
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-4 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3"
        >
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-white text-xs">✓</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-green-800 flex items-center gap-1.5">
              🔔 You're Next!
            </p>
            <p className="text-sm text-green-700 mt-0.5">
              Token #{tokenNumber} at {booking?.hospitalName}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Amber "You're Next at the Counter" dismissable alert (Image 2) ── */}
      {showNextBanner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-amber-900">You're Next at the Counter</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Token #{tokenNumber} will be called shortly. Please stay ready.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="text-amber-600 hover:text-amber-800 ml-1"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Back link */}
      <button
        type="button"
        onClick={goBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5"
        data-ocid="tracker.button"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> My Bookings
      </button>

      {/* ── Tracker header card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
        {/* LIVE badge */}
        <div className="flex items-center gap-3 mb-4">
          <span className="animate-pulse bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            LIVE
          </span>
          <span className="text-xs text-gray-400">Updates every 5 seconds</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Live Queue Tracker</h1>
            {booking && (
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  {booking.doctorName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {booking.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {SESSION_TIMES[booking.session as SessionType]?.label}
                </span>
              </div>
            )}
          </div>

          {/* Your token badge */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center min-w-[110px] shrink-0">
            <p className="text-xs font-bold text-teal-500 tracking-widest uppercase">Your Token</p>
            <p className="text-4xl font-bold text-teal-600 mt-1">#{tokenNumber}</p>
            <span className={`inline-block mt-1.5 text-xs font-semibold px-3 py-0.5 rounded-full ${
              myStatus === "green"  ? "bg-green-100 text-green-700" :
              myStatus === "orange" ? "bg-orange-100 text-orange-700" :
              myStatus === "yellow" ? "bg-amber-100 text-amber-700" :
              "bg-teal-100 text-teal-700"
            }`}>
              {STATUS_LABELS[myStatus]}
            </span>
          </div>
        </div>
      </div>

      {/* ── Queue Position status ── */}
      <div className={`rounded-2xl border p-5 mb-4 ${msg.bg}`}>
        <h3 className="font-bold text-gray-900 mb-1">Your Queue Position</h3>
        <p className={`text-sm font-medium ${msg.color}`}>{msg.text}</p>
      </div>

      {/* ── Queue Board ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
        <h2 className="font-bold text-gray-900 mb-3">Queue Board</h2>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
          {([
            ["#e2e8f0", "Available"],
            ["#ef4444", "Booked"],
            ["#f97316", "Ongoing"],
            ["#fbbf24", "Next Up"],
            ["#22c55e", "Completed"],
          ] as [string, string][]).map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
        {/* Token grid */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {Array.from({ length: maxTokens }, (_, i) => i + 1).map((n) => {
            const st: TokenStatus = (statuses[n] as TokenStatus) ?? "white";
            const isMe = n === tokenNumber;
            const prioritySlots = tokenState?.prioritySlots ?? {};
            const elements: React.ReactNode[] = [];

            elements.push(
              <div
                key={n}
                className={`relative w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                  TOKEN_CLASSES[st] ?? "token-white"
                } ${isMe ? "ring-4 ring-blue-500 ring-offset-1 scale-110" : ""}`}
                title={STATUS_LABELS[st]}
              >
                {n}
                {isMe && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
            );

            const effectiveWalkInInterval = doctor?.walkInInterval && doctor.walkInInterval > 0 ? doctor.walkInInterval : 5;
            if (n % effectiveWalkInInterval === 0 && n < maxTokens) {
              const slotIndex = n / effectiveWalkInInterval;
              const ps = prioritySlots[slotIndex];
              const slotStatus = ps?.status ?? "waiting";
              elements.push(
                <div key={`ps_${slotIndex}`} className="col-span-5 sm:col-span-10">
                  <div className={`w-full py-2 px-3 rounded-xl border-2 border-dashed text-xs font-semibold flex items-center justify-between ${
                    slotStatus === "completed"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : slotStatus === "ongoing"
                        ? "bg-orange-50 border-orange-200 text-orange-700"
                        : "bg-blue-50 border-blue-200 text-blue-700"
                  }`}>
                    <span>⚡ Walk-in Patient Slot W{slotIndex}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      slotStatus === "completed"
                        ? "bg-green-200 text-green-800"
                        : slotStatus === "ongoing"
                          ? "bg-orange-200 text-orange-800"
                          : "bg-blue-200 text-blue-800"
                    }`}>
                      {slotStatus === "completed" ? "Completed" : slotStatus === "ongoing" ? "Ongoing" : "Waiting"}
                    </span>
                  </div>
                </div>
              );
            }

            return elements;
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Blue ring indicates your token. Walk-in slots appear after every {doctor?.walkInInterval && doctor.walkInInterval > 0 ? doctor.walkInInterval : 5} tokens.
        </p>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <CheckCircle className="w-4 h-4 text-teal-600" />,  bg: "bg-teal-100",   value: totalBookedCount,   label: "Total Booked" },
          { icon: <CheckCircle className="w-4 h-4 text-green-600" />, bg: "bg-green-100",  value: completedCount,     label: "Completed" },
          { icon: <Clock className="w-4 h-4 text-orange-600" />,      bg: "bg-orange-100", value: nowSeeingToken ?? "-", label: "Now Seeing" },
          { icon: <Activity className="w-4 h-4 text-blue-600" />,     bg: "bg-blue-100",   value: tokensAhead,        label: "Tokens Ahead" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center mb-2`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Important Notice Warning Popup — shown every time, but only for live (not yet ended) sessions ── */}
      {showWarningPopup && !isPastSession && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0 pointer-events-none">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-amber-50 rounded-3xl shadow-2xl p-6 w-full max-w-sm border-2 border-amber-400 pointer-events-auto"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-4xl">⚠️</span>
              <h2 className="text-xl font-bold text-amber-900">Important Notice</h2>
            </div>

            {/* Points */}
            <ul className="space-y-3 mb-6">
              {[
                ["Stay on this page", "to track your token live in real time."],
                ["Arrive at the clinic", "when there are 3 or fewer tokens ahead of you."],
                ["Be ready at the counter", "when your token turns yellow (Next Up)."],
                ["Do not close this app", "— you may miss your turn if you do."],
                ["You will be notified", "automatically when it is your turn."],
              ].map(([bold, rest]) => (
                <li key={bold} className="flex items-start gap-2.5 text-sm text-amber-900">
                  <span className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 shrink-0" />
                  <span><strong>{bold}</strong> {rest}</span>
                </li>
              ))}
            </ul>

            {/* CTA button */}
            <button
              type="button"
              className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold py-3.5 rounded-2xl transition-colors text-base"
              onClick={() => setShowWarningPopup(false)}
            >
              ✓ Understood, I'll stay here
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
