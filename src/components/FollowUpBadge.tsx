import { useEffect, useState } from "react";

type Med = { name?: string; dosage?: string; duration?: string; instructions?: string };
type Status = {
  followUp: boolean;
  state?: "on_time" | "overdue";
  followUpDays?: number;
  followUpDate?: string;
  daysSince?: number;
  daysLeft?: number;
  previous?: { date: string; session: string; complaint: string; diagnosis: string; notes: string; medicines: Med[] };
};

const cache = new Map<string, Status>();

function fmt(d?: string) {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function FollowUpBadge({ bookingId, patientId }: { bookingId: string; patientId?: string }) {
  const [data, setData] = useState<Status | null>(cache.get(bookingId) ?? null);

  useEffect(() => {
    if (!bookingId || !patientId || cache.has(bookingId)) return;
    const ctrl = new AbortController();
    const token = localStorage.getItem("db_jwt") ?? "";
    const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/api$/, "");
    fetch(`${API}/api/doctor/follow-up-status/${encodeURIComponent(bookingId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { followUp: false }))
      .then((d: Status) => { cache.set(bookingId, d); setData(d); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [bookingId, patientId]);

  if (!data?.followUp || !data.previous) return null;
  const ok = data.state === "on_time";
  const left = data.daysLeft ?? 0;
  const prev = data.previous;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`mt-1.5 rounded-lg border px-2 py-1.5 text-xs ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
    >
      <p className="font-semibold">{ok ? "Follow-up Patient" : "Follow-up overdue"}</p>
      <p>
        {ok
          ? `Day ${data.daysSince} of ${data.followUpDays} · ${left === 0 ? "last day of follow-up" : `${left} day(s) left`}`
          : `Asked to return by ${fmt(data.followUpDate)} · ${Math.abs(left)} day(s) late`}
      </p>
      <p>Last visit: {fmt(prev.date)} · {prev.session}</p>
      <details className="mt-1">
        <summary className="cursor-pointer font-medium">Previous visit details</summary>
        <div className="mt-1 space-y-0.5 text-gray-700">
          {prev.complaint && <p><span className="font-medium">Complaint:</span> {prev.complaint}</p>}
          {prev.diagnosis && <p><span className="font-medium">Diagnosis:</span> {prev.diagnosis}</p>}
          {prev.medicines.length > 0 && (
            <div>
              <p className="font-medium">Medicines:</p>
              {prev.medicines.map((m, i) => (
                <p key={i}>• {[m.name, m.dosage, m.duration].filter(Boolean).join(" · ")}</p>
              ))}
            </div>
          )}
          {prev.notes && <p><span className="font-medium">Notes:</span> {prev.notes}</p>}
        </div>
      </details>
    </div>
  );
}