import { useEffect, useState } from "react";

type Item = {
  bookingId: string; patientId: string; patientName: string; phone: string;
  visitDate: string; followUpDays: number; followUpDate: string; diagnosis: string;
  state: "upcoming" | "due_today" | "overdue"; daysOverdue: number; daysToGo: number;
};

function fmt(d: string) {
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function FollowUpsPanel() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const token = localStorage.getItem("db_jwt") ?? "";
    const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/api$/, "");
    fetch(`${API}/api/doctor/follow-ups`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
      .then(async (r) => {
        const d = await r.json().catch(() => ([]));
        if (!r.ok) throw new Error((d as any).error || "Could not load follow-ups");
        setItems(Array.isArray(d) ? d : []);
      })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message || "Could not load follow-ups"); });
    return () => ctrl.abort();
  }, []);

  if (error) return <p className="text-sm text-red-600 p-4">{error}</p>;
  if (!items) return <p className="text-sm text-gray-500 p-4">Loading follow-ups…</p>;
  if (items.length === 0) return <p className="text-sm text-gray-500 p-4">No pending follow-ups.</p>;

  const groups: { title: string; cls: string; list: Item[] }[] = [
    { title: "Overdue", cls: "border-amber-300 bg-amber-50", list: items.filter((i) => i.state === "overdue") },
    { title: "Due today", cls: "border-emerald-300 bg-emerald-50", list: items.filter((i) => i.state === "due_today") },
    { title: "Upcoming", cls: "border-gray-200 bg-white", list: items.filter((i) => i.state === "upcoming") },
  ];

  return (
    <div className="space-y-5">
      {groups.filter((g) => g.list.length > 0).map((g) => (
        <div key={g.title}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{g.title} ({g.list.length})</p>
          <div className="space-y-2">
            {g.list.map((i) => (
              <div key={i.bookingId} className={`rounded-xl border p-3 ${g.cls}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{i.patientName}</p>
                    {i.phone && <a href={`tel:${i.phone}`} className="text-xs text-teal-700">{i.phone}</a>}
                    {i.diagnosis && <p className="text-xs text-gray-600 mt-0.5">Dx: {i.diagnosis}</p>}
                    <p className="text-xs text-gray-500 mt-0.5">Seen {fmt(i.visitDate)} · asked to return after {i.followUpDays} day(s)</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-gray-800">{fmt(i.followUpDate)}</p>
                    <p className="text-[11px] text-gray-600">
                      {i.state === "overdue" ? `${i.daysOverdue} day(s) late` : i.state === "due_today" ? "Today" : `in ${i.daysToGo} day(s)`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}