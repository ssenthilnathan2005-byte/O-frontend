import { useEffect, useState } from "react";

type Medicine = { name?: string; dosage?: string; duration?: string; instructions?: string };
type Visit = {
  bookingId: string;
  date: string;
  session: string;
  tokenNumber: number;
  complaint: string;
  doctorName: string;
  hospitalName: string;
  medicines: Medicine[];
  notes: string;
};

function fmtDate(d: string) {
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PatientHistoryModal({
  patientId,
  patientName,
  bookingId,
  onClose,
}: {
  patientId: string;
  patientName: string;
  bookingId: string;
  onClose: () => void;
}) {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const token = localStorage.getItem("db_jwt") ?? "";
    const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/api$/, "");
    fetch(
      `${API}/api/doctor/patient-history/${encodeURIComponent(patientId)}?excludeBookingId=${encodeURIComponent(bookingId)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal },
    )
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Could not load history");
        setVisits(Array.isArray(data.visits) ? data.visits : []);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message || "Could not load history");
      });
    return () => ctrl.abort();
  }, [patientId, bookingId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">Patient History &mdash; {patientName}</p>
            {visits && <p className="text-xs text-gray-500 mt-0.5">Total Visits: {visits.length}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full text-xl leading-none text-gray-500 hover:bg-gray-100"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!visits && !error && <p className="text-sm text-gray-400">Loading history...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {visits && visits.length === 0 && (
            <p className="text-sm text-gray-500">No previous visit history available.</p>
          )}
          {visits?.map((v) => (
            <div key={v.bookingId} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900 text-sm">{fmtDate(v.date)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {v.session} &middot; Token #{v.tokenNumber}
              </p>
              <div className="mt-2 space-y-1 text-sm text-gray-700">
                {v.complaint && (
                  <p>
                    <span className="text-gray-500">Complaint:</span> {v.complaint}
                  </p>
                )}
                {v.medicines.length > 0 && (
                  <div>
                    <span className="text-gray-500">Prescription:</span>
                    <ul className="list-disc ml-5">
                      {v.medicines.map((m, i) => (
                        <li key={i}>
                          {m.name}
                          {m.dosage ? ` - ${m.dosage}` : ""}
                          {m.duration ? ` for ${m.duration}` : ""}
                          {m.instructions ? ` (${m.instructions})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {v.notes && (
                  <p>
                    <span className="text-gray-500">Notes:</span> {v.notes}
                  </p>
                )}
                <p>
                  <span className="text-gray-500">Doctor:</span> {v.doctorName}
                </p>
                <p>
                  <span className="text-gray-500">Hospital:</span> {v.hospitalName}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
