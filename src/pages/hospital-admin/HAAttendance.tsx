import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { CalendarCheck, CheckCheck, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "../../api";
import { fmtDate } from "@/lib/formatDate";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Status = "present" | "absent" | "half_day" | "leave";
type Marks = Record<string, Status | null>; // staffId -> status
type Staff = { id: string; name: string; role: string; department: string | null };
type SummaryRow = { id: string; name: string; role: string; present: number; half_day: number; leave: number; absent: number };

const OPTIONS: { key: Status; label: string; on: string }[] = [
  { key: "present", label: "Present", on: "bg-green-600 text-white border-green-600" },
  { key: "half_day", label: "Half day", on: "bg-amber-500 text-white border-amber-500" },
  { key: "leave", label: "Leave", on: "bg-blue-600 text-white border-blue-600" },
  { key: "absent", label: "Absent", on: "bg-red-600 text-white border-red-600" },
];

async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${BASE}/staff-attendance${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data;
}

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const roleLabel = (r: string) => (r || "").replace(/_/g, " ");
const UNSAVED_MSG = "You have unsaved attendance changes. Discard them?";

export default function HAAttendance() {
  const today = iso(new Date());
  const [tab, setTab] = useState<"daily" | "summary">("daily");

  // Daily: `saved` is what the server has, `draft` is what is on screen.
  const [date, setDate] = useState(today);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [saved, setSaved] = useState<Marks>({});
  const [draft, setDraft] = useState<Marks>({});
  const [saving, setSaving] = useState(false);

  // Summary
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<SummaryRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const changedIds = staff.filter(s => (draft[s.id] ?? null) !== (saved[s.id] ?? null)).map(s => s.id);
  const dirty = changedIds.length > 0;
  const unmarked = staff.filter(s => !draft[s.id]).length;
  const anySaved = staff.some(s => saved[s.id]);
  const count = (st: Status) => staff.filter(s => draft[s.id] === st).length;

  async function loadDaily() {
    setLoading(true); setError("");
    try {
      const list: (Staff & { status: Status | null })[] = (await call(`?date=${date}`)).staff;
      const marks: Marks = {};
      for (const s of list) marks[s.id] = s.status ?? null;
      setStaff(list.map(({ id, name, role, department }) => ({ id, name, role, department })));
      setSaved(marks); setDraft(marks);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadSummary() {
    setLoading(true); setError("");
    try { setSummary((await call(`/summary?from=${from}&to=${to}`)).staff); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (tab === "daily") loadDaily(); /* eslint-disable-next-line */ }, [tab, date]);
  useEffect(() => { if (tab === "summary") loadSummary(); /* eslint-disable-next-line */ }, [tab, from, to]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function changeDate(v: string) {
    if (!v || v === date) return;
    if (dirty && !window.confirm(UNSAVED_MSG)) return;
    setDate(v);
  }

  function refresh() {
    if (dirty && !window.confirm(UNSAVED_MSG)) return;
    loadDaily();
  }

  function pick(id: string, status: Status) {
    // tap the active button again to clear it
    setDraft(d => ({ ...d, [id]: d[id] === status ? null : status }));
  }

  function fillUnmarked() {
    setDraft(d => {
      const next = { ...d };
      for (const s of staff) if (!next[s.id]) next[s.id] = "present";
      return next;
    });
  }

  async function save() {
    if (!dirty || saving) return;
    if (unmarked > 0 && !window.confirm(`${unmarked} staff are not marked. Save anyway?`)) return;
    setSaving(true);
    try {
      const entries = changedIds.map(id => ({ staffId: id, status: draft[id] ?? null }));
      await call("/save", "POST", { date, entries });
      setSaved({ ...draft });
      toast.success(`Attendance saved for ${fmtDate(date)}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <CalendarCheck className="w-6 h-6 text-teal-600" />
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">Mark attendance for the staff listed in HR / Staff</p>
        </div>
      </div>

      <div className="inline-flex rounded-lg border p-1 bg-muted/40">
        {(["daily", "summary"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md ${tab === t ? "bg-white shadow font-semibold" : "text-muted-foreground"}`}>
            {t === "daily" ? "Daily" : "Summary"}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "daily" ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div><p className="text-xs text-muted-foreground mb-1">Date (pick a past day to correct it)</p>
              <DateInput value={date} max={today} onChange={e => changeDate(e.target.value)} /></div>
            <button type="button" onClick={refresh} disabled={loading}
              className="h-10 px-4 rounded-md border text-sm font-medium flex items-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
            </button>
            <button type="button" onClick={fillUnmarked} disabled={loading || unmarked === 0}
              className="h-10 px-4 rounded-md border border-teal-600 text-teal-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              <CheckCheck className="w-4 h-4" /> Mark all unmarked as present
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-green-50 text-green-700">Present {count("present")}</span>
            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">Half day {count("half_day")}</span>
            <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">Leave {count("leave")}</span>
            <span className="px-2 py-1 rounded-full bg-red-50 text-red-700">Absent {count("absent")}</span>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">Not marked {unmarked}</span>
          </div>

          {dirty ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Not saved yet. Press <b>Save attendance</b> to store {fmtDate(date)}.
            </p>
          ) : anySaved ? (
            <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Saved for {fmtDate(date)}. To change it, tap a different status and save again.
            </p>
          ) : null}

          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr><th className="p-3">Staff</th><th className="p-3">Attendance</th></tr>
              </thead>
              <tbody>
                {staff.length === 0 && !loading && (
                  <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">
                    No staff for this date. Add staff in HR / Staff first.
                  </td></tr>
                )}
                {staff.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">
                      <p className="font-medium">{r.name}{(draft[r.id] ?? null) !== (saved[r.id] ?? null) && <span className="ml-2 text-xs text-amber-600">edited</span>}</p>
                      <p className="text-xs text-muted-foreground capitalize">{roleLabel(r.role)}{r.department ? ` · ${r.department}` : ""}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {OPTIONS.map(o => (
                          <button key={o.key} type="button" onClick={() => pick(r.id, o.key)}
                            className={`px-3 py-1.5 rounded-md border text-xs font-medium ${draft[r.id] === o.key ? o.on : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-0 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-white/95 backdrop-blur border-t flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {dirty ? `${changedIds.length} unsaved change${changedIds.length > 1 ? "s" : ""}` : "No changes to save"}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDraft({ ...saved })} disabled={!dirty || saving}
                className="h-10 px-4 rounded-md border text-sm font-medium disabled:opacity-50">
                Discard
              </button>
              <button type="button" onClick={save} disabled={!dirty || saving}
                className="h-10 px-5 rounded-md bg-teal-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save attendance
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div><p className="text-xs text-muted-foreground mb-1">From</p>
              <DateInput value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} /></div>
            <div><p className="text-xs text-muted-foreground mb-1">To</p>
              <DateInput value={to} min={from} max={today} onChange={e => e.target.value && setTo(e.target.value)} /></div>
            <button type="button" onClick={loadSummary} disabled={loading}
              className="h-10 px-4 rounded-md border text-sm font-medium flex items-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
            </button>
          </div>

          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3">Staff</th><th className="p-3">Present</th><th className="p-3">Half day</th>
                  <th className="p-3">Leave</th><th className="p-3">Absent</th><th className="p-3">Days worked</th>
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 && !loading && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No staff found</td></tr>
                )}
                {summary.map(s => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{roleLabel(s.role)}</p>
                    </td>
                    <td className="p-3">{s.present}</td>
                    <td className="p-3">{s.half_day}</td>
                    <td className="p-3">{s.leave}</td>
                    <td className="p-3">{s.absent}</td>
                    <td className="p-3 font-semibold">{s.present + s.half_day * 0.5}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Days worked = Present + half of Half days. Unmarked days are not counted.</p>
        </>
      )}
    </div>
  );
}