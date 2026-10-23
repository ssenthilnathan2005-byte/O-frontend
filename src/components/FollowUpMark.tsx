import { CalendarClock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function FollowUpMark({ bookingId, patientId, label }: { bookingId: string; patientId?: string; label?: boolean }) {
  const [data, setData] = useState<Status | null>(cache.get(bookingId) ?? null);
  const [open, setOpen] = useState(false);

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
  const prev = data.previous;
  const ok = data.state === "on_time";

  return (
    <>
      <button
        type="button"
        title="Follow-up patient"
        aria-label="Follow-up patient"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`self-center ml-1.5 inline-flex items-center justify-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 text-emerald-700 ${label ? "px-2 py-0.5 text-xs font-medium" : "w-6 h-6"}`}
      >
        <CalendarClock className="w-3.5 h-3.5" />
        {label && "Follow-up"}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="bg-white w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900">Follow-up patient</p>
                <p className={`text-xs mt-0.5 ${ok ? "text-emerald-700" : "text-amber-700"}`}>
                  {ok ? `Day ${data.daysSince} of ${data.followUpDays}` : `Overdue, was asked to return by ${fmt(data.followUpDate)}`}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm text-gray-800">
              <p className="text-xs text-gray-500">Previous visit: {fmt(prev.date)} · {prev.session}</p>
              {prev.complaint && <p><span className="font-medium">Complaint:</span> {prev.complaint}</p>}
              {prev.diagnosis && <p><span className="font-medium">Diagnosis:</span> {prev.diagnosis}</p>}
              <div>
                <p className="font-medium mb-1">Prescription</p>
                {prev.medicines.length === 0 ? (
                  <p className="text-xs text-gray-500">No medicines recorded.</p>
                ) : (
                  <ul className="space-y-1">
                    {prev.medicines.map((m, i) => (
                      <li key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5">
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-gray-600">{[m.dosage, m.duration, m.instructions].filter(Boolean).join(" · ")}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {prev.notes && <p><span className="font-medium">Notes:</span> {prev.notes}</p>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}