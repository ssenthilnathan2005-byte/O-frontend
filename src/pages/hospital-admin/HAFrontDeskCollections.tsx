import { useEffect, useState } from "react";
import { IndianRupee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
type Row = { mode: string; count: number; total: number | string };
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

export default function HAFrontDeskCollections() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let off = false;
    async function load() {
      try {
        const r = await fetch(BASE + "/front-office/fees/summary?date=" + date, { headers: { Authorization: "Bearer " + getToken() } });
        const j = await r.json().catch(() => ({}));
        if (off) return;
        if (!r.ok) { setErr(j.error || "Failed to load"); return; }
        setErr(""); setRows(j.modes || []);
      } catch { if (!off) setErr("Failed to load"); }
    }
    load();
    const t = setInterval(load, 30000);
    return () => { off = true; clearInterval(t); };
  }, [date]);

  const get = (m: string) => rows.find((r) => r.mode === m);
  const all = rows.reduce((a, r) => a + Number(r.total), 0);
  const cnt = rows.reduce((a, r) => a + r.count, 0);
  const fmt = (n: number) => "\u20B9" + n.toLocaleString("en-IN");

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm flex items-center gap-1.5"><IndianRupee className="w-4 h-4" />Consultation fee collections</p>
        <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[["Total", all, cnt], ["Cash", Number(get("cash")?.total || 0), get("cash")?.count || 0], ["UPI", Number(get("upi")?.total || 0), get("upi")?.count || 0], ["Card", Number(get("card")?.total || 0), get("card")?.count || 0]].map(([l, t, n]) => (
          <div key={l as string} className={"rounded-lg border px-3 py-2 " + (l === "Total" ? "bg-emerald-50 border-emerald-200" : "bg-white")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{l}</p>
            <p className="text-xl font-bold">{fmt(t as number)}</p>
            <p className="text-xs text-gray-500">{n} payment{n === 1 ? "" : "s"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
