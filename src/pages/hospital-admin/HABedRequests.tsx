import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BedDouble, RefreshCw } from "lucide-react";
import { bedBookings } from "../../api";
import { useStore } from "../../context/StoreContext";

const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");
const sel = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white";

export default function HABedRequests() {
  const { user } = useStore() as any;
  const isAdmin = user?.role === "hospital_admin" || user?.role === "admin";
  const [rows, setRows] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [pick, setPick] = useState({ wardId: "", bedId: "", hold: "24" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, b] = await Promise.all([bedBookings.hospitalList(), bedBookings.freeBeds()]);
      setRows(r); setBeds(b); setErr("");
    } catch (e: any) { setErr(e.message || "Could not load bed requests"); }
  }, []);
  const loadWards = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const w = await bedBookings.wards();
      setWards(w);
      setRates(Object.fromEntries(w.map((x: any) => [x.id, String(Number(x.daily_rate || 0))])));
    } catch { /* ward list is optional here */ }
  }, [isAdmin]);

  useEffect(() => { load(); loadWards(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load, loadWards]);

  async function run(id: string, fn: () => Promise<any>, ok: string) {
    setBusy(id);
    try { await fn(); toast.success(ok); setOpen(null); await load(); }
    catch (e: any) { toast.error(e.message || "Failed"); await load(); }
    finally { setBusy(null); }
  }

  function startConfirm(b: any) {
    setOpen(b.id);
    const same = beds.find((x) => x.ward_id === b.ward_id);
    setPick({ wardId: b.ward_id, bedId: b.bed_id || (same ? same.bed_id : ""), hold: "24" });
  }

  const requested = rows.filter((r) => r.status === "requested");
  const confirmed = rows.filter((r) => r.status === "confirmed");

  function Card({ b }: { b: any }) {
    const wardMap = new Map<string, string>();
    wardMap.set(b.ward_id, b.ward_name);
    beds.forEach((x) => wardMap.set(x.ward_id, x.ward_name));
    const wardBeds = beds.filter((x) => x.ward_id === pick.wardId);
    return (
      <div className="border border-gray-200 rounded-xl p-3 bg-white space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{b.patient_name}{b.age ? ", " + b.age : ""}{b.gender ? " · " + b.gender : ""}</p>
            <p className="text-xs text-gray-500">{b.phone}{b.doctor_name ? " · " + b.doctor_name : ""}</p>
          </div>
          <span className={"text-[11px] font-semibold px-2 py-0.5 rounded-full " + (b.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
            {b.status === "confirmed" ? "Reserved" : "New request"}
          </span>
        </div>
        <p className="text-xs text-gray-600">Wants: <b>{b.ward_name}</b> · Expected {fmt(b.expected_admit_at)}</p>
        {b.reason && <p className="text-xs text-gray-600">Reason: {b.reason}</p>}
        {b.status === "confirmed" && <p className="text-xs text-green-700">Bed {b.bed_number} ({b.ward_name}) held until {fmt(b.reserved_until)}</p>}

        {open === b.id ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select className={sel} value={pick.wardId} onChange={(e) => setPick({ ...pick, wardId: e.target.value, bedId: "" })}>
              {Array.from(wardMap.entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select className={sel} value={pick.bedId} onChange={(e) => setPick({ ...pick, bedId: e.target.value })}>
              <option value="">{wardBeds.length ? "Select bed" : "No free beds"}</option>
              {wardBeds.map((x) => <option key={x.bed_id} value={x.bed_id}>{x.bed_number}</option>)}
            </select>
            <select className={sel} value={pick.hold} onChange={(e) => setPick({ ...pick, hold: e.target.value })}>
              {["6", "12", "24", "48", "72"].map((h) => <option key={h} value={h}>Hold {h}h</option>)}
            </select>
            <button disabled={!pick.bedId || busy === b.id} className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm disabled:opacity-50"
              onClick={() => run(b.id, () => bedBookings.confirm(b.id, { bedId: pick.bedId, holdHours: Number(pick.hold) }), "Bed reserved, patient notified")}>Save</button>
            <button className="px-3 py-1.5 rounded-lg border text-sm" onClick={() => setOpen(null)}>Close</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm" onClick={() => startConfirm(b)}>{b.status === "confirmed" ? "Change bed" : "Confirm bed"}</button>
            {b.status === "confirmed" && (
              <button disabled={busy === b.id} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
                onClick={() => run(b.id, () => bedBookings.admit(b.id), "Patient admitted")}>Admit now</button>
            )}
            <button disabled={busy === b.id} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-sm"
              onClick={() => { const r = window.prompt("Reason for declining (optional)") ; if (r !== null) run(b.id, () => bedBookings.reject(b.id, r), "Request declined"); }}>
              {b.status === "confirmed" ? "Release" : "Decline"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><BedDouble className="w-4 h-4 text-teal-600" />Online bed requests ({requested.length} new, {confirmed.length} reserved)</h2>
        <button onClick={load} className="text-gray-500 hover:text-gray-800"><RefreshCw className="w-4 h-4" /></button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {!err && rows.length === 0 && <p className="text-sm text-gray-500">No pending bed requests.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {requested.map((b) => <Card key={b.id} b={b} />)}
        {confirmed.map((b) => <Card key={b.id} b={b} />)}
      </div>

      {isAdmin && wards.length > 0 && (
        <details className="pt-2">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">Bed charge per day (used for billing)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {wards.map((w) => (
              <div key={w.id} className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
                <span className="text-sm flex-1">{w.name}</span>
                <span className="text-sm text-gray-500">{"₹"}</span>
                <input className="w-24 border rounded px-2 py-1 text-sm" inputMode="decimal" value={rates[w.id] ?? ""} onChange={(e) => setRates({ ...rates, [w.id]: e.target.value })} />
                <button className="text-sm text-teal-700 font-medium"
                  onClick={async () => { try { await bedBookings.setWardRate(w.id, Number(rates[w.id] || 0)); toast.success("Rate saved"); } catch (e: any) { toast.error(e.message || "Could not save"); } }}>Save</button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
