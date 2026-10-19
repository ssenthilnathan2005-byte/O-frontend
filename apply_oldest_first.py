import os, shutil, sys

F = os.path.join("src", "pages", "PharmacyDashboard.tsx")
if not os.path.exists(F):
    print("Cannot find " + F + " - run this from F:\\O-frontend")
    sys.exit(1)

with open(F, "r", encoding="utf-8", newline="") as f:
    s = f.read()

old = "const [newestFirst, setNewestFirst] = useState(true);"
new = "const [newestFirst, setNewestFirst] = useState(false); // oldest first: patients are served in order"

if new in s:
    print("[SKIP] already patched")
elif old in s:
    shutil.copyfile(F, F + ".bak")
    with open(F, "w", encoding="utf-8", newline="") as f:
        f.write(s.replace(old, new, 1))
    print("[OK]   default order is now oldest first (backup: " + F + ".bak)")
else:
    print("[FAIL] could not find the newestFirst line. Paste lines 138-144 to Claude.")
