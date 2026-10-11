import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { Fingerprint, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Punch = {
  id: string; device_user_id: string; punched_at: string; method: string | null;
  staff_id: string | null; staff_name: string | null; staff_role: string | null;
};
type Integration = { id: string; name: string; type: string; enabled: boolean; last_seen_at: string | null };

async function get(path: string) {
  const res = await fetch(`${BASE}/hospital-integrations${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data;
}

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export default function HAAttendance() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  const [punches, setPunches] = useState<Punch[]>([]);
  const [devices, setDevices] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const f = new Date(`${from}T00:00:00`).toISOString();
      const t = new Date(`${to}T23:59:59`).toISOString();
      const [p, d] = await Promise.all([
        get(`/attendance?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`),
        get(""),
      ]);
      setPunches(p); setDevices(d);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const unmatched = punches.filter(p => !p.staff_id).length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Fingerprint className="w-6 h-6 text-teal-600" />
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">Punches from this hospital's connected devices</p>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-2">
        <p className="text-sm font-semibold">Devices</p>
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No device connected yet. Ask the platform admin to set one up for your hospital.
          </p>
        ) : devices.map(d => (
          <div key={d.id} className="flex justify-between text-sm">
            <span>{d.name} <span className="text-muted-foreground">({d.type.replace("_", " ")})</span></span>
            <span className="text-muted-foreground">
              {!d.enabled ? "Disabled" : d.last_seen_at ? `Last seen ${new Date(d.last_seen_at).toLocaleString("en-IN")}` : "Waiting for first punch"}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div><p className="text-xs text-muted-foreground mb-1">From</p>
          <DateInput value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><p className="text-xs text-muted-foreground mb-1">To</p>
          <DateInput value={to} onChange={e => setTo(e.target.value)} /></div>
        <button type="button" onClick={load} disabled={loading}
          className="h-10 px-4 rounded-md bg-teal-600 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {unmatched > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {unmatched} punch(es) don't match any staff member. Set each staff member's Employee ID (HR / Staff) to the ID enrolled on the device.
        </p>
      )}

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr><th className="p-3">Time</th><th className="p-3">Staff</th><th className="p-3">Device ID</th><th className="p-3">Method</th></tr>
          </thead>
          <tbody>
            {punches.length === 0 && !loading && (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No punches in this range</td></tr>
            )}
            {punches.map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{new Date(p.punched_at).toLocaleString("en-IN")}</td>
                <td className="p-3">
                  {p.staff_name ? <>{p.staff_name} <span className="text-xs text-muted-foreground">{(p.staff_role || "").replace(/_/g, " ")}</span></>
                    : <span className="text-amber-700">Unmatched</span>}
                </td>
                <td className="p-3">{p.device_user_id}</td>
                <td className="p-3">{(p.method || "").replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {punches.length >= 2000 && <p className="text-xs text-muted-foreground">Showing the latest 2000 punches. Narrow the date range to see older ones.</p>}
    </div>
  );
}
