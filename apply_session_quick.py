#!/usr/bin/env python3
"""apply_session_quick.py
Adds two quick controls to each active session on the doctor profile:
 - Length chips (2 / 3 / 4 / 5 hours): sets End = Start + length
 - Move buttons (30 min earlier / later): shifts the whole session
Requires apply_session_simple.py to be applied first.
Stops without changing anything if any anchor doesn't match exactly once.
Run from F:\\O-frontend.
"""
import re
import sys
from pathlib import Path

PATH = Path("src/pages/doctor/DoctorDashboard.tsx")
if not PATH.exists():
    sys.exit("STOP: src/pages/doctor/DoctorDashboard.tsx not found. Run from F:\\O-frontend.")

raw = PATH.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
src = raw.replace("\r\n", "\n")

if "sessTimeOptions" not in src:
    sys.exit("STOP: apply_session_simple.py is not applied yet. Nothing changed.")
if "sessShift" in src:
    sys.exit("STOP: quick-controls patch already applied. Nothing changed.")

FIT_LINE = "const fit = mins > 0 ? Math.floor(mins / avg) : 0;"
P_ROWS = (r'<div className="mt-3 space-y-2">(\s*)<div className="flex flex-wrap items-center gap-2">'
          r'(\s*)<span className="text-xs text-gray-400">Quick set:</span>')

SHIFT_FN = r'''const fit = mins > 0 ? Math.floor(mins / avg) : 0;
                            const sessShift = (d: number) => {
                              updateScheduleEntry(scheduleTab, s, "start", sessFmt(sessMins(entry.start) + d));
                              updateScheduleEntry(scheduleTab, s, "end", sessFmt(sessMins(entry.end) + d));
                            };'''

ROWS = r'''<div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-gray-400">Length:</span>
                                  {[2, 3, 4, 5].map((h) => {
                                    const on = sessMins(entry.end) - sessMins(entry.start) === h * 60;
                                    return (
                                      <button
                                        key={h}
                                        type="button"
                                        onClick={() =>
                                          updateScheduleEntry(
                                            scheduleTab, s, "end",
                                            sessFmt(Math.min(sessMins(entry.start) + h * 60, 23 * 60 + 45)),
                                          )
                                        }
                                        className={`text-xs border rounded-full px-2.5 py-0.5 ${
                                          on
                                            ? "bg-teal-600 text-white border-teal-600"
                                            : "border-teal-200 bg-white text-teal-700 hover:bg-teal-50"
                                        }`}
                                      >
                                        {h} hours
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-gray-400">Move:</span>
                                  <button
                                    type="button"
                                    disabled={sessMins(entry.start) - 30 < 5 * 60}
                                    onClick={() => sessShift(-30)}
                                    className="text-xs border border-teal-200 bg-white text-teal-700 rounded-full px-2.5 py-0.5 hover:bg-teal-50 disabled:opacity-40"
                                  >
                                    30 min earlier
                                  </button>
                                  <button
                                    type="button"
                                    disabled={sessMins(entry.end) + 30 > 23 * 60 + 45}
                                    onClick={() => sessShift(30)}
                                    className="text-xs border border-teal-200 bg-white text-teal-700 rounded-full px-2.5 py-0.5 hover:bg-teal-50 disabled:opacity-40"
                                  >
                                    30 min later
                                  </button>
                                </div>
                                '''

n1 = src.count(FIT_LINE)
n2 = len(re.findall(P_ROWS, src, flags=re.DOTALL))
if n1 != 1:
    sys.exit(f"STOP: anchor 'fit line' matched {n1} times (need 1). Nothing was changed.")
if n2 != 1:
    sys.exit(f"STOP: anchor 'quick set row' matched {n2} times (need 1). Nothing was changed.")

out = src.replace(FIT_LINE, SHIFT_FN, 1)
out = re.sub(
    P_ROWS,
    lambda m: '<div className="mt-3 space-y-2">' + m.group(1) + ROWS
    + '<div className="flex flex-wrap items-center gap-2">' + m.group(2)
    + '<span className="text-xs text-gray-400">Quick set:</span>',
    out, count=1, flags=re.DOTALL,
)

if crlf:
    out = out.replace("\n", "\r\n")
PATH.write_bytes(out.encode("utf-8"))
print(f"OK: applied 2 edits to {PATH}")
print("Next: git diff, npx tsc --noEmit, test, then commit.")
print("Then: git reset apply_session_quick.py  (don't commit the script)")
