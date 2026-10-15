import { useCallback, useEffect, useState } from "react";
import { IndianRupee, RefreshCw } from "lucide-react";
import { ipdBilling } from "../../api";

const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function IPDCollections({ onOpen, refreshKey }: { onOpen: (inwardId: string) => void; refreshKey?: any }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try { setD(await ipdBilling.summary()); setErr(""); }
    catch (e: any) { setErr(e.message || ""); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (err || !d) return null;
  const rows = showAll ? d.outstanding : d.outstanding.slice(0, 5);

  return (
    <div className="border rounded-xl p-3 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5"><IndianRupee className="w-4 h-4 text-teal-600" />IPD collections</p>
        <button onClick={load} className="p-1 rounded hover:bg-gray-100" title="Refresh"><RefreshCw className="w-3.5 h-3.5 text-gray-500" /></button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-green-50 p-2"><p className="text-[11px] text-green-700">Collected today</p><p className="font-semibold text-green-700">{inr(d.collectedToday)}</p></div>
        <div className="rounded-lg bg-green-50 p-2"><p className="text-[11px] text-green-700">This month</p><p className="font-semibold text-green-700">{inr(d.collectedMonth)}</p></div>
        <div className={"rounded-lg p-2 " + (d.outstandingTotal > 0 ? "bg-red-50" : "bg-gray-50")}><p className={"text-[11px] " + (d.outstandingTotal > 0 ? "text-red-600" : "text-gray-500")}>Outstanding</p><p className={"font-semibold " + (d.outstandingTotal > 0 ? "text-red-600" : "text-gray-700")}>{inr(d.outstandingTotal)}</p></div>
      </div>
      {d.outstanding.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">Balance due ({d.outstanding.length})</p>
          {rows.map((r: any) => (
            <button key={r.inwardId} onClick={() => onOpen(r.inwardId)} className="w-full flex items-center justify-between text-sm rounded-lg border px-2.5 py-1.5 hover:bg-gray-50 text-left">
              <span className="min-w-0">
                <span className="font-medium">{r.patientName}</span>
                <span className="text-[11px] text-gray-500 ml-2">{r.ward || "-"}{r.bedNumber ? " / " + r.bedNumber : ""} · {r.status === "discharged" ? "discharged" : "admitted"}</span>
              </span>
              <span className="font-semibold text-red-600 shrink-0 ml-2">{inr(r.balance)}</span>
            </button>
          ))}
          {d.outstanding.length > 5 && (
            <button onClick={() => setShowAll(!showAll)} className="text-xs text-teal-700 font-medium">{showAll ? "Show fewer" : "Show all " + d.outstanding.length}</button>
          )}
        </div>
      )}
    </div>
  );
}
