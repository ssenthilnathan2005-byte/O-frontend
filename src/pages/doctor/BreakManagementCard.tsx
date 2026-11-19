// Break Management card for the Doctor Login > Token Control Panel (Regulator tab).
// Connected to /api/availability (start / extend / resume + live read).
// The server clock is the source of truth: every countdown is corrected by the offset
// between the server time and this device's clock, so a wrong phone clock cannot show a wrong time.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Coffee, Play, Plus, Timer, AlertTriangle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { connectTokenSocket, getToken } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REASONS = [
  { value: "lunch", label: "Lunch" },
  { value: "tea", label: "Tea / Coffee" },
  { value: "personal", label: "Personal" },
  { value: "emergency", label: "Emergency" },
  { value: "meeting", label: "Meeting" },
  { value: "other", label: "Other" },
] as const;
type ReasonValue = (typeof REASONS)[number]["value"];

const DURATIONS = [5, 10, 15, 30, 45, 60];
const EXTENSIONS = [5, 10, 15, 30];
const MAX_MINUTES = 240;
const MAX_CUSTOM_REASON = 60;

type Availability = {
  doctorId: string;
  status: "available" | "on_break";
  reason: ReasonValue | null;
  reasonLabel: string | null;
  customReason: string | null;
  breakId: string | null;
  startedAt: string | null;
  expectedReturnAt: string | null; // null = emergency with no fixed time (never invented)
  overdue: boolean;
  version: number;
  serverNow: string;
};

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

function newKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

