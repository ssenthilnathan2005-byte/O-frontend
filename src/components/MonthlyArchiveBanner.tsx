import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/api$/, "");
type Pending = { month: string; count: number };

const label = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};

export default function MonthlyArchiveBanner({
  base,          // "/api/doctor" or "/api/hospital"
  hospitalId,    // only for the hospital admin
  who,           // "dashboard" text: "doctor" | "hospital"
  onCleared,     // reload bookings after clearing
}: { base: string; hospitalId?: string; who: "doctor" | "hospital"; onCleared?: () => void }) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const qs = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("db_jwt") ?? ""}` });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}${base}/exports/pending-months${qs}`, { headers: auth() });
      if (r.ok) setPending(await r.json());
    } catch { /* silent */ }
  }, [base, qs]);

  useEffect(() => { void load(); }, [load]);

  async function downloadAndClear(p: Pending) {
    const name = label(p.month);
    if (!window.confirm(
      `Download ${name} records (${p.count})?\n\nAfter the file is downloaded, these records will be REMOVED from your ${who} dashboard. Keep the file safe — you will not be able to view them here again.`
    )) return;
    setBusy(p.month);
    try {
      const r = await fetch(`${API}${base}/exports/month/${p.month}${qs}`, { headers: auth() });
      if (!r.ok) { alert("Download failed. Nothing was removed. Please try again."); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${who}_patients_${p.month}.xlsx`; a.click();
      URL.revokeObjectURL(url);

      const c = await fetch(`${API}${base}/exports/month/${p.month}/confirm${qs}`, { method: "POST", headers: auth() });
      if (!c.ok) { alert("File downloaded, but clearing failed. It will stay visible; please try again."); return; }
      await load();
      onCleared?.();
    } finally { setBusy(null); }
  }

  if (pending.length === 0) return null;
  return (
    <div className="space-y-2 mb-4">
      {pending.map((p) => (
        <div key={p.month} className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-amber-900">
            <p className="font-semibold">{label(p.month)} records are ready to download ({p.count} patients)</p>
            <p className="text-xs mt-0.5">
              Please download them now. Once downloaded, these records will be removed from your dashboard.
              You will keep seeing this reminder until you download.
            </p>
          </div>
          <button
            type="button" disabled={busy === p.month} onClick={() => downloadAndClear(p)}
            className="px-3 py-1.5 rounded-full text-sm font-medium border border-amber-400 bg-white text-amber-800 hover:bg-amber-100 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> {busy === p.month ? "Working…" : "Download & clear"}
          </button>
        </div>
      ))}
    </div>
  );
}
