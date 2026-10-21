#!/usr/bin/env python3
"""apply_patient_rx_timeline.py
Patient "My Prescriptions" timeline: 4 steps -> 2 steps (Prescribed, Given),
to match the pharmacy's Received / Given tabs.
Packed/Ready prescriptions show "Prescribed" as the current step until given.
Stops without changing anything if any anchor doesn't match exactly once.
Run from F:\\O-frontend.
"""
import sys
from pathlib import Path

PATH = Path("src/pages/patient/MyPrescriptionsPage.tsx")
if not PATH.exists():
    sys.exit("STOP: src/pages/patient/MyPrescriptionsPage.tsx not found. Run from F:\\O-frontend.")

raw = PATH.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
src = raw.replace("\r\n", "\n")

EDITS = [
    ("icon import",
     'import { Pill, Clock, Package, CheckCircle, HandMetal, ArrowLeft } from "lucide-react";',
     'import { Pill, Clock, HandMetal, ArrowLeft } from "lucide-react";'),
    ("drop packed step",
     '  { status: "packed", label: "Medicines Packed", icon: Package, color: "text-yellow-500 bg-yellow-50 border-yellow-200" },\n',
     ''),
    ("drop ready step",
     '  { status: "ready", label: "Ready for Pickup", icon: CheckCircle, color: "text-green-500 bg-green-50 border-green-200" },\n',
     ''),
    ("given step",
     '  { status: "handed_over", label: "Handed Over", icon: HandMetal, color: "text-gray-500 bg-gray-50 border-gray-200" },',
     '  { status: "handed_over", label: "Given", icon: HandMetal, color: "text-green-500 bg-green-50 border-green-200" },'),
    ("current badge",
     '{p.status === status && (',
     '{(p.status === "handed_over" ? "handed_over" : "pending") === status && ('),
]

for name, old, _ in EDITS:
    n = src.count(old)
    if n != 1:
        sys.exit(f"STOP: anchor '{name}' matched {n} times (need 1). Nothing was changed.")

out = src
for _, old, new in EDITS:
    out = out.replace(old, new, 1)

if crlf:
    out = out.replace("\n", "\r\n")
PATH.write_bytes(out.encode("utf-8"))
print(f"OK: applied {len(EDITS)} edits to {PATH}")
print("Next: git diff, npx tsc --noEmit, test, then commit.")
print("Then: git reset apply_patient_rx_timeline.py  (don't commit the script)")
