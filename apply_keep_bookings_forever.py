import os, shutil, sys

F = os.path.join("src", "pages", "patient", "MyTokensPage.tsx")
if not os.path.exists(F):
    print("Cannot find " + F + " - run this from F:\\O-frontend")
    sys.exit(1)

with open(F, "r", encoding="utf-8", newline="") as f:
    raw = f.read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

if "HIDE_AFTER_DAYS" not in s:
    print("[SKIP] already patched")
    sys.exit(0)

shutil.copyfile(F, F + ".bak")
failed = False


def rep(old, new, label):
    global s, failed
    if old in s:
        s = s.replace(old, new, 1)
        print("  [OK]   " + label)
    else:
        failed = True
        print("  [FAIL] " + label + " - text not found")


rep('''// Past bookings older than this many days are hidden from the PATIENT view only.
// Nothing is deleted; hospital admin and lab staff still see the full history.
const HIDE_AFTER_DAYS = 6;
''',
    '''// Patient history is never hidden: every past booking stays visible until the patient
// or an admin deletes it.
''',
    "remove the 6-day hide setting")

rep('''function cutoffDate(): Date {
  const c = new Date();
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - HIDE_AFTER_DAYS);
  return c;
}
// Unreadable dates stay visible rather than silently disappearing.
function isRecent(d?: string | null): boolean {
  const dt = parseDay(d);
  return !dt || dt >= cutoffDate();
}
''', '', "remove the date cutoff helpers")

rep("    if (!isRecent(b.date)) return false;\n", "", "hospital bookings: no age limit")

rep("LAB_DONE.has(b.status) && isRecent(b.slot_date));",
    "LAB_DONE.has(b.status));",
    "lab bookings: no age limit")

rep("`Nothing in the last ${HIDE_AFTER_DAYS} days`", '"Nothing here yet"',
    "folder text when empty")

rep("go in the folder (6-day limit).", "go in the folder (no age limit).",
    "comment")

if crlf:
    s = s.replace("\n", "\r\n")
with open(F, "w", encoding="utf-8", newline="") as fh:
    fh.write(s)

print()
print("Some steps FAILED. Backup: " + F + ".bak. Paste this output to Claude." if failed
      else "Done. Past hospital and lab bookings now stay in the History folders.")
