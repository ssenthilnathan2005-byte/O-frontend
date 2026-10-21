#!/usr/bin/env python3
"""apply_manual_button.py
Prescription dialog: the Manual / Speak switch becomes a small, fixed-height
rectangular button pinned to the top right (next to the close X) instead of a
stretched pill in its own row.
Stops without changing anything if any anchor doesn't match exactly once.
Run from F:\\O-frontend.
"""
import re
import sys
from pathlib import Path

PATH = Path("src/components/PrescriptionDialog.tsx")
if not PATH.exists():
    sys.exit("STOP: src/components/PrescriptionDialog.tsx not found. Run from F:\\O-frontend.")

raw = PATH.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
src = raw.replace("\r\n", "\n")

P_WRAP = r'<div className="flex justify-end">(\s*)\{mode === "voice" \? \('
OLD_MANUAL = 'className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"'
OLD_SPEAK = 'className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-300 text-sm text-blue-700 hover:bg-blue-50"'

NEW_MANUAL = 'className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"'
NEW_SPEAK = 'className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-blue-300 bg-white text-xs font-medium text-blue-700 hover:bg-blue-50"'

n = len(re.findall(P_WRAP, src))
if n != 1:
    sys.exit(f"STOP: anchor 'button row' matched {n} times (need 1). Nothing was changed.")
for name, s in (("manual button classes", OLD_MANUAL), ("speak button classes", OLD_SPEAK)):
    c = src.count(s)
    if c != 1:
        sys.exit(f"STOP: anchor '{name}' matched {c} times (need 1). Nothing was changed.")

out = re.sub(P_WRAP, lambda m: '<div className="absolute top-4 right-12 z-10">' + m.group(1) + '{mode === "voice" ? (', src, count=1)
out = out.replace(OLD_MANUAL, NEW_MANUAL, 1).replace(OLD_SPEAK, NEW_SPEAK, 1)

if crlf:
    out = out.replace("\n", "\r\n")
PATH.write_bytes(out.encode("utf-8"))
print(f"OK: applied 3 edits to {PATH}")
print("Next: git diff, npx tsc --noEmit, test, then commit.")
print("Then: git reset apply_manual_button.py  (don't commit the script)")