async function callApi(path: string, method: "GET" | "POST", body?: unknown) {
  const token = getToken();
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(API_BASE + path, {
      method,
      cache: "no-store",
      signal: ctl.signal,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data } as {
      ok: boolean;
      status: number;
      data: { availability?: Availability; error?: string };
    };
  } finally {
    window.clearTimeout(timer);
  }
}

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function parseCustom(v: string): number | null {
  if (!/^\d+$/.test(v.trim())) return null;
  const n = Number(v);
  return n >= 1 && n <= MAX_MINUTES ? n : null;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
        active
          ? "bg-teal-500 border-teal-500 text-white"
          : "bg-white border-gray-200 text-gray-600 hover:border-teal-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function BreakManagementCard({
  doctorId,
  onChanged,
}: {
  doctorId?: string;
  onChanged?: () => void;
}) {
  const [av, setAv] = useState<Availability | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<"" | "start" | "extend" | "resume">("");
  const [now, setNow] = useState(() => Date.now());
  const offsetRef = useRef(0); // serverNow - deviceNow
  const versionRef = useRef(-1);

  // start form
  const [reason, setReason] = useState<ReasonValue>("lunch");
  const [customReason, setCustomReason] = useState("");
  const [duration, setDuration] = useState<number | "custom" | null>(15);
  const [customMinutes, setCustomMinutes] = useState("");
  // extend form
  const [ext, setExt] = useState<number | "custom">(10);
  const [extCustom, setExtCustom] = useState("");
  const [error, setError] = useState("");

  const apply = useCallback((s: Availability) => {
    // Ignore an older snapshot that arrives after a newer one (WebSocket vs. HTTP race).
    if (s.version < versionRef.current) return;
    versionRef.current = s.version;
    offsetRef.current = new Date(s.serverNow).getTime() - Date.now();
    setNow(Date.now() + offsetRef.current);
    setAv(s);
    setLoadFailed(false);
  }, []);

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      const r = await callApi(`/availability/doctor/${encodeURIComponent(doctorId)}`, "GET");
      if (r.ok && r.data.availability) apply(r.data.availability);
      else setLoadFailed(true);
    } catch {
      setLoadFailed(true);
    }
  }, [doctorId, apply]);

  // Initial load, safety refresh, and refresh when the tab becomes visible again.
  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 60000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  // Live updates (also keeps a second device of the same doctor in sync).
  useEffect(() => {
    if (!doctorId) return;
    return connectTokenSocket(`avail_doctor_${doctorId}`, (p: any) => {
      if (p?.type === "availability_update" && p.availability) apply(p.availability as Availability);
    });
  }, [doctorId, apply]);

  const onBreak = av?.status === "on_break";

  useEffect(() => {
    if (!onBreak) return;
    const t = window.setInterval(() => setNow(Date.now() + offsetRef.current), 1000);
    return () => window.clearInterval(t);
  }, [onBreak]);

  const minutesChosen = useMemo(
    () => (duration === "custom" ? parseCustom(customMinutes) : duration),
    [duration, customMinutes],
  );

  async function send(action: "start" | "extend" | "resume", payload: Record<string, unknown>) {
    if (busy) return;
    setError("");
    setBusy(action);
    try {
      const r = await callApi(`/availability/${action}`, "POST", {
        ...payload,
        idempotencyKey: newKey(),
        expectedVersion: av ? av.version : undefined,
      });
      if (r.data.availability) apply(r.data.availability);
      if (!r.ok) {
        setError(r.data.error || "Could not update. Please try again.");
        return;
      }
      toast.success(
        action === "start" ? "Break started — waiting patients are being notified."
          : action === "extend" ? "Break extended — patients are being notified."
          : "Consultation resumed — patients are being notified.",
      );
      onChanged?.();
    } catch {
      setError("No connection. Check your internet and try again.");
      void load();
    } finally {
      setBusy("");
    }
  }

  function handleStart() {
    setError("");
    if (reason === "other" && !customReason.trim()) {
      setError("Please enter the reason for the break.");
      return;
    }
    if (minutesChosen === null && reason !== "emergency") {
      setError(`Choose a duration (1–${MAX_MINUTES} minutes).`);
      return;
    }
    void send("start", {
      reason,
      customReason: reason === "other" ? customReason.trim() : undefined,
      minutes: minutesChosen ?? undefined,
    });
  }

  function handleExtend() {
    setError("");
    const mins = ext === "custom" ? parseCustom(extCustom) : ext;
    if (mins === null) {
      setError(`Enter extra minutes (1–${MAX_MINUTES}).`);
      return;
    }
    void send("extend", { minutes: mins });
  }

  function handleResume() {
    void send("resume", {});
  }

  const startedMs = av?.startedAt ? new Date(av.startedAt).getTime() : null;
  const expectedMs = av?.expectedReturnAt ? new Date(av.expectedReturnAt).getTime() : null;
  const overdue = onBreak && expectedMs !== null && now > expectedMs;
  const remainingSec = expectedMs !== null ? (expectedMs - now) / 1000 : null;
  const elapsedSec = startedMs !== null ? (now - startedMs) / 1000 : 0;
  const shownReason =
    av?.reason === "other" && av.customReason ? av.customReason : (av?.reasonLabel ?? "Break");

  const badge = !av
    ? { text: loadFailed ? "Offline" : "Loading…", cls: "bg-gray-100 text-gray-600" }
    : !onBreak
      ? { text: "Available", cls: "bg-green-100 text-green-700" }
      : overdue
        ? { text: "Break overdue", cls: "bg-red-100 text-red-700" }
        : { text: "On break", cls: "bg-amber-100 text-amber-700" };

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-teal-500" /> Break Management
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Pause consultations and let waiting patients know when you will be back.
            </p>
          </div>
          <span className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full ${badge.cls}`}>
            {badge.text}
          </span>
        </div>

        {!av ? (
          <div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
            {loadFailed ? (
              <>
                <span>Could not load your break status.</span>
                <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
              </>
            ) : (
              <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</>
            )}
          </div>
        ) : !onBreak ? (
          /* ── Start a break ── */
          <div className="mt-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="space-y-1 w-full sm:w-56">
                <Label className="text-xs text-gray-500">Reason</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as ReasonValue)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reason === "other" && (
                <div className="space-y-1 w-full sm:flex-1">
                  <Label className="text-xs text-gray-500">Reason (shown to patients)</Label>
                  <Input
                    value={customReason}
                    maxLength={MAX_CUSTOM_REASON}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="e.g. Quick call with lab"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-500">
                Duration{reason === "emergency" ? " (optional for emergencies)" : ""}
              </Label>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((m) => (
                  <Chip key={m} active={duration === m} onClick={() => setDuration(m)}>
                    {m} min
                  </Chip>
                ))}
                <Chip active={duration === "custom"} onClick={() => setDuration("custom")}>
                  Custom
                </Chip>
                {reason === "emergency" && (
                  <Chip active={duration === null} onClick={() => setDuration(null)}>
                    No fixed time
                  </Chip>
                )}
              </div>
              {duration === "custom" && (
                <div className="flex items-center gap-2">
                  <Input
                    inputMode="numeric"
                    className="w-28"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="Minutes"
                  />
                  <span className="text-sm text-gray-500">minutes (max {MAX_MINUTES})</span>
                </div>
              )}
            </div>

            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 w-full sm:w-auto"
              onClick={handleStart}
              disabled={!!busy}
            >
              {busy === "start" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coffee className="w-4 h-4" />} Start Break
            </Button>
          </div>
        ) : (
          /* ── Break in progress ── */
          <div className="mt-4 space-y-4">
            {overdue && (
              <div className="flex items-start gap-2 border border-red-200 bg-red-50 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">
                  Your break time is over. Extend the break or resume consultation.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] uppercase tracking-wider text-gray-400">Reason</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 break-words">
                  {shownReason}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] uppercase tracking-wider text-gray-400">Started</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{startedMs ? fmtTime(startedMs) : "—"}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] uppercase tracking-wider text-gray-400">Expected return</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">
                  {expectedMs ? fmtTime(expectedMs) : "Not fixed"}
                </p>
              </div>
              <div
                className={`rounded-xl border p-3 ${
                  overdue ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="text-[11px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
                  <Timer className="w-3 h-3" /> {overdue ? "Overdue by" : "Remaining"}
                </p>
                <p
                  className={`text-lg font-bold mt-0.5 tabular-nums ${
                    overdue ? "text-red-700" : "text-amber-700"
                  }`}
                >
                  {remainingSec === null ? "—" : fmtClock(Math.abs(remainingSec))}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 col-span-2 lg:col-span-1">
                <p className="text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Time on break
                </p>
                <p className="text-lg font-bold text-gray-800 mt-0.5 tabular-nums">{fmtClock(elapsedSec)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Extend break by</Label>
              <div className="flex flex-wrap items-center gap-2">
                {EXTENSIONS.map((m) => (
                  <Chip key={m} active={ext === m} onClick={() => setExt(m)}>
                    +{m} min
                  </Chip>
                ))}
                <Chip active={ext === "custom"} onClick={() => setExt("custom")}>
                  Custom
                </Chip>
                {ext === "custom" && (
                  <Input
                    inputMode="numeric"
                    className="w-24"
                    value={extCustom}
                    onChange={(e) => setExtCustom(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="Minutes"
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5 w-full sm:w-auto"
                onClick={handleExtend}
                disabled={!!busy}
              >
                {busy === "extend" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Extend Break
              </Button>
              <Button
                className="bg-teal-500 hover:bg-teal-600 text-white gap-1.5 w-full sm:w-auto"
                onClick={handleResume}
                disabled={!!busy}
              >
                {busy === "resume" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Resume Consultation
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <p className="text-[11px] text-gray-400 mt-4">
          Patients waiting in today&apos;s queue are notified when you start, extend or resume.
        </p>
      </CardContent>
    </Card>
  );
}
