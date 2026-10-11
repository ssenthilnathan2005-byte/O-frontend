import { useState } from "react";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type S = { name: string; login_type?: string | null; login_id?: string | null; login_code?: string | null };

export default function DoctorActions({ s, onDone }: { s: S; onDone: () => void }) {
  const [mode, setMode] = useState<null | "replace" | "terminate">(null);
  const [f, setF] = useState({ name: "", password: "", specialty: "", date: new Date().toISOString().slice(0, 10), reason: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (s.login_type !== "doctor" || !s.login_id || (s.login_code || "").includes("~")) return null;

  function close() { setMode(null); setErr(""); setF({ name: "", password: "", specialty: "", date: new Date().toISOString().slice(0, 10), reason: "" }); }

  async function submit() {
    if (mode === "replace" && (!f.name.trim() || f.password.trim().length < 6)) {
      setErr("Enter the new doctor's name and a password of at least 6 characters.");
      return;
    }
    setBusy(true); setErr("");
    try {
      const body = mode === "replace"
        ? { doctorId: s.login_id, name: f.name, password: f.password, specialty: f.specialty || undefined, date: f.date, reason: f.reason }
        : { doctorId: s.login_id, date: f.date, reason: f.reason };
      const res = await fetch(`${BASE}/hr/${mode === "replace" ? "replace-doctor" : "terminate-doctor"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || "Request failed"); return; }
      alert(`Done. ${data.cancelledBookings ?? 0} confirmed booking(s) cancelled.`);
      close(); onDone();
    } catch { setErr("Network error"); } finally { setBusy(false); }
  }

  const cls = "w-full border rounded px-3 py-2 text-sm";
  return (
    <>
      <button onClick={() => setMode("replace")} className="px-2 py-1 text-xs rounded border hover:bg-muted">Replace</button>
      <button onClick={() => setMode("terminate")} className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50">Terminate</button>
      {mode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-semibold">{mode === "replace" ? `Replace ${s.name}` : `Terminate ${s.name}`}</h3>
            <p className="text-xs text-gray-500">
              {mode === "replace"
                ? `The old doctor is retired and a new doctor takes over login code ${s.login_code}. Schedule, sessions and fee are copied. Name, password, photo, bio and education start blank.`
                : "The doctor is retired and can no longer log in. No replacement is created."}
              {" "}All of this doctor's confirmed bookings will be cancelled. This cannot be undone.
            </p>
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
                {busy ? "Working..." : mode === "replace" ? "Replace doctor" : "Terminate doctor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}