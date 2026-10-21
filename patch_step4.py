#!/usr/bin/env python3
"""
Doctor Booked - STEP 4: remove the "All locations" dropdown from the Hospitals page.

Run from the repo root (the folder that contains src/):
    python patch_step4.py
Then:
    git diff --stat
    npx tsc --noEmit
"""
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
P = os.path.join(ROOT, "src", "pages", "patient", "HospitalsPage.tsx")

with open(P, "r", encoding="utf-8") as f:
    s = f.read()


def sub(src, old, new, label):
    n = src.count(old)
    if n != 1:
        sys.exit(f"ABORT [{label}]: expected 1 match, found {n}. Nothing was written.")
    return src.replace(old, new)


# 1. the dropdown itself (one JSX line)
s, n = re.subn(r'[ \t]*\{!city && \(<select value=\{locFilter\}.*?</select>\)\}\r?\n', "", s, count=1)
if n != 1:
    sys.exit("ABORT [dropdown]: select line not found. Nothing was written.")

# 2. its state
s = sub(s, '  const [locFilter, setLocFilter] = useState("");\n', "", "state")

# 3. the filter + options that only the dropdown used
OLD = '''  const locScoped = !city && locFilter ? cityScoped.filter((h) => norm(h.area) === locFilter) : cityScoped;
  const locOptions = (() => {
    const m = new Map<string, string>();
    for (const h of hospitals) { const k = norm(h.area); if (k && !m.has(k)) m.set(k, h.area.trim()); }
    return Array.from(m.entries()).sort((x, y) => x[1].localeCompare(y[1]));
  })();

  const filtered = locScoped.filter('''
NEW = '''  const filtered = cityScoped.filter('''
s = sub(s, OLD, NEW, "filter + options")

with open(P, "w", encoding="utf-8", newline="\n") as f:
    f.write(s)

print("Done. Now run: git diff --stat   then   npx tsc --noEmit")
