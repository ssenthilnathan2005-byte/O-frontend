import os, shutil, sys

F = os.path.join("src", "pages", "patient", "MyPrescriptionsPage.tsx")
if not os.path.exists(F):
    print("Cannot find " + F + " - run this from F:\\O-frontend")
    sys.exit(1)

with open(F, "r", encoding="utf-8", newline="") as f:
    raw = f.read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

if "showPast" not in s:
    print("[FAIL] run apply_past_prescriptions.py first")
    sys.exit(1)
if "PAST_LABEL" in s:
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


rep('const PAST_DAYS = 20;',
    'const PAST_DAYS = 20;\n// Text shown on the button at the top right (change it here if you want different wording)\nconst PAST_LABEL = "Past";',
    "label setting")

rep('<div className="bg-white border-b px-4 py-2 flex items-center gap-3">',
    '<div className="bg-white border-b shadow-sm px-4 py-4 flex items-center gap-3">',
    "taller header box")

rep('''          className={"ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium " +''',
    '''          className={"ml-auto flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium " +''',
    "bigger Past button")

rep('''          <HistoryIcon className="w-4 h-4" />
          {pastList.length > 0 && <span>{pastList.length}</span>}''',
    '''          <HistoryIcon className="w-4 h-4" />
          <span>{PAST_LABEL}</span>
          {pastList.length > 0 && (
            <span className={"min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center " +
              (showPast ? "bg-white/25 text-white" : "bg-teal-600 text-white")}>
              {pastList.length}
            </span>
          )}''',
    "Past label and count badge")

rep('<div className="max-w-lg mx-auto px-4 py-4 space-y-3">',
    '<div className="max-w-lg mx-auto px-4 py-5 space-y-3">',
    "a bit more space above the list")

if crlf:
    s = s.replace("\n", "\r\n")
with open(F, "w", encoding="utf-8", newline="") as fh:
    fh.write(s)

print()
print("Some steps FAILED. Paste this output to Claude." if failed else "Done.")
