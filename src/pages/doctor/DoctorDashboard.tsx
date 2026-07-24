import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Phone,
  Save,
  SkipForward,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../../context/StoreContext";
import {
  SESSION_TIMES,
  formatTime12h,
  getAvailableDates,
  getSessionLabel,
  isSessionAccessibleForRegulator,
  makeSessionId,
} from "../../data/seed";
import type {
  PrioritySlotState,
  SessionTiming,
  SessionType,
  TokenStatus,
} from "../../types";

const TOKEN_CLASSES: Record<string, string> = {
  white: "token-white cursor-pointer hover:opacity-80",
  red: "token-red cursor-pointer hover:opacity-80",
  orange: "token-orange cursor-pointer hover:opacity-80",
  yellow: "token-yellow cursor-pointer",
  green: "token-green",
  unvisited:
    "bg-purple-100 border-2 border-purple-300 text-purple-700 cursor-pointer hover:opacity-80",
};

const PRIORITY_STATUS_CLASSES: Record<string, string> = {
  waiting:
    "bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100",
  ongoing: "bg-orange-50 text-orange-700 border-orange-200 cursor-pointer",
  completed: "bg-green-50 text-green-700 border-green-200 cursor-pointer",
};

const DEFAULT_TIMINGS: Record<SessionType, SessionTiming> = {
  morning: { start: "09:00", end: "12:00" },
  afternoon: { start: "14:00", end: "17:00" },
  evening: { start: "18:00", end: "21:00" },
};

const DOCTOR_STATUS_OPTIONS = [
  { value: "not_yet_arrived", label: "Not yet arrived", preview: "Doctor not yet arrived", detail: "Please wait. The doctor has not reached the clinic yet." },
  { value: "running_late",    label: "Running late",    preview: "Doctor is running late",  detail: "The doctor is delayed. Please wait a little longer." },
  { value: "seeing_patients", label: "Seeing patients", preview: "Doctor is seeing patients", detail: "Your turn will come shortly." },
  { value: "short_break",     label: "Short break",     preview: "Doctor is on a short break", detail: "The doctor will be back shortly." },
  { value: "available_soon",  label: "Available soon",  preview: "Doctor will be available soon", detail: "Please be ready, the doctor is almost here." },
  { value: "attending_emergency", label: "Attending an emergency", preview: "Doctor is attending an emergency", detail: "There may be a delay. Please wait." },
];

function normalizeTimeValue(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const normalized = raw.replace(".", ":").replace(/\s+/g, " ").toUpperCase();
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM") {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }
  }

  if (hours < 0 || hours > 23) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toMinutes(time24: string): number {
  const [h, m] = time24.split(":").map(Number);
  return h * 60 + m;
}

function isStartBeforeEnd(start: string, end: string): boolean {
  return toMinutes(start) < toMinutes(end);
}

function sanitizeSessionTimings(
  input?: Partial<Record<SessionType, SessionTiming>>,
): Partial<Record<SessionType, SessionTiming>> {
  const result: Partial<Record<SessionType, SessionTiming>> = {};

  (Object.keys(DEFAULT_TIMINGS) as SessionType[]).forEach((session) => {
    const fallback = DEFAULT_TIMINGS[session];
    const raw = input?.[session];

    const start = normalizeTimeValue(raw?.start ?? "") ?? fallback.start;
    const end = normalizeTimeValue(raw?.end ?? "") ?? fallback.end;

    result[session] = isStartBeforeEnd(start, end)
      ? { start, end }
      : { ...fallback };
  });

  return result;
}

type DoctorTab = "regulator" | "livetokens" | "profile";

function getInitialDoctorTab(): DoctorTab {
  if (typeof window === "undefined") return "regulator";
  const params = new URLSearchParams(window.location.search);
  const queryTab = params.get("doctorTab") as DoctorTab | null;
  if (queryTab === "livetokens" || queryTab === "profile") return queryTab;

  const savedTab = window.localStorage.getItem("doctorTab") as DoctorTab | null;
  if (savedTab === "livetokens" || savedTab === "profile") return savedTab;

  return "regulator";
}

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/api$/, "");

function DoctorExportBanner({ token }: { token: string }) {
  const [exports, setExports] = useState<any[]>([]);
  const [downloading, setDownloading] = useState<number | null>(null);
  const fetchExports = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/doctor/exports`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const data = await r.json();
      setExports(data);
    } catch {}
  }, [token]);
  useEffect(() => { fetchExports(); }, [fetchExports]);
  if (exports.length === 0) return null;
  async function download(id: number) {
    setDownloading(id);
    try {
      const r = await fetch(`${API}/api/doctor/exports/${id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my_patients_${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExports((prev) => prev.filter((e) => e.id !== id));
    } catch {}
    setDownloading(null);
  }
  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-amber-800">Your patient records are ready to download</p>
          <p className="text-sm text-amber-700 mt-0.5">These records were removed from the system during cleanup. Download them to keep a copy.</p>
          <div className="mt-3 flex flex-col gap-2">
            {exports.map((e) => (
              <div key={e.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-200 px-3 py-2">
                <span className="text-sm text-gray-700">{new Date(e.created_at).toLocaleDateString("en-IN")} — patient records</span>
                <button onClick={() => download(e.id)} disabled={downloading === e.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-60">
                  <Download className="w-3.5 h-3.5" />
                  {downloading === e.id ? "Downloading..." : "Download"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DoctorDashboard() {
  const {
    user,
    doctors,
    bookings,
    updateDoctor,
    getOrCreateTokenState,
    regulateToken,
    completeCurrentToken,
    skipToken,
    completeSkippedToken,
    closeSession,
    setPrioritySlot,
    cancelSession,
    isSessionCancelled,
    tokenStates,
    getBookingsForSession,
  } = useStore();

  const doctorUser = user as { doctorId: string; code: string };
  const doctor = doctors.find((d) => d.id === doctorUser.doctorId)!;
  const [activeTab, setActiveTab] = useState<DoctorTab>(getInitialDoctorTab);

  // Initial tab is set from getInitialDoctorTab(); persistence handled on user interaction

  const [profileForm, setProfileForm] = useState({
    name: doctor?.name ?? "",
    specialty: doctor?.specialty ?? "",
    tokensPerSession: String(doctor?.tokensPerSession ?? 20),
    walkInInterval: String(doctor?.walkInInterval ?? 5),
    sessions: ((doctor?.sessions ?? []) as string[]).filter((s): s is SessionType => ["morning","afternoon","evening"].includes(s)),
    contactPhone: (doctor as any)?.contactPhone || doctor?.phone || "",
    sessionTimings: sanitizeSessionTimings(doctor?.sessionTimings),
  });

  // ── Sync profileForm when doctor reloads from server ─────────────────────
  // Runs whenever the doctor object changes (30s background refresh)
  // Critical: phone number must always reflect server value so login keeps working
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!doctor) return;
    if (!hasInitialized.current) {
      // First load — sync everything including timings
      hasInitialized.current = true;
      setProfileForm({
        name: doctor.name ?? "",
        specialty: doctor.specialty ?? "",
        tokensPerSession: String(doctor.tokensPerSession ?? 20),
        walkInInterval: String(doctor.walkInInterval ?? 5),
        sessions: ((doctor.sessions ?? []) as string[]).filter((s): s is SessionType => ["morning","afternoon","evening"].includes(s)),
        contactPhone: (doctor as any).contactPhone || doctor?.phone || "",
        sessionTimings: sanitizeSessionTimings(doctor.sessionTimings),
      });
    } else {
      // Background refresh — only update non-timing fields
      setProfileForm((prev) => ({
        ...prev,
        name: doctor.name ?? prev.name,
        specialty: doctor.specialty ?? prev.specialty,
        tokensPerSession: String(doctor.tokensPerSession ?? prev.tokensPerSession),
        walkInInterval: String(doctor.walkInInterval ?? prev.walkInInterval),
        contactPhone: (doctor as any).contactPhone || doctor?.phone || prev.contactPhone,
        // ✅ sessions and sessionTimings are NOT overwritten — user edits preserved
      }));
    }
  }, [doctor?.id, doctor?.phone]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];
  const [regDate, setRegDate] = useState(today);
  const [regSession, setRegSession] = useState<SessionType>(
    (doctor?.sessions?.[0] as SessionType | undefined) ?? "morning",
  );
  const [priorityDialog, setPriorityDialog] = useState<{
    open: boolean;
    index: number;
    slot: PrioritySlotState | null;
  }>({ open: false, index: 0, slot: null });
  const [sessionActionResult, setSessionActionResult] = useState<{
    type: "ended" | "cancelled";
    session: string;
  } | null>(null);

  const [doctorStatusOverride, setDoctorStatusOverride] = useState<string>(
    (doctor as any)?.statusOverride ?? "not_yet_arrived"
  );

  // Re-sync the local selector whenever the doctor record (re)loads — e.g. on
  // page refresh the doctor list is re-fetched from the server, and without
  // this the dropdown would stay stuck on its initial mount value
  // ("not_yet_arrived") even though the server has a saved status.
  useEffect(() => {
    if (doctor && (doctor as any).statusOverride) {
      setDoctorStatusOverride((doctor as any).statusOverride);
    }
  }, [doctor && (doctor as any).statusOverride]);

  function handleSaveDoctorStatus() {
    if (!doctor) return;
    updateDoctor(doctor.id, { statusOverride: doctorStatusOverride } as any);
    toast.success("Status updated — patients can see this now.");
  }

  // Live Tokens tab state
  const [liveTokensView, setLiveTokensView] = useState<"tovisit" | "visited">("tovisit");
  const allDoctorBookings = doctor
    ? bookings.filter((b: any) => b.doctorId === doctor.id)
    : [];
  const liveToVisit = allDoctorBookings.filter((b: any) => b.status === "confirmed");
  const liveVisited = allDoctorBookings.filter((b: any) => ["completed", "unvisited"].includes(b.status));
  const [tokenDialog, setTokenDialog] = useState<{
    open: boolean;
    tokenNum: number | null;
  }>({ open: false, tokenNum: null });
  const [closeReason, setCloseReason] = useState("");

  const visibleSessions = useMemo((): SessionType[] => {
    if (!doctor) return [];
    return (doctor.sessions as string[]).filter((s) => {
      if (isSessionCancelled(doctor.id, regDate, s)) return false;
      const sid = makeSessionId(doctor.id, regDate, s);
      if (tokenStates[sid]?.isClosed === true) return false;
      return true;
    }) as SessionType[];
  }, [doctor, regDate, tokenStates, isSessionCancelled]);

  const availableDates = useMemo(() => getAvailableDates(), []);

  const sessionId = doctor ? makeSessionId(doctor.id, regDate, regSession) : "";
  const tokenState = doctor
    ? getOrCreateTokenState(sessionId, doctor.id, regDate, regSession)
    : null;
  const statuses = tokenState?.tokenStatuses ?? {};
  const isClosed = tokenState?.isClosed ?? false;
  const cancelled = doctor
    ? isSessionCancelled(doctor.id, regDate, regSession)
    : false;

  // Session is only accessible for token regulation when date=today AND time >= session start
  const isSessionAccessibleNow = isSessionAccessibleForRegulator(
    regDate,
    regSession,
    doctor?.sessionTimings,
  );

  // Show cancel button for future sessions OR today's sessions that haven't started yet
  const canCancelSession =
    !cancelled &&
    !isClosed &&
    (regDate > today || (regDate === today && !isSessionAccessibleNow));

  // Get the session start time for display
  function getSessionStartTime(session: SessionType): string {
    const custom = doctor?.sessionTimings?.[session];
    const times = custom ?? SESSION_TIMES[session];
    return times ? formatTime12h(times.start) : "";
  }

  // Derive info for the token dialog
  const dialogTokenBooking = useMemo(() => {
    if (tokenDialog.tokenNum === null) return null;
    const sessionBookings = getBookingsForSession(sessionId);
    return (
      sessionBookings.find((b) => b.tokenNumber === tokenDialog.tokenNum) ??
      null
    );
  }, [tokenDialog.tokenNum, sessionId, getBookingsForSession]);

  const dialogTokenStatus: TokenStatus | null = useMemo(() => {
    if (tokenDialog.tokenNum === null) return null;
    return (statuses[tokenDialog.tokenNum] as TokenStatus) ?? "white";
  }, [tokenDialog.tokenNum, statuses]);

  function handleSaveProfile() {
    const normalizedTimings = sanitizeSessionTimings(profileForm.sessionTimings);

    for (const session of profileForm.sessions) {
      const timing = normalizedTimings[session] ?? DEFAULT_TIMINGS[session];
      if (!isStartBeforeEnd(timing.start, timing.end)) {
        toast.error(`${session.charAt(0).toUpperCase() + session.slice(1)} session: start time must be earlier than end time.`);
        return;
      }
    }

    const walkInIntervalNum = Number(profileForm.walkInInterval);
    if (!Number.isInteger(walkInIntervalNum) || walkInIntervalNum < 1) {
      toast.error("Walk-in interval must be a whole number of 1 or more.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: profileForm.name,
      specialty: profileForm.specialty,
      price: 10,
      tokensPerSession: Number(profileForm.tokensPerSession),
      walkInInterval: walkInIntervalNum,
      sessions: profileForm.sessions,
      consultationFee: 10,
      sessionTimings: normalizedTimings,
    };
    // Only send phone if it has a value — never overwrite with empty string
    // Phone is the doctor's login password so it must never be blanked
    if (profileForm.contactPhone.trim()) {
      payload.contactPhone = profileForm.contactPhone.trim();
      payload.phone = profileForm.contactPhone.trim();
    }
    updateDoctor(doctor.id, payload as any);
    setProfileForm((prev) => ({ ...prev, sessionTimings: normalizedTimings }));
    toast.success("Profile updated successfully");
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      updateDoctor(doctor.id, { photo: base64 });
      toast.success("Photo updated successfully");
    };
    reader.readAsDataURL(file);
  }

  function toggleSession(s: SessionType) {
    setProfileForm((prev) => ({
      ...prev,
      sessions: prev.sessions.includes(s)
        ? prev.sessions.filter((x) => x !== s)
        : [...prev.sessions, s],
    }));
  }

  function updateSessionTiming(
    session: SessionType,
    field: "start" | "end",
    value: string,
  ) {
    setProfileForm((prev) => {
      const existing = prev.sessionTimings[session] ?? DEFAULT_TIMINGS[session];
      const normalizedValue = normalizeTimeValue(value);
      if (!normalizedValue) return prev;

      const nextTiming = {
        ...existing,
        [field]: normalizedValue,
      };

      if (!isStartBeforeEnd(nextTiming.start, nextTiming.end)) {
        toast.error("Start time must be earlier than end time.");
        return prev;
      }

      return {
        ...prev,
        sessionTimings: {
          ...prev.sessionTimings,
          [session]: nextTiming,
        },
      };
    });
  }

  function handleTokenClick(tokenNum: number) {
    if (isClosed || !isSessionAccessibleNow) return;
    const st = statuses[tokenNum] as TokenStatus;
    if (
      st !== "red" &&
      st !== "yellow" &&
      st !== "orange" &&
      st !== "unvisited"
    )
      return;
    setTokenDialog({ open: true, tokenNum });
  }

  function handleMarkAsOngoing() {
    if (tokenDialog.tokenNum === null) return;
    const calledNum = tokenDialog.tokenNum;
    regulateToken(sessionId, calledNum);
    // Find the next token that will become "next up" (yellow)
    const nextRed = Object.entries(statuses)
      .filter(([n, s]) => s === "red" && Number(n) !== calledNum)
      .map(([n]) => Number(n))
      .sort((a, b) => a - b)[0] ?? null;
    if (nextRed !== null) {
      toast.success(
        `Token #${calledNum} is now with the doctor 🟠 — Token #${nextRed} please get ready 🟡`,
        { duration: 4000 }
      );
    } else {
      toast.success(`Token #${calledNum} is now with the doctor 🟠`);
    }
    setTokenDialog({ open: false, tokenNum: null });
  }

  function handleMarkCompleted() {
    const doneNum = tokenDialog.tokenNum;
    completeCurrentToken(sessionId);
    // Find next queued token (yellow or next red) to notify
    const nextUp = state => {
      const s = state?.tokenStatuses ?? statuses;
      return Object.entries(s)
        .filter(([n, st]) => (st === "yellow" || st === "red") && Number(n) !== doneNum)
        .map(([n]) => Number(n))
        .sort((a, b) => a - b)[0] ?? null;
    };
    const nextToken = nextUp(null);
    if (nextToken !== null) {
      toast.success(
        `Token #${doneNum} completed ✓ — Next patient: Token #${nextToken} 🔔`,
        { duration: 4000 }
      );
    } else {
      toast.success(`Token #${doneNum} consultation completed ✓`);
    }
    setTokenDialog({ open: false, tokenNum: null });
  }

  function handleSkipToken() {
    const skippedNum = tokenDialog.tokenNum;
    // Pass the explicit token number so backend marks THIS token as unvisited
    // even if it was never set to "ongoing" (currentToken would be null otherwise)
    skipToken(sessionId, skippedNum !== null ? skippedNum : undefined);
    // Find next red token to notify who is now "next up"
    const nextRed = Object.entries(statuses)
      .filter(([n, s]) => s === "red" && Number(n) !== skippedNum)
      .map(([n]) => Number(n))
      .sort((a, b) => a - b)[0] ?? null;
    if (nextRed !== null) {
      toast.success(
        `Token #${skippedNum} marked unavailable — Next up: Token #${nextRed} 🔔`,
        { duration: 4000 }
      );
    } else {
      toast.success(`Token #${skippedNum} marked unavailable.`);
    }
    setTokenDialog({ open: false, tokenNum: null });
  }

  function handleCompleteSkipped() {
    if (tokenDialog.tokenNum === null) return;
    completeSkippedToken(sessionId, tokenDialog.tokenNum);
    toast.success(`Token #${tokenDialog.tokenNum} marked as completed`);
    setTokenDialog({ open: false, tokenNum: null });
  }

  function handleCloseSession() {
    const sessionLabel = getSessionLabel(regSession, doctor?.sessionTimings);
    closeSession(sessionId, closeReason.trim());
    toast.success(
      "Session closed. Patients have been notified and refunds will be processed for paid tokens.",
    );
    setCloseReason("");
    const next = visibleSessions.find((s) => s !== regSession);
    if (next) setRegSession(next as SessionType);
    setSessionActionResult({ type: "ended", session: sessionLabel });
  }

  function handleCancelSession() {
    const sessionLabel = getSessionLabel(regSession, doctor?.sessionTimings);
    cancelSession(doctor.id, regDate, regSession);
    toast.success("Session cancelled. Patients will be notified.");
    const next = visibleSessions.find((s) => s !== regSession);
    if (next) setRegSession(next as SessionType);
    setSessionActionResult({ type: "cancelled", session: sessionLabel });
  }

  function openPriorityDialog(slotIndex: number) {
    const existing = tokenState?.prioritySlots?.[slotIndex] ?? {
      label: `Priority Slot P${slotIndex}`,
      status: "waiting" as const,
    };
    setPriorityDialog({ open: true, index: slotIndex, slot: existing });
  }

  function handlePriorityUpdate(status: PrioritySlotState["status"]) {
    if (!priorityDialog.slot) return;
    setPrioritySlot(sessionId, priorityDialog.index, {
      ...priorityDialog.slot,
      status,
    });
    setPriorityDialog({ open: false, index: 0, slot: null });
  }

  const maxTokens = doctor?.tokensPerSession ?? 20;
  const walkInInterval = doctor?.walkInInterval && doctor.walkInInterval > 0 ? doctor.walkInInterval : 5;

  function renderTokenGrid() {
    const elements: React.ReactNode[] = [];
    for (let n = 1; n <= maxTokens; n++) {
      const st: TokenStatus = (statuses[n] as TokenStatus) ?? "white";
      const isClickable =
        (st === "red" ||
          st === "yellow" ||
          st === "orange" ||
          st === "unvisited") &&
        !isClosed &&
        isSessionAccessibleNow;
      elements.push(
        <button
          key={n}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-sm font-semibold border-2 transition-all select-none ${
            TOKEN_CLASSES[st] ?? "token-white"
          } ${isClickable ? "cursor-pointer hover:scale-110" : ""} ${
            st === "orange" ? "scale-110 shadow-lg" : ""
          }`}
          type="button"
          disabled={!isClickable}
          onClick={() => handleTokenClick(n)}
          title={
            st === "orange"
              ? "Currently seeing — click to act"
              : st === "yellow"
                ? "Next up — click to call"
                : st === "green"
                  ? "Done"
                  : st === "red"
                    ? "Click to call"
                    : "Available"
          }
          data-ocid={`tokens.item.${n}`}
        >
          {n}
        </button>,
      );
      if (n % walkInInterval === 0 && n <= maxTokens) {
        const slotIndex = n / walkInInterval;
        const ps = tokenState?.prioritySlots?.[slotIndex] ?? {
          label: `Priority Slot P${slotIndex}`,
          status: "waiting" as const,
        };
        elements.push(
          <div key={`ps_${slotIndex}`} className="col-span-5 sm:col-span-10 mt-1">
            <button
              type="button"
              className={`w-full py-2.5 px-4 rounded-xl border-2 border-dashed text-xs font-semibold text-left flex items-center justify-between transition-all ${
                PRIORITY_STATUS_CLASSES[ps.status]
              }`}
              onClick={() => openPriorityDialog(slotIndex)}
              data-ocid="tokens.toggle"
            >
              <span className="truncate mr-2">
                ⚡ Walk-in Patient Slot W{slotIndex}
              </span>
              <Badge
                className={`text-[10px] border-0 shrink-0 ${
                  ps.status === "completed"
                    ? "bg-green-200 text-green-800"
                    : ps.status === "ongoing"
                      ? "bg-orange-200 text-orange-800"
                      : "bg-blue-200 text-blue-800"
                }`}
              >
                {ps.status === "completed"
                  ? "Completed"
                  : ps.status === "ongoing"
                    ? "Ongoing"
                    : "Waiting"}
              </Badge>
            </button>
          </div>,
        );
      }
    }
    return elements;
  }

  const currentDoctor = doctors.find((d) => d.id === doctorUser.doctorId);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      {/* Title card */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
          Token Control Panel
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Manage live patient queue — {doctor?.name} ·{" "}
          {currentDoctor?.specialty}
        </p>
      </div>

      {/* ── Doctor Patient Export Banner ── */}
      <DoctorExportBanner token={localStorage.getItem("db_jwt") ?? ""} />

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextTab = value as DoctorTab;
          setActiveTab(nextTab);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("doctorTab", nextTab);
            const url = new URL(window.location.href);
            if (window.location.pathname === "/doctor") {
              if (nextTab === "regulator") {
                url.searchParams.delete("doctorTab");
              } else {
                url.searchParams.set("doctorTab", nextTab);
              }
              window.history.replaceState({}, "", url.toString());
            }
          }
        }}
        className="w-full"
      >
        {/* ── Doctor Patient Export Banner ── */}
      <DoctorExportBanner token={localStorage.getItem("db_jwt") ?? ""} />

      <TabsList className="mb-6" data-ocid="doctor.tab">
          {/* ── Doctor Patient Export Banner ── */}
      <DoctorExportBanner token={localStorage.getItem("db_jwt") ?? ""} />

      <TabsTrigger value="regulator" data-ocid="doctor.tab">
            <Activity className="w-4 h-4 mr-1.5 sm:mr-2" />
            Regulator
          </TabsTrigger>
          {/* ── Doctor Patient Export Banner ── */}
      <DoctorExportBanner token={localStorage.getItem("db_jwt") ?? ""} />

      <TabsTrigger value="livetokens" data-ocid="doctor.tab">
            <Clock className="w-4 h-4 mr-1.5 sm:mr-2" />
            Live Tokens
          </TabsTrigger>
          {/* ── Doctor Patient Export Banner ── */}
      <DoctorExportBanner token={localStorage.getItem("db_jwt") ?? ""} />

      <TabsTrigger value="profile" data-ocid="doctor.tab">
            <User className="w-4 h-4 mr-1.5 sm:mr-2" />
            Profile
          </TabsTrigger>
        </TabsList>

        {/* Token Regulator Tab */}
        {/* ── Doctor Patient Export Banner ── */}
      <DoctorExportBanner token={localStorage.getItem("db_jwt") ?? ""} />

      <TabsContent value="regulator">
          <div className="space-y-6">

            {/* ── Current Position shown to patients ── */}
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Current Position Shown to Patients
                </p>
                <p className="text-sm text-gray-500 mb-3">
                  Update the live status patients see before you regulate tokens.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <Select
                    value={doctorStatusOverride}
                    onValueChange={setDoctorStatusOverride}
                  >
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCTOR_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="bg-teal-500 hover:bg-teal-600 text-white gap-1.5 shrink-0"
                    onClick={handleSaveDoctorStatus}
                  >
                    <Save className="w-3.5 h-3.5" /> Save Current Position
                  </Button>
                </div>
                {/* Live preview */}
                {doctorStatusOverride && doctorStatusOverride !== "not_yet_arrived" && (
                  <div className="mt-4 border border-red-200 bg-red-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Live Preview</p>
                    <p className="text-sm font-bold text-red-700">
                      {DOCTOR_STATUS_OPTIONS.find(o => o.value === doctorStatusOverride)?.preview}
                    </p>
                    <p className="text-xs text-red-500 mt-0.5">
                      {DOCTOR_STATUS_OPTIONS.find(o => o.value === doctorStatusOverride)?.detail}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Session selectors */}
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Date</Label>
                    <Select value={regDate} onValueChange={setRegDate}>
                      <SelectTrigger
                        className="w-full sm:w-44"
                        data-ocid="doctor.select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDates.map((d) => (
                          <SelectItem key={d} value={d}>
                            {new Date(`${d}T00:00:00`).toLocaleDateString(
                              "en-IN",
                              {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              },
                            )}
                            {d === today ? " (Today)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Session</Label>
                    <Select
                      value={regSession}
                      onValueChange={(v) => setRegSession(v as SessionType)}
                    >
                      <SelectTrigger
                        className="w-full sm:w-52"
                        data-ocid="doctor.select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleSessions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {getSessionLabel(s, doctor?.sessionTimings)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:ml-auto">
                    {cancelled ? (
                      <span className="bg-red-100 text-red-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        Session Cancelled
                      </span>
                    ) : isClosed ? (
                      <span className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full">
                        Session Closed
                      </span>
                    ) : regDate > today ? (
                      <span className="bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        Upcoming
                      </span>
                    ) : !isSessionAccessibleNow ? (
                      <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        Not Started Yet
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        Session Active
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token Grid Card */}
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-3">
                  <CardTitle className="text-base">
                    <Clock className="w-4 h-4 inline mr-2 text-teal-500" />
                    {getSessionLabel(regSession, doctor?.sessionTimings)} —{" "}
                    {new Date(`${regDate}T00:00:00`).toLocaleDateString(
                      "en-IN",
                      {
                        day: "numeric",
                        month: "long",
                      },
                    )}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* End Session: only when session is accessible now */}
                    {!isClosed && !cancelled && isSessionAccessibleNow && (
                      <AlertDialog onOpenChange={(v) => { if (!v) setCloseReason(""); }}>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
                            data-ocid="tokens.close_button"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1.5" />
                            End Session
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent data-ocid="tokens.dialog">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Close This Session?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              All remaining booked tokens will be marked as
                              unvisited and eligible for refund. This cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-1.5 py-1">
                            <Label htmlFor="close-reason">
                              Reason for ending early <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                              id="close-reason"
                              placeholder="e.g. Medical emergency, unwell, called away suddenly..."
                              value={closeReason}
                              onChange={(e) => setCloseReason(e.target.value)}
                              rows={3}
                            />
                            <p className="text-xs text-gray-400">
                              This will be shown to patients who weren't seen today.
                            </p>
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-ocid="tokens.cancel_button">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleCloseSession}
                              disabled={!closeReason.trim()}
                              data-ocid="tokens.confirm_button"
                            >
                              Close Session & Process Refunds
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {/* Cancel Session: for future dates or today's sessions before start time */}
                    {canCancelSession && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
                            data-ocid="tokens.delete_button"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                            Cancel Session
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent data-ocid="tokens.dialog">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Cancel This Session?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will cancel the{" "}
                              {getSessionLabel(
                                regSession,
                                doctor?.sessionTimings,
                              )}{" "}
                              session on {regDate}. All booked patients will be
                              refunded.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-ocid="tokens.cancel_button">
                              Keep Session
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleCancelSession}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-ocid="tokens.confirm_button"
                            >
                              Cancel Session
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {cancelled ? (
                  <div className="py-10 text-center">
                    <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
                      This session has been cancelled.
                    </p>
                  </div>
                ) : regDate > today ? (
                  /* Future date — show token grid behind transparent lock overlay */
                  <div className="relative">
                    {/* Token grid — visible but non-interactive */}
                    <div className="pointer-events-none select-none opacity-40">
                      <div className="flex flex-wrap gap-3 mb-4">
                        {([["#fff","Available"],["#ef4444","Booked"]] as [string,string][]).map(([color,label]) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs text-gray-500">{label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {renderTokenGrid()}
                      </div>
                    </div>
                    {/* Transparent lock overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/70 backdrop-blur-[2px]">
                      <div className="bg-white/90 border border-blue-100 rounded-2xl px-6 py-5 text-center shadow-sm max-w-xs">
                        <Lock className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                        <p className="text-gray-700 font-semibold text-sm">
                          Session Not Yet Started
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          Scheduled for{" "}
                          {new Date(`${regDate}T00:00:00`).toLocaleDateString("en-IN",
                            { weekday: "long", day: "numeric", month: "long" }
                          )}
                          {" "}at {getSessionStartTime(regSession)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : !isSessionAccessibleNow && !isClosed ? (
                  /* Today but session hasn't started — show grid behind transparent lock */
                  <div className="relative">
                    {/* Token grid — visible but non-interactive */}
                    <div className="pointer-events-none select-none opacity-40">
                      <div className="flex flex-wrap gap-3 mb-4">
                        {([["#fff","Available"],["#ef4444","Booked"]] as [string,string][]).map(([color,label]) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs text-gray-500">{label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {renderTokenGrid()}
                      </div>
                    </div>
                    {/* Transparent lock overlay with Start Session Now button */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/70 backdrop-blur-[2px]">
                      <div className="bg-white/90 border border-yellow-100 rounded-2xl px-6 py-5 text-center shadow-sm max-w-xs">
                        <Lock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                        <p className="text-gray-700 font-semibold text-sm">
                          Session Starts at {getSessionStartTime(regSession)}
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          Unlocks 30 min before start. You can see booked tokens above.
                        </p>
                        <Button
                          size="sm"
                          className="mt-3 bg-teal-500 hover:bg-teal-600 text-white px-4 text-xs"
                          onClick={() => {
                            toast.success("Session unlocked — you can now regulate tokens.");
                          }}
                        >
                          <Activity className="w-3.5 h-3.5 mr-1.5" />
                          Start Session Now
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-3 mb-4">
                      {(
                        [
                          ["#fff", "Available"],
                          ["#ef4444", "Booked"],
                          ["#f97316", "Ongoing"],
                          ["#22c55e", "Done"],
                          ["#7c3aed", "Skipped"],
                        ] as [string, string][]
                      ).map(([color, label]) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs text-gray-500">{label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {renderTokenGrid()}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profile Tab */}
        {/* ── Live Tokens Tab ── */}
        {/* ── Doctor Patient Export Banner ── */}
      <DoctorExportBanner token={localStorage.getItem("db_jwt") ?? ""} />

      <TabsContent value="livetokens">
          <Card className="border border-gray-100 shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <p className="font-semibold text-gray-900">All patients in one view</p>
                  <p className="text-xs text-gray-400 mt-0.5">Switch between patients who are waiting and patients who already visited.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLiveTokensView("tovisit")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${liveTokensView === "tovisit" ? "bg-white border-gray-300 text-gray-800 shadow-sm" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    To Visit ({liveToVisit.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveTokensView("visited")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${liveTokensView === "visited" ? "bg-white border-gray-300 text-gray-800 shadow-sm" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    Visited ({liveVisited.length})
                  </button>
                </div>
              </div>

              {(liveTokensView === "tovisit" ? liveToVisit : liveVisited).length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
                  <Clock className="w-12 h-12" />
                  <p className="font-medium text-gray-500">No patients in this view</p>
                  <p className="text-xs">Switch to the other view or wait for bookings to appear.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(liveTokensView === "tovisit" ? liveToVisit : liveVisited).map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 flex-wrap">
                          {b.patientName}
                          {b.patientAge != null && (
                            <span className="font-normal text-gray-400"> · {b.patientAge} yrs</span>
                          )}
                          {b.status === "unvisited" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                              <XCircle className="w-3 h-3" /> Unvisited
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {b.phone}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{b.session} · {b.date}</p>
                        {b.complaint && <p className="text-xs text-gray-500 mt-0.5 italic">"{b.complaint}"</p>}
                      </div>
                      <div className="flex items-baseline gap-0.5 shrink-0 ml-3">
                        <span className="text-base font-bold text-teal-500">#</span>
                        <span className="text-2xl font-bold text-teal-600">{b.tokenNumber}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Doctor Patient Export Banner ── */}
      <DoctorExportBanner token={localStorage.getItem("db_jwt") ?? ""} />

      <TabsContent value="profile">
          <div className="space-y-4">
            {/* PHOTO IDENTITY */}
            <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Photo Identity
              </p>
              <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="relative shrink-0">
                  {currentDoctor?.photo ? (
                    <img
                      src={currentDoctor.photo}
                      alt={currentDoctor.name}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-teal-100"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-teal-100 flex items-center justify-center border-2 border-teal-200">
                      <User className="w-9 h-9 text-teal-600" />
                    </div>
                  )}
                </div>
                {/* Identity info */}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-gray-900 truncate">
                    {currentDoctor?.name || profileForm.name || "Doctor Name"}
                  </p>
                  <p className="text-sm text-teal-600 font-medium mt-0.5">
                    {currentDoctor?.specialty ||
                      profileForm.specialty ||
                      "Specialty"}
                  </p>
                  <span className="inline-block mt-1.5 text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-mono">
                    Code: {doctorUser.code}
                  </span>
                  <div className="mt-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
                      onClick={() => photoInputRef.current?.click()}
                      data-ocid="profile.upload_button"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload new photo
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PERSONAL DETAILS */}
            <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Personal Details
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="doc-name"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <User className="w-3.5 h-3.5 text-gray-400" /> Full Name
                  </Label>
                  <Input
                    id="doc-name"
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, name: e.target.value }))
                    }
                    data-ocid="profile.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="doc-specialty"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Activity className="w-3.5 h-3.5 text-gray-400" /> Specialty
                  </Label>
                  <Input
                    id="doc-specialty"
                    value={profileForm.specialty}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        specialty: e.target.value,
                      }))
                    }
                    data-ocid="profile.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="doc-phone"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Phone className="w-3.5 h-3.5 text-gray-400" /> Phone
                    Number
                    <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-normal">
                      Login Password
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="doc-phone"
                      value={profileForm.contactPhone}
                      placeholder="Set by admin — contact admin to change"
                      readOnly
                      className="pr-10 bg-gray-50 text-gray-600 cursor-not-allowed"
                      data-ocid="profile.input"
                    />
                    <Lock className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    This is your login password. Only the admin can change it.
                  </p>
                </div>
              </div>
            </div>

            {/* SESSION SETTINGS */}
            <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Session Settings
              </p>
              <div className="mb-4 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                Booking fee is fixed at Rs 10 for all doctors.
              </div>
              <div className="grid grid-cols-1 gap-4 mb-5">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-tokens" className="text-sm font-medium">
                    Tokens Per Session
                  </Label>
                  <Input
                    id="doc-tokens"
                    type="number"
                    value={profileForm.tokensPerSession}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        tokensPerSession: e.target.value,
                      }))
                    }
                    data-ocid="profile.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-walkin-interval" className="text-sm font-medium">
                    Walk-in Slot Interval
                  </Label>
                  <Input
                    id="doc-walkin-interval"
                    type="number"
                    min={1}
                    value={profileForm.walkInInterval}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        walkInInterval: e.target.value,
                      }))
                    }
                    data-ocid="profile.input"
                  />
                  <p className="text-xs text-gray-400">
                    A walk-in patient slot is inserted after every N online patients (e.g. 5 means after tokens 5, 10, 15…).
                  </p>
                </div>
              </div>

              {/* Session toggles + custom timings */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Available Sessions & Timings
                </Label>
                <p className="text-xs text-gray-400">
                  Enable a session and set your own start/end time. Patients
                  will see your custom timings when booking.
                </p>
                {(["morning", "afternoon", "evening"] as SessionType[]).map(
                  (s) => {
                    const isEnabled = profileForm.sessions.includes(s);
                    const timing =
                      profileForm.sessionTimings[s] ?? DEFAULT_TIMINGS[s];
                    const sessionName = s.charAt(0).toUpperCase() + s.slice(1);
                    return (
                      <div
                        key={s}
                        className={`rounded-xl border-2 p-4 transition-colors ${
                          isEnabled
                            ? "border-teal-200 bg-teal-50/50"
                            : "border-gray-100 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Checkbox
                            id={`sess_${s}`}
                            checked={isEnabled}
                            onCheckedChange={() => toggleSession(s)}
                            data-ocid="profile.checkbox"
                          />
                          <Label
                            htmlFor={`sess_${s}`}
                            className="font-semibold cursor-pointer text-sm"
                          >
                            {sessionName} Session
                          </Label>
                          {isEnabled && (
                            <span className="ml-auto text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                              Active
                            </span>
                          )}
                        </div>
                        {isEnabled && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500 font-medium">
                                Start Time
                              </Label>
                              <Input
                                type="time"
                                value={timing.start}
                                onChange={(e) =>
                                  updateSessionTiming(
                                    s,
                                    "start",
                                    e.target.value,
                                  )
                                }
                                className="text-sm"
                                data-ocid="profile.input"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500 font-medium">
                                End Time
                              </Label>
                              <Input
                                type="time"
                                value={timing.end}
                                onChange={(e) =>
                                  updateSessionTiming(s, "end", e.target.value)
                                }
                                className="text-sm"
                                data-ocid="profile.input"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pb-2">
              <Button
                className="bg-teal-500 hover:bg-teal-600 text-white px-8"
                onClick={handleSaveProfile}
                data-ocid="profile.save_button"
              >
                <Save className="w-4 h-4 mr-2" /> Save Profile
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Token Action Dialog */}
      <Dialog
        open={tokenDialog.open}
        onOpenChange={(v) => {
          if (!v) setTokenDialog({ open: false, tokenNum: null });
        }}
      >
        <DialogContent className="max-w-sm" data-ocid="tokens.dialog">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Token #{tokenDialog.tokenNum}
            </DialogTitle>
          </DialogHeader>

          {/* Patient info */}
          <div className="space-y-4 py-1">
            <p className="text-sm text-gray-700">
              Patient:{" "}
              <span className="font-semibold">
                {dialogTokenBooking?.patientName ?? "Walk-in / Unknown"}
              </span>
              {dialogTokenBooking?.patientAge != null && (
                <span className="text-gray-500"> ({dialogTokenBooking.patientAge} yrs)</span>
              )}
            </p>
            <p className="text-sm text-gray-700 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium">Phone:</span>
              <span>{dialogTokenBooking?.phone ?? "Not available"}</span>
            </p>

            {/* Complaint box */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Patient Complaint
                </span>
              </div>
              {dialogTokenBooking?.complaint ? (
                <p className="text-sm text-gray-700">
                  {dialogTokenBooking.complaint}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No complaint submitted
                </p>
              )}
            </div>

            {/* Action buttons based on token status */}

            {/* ── RED / YELLOW: patient is waiting — first interaction ── */}
            {(dialogTokenStatus === "red" || dialogTokenStatus === "yellow") && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium">
                  Patient is waiting. Choose an action:
                </p>
                {/* PRIMARY: call patient in */}
                <Button
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold h-11"
                  onClick={handleMarkAsOngoing}
                  data-ocid="tokens.primary_button"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Call Patient In (Mark as Ongoing)
                </Button>
                {/* SECONDARY: patient not present — mark unavailable immediately */}
                <Button
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold h-11"
                  onClick={handleSkipToken}
                  data-ocid="tokens.secondary_button"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Patient Unavailable (Skip &amp; Refund)
                </Button>
              </div>
            )}

            {/* ── ORANGE: patient is currently with doctor — final step ── */}
            {dialogTokenStatus === "orange" && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium">
                  Patient is currently with the doctor.
                </p>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-11"
                  onClick={handleMarkCompleted}
                  data-ocid="tokens.confirm_button"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Consultation Done (Mark Completed)
                </Button>
                <p className="text-xs text-gray-400 text-center">
                  This marks the consultation as finished. No refund will be issued.
                </p>
              </div>
            )}

            {/* ── PURPLE / UNVISITED: was skipped — patient returned ── */}
            {dialogTokenStatus === "unvisited" && (
              <div className="space-y-2">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <p className="text-sm text-purple-700 font-semibold">
                    Previously marked unavailable
                  </p>
                  <p className="text-xs text-purple-500 mt-0.5">
                    This patient was skipped earlier. If they have returned, mark them completed. Otherwise they remain eligible for a refund.
                  </p>
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-11"
                  onClick={handleCompleteSkipped}
                  data-ocid="tokens.confirm_button"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Patient Returned — Mark Completed
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTokenDialog({ open: false, tokenNum: null })}
              data-ocid="tokens.close_button"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Priority Slot Dialog */}
      <Dialog
        open={priorityDialog.open}
        onOpenChange={(v) =>
          !v && setPriorityDialog((p) => ({ ...p, open: false }))
        }
      >
        <DialogContent data-ocid="tokens.dialog">
          <DialogHeader>
            <DialogTitle>
              Walk-in Patient Slot W{priorityDialog.index}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Update the status for this priority slot.
          </p>
          <div className="grid grid-cols-3 gap-3 py-2">
            <Button
              variant="outline"
              className="flex-col h-16 gap-1"
              onClick={() => handlePriorityUpdate("waiting")}
              data-ocid="tokens.secondary_button"
            >
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="text-xs">Waiting</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-16 gap-1"
              onClick={() => handlePriorityUpdate("ongoing")}
              data-ocid="tokens.secondary_button"
            >
              <Activity className="w-5 h-5 text-orange-500" />
              <span className="text-xs">Ongoing</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-16 gap-1"
              onClick={() => handlePriorityUpdate("completed")}
              data-ocid="tokens.secondary_button"
            >
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-xs">Completed</span>
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPriorityDialog((p) => ({ ...p, open: false }))}
              data-ocid="tokens.close_button"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Action Confirmation Dialog */}
      <Dialog
        open={sessionActionResult !== null}
        onOpenChange={(v) => {
          if (!v) setSessionActionResult(null);
        }}
      >
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          data-ocid="session.dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sessionActionResult?.type === "cancelled" ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {sessionActionResult?.type === "ended"
                ? "Session Ended"
                : "Session Cancelled"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            {sessionActionResult?.type === "ended"
              ? `The ${sessionActionResult.session} session has been successfully ended. All remaining unvisited tokens are marked for refund processing.`
              : `The ${sessionActionResult?.session} session has been successfully cancelled. All booked patients will be notified and refunded.`}
          </p>
          <DialogFooter>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => setSessionActionResult(null)}
              data-ocid="session.confirm_button"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
