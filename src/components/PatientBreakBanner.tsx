// Patient-side notice on the Live Queue Tracker: shows when the doctor is on a break.
// Reads GET /api/availability/doctor/:id (public) and stays live over the WebSocket room avail_doctor_<id>.
// Shows nothing at all while the doctor is available, or if the status cannot be loaded.
import { useCallback, useEffect, useRef, useState } from "react";
import { Coffee, AlertTriangle } from "lucide-react";
import { connectTokenSocket } from "@/api";

type Availability = {
  status: "available" | "on_break";
  reason: string | null;
  customReason: string | null;
  expectedReturnAt: string | null;
  version: number;
  serverNow: string;
};

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

const PHRASES: Record<string, string> = {
  lunch: "on a lunch break",
  tea: "on a tea / coffee break",
  personal: "on a personal break",
  emergency: "attending an emergency patient",
  meeting: "in a meeting",
  other: "on a break",
};

const istDate = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

const fmtTime = (ms: number) =>
  new Date(ms)
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    .toUpperCase();

export default function PatientBreakBanner({
  doctorId,
  doctorName,
  bookingDate,
}: {
  doctorId?: string;
  doctorName?: string;
  bookingDate?: string;
}) {
  const [av, setAv] = useState<Availability | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const offsetRef = useRef(0);
  const versionRef = useRef(-1);

  const apply = useCallback((s: Availability) => {
    if (s.version < versionRef.current) return;
    versionRef.current = s.version;
    offsetRef.current = new Date(s.serverNow).getTime() - Date.now();
    setNow(Date.now() + offsetRef.current);
    setAv(s);
  }, []);

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      const res = await fetch(`${API_BASE}/availability/doctor/${encodeURIComponent(doctorId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      if (j?.availability) apply(j.availability as Availability);
    } catch {
      /* stay silent: no banner is better than a wrong one */
    }
  }, [doctorId, apply]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 30000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  useEffect(() => {
    if (!doctorId) return;
    return connectTokenSocket(`avail_doctor_${doctorId}`, (p: any) => {
      if (p?.type === "availability_update" && p.availability) apply(p.availability as Availability);
    });
  }, [doctorId, apply]);

  const onBreak = av?.status === "on_break";
  useEffect(() => {
    if (!onBreak) return;
    const t = window.setInterval(() => setNow(Date.now() + offsetRef.current), 15000);
    return () => window.clearInterval(t);
  }, [onBreak]);

  // A break only matters for a booking that is for today.
  if (!av || !onBreak || (bookingDate && bookingDate !== istDate())) return null;

  const name = doctorName ? (/^dr\.?\s/i.test(doctorName) ? doctorName : `Dr. ${doctorName}`) : "Your doctor";
  const phrase = (av.reason && PHRASES[av.reason]) || "on a break";
  const expMs = av.expectedReturnAt ? new Date(av.expectedReturnAt).getTime() : null;
  const overdue = expMs !== null && now > expMs;
  const emergency = av.reason === "emergency";

  const headline = overdue ? `${name} has not resumed yet` : emergency ? `${name} is attending an emergency` : `${name} is ${phrase}`;
  const detail = overdue
    ? "Your consultation may take longer than expected. We will update you shortly."
    : expMs
      ? `Expected return time: ${fmtTime(expMs)}. Your consultation may be delayed.`
      : "Your consultation may be delayed. We will update you shortly.";

  return (
    <div
      role="status"
      className={`rounded-2xl border p-5 mb-4 flex items-start gap-3 ${
        overdue ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
      }`}
    >
      {overdue ? (
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      ) : (
        <Coffee className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <h3 className={`font-bold ${overdue ? "text-red-800" : "text-amber-800"}`}>{headline}</h3>
        <p className={`text-sm mt-0.5 ${overdue ? "text-red-700" : "text-amber-700"}`}>{detail}</p>
        <p className="text-xs text-gray-500 mt-1">Your token and place in the queue are not affected.</p>
      </div>
    </div>
  );
}
