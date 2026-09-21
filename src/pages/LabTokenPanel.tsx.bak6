import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import * as api from "../api";
import type { LabBooking } from "../api";

type Act = "call" | "complete" | "skip";
type Sess = "morning" | "afternoon";

const STATUS_LABELS: Record<LabBooking["status"], string> = {
  booked: "Booked",
  technician_assigned: "Technician Assigned",
  sample_collected: "Sample Collected",
  processing: "Processing",
  report_ready: "Report Ready",
  cancelled: "Cancelled",
};
const STATUS_ORDER = Object.keys(STATUS_LABELS) as LabBooking["status"][];

const TOKEN_CLASS: Record<string, string> = {
  red: "bg-red-50 text-red-600 border-red-300",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-400",
  orange: "bg-orange-500 text-white border-orange-600",
  green: "bg-green-100 text-green-700 border-green-400",
  purple: "bg-purple-100 text-purple-700 border-purple-300",
};
const LEGEND: [string, string][] = [
  ["red", "Waiting"], ["yellow", "Next up"], ["orange", "Now serving"], ["green", "Completed"], ["purple", "Skipped"],
];

function localDate(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
}

export default function LabTokenPanel() {
  const [tests, setTests] = useState<api.LabTest[]>([]);
  const [bookings, setBookings] = useState<LabBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [testId, setTestId] = useState("");
  const dates = useMemo(() => [0, 1, 2, 3, 4].map(localDate), []);
  const [date, setDate] = useState(dates[0]);
  const [session, setSession] = useState<Sess>(new Date().getHours() < 12 ? "morning" : "afternoon");
  const [state, setState] = useState<api.LabSessionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<number | null>(null);

  const loadBookings = useCallback(
    () => api.labs.myLabBookings().then(setBookings).catch(() => {}),
    [],
  );

  useEffect(() => {
    Promise.all([api.labs.myTests().then(setTests).catch(() => {}), loadBookings()]).finally(() => setLoading(false));
    const t = setInterval(loadBookings, 15_000);
    return () => clearInterval(t);
  }, [loadBookings]);

  useEffect(() => {
    if (!testId && tests.length) setTestId(tests[0].id);
  }, [tests, testId]);

  const labId = bookings[0]?.lab_id ?? "";

  useEffect(() => {
    if (!labId || !testId) return;
    let mounted = true;
    setState(null);
    const load = () =>
      api.labs.getSession(labId, testId, date, session).then((s) => { if (mounted) setState(s); }).catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    const close = api.connectTokenSocket(`${labId}_${testId}_${date}_${session}`, (p: any) => {
      if (mounted && p?.type === "state_update" && p.state) {
        setState(p.state as api.LabSessionState);
        loadBookings();
      }
    });
    return () => { mounted = false; clearInterval(t); close(); };
  }, [labId, testId, date, session, loadBookings]);

  const statuses = state?.tokenStatuses ?? {};
  const nums = Object.keys(statuses).map(Number).sort((a, b) => a - b);
  const cur = state?.currentToken ?? null;
  const next = state?.nextToken ?? null;
  const count = (s: string) => nums.filter((n) => statuses[String(n)] === s).length;
  const waiting = count("red") + count("yellow");

  const byToken = useMemo(() => {
    const m = new Map<number, LabBooking>();
    for (const b of bookings) {
      if (b.test_id === testId && b.slot_date === date && b.slot_time === session && b.token_number != null) {
        m.set(b.token_number, b);
      }
    }
    return m;
  }, [bookings, testId, date, session]);

  const testCount = (id: string) =>
    bookings.filter((b) => b.test_id === id && b.slot_date === date && b.status !== "cancelled").length;
  const sessionCount = (s: string) =>
    bookings.filter((b) => b.test_id === testId && b.slot_date === date && b.slot_time === s && b.status !== "cancelled").length;

  async function act(action: Act, token?: number): Promise<boolean> {
    if (!labId || !testId) return false;
    setBusy(true);
    try {
      setState(await api.labs.sessionAction(labId, testId, date, session, action, token));
      return true;
    } catch (err: any) {
      toast.error(err.message || "Queue update failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function callToken(n?: number) {
    if (await act("call", n)) toast.success(n != null ? `Token #${n} is now being served` : "Next token called");
    setDlg(null);
  }
  async function completeCurrent() {
    const done = cur;
    if (await act("complete")) toast.success(`Token #${done} completed ✓`);
    setDlg(null);
  }
  async function skipToken(n: number) {
    if (await act("skip", n)) toast.success(`Token #${n} skipped`);
    setDlg(null);
  }
  async function changeStatus(b: LabBooking, status: LabBooking["status"]) {
    try {
      await api.labs.updateStatus(b.id, { status });
      toast.success(`Sample status: ${STATUS_LABELS[status]}`);
      await loadBookings();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading...
      </div>
    );
  }

  const curBooking = cur != null ? byToken.get(cur) : undefined;
  const dlgBooking = dlg != null ? byToken.get(dlg) : undefined;
  const dlgStatus = dlg != null ? statuses[String(dlg)] : undefined;
  const pill = (on: boolean) =>
    `shrink-0 px-3 py-2 rounded-xl border text-sm font-medium ${on ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 bg-white text-gray-600"}`;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">Token Control Panel</h2>
        <p className="text-xs text-gray-500 mt-0.5">Every test has its own queue for each date and session.</p>
      </div>

      {tests.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">Add tests in the Tests &amp; Pricing tab first.</div>
      ) : (
        <>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Test</p>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {tests.map((t) => (
              <button key={t.id} type="button" onClick={() => setTestId(t.id)} className={pill(testId === t.id)}>
                {t.name} <span className="ml-1 text-xs opacity-70">({testCount(t.id)})</span>
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Date</p>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {dates.map((d, i) => (
              <button key={d} type="button" onClick={() => setDate(d)} className={pill(date === d)}>
                {i === 0 ? "Today" : new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Session</p>
          <div className="flex gap-2 mb-5">
            {(["morning", "afternoon"] as Sess[]).map((s) => (
              <button key={s} type="button" onClick={() => setSession(s)} className={pill(session === s)}>
                {api.labSessionLabel(s)} <span className="ml-1 text-xs opacity-70">({sessionCount(s)})</span>
              </button>
            ))}
          </div>

          {!labId ? (
            <div className="py-12 text-center text-gray-400 text-sm">No bookings yet. Tokens appear here as patients book.</div>
          ) : !state || nums.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-gray-400 text-sm">
              No bookings for this test in the {api.labSessionLabel(session).toLowerCase()} session on this date.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Now serving</p>
                    <p className="text-4xl font-extrabold text-orange-500 leading-none mt-1">{cur != null ? `#${cur}` : "—"}</p>
                    {curBooking && (
                      <p className="text-xs text-gray-600 mt-1.5 truncate">{curBooking.patient_name} · {curBooking.phone}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Next up</p>
                    <p className="text-2xl font-extrabold text-yellow-600 leading-none mt-1">{next != null ? `#${next}` : "—"}</p>
                    {next != null && byToken.get(next) && (
                      <p className="text-xs text-gray-500 mt-1.5">{byToken.get(next)!.patient_name.split(" ")[0]}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button size="sm" disabled={busy || waiting === 0} onClick={() => callToken()} className="bg-teal-500 hover:bg-teal-600 text-white">
                    Call next
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy || cur == null} onClick={completeCurrent}>
                    Complete current
                  </Button>
                </div>
                <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  <span>Waiting <b className="text-gray-800">{waiting}</b></span>
                  <span>Completed <b className="text-gray-800">{count("green")}</b></span>
                  <span>Skipped <b className="text-gray-800">{count("purple")}</b></span>
                  <span>Total <b className="text-gray-800">{nums.length}</b></span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tokens · tap to manage</p>
                <div className="flex flex-wrap gap-2">
                  {nums.map((n) => {
                    const st = statuses[String(n)];
                    const b = byToken.get(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setDlg(n)}
                        title={b ? b.patient_name : ""}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 text-sm font-semibold transition-all hover:scale-105 ${TOKEN_CLASS[st] || TOKEN_CLASS.red} ${st === "orange" ? "scale-110 shadow-lg" : ""} ${b?.status === "cancelled" ? "opacity-50 line-through" : ""}`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4">
                  {LEGEND.map(([k, label]) => (
                    <span key={k} className="flex items-center gap-1 text-[11px] text-gray-500">
                      <span className={`w-2.5 h-2.5 rounded-sm border ${TOKEN_CLASS[k]}`} /> {label}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      <Dialog open={dlg !== null} onOpenChange={(o) => { if (!o) setDlg(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Token #{dlg}</DialogTitle>
          </DialogHeader>
          {dlgBooking ? (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-gray-900">{dlgBooking.patient_name}</p>
              <p className="flex items-center gap-1.5 text-gray-600"><Phone className="w-3.5 h-3.5" /> {dlgBooking.phone}</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{dlgBooking.collection_type === "home" ? "Home collection" : "Walk-in"}</Badge>
                <span className="text-xs text-gray-500">₹{dlgBooking.price}</span>
              </div>
              {dlgBooking.collection_type === "home" && dlgBooking.address && (
                <p className="flex items-start gap-1.5 text-xs text-gray-600"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {dlgBooking.address}</p>
              )}
              {dlgBooking.status === "cancelled" && <p className="text-xs font-semibold text-red-600">This booking was cancelled.</p>}
              <div className="pt-1">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Sample status</label>
                <select
                  value={dlgBooking.status}
                  onChange={(e) => changeStatus(dlgBooking, e.target.value as LabBooking["status"])}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
                >
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Loading patient details...</p>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {(dlgStatus === "red" || dlgStatus === "yellow") && dlg !== null && (
              <>
                <Button disabled={busy} onClick={() => callToken(dlg)} className="bg-teal-500 hover:bg-teal-600 text-white">Call now</Button>
                <Button variant="outline" disabled={busy} onClick={() => skipToken(dlg)}>Skip (not present)</Button>
              </>
            )}
            {dlgStatus === "orange" && dlg !== null && (
              <>
                <Button disabled={busy} onClick={completeCurrent} className="bg-green-600 hover:bg-green-700 text-white">Mark completed</Button>
                <Button variant="outline" disabled={busy} onClick={() => skipToken(dlg)}>Skip</Button>
              </>
            )}
            {dlgStatus === "purple" && dlg !== null && (
              <Button disabled={busy} onClick={() => callToken(dlg)} className="bg-teal-500 hover:bg-teal-600 text-white">Call again</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
