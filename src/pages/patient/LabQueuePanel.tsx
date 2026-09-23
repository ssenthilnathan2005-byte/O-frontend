import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import * as api from "../../api";
import { resolveSessionTiming } from "../../data/seed";

const TOKEN_STYLE: Record<string, string> = {
  red: "bg-red-50 text-red-600 border-red-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-300",
  orange: "bg-orange-500 text-white border-orange-500",
  green: "bg-green-100 text-green-700 border-green-300",
  purple: "bg-purple-100 text-purple-700 border-purple-300",
};

const LEGEND: [string, string][] = [
  ["red", "Booked"],
  ["yellow", "Next up"],
  ["orange", "Now serving"],
  ["green", "Completed"],
  ["purple", "Skipped"],
];

export default function LabQueuePanel({ booking }: { booking: api.LabBooking }) {
  const [session, setSession] = useState<api.LabSessionState | null>(null);
  const [lateFlag, setLateFlag] = useState(!!booking.late_flag);
  const [lateEtaMinutes, setLateEtaMinutes] = useState<number | null>(booking.late_eta_minutes ?? null);
  const [showLateOptions, setShowLateOptions] = useState(false);
  const [markingLate, setMarkingLate] = useState(false);
  const labId = booking.lab_id;
  const testId = booking.test_id;
  const slotDate = booking.slot_date;
  const slotTime = booking.slot_time;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const s = await api.labs.getSession(labId, testId, slotDate, slotTime);
        if (mounted) setSession(s);
      } catch {
        // keep last known state
      }
    };
    load();
    const interval = setInterval(load, 10_000);
    const closeSocket = api.connectTokenSocket(`${labId}_${testId}_${slotDate}_${slotTime}`, (p: any) => {
      if (mounted && p?.type === "state_update" && p.state) setSession(p.state as api.LabSessionState);
    });
    return () => { mounted = false; clearInterval(interval); closeSocket(); };
  }, [labId, testId, slotDate, slotTime]);

  const myToken = booking.token_number ?? null;
  if (myToken == null) return null;

  const statuses = session?.tokenStatuses ?? {};
  const myState = statuses[String(myToken)];
  const ahead = Object.entries(statuses).filter(
    ([n, st]) => Number(n) < myToken && (st === "red" || st === "yellow" || st === "orange")
  ).length;
  const nums = Object.keys(statuses).map(Number).sort((a, b) => a - b);

  let banner = "";
  let cls = "bg-gray-50 text-gray-700 border-gray-200";
  if (myState === "orange") { banner = "It's your turn — please proceed now"; cls = "bg-orange-50 text-orange-700 border-orange-200"; }
  else if (myState === "yellow") { banner = "You're next — please be ready"; cls = "bg-yellow-50 text-yellow-700 border-yellow-200"; }
  else if (myState === "green") { banner = "Your token has been completed"; cls = "bg-green-50 text-green-700 border-green-200"; }
  else if (myState === "purple") { banner = "Your token was skipped — please contact the lab"; cls = "bg-purple-50 text-purple-700 border-purple-200"; }
  else if (myState === "red") { banner = ahead === 0 ? "You're first in line" : `${ahead} ${ahead === 1 ? "person" : "people"} ahead of you`; }

  // "Running late?" opens 10 min before the session starts and stays open
  // until the session's end time, mirroring the doctor token tracker.
  const lateWindow = (() => {
    const times = resolveSessionTiming(slotDate, slotTime as any);
    if (!times) return { open: false, opensAt: null as Date | null };
    const [y, mo, d] = slotDate.split("-").map(Number);
    const [sh, sm] = times.start.split(":").map(Number);
    const [eh, em] = times.end.split(":").map(Number);
    const opensAt = new Date(y, mo - 1, d, sh, sm - 10, 0, 0);
    const endsAt = new Date(y, mo - 1, d, eh, em, 0, 0);
    const nowMs = Date.now();
    return { open: nowMs >= opensAt.getTime() && nowMs < endsAt.getTime(), opensAt };
  })();

  async function handleMarkLate(etaMinutes: number) {
    if (!lateWindow.open) return;
    setMarkingLate(true);
    try {
      await api.labs.markLate(booking.id, etaMinutes);
      setLateFlag(true);
      setLateEtaMinutes(etaMinutes);
      setShowLateOptions(false);
    } catch (err) {
      console.error(err);
      alert("Couldn't send your update. Please try again.");
    } finally {
      setMarkingLate(false);
    }
  }

  const canShowLate = myState === "red" || myState === "yellow";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Live Queue · {api.labSessionLabel(slotTime)}</p>
      {banner && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold text-center mb-4 ${cls}`}>{banner}</div>
      )}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Now serving</p>
          <p className="text-2xl font-extrabold text-orange-500">{session?.currentToken != null ? `#${session.currentToken}` : "—"}</p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Next up</p>
          <p className="text-2xl font-extrabold text-yellow-600">{session?.nextToken != null ? `#${session.nextToken}` : "—"}</p>
        </div>
      </div>

      {/* ── Running Late (locked until 10 min before the session) ── */}
      {canShowLate && !lateFlag && !lateWindow.open && lateWindow.opensAt && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 mb-4 flex items-start gap-2 text-xs text-gray-500">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            The "running late" option opens 10 minutes before your session starts (
            {lateWindow.opensAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })},{" "}
            {lateWindow.opensAt.toLocaleDateString([], { day: "numeric", month: "short" })}).
          </span>
        </div>
      )}
      {canShowLate && (lateWindow.open || lateFlag) && (
        <div className="mb-4">
          {lateFlag ? (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              <span>You've let the lab know you're running about {lateEtaMinutes} min late.</span>
            </div>
          ) : showLateOptions ? (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">How late will you be?</p>
              <div className="flex flex-wrap gap-2">
                {[10, 15, 20, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={markingLate}
                    onClick={() => handleMarkLate(mins)}
                    className="px-3 py-1.5 rounded-full border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-50 disabled:opacity-50"
                  >
                    ~{mins} min
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowLateOptions(false)}
                  className="px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLateOptions(true)}
              className="flex items-center gap-2 text-sm font-semibold text-amber-700 border border-amber-300 rounded-xl px-4 py-2.5 hover:bg-amber-50"
            >
              <Clock className="w-4 h-4" /> Running late?
            </button>
          )}
        </div>
      )}

      {nums.length > 0 && (
        <>
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {nums.map((n) => (
              <div
                key={n}
                className={`h-10 rounded-lg border text-sm font-bold flex items-center justify-center ${TOKEN_STYLE[statuses[String(n)]] || TOKEN_STYLE.red} ${n === myToken ? "ring-2 ring-teal-500 ring-offset-1" : ""}`}
              >
                {n}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
            {LEGEND.map(([k, label]) => (
              <span key={k} className="flex items-center gap-1 text-[11px] text-gray-500">
                <span className={`w-2.5 h-2.5 rounded-sm border ${TOKEN_STYLE[k]}`} /> {label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
