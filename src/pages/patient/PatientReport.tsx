import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { maternityApi } from "../../lib/maternityApi";
import { printMaternityRecord } from "../../lib/maternityRecord";

// "View report" for the patient app: same report as the Front Office "Print record" button.
export default function PatientReport({ inwardId }: { inwardId: string }) {
  const [eligible, setEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    maternityApi.eligible().then((r) => { if (alive) setEligible(r.ids.includes(inwardId)); }).catch(() => {});
    return () => { alive = false; };
  }, [inwardId]);

  if (!eligible) return null;
  return (
    <div className="border-t pt-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setErr("");
          try { await printMaternityRecord(inwardId, { autoPrint: false }); }
          catch (e: any) { setErr(e.message || "Could not open the report"); }
          finally { setBusy(false); }
        }}
        className="w-full flex items-center gap-1.5 text-sm font-medium text-teal-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {busy ? "Opening report..." : "View report"}
      </button>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}