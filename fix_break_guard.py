"""
Break guard: when the doctor is On Break and tries to open/act on a token,
show "You are currently on a break. Would you like to resume consultation?"
with [Resume Consultation] / [Continue Break].

Run from the O-frontend folder:  python fix_break_guard.py
Edits: src/pages/doctor/BreakManagementCard.tsx and src/pages/doctor/DoctorDashboard.tsx
Stops without changing anything if the files differ from what is expected.
"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
CARD = root / "src/pages/doctor/BreakManagementCard.tsx"
DASH = root / "src/pages/doctor/DoctorDashboard.tsx"


def load(p):
    raw = p.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n"), ("\r\n" in raw)


def save(p, s, crlf):
    if crlf:
        s = s.replace("\n", "\r\n")
    p.write_bytes(s.encode("utf-8"))


def rep(s, old, new, label):
    if s.count(old) != 1:
        sys.exit(f"STOP: '{label}' block not found exactly once - file differs from expected. Nothing was changed.")
    return s.replace(old, new)


# ───────────────────────── BreakManagementCard.tsx ─────────────────────────
card, card_crlf = load(CARD)
if "resumeBreakNow" in card or "onAvailabilityChange" in card:
    sys.exit("BreakManagementCard.tsx already patched - nothing to do.")

card = rep(card,
'''const fmtTime = (ms: number) =>''',
'''// Used by the dashboard's "You are on a break" prompt to end the break from outside the card.
export async function resumeBreakNow(expectedVersion?: number) {
  return callApi("/availability/resume", "POST", {
    idempotencyKey: newKey(),
    expectedVersion,
  });
}

const fmtTime = (ms: number) =>''', "fmtTime anchor")

card = rep(card,
'''export default function BreakManagementCard({
  doctorId,
  onChanged,
}: {
  doctorId?: string;
  onChanged?: () => void;
}) {''',
'''export default function BreakManagementCard({
  doctorId,
  onChanged,
  onAvailabilityChange,
  refreshSignal,
}: {
  doctorId?: string;
  onChanged?: () => void;
  onAvailabilityChange?: (s: { onBreak: boolean; version: number } | null) => void;
  refreshSignal?: number;
}) {''', "component signature")

card = rep(card,
'''  const onBreak = av?.status === "on_break";
''',
'''  const onBreak = av?.status === "on_break";

  // Tell the dashboard whether the doctor is on a break (used to guard token actions).
  useEffect(() => {
    onAvailabilityChange?.(av ? { onBreak: av.status === "on_break", version: av.version } : null);
  }, [av, onAvailabilityChange]);

  // Re-read the status when the dashboard resumes the break from its own prompt.
  useEffect(() => {
    if (refreshSignal) void load();
  }, [refreshSignal, load]);
''', "onBreak line")
save(CARD, card, card_crlf)

# ───────────────────────── DoctorDashboard.tsx ─────────────────────────
d, d_crlf = load(DASH)
if "breakPrompt" in d:
    sys.exit("DoctorDashboard.tsx already patched - nothing to do.")

d = rep(d,
'import BreakManagementCard from "./BreakManagementCard";',
'import BreakManagementCard, { resumeBreakNow } from "./BreakManagementCard";', "import")

d = rep(d,
'''  const [tokenDialog, setTokenDialog] = useState<{
    open: boolean;
    tokenNum: number | null;
  }>({ open: false, tokenNum: null });
''',
'''  const [tokenDialog, setTokenDialog] = useState<{
    open: boolean;
    tokenNum: number | null;
  }>({ open: false, tokenNum: null });
  // ── Break guard: token actions are blocked while the doctor is On Break ──
  const [breakState, setBreakState] = useState<{ onBreak: boolean; version: number } | null>(null);
  const [breakPrompt, setBreakPrompt] = useState<{
    open: boolean;
    action: { type: "token"; tokenNum: number } | { type: "priority"; slotIndex: number } | null;
  }>({ open: false, action: null });
  const [breakResuming, setBreakResuming] = useState(false);
  const [breakRefresh, setBreakRefresh] = useState(0);
''', "tokenDialog state")

d = rep(d,
'''  function handleTokenClick(tokenNum: number) {
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
''',
'''  // Returns true (and opens the "resume consultation?" prompt) when the doctor is still On Break.
  function blockedByBreak(
    action: { type: "token"; tokenNum: number } | { type: "priority"; slotIndex: number },
  ): boolean {
    if (!breakState?.onBreak) return false;
    setBreakPrompt({ open: true, action });
    return true;
  }

  // Same guard for actions started from inside the token dialog (e.g. a break began on another device).
  function blockedInDialog(): boolean {
    if (tokenDialog.tokenNum === null) return false;
    if (!blockedByBreak({ type: "token", tokenNum: tokenDialog.tokenNum })) return false;
    setTokenDialog({ open: false, tokenNum: null });
    return true;
  }

  async function handleResumeFromPrompt() {
    if (breakResuming) return;
    setBreakResuming(true);
    try {
      const r = await resumeBreakNow(breakState?.version);
      const a = r.data.availability;
      if (a) setBreakState({ onBreak: a.status === "on_break", version: a.version });
      setBreakRefresh((n) => n + 1);
      if (!r.ok && a?.status !== "available") {
        toast.error(r.data.error || "Could not resume consultation. Please try again.");
        return;
      }
      if (r.ok) toast.success("Consultation resumed — patients are being notified.");
      const act = breakPrompt.action;
      setBreakPrompt({ open: false, action: null });
      // Continue with what the doctor was trying to do.
      if (act?.type === "token") setTokenDialog({ open: true, tokenNum: act.tokenNum });
      else if (act?.type === "priority") openPriorityDialogNow(act.slotIndex);
    } catch {
      toast.error("No connection. Check your internet and try again.");
    } finally {
      setBreakResuming(false);
    }
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
    if (blockedByBreak({ type: "token", tokenNum })) return;
    setTokenDialog({ open: true, tokenNum });
  }

  function handleMarkAsOngoing() {
    if (tokenDialog.tokenNum === null) return;
    if (blockedInDialog()) return;
    const calledNum = tokenDialog.tokenNum;
''', "handleTokenClick/handleMarkAsOngoing")

d = rep(d,
'''  function handleMarkCompleted() {
    const doneNum = tokenDialog.tokenNum;
''',
'''  function handleMarkCompleted() {
    if (blockedInDialog()) return;
    const doneNum = tokenDialog.tokenNum;
''', "handleMarkCompleted")

d = rep(d,
'''  function handleSkipToken() {
    const skippedNum = tokenDialog.tokenNum;
''',
'''  function handleSkipToken() {
    if (blockedInDialog()) return;
    const skippedNum = tokenDialog.tokenNum;
''', "handleSkipToken")

d = rep(d,
'''  function openPriorityDialog(slotIndex: number) {
    const existing =''',
'''  function openPriorityDialog(slotIndex: number) {
    if (blockedByBreak({ type: "priority", slotIndex })) return;
    openPriorityDialogNow(slotIndex);
  }

  function openPriorityDialogNow(slotIndex: number) {
    const existing =''', "openPriorityDialog")

d = rep(d,
'''            <BreakManagementCard
              doctorId={doctor?.id}
              onChanged={() => { void refreshFromStorage(); }}
            />''',
'''            <BreakManagementCard
              doctorId={doctor?.id}
              onChanged={() => { void refreshFromStorage(); }}
              onAvailabilityChange={setBreakState}
              refreshSignal={breakRefresh}
            />''', "BreakManagementCard usage")

d = rep(d,
'''      {/* Token Action Dialog */}
      <Dialog
        open={tokenDialog.open}''',
'''      {/* Break guard: shown when a token action is attempted while On Break */}
      <AlertDialog
        open={breakPrompt.open}
        onOpenChange={(v) => {
          if (!v && !breakResuming) setBreakPrompt({ open: false, action: null });
        }}
      >
        <AlertDialogContent data-ocid="break_guard.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>You are on a break</AlertDialogTitle>
            <AlertDialogDescription>
              You are currently on a break. Would you like to resume consultation?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              disabled={breakResuming}
              onClick={() => setBreakPrompt({ open: false, action: null })}
              data-ocid="break_guard.cancel_button"
            >
              Continue Break
            </Button>
            <Button
              className="bg-teal-500 hover:bg-teal-600 text-white"
              disabled={breakResuming}
              onClick={() => void handleResumeFromPrompt()}
              data-ocid="break_guard.confirm_button"
            >
              {breakResuming ? "Resuming…" : "Resume Consultation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Token Action Dialog */}
      <Dialog
        open={tokenDialog.open}''', "token dialog anchor")

save(DASH, d, d_crlf)
print("Patched: BreakManagementCard.tsx and DoctorDashboard.tsx")
