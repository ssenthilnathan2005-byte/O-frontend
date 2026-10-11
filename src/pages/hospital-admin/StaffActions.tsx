import { useEffect, useState } from "react";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type S = { id: string; name: string; role: string; login_type?: string | null; login_id?: string | null; login_code?: string | null };
type Ev = { event: string; event_date: string | null; reason: string | null; login_code: string; person: string | null; created_at: string };

const todayStr = () => new Date().toISOString().slice(0, 10);

async function call(path: string, method = "GET", body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function StaffActions({ s, onDone }: { s: S; onDone: () => void }) {
  const [mode, setMode] = useState<null | "replace" | "terminate" | "history">(null);
  const [f, setF] = useState({ name: "", password: "", specialty: "", date: todayStr(), reason: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [impact, setImpact] = useState<number | null>(null);
  const [events, setEvents] = useState<Ev[] | null>(null);

  const code = s.login_code || "";
  const baseCode = code.split("~")[0];
  const retired = code.includes("~");
  const isDoctor = s.login_type === "doctor";

  useEffect(() => {
    if (!mode || !s.login_id) return;
    if (mode === "history") {
      setEvents(null);
      call(`/hr/events?code=${encodeURIComponent(baseCode)}`).then(r => setEvents(Array.isArray(r.data) ? r.data : []));
    } else if (isDoctor) {
      setImpact(null);
      call(`/hr/doctor-impact/${s.login_id}`).then(r => setImpact(r.ok ? r.data.upcomingConfirmed : null));
    }
  }, [mode]);

  if (!s.login_id) return null;

  function close() { setMode(null); setErr(""); setF({ name: "", password: "", specialty: "", date: todayStr(), reason: "" }); }

  async function submit() {
    if (mode === "replace" && (!f.name.trim() || f.password.trim().length < 6)) {
      setErr("Enter the new doctor's name and a password of at least 6 characters.");
      return;
    }
    setBusy(true); setErr("");
    try {
      let r;
      if (mode === "replace") r = await call("/hr/replace-doctor", "POST", { doctorId: s.login_id, name: f.name, password: f.password, specialty: f.specialty || undefined, date: f.date, reason: f.reason });
      else if (isDoctor) r = await call("/hr/terminate-doctor", "POST", { doctorId: s.login_id, date: f.date, reason: f.reason });
      else r = await call("/hr/terminate-login", "POST", { staffId: s.id, date: f.date, reason: f.reason });
      if (!r.ok) { setErr(r.data.error || "Request failed"); return; }
      alert(isDoctor ? `Done. ${r.data.cancelledBookings ?? 0} upcoming booking(s) cancelled.` : "Done.");
      close(); onDone();
    } catch { setErr("Network error"); } finally { setBusy(false); }
  }

  const cls = "w-full border rounded px-3 py-2 text-sm";
  return (
    <>
      <button onClick={() => setMode("history")} className="px-2 py-1 text-xs rounded border hover:bg-muted">History</button>
      {!retired && isDoctor && <button onClick={() => setMode("replace")} className="px-2 py-1 text-xs rounded border hover:bg-muted">Replace</button>}
      {!retired && <button onClick={() => setMode("terminate")} className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50">Terminate</button>}
      {mode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            {mode === "history" ? (
              <>
                <h3 className="font-semibold">History for {baseCode}</h3>
                {events === null && <p className="text-sm text-gray-500">Loading...</p>}
                {events && events.length === 0 && <p className="text-sm text-gray-500">No events recorded for this login code yet.</p>}
                {events && events.map((e, i) => (
                  <div key={i} className="border rounded p-2 text-sm">
                    <p className="font-medium capitalize">{e.event}{e.person ? `: ${e.person}` : ""}</p>
                    <p className="text-xs text-gray-500">{e.event_date || new Date(e.created_at).toLocaleDateString()}{e.reason ? ` | ${e.reason}` : ""}</p>
                  </div>
                ))}
                <div className="flex justify-end pt-1"><button onClick={close} className="px-3 py-2 text-sm rounded border">Close</button></div>
              </>
            ) : (
              <>
                <h3 className="font-semibold">{mode === "replace" ? `Replace ${s.name}` : `Terminate ${s.name}`}</h3>
                <p className="text-xs text-gray-500">
                  {mode === "replace"
                    ? `The old doctor is retired and a new doctor takes over login code ${baseCode}. Schedule, sessions and fee are copied. Name, password, photo, bio and education start blank.`
                    : isDoctor
                      ? "The doctor is retired and can no longer log in. No replacement is created."
                      : "This person is deactivated, their login code is archived, and they can no longer log in."}
                  {" "}This cannot be undone.
                </p>
                {isDoctor && (
                  <p className="text-sm font-medium text-red-600">
                    {impact === null ? "Checking upcoming bookings..." : `${impact} upcoming confirmed booking(s) will be cancelled.`}
                  </p>
                )}
                {mode === "replace" && (
                  <>
                    <input className={cls} placeholder="New doctor name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
                    <input className={cls} placeholder="Password (min 6 characters)" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
                    <input className={cls} placeholder="Specialty (optional, keeps old if blank)" value={f.specialty} onChange={e => setF({ ...f, specialty: e.target.value })} />
                  </>
                )}
                <input type="date" className={cls} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
                <input className={cls} placeholder="Reason (optional)" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} />
                {err && <p className="text-sm text-red-600">{err}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={close} disabled={busy} className="px-3 py-2 text-sm rounded border">Cancel</button>
                  <button onClick={submit} disabled={busy} className="px-3 py-2 text-sm rounded bg-red-600 text-white disabled:opacity-50">
                    {busy ? "Working..." : mode === "replace" ? "Replace doctor" : "Terminate"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}