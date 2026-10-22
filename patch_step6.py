#!/usr/bin/env python3
"""
Doctor Booked - STEP 6: live refresh for inward screens (staff side).

Wards / beds (hospital admin + nurse), Inward list, and All Patients used to load once and never update
until the page was reopened. They now refresh by themselves every few seconds while the screen is open and visible,
and instantly when you come back to the tab/app.

Run from the repo root (the folder that contains src/):
    python patch_step6.py
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


# ── shared hook ──────────────────────────────────────────────────────────────
HOOK = '''import { useEffect, useRef } from "react";

// Runs `fn` every `ms` while the page is visible, and once more straight away when the
// tab / app comes back to the front. Never overlaps two runs, errors are swallowed.
export function useLiveRefresh(fn: () => void | Promise<unknown>, ms: number, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    const run = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try { await ref.current(); } catch { /* keep the last data */ }
      busy = false;
    };
    const t = setInterval(run, ms);
    const onShow = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [ms, enabled]);
}
'''
wr(path("src", "hooks", "useLiveRefresh.ts"), HOOK)

IMPORT = 'import { useLiveRefresh } from "../../hooks/useLiveRefresh";\n'

# ── Wards (hospital admin) and Wards (nurse): identical wiring ───────────────
WARD_ANCHOR = "  useEffect(() => { if (hospitalId) loadWards(); }, [hospitalId]);\n"
WARD_LIVE = WARD_ANCHOR + '''
  // keep wards and every opened ward's beds fresh without reopening the page
  useLiveRefresh(async () => {
    const w = await api("/wards");
    if (Array.isArray(w)) setWards(w);
    await Promise.all(Object.keys(beds).map((id) => loadBeds(id)));
  }, 5000, !!hospitalId);
'''
for rel in (("pages", "hospital-admin", "HAWards.tsx"), ("pages", "nurse", "NurseWards.tsx")):
    p = path("src", *rel)
    s = rd(p)
    s = sub(s, 'import { getToken } from "../../api";\n', 'import { getToken } from "../../api";\n' + IMPORT, rel[-1] + " import")
    s = sub(s, WARD_ANCHOR, WARD_LIVE, rel[-1] + " live")
    wr(p, s)

# ── Inward list (hospital admin) ─────────────────────────────────────────────
p = path("src", "pages", "hospital-admin", "HAInward.tsx")
s = rd(p)
s = sub(s, 'import { getToken } from "../../api";\n', 'import { getToken } from "../../api";\n' + IMPORT, "HAInward import")
s = sub(s, "  useEffect(() => { load(); }, []);\n",
           "  useEffect(() => { load(); }, []);\n  useLiveRefresh(load, 5000);\n", "HAInward live")
wr(p, s)

# ── All Patients (hospital admin) ────────────────────────────────────────────
p = path("src", "pages", "hospital-admin", "HAAllPatients.tsx")
s = rd(p)
s = sub(s, 'import { inward as inwardApi } from "../../api";\n',
           'import { inward as inwardApi } from "../../api";\n' + IMPORT, "HAAllPatients import")
OLD = '''    return () => { cancelled = true; };
  }, []);
'''
NEW = OLD + '''  useLiveRefresh(async () => {
    const list = await inwardApi.list();
    if (Array.isArray(list)) setInwardList(list);
  }, 8000);
'''
s = sub(s, OLD, NEW, "HAAllPatients live")
wr(p, s)

print("Done. Now run: git diff --stat   then   npx tsc --noEmit")
