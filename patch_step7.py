#!/usr/bin/env python3
"""
Doctor Booked - STEP 7: faster refresh on the patient side (and bed requests).

 - My Admission / Bed Bookings page : 30s -> 8s (and instant when you return to the app)
 - Bed button status (bottom-right)   : 60s -> 15s
 - Admission check in TopNav          : 60s -> 15s
 - Hospital admin Bed Requests        : 30s -> 10s

Needs step 6 applied first (it creates src/hooks/useLiveRefresh.ts).

Run from the repo root (the folder that contains src/):
    python patch_step7.py
Then:
    git diff --stat
    npx tsc --noEmit
"""
import os
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."


def path(*p):
    return os.path.join(ROOT, *p)


def rd(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def wr(p, s):
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)


def sub(src, old, new, label):
    n = src.count(old)
    if n != 1:
        sys.exit(f"ABORT [{label}]: expected 1 match, found {n}. Nothing was written for this file.")
    return src.replace(old, new)


if not os.path.exists(path("src", "hooks", "useLiveRefresh.ts")):
    sys.exit("ABORT: src/hooks/useLiveRefresh.ts not found. Run patch_step6.py first.")

# 1. My Admission page: poll faster, and refresh the moment the app comes back to the front
p = path("src", "pages", "patient", "MyAdmissionPage.tsx")
s = rd(p)
s = sub(s, 'import { useRouter } from "../../router/RouterContext";\n',
           'import { useRouter } from "../../router/RouterContext";\nimport { useLiveRefresh } from "../../hooks/useLiveRefresh";\n', "admission import")
s = sub(s, "  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);\n",
           "  useEffect(() => { load(); }, [load]);\n  useLiveRefresh(load, 8000);\n", "admission poll")
wr(p, s)

# 2. Admission check in the bottom bar code
p = path("src", "components", "layout", "TopNav.tsx")
s = rd(p)
s = sub(s, "const t = setInterval(check, 60000);", "const t = setInterval(check, 15000);", "TopNav poll")
wr(p, s)

# 3. Floating bed button status (created in step 1)
p = path("src", "components", "FloatingAdmissionButton.tsx")
if os.path.exists(p):
    s = rd(p)
    s = sub(s, "const t = setInterval(check, 60000);", "const t = setInterval(check, 15000);", "FAB poll")
    wr(p, s)
else:
    print("note: FloatingAdmissionButton.tsx not found (step 1 not applied) - skipped")

# 4. Bed requests (hospital admin)
p = path("src", "pages", "hospital-admin", "HABedRequests.tsx")
s = rd(p)
s = sub(s, "const t = setInterval(load, 30000);", "const t = setInterval(load, 10000);", "bed requests poll")
wr(p, s)

print("Done. Now run: git diff --stat   then   npx tsc --noEmit")
