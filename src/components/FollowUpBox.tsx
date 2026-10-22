import { useSyncExternalStore } from "react";

let days = "";
let visit = "";
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const followUpStore = {
  get: () => days,
  set: (v: string) => { if (v !== days) { days = v; emit(); } },
  setVisit: (d?: string) => { visit = (d || "").slice(0, 10); },
};

function returnDate(n: number) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(visit) ? visit : new Date().toISOString().slice(0, 10);
  const [y, m, d] = base.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function FollowUpBox() {
  const value = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => days);
  const n = parseInt(value, 10);
  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3">
      <p className="text-xs font-medium text-teal-800 mb-1.5">Follow-up after (days)</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {[3, 5, 7, 15, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => followUpStore.set(value === String(d) ? "" : String(d))}
            className={`px-2.5 py-1 rounded-full text-xs border ${value === String(d) ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 border-gray-200"}`}
          >{d}</button>
        ))}
        <input
          type="number"
          min={1}
          max={365}
          inputMode="numeric"
          placeholder="Other"
          value={value}
          onChange={(e) => followUpStore.set(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
          className="w-16 px-2 py-1 rounded-md text-xs border border-gray-200"
        />
      </div>
      {n > 0 && (
        <p className="mt-2 text-xs font-semibold text-teal-800">
          Return by {returnDate(n)} <span className="font-normal text-teal-700">· saved with this prescription</span>
        </p>
      )}
    </div>
  );
}