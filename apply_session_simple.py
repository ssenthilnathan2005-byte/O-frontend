#!/usr/bin/env python3
"""apply_session_simple.py
Doctor profile > Sessions & Timings: simpler to fill in.
 - Start/End become dropdowns (15-minute steps, 12-hour labels)
 - End only lists times after Start; moving Start past End pushes End forward
 - Quick-set preset chips per session
 - Summary line + "fits about N patients" with a Use N button
 - "Copy weekday timings to weekend" button
Saving and validation are unchanged (values stay "HH:MM").
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

if "sessTimeOptions" in src:
    sys.exit("STOP: session patch already applied. Nothing changed.")

SELECT_CLASS = "w-full h-10 rounded-md border border-input bg-background px-3 text-sm"

HELPERS = r'''// ---- simple session time helpers (dropdown-based timing UI) ----
const sessMins = (t: string) => {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const sessFmt = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const sess12 = (t: string) => {
  const mins = sessMins(t);
  const h = Math.floor(mins / 60);
  return `${h % 12 || 12}:${String(mins % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
function sessTimeOptions(from: number, to: number, current?: string): string[] {
  const list: string[] = [];
  for (let m = from; m <= to; m += 15) list.push(sessFmt(m));
  if (current && !list.includes(current)) list.push(current);
  return list.sort();
}
const SESSION_PRESETS: Record<string, { label: string; start: string; end: string }[]> = {
  morning: [
    { label: "9 AM - 1 PM", start: "09:00", end: "13:00" },
    { label: "8 AM - 12 PM", start: "08:00", end: "12:00" },
  ],
  afternoon: [
    { label: "2 PM - 5 PM", start: "14:00", end: "17:00" },
    { label: "1 PM - 4 PM", start: "13:00", end: "16:00" },
  ],
  evening: [
    { label: "6 PM - 9 PM", start: "18:00", end: "21:00" },
    { label: "5 PM - 8 PM", start: "17:00", end: "20:00" },
  ],
};

const DOCTOR_STATUS_OPTIONS = ['''

START_SELECT = r'''<select
                                  value={entry.start}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    updateScheduleEntry(scheduleTab, s, "start", v);
                                    if (sessMins(v) >= sessMins(entry.end)) {
                                      updateScheduleEntry(scheduleTab, s, "end", sessFmt(Math.min(sessMins(v) + 60, 23 * 60 + 45)));
                                    }
                                  }}
                                  className="__CLS__"
                                  data-ocid="profile.input"
                                >
                                  {sessTimeOptions(5 * 60, 23 * 60 + 30, entry.start).map((t) => (
                                    <option key={t} value={t}>{sess12(t)}</option>
                                  ))}
                                </select>'''.replace("__CLS__", SELECT_CLASS)

END_SELECT = r'''<select
                                  value={entry.end}
                                  onChange={(e) =>
                                    updateScheduleEntry(scheduleTab, s, "end", e.target.value)
                                  }
                                  className="__CLS__"
                                  data-ocid="profile.input"
                                >
                                  {sessTimeOptions(sessMins(entry.start) + 15, 23 * 60 + 45, entry.end).map((t) => (
                                    <option key={t} value={t}>{sess12(t)}</option>
                                  ))}
                                </select>'''.replace("__CLS__", SELECT_CLASS)

EXTRAS = r'''
                          {isEnabled && (() => {
                            const mins = sessMins(entry.end) - sessMins(entry.start);
                            const avg = Number(profileForm.avgMinutesPerPatient) || 5;
                            const fit = mins > 0 ? Math.floor(mins / avg) : 0;
                            return (
                              <div className="mt-3 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-gray-400">Quick set:</span>
                                  {(SESSION_PRESETS[s] ?? []).map((pr) => (
                                    <button
                                      key={pr.label}
                                      type="button"
                                      onClick={() => {
                                        updateScheduleEntry(scheduleTab, s, "start", pr.start);
                                        updateScheduleEntry(scheduleTab, s, "end", pr.end);
                                      }}
                                      className="text-xs border border-teal-200 bg-white text-teal-700 rounded-full px-2.5 py-0.5 hover:bg-teal-50"
                                    >
                                      {pr.label}
                                    </button>
                                  ))}
                                </div>
                                {mins > 0 && (
                                  <p className="text-xs text-gray-500">
                                    {sess12(entry.start)} to {sess12(entry.end)}, {entry.count} tokens.
                                    {fit > 0 && entry.count !== fit && (
                                      <>
                                        {" "}Fits about {fit} patients at {avg} min each.{" "}
                                        <button
                                          type="button"
                                          onClick={() => updateScheduleEntry(scheduleTab, s, "count", String(fit))}
                                          className="text-teal-700 underline"
                                        >
                                          Use {fit}
                                        </button>
                                      </>
                                    )}
                                  </p>
                                )}
                              </div>
                            );
                          })()}'''

COPY_BTN = r'''<button
                      type="button"
                      onClick={() => {
                        setProfileForm((prev) => ({
                          ...prev,
                          scheduleConfig: {
                            ...prev.scheduleConfig,
                            weekend: { ...prev.scheduleConfig.weekday },
                          },
                        }));
                        toast.success("Weekend timings copied from weekday");
                      }}
                      className="text-xs text-teal-700 underline"
                    >
                      {scheduleTab === "weekend" ? "Copy weekday timings here" : "Copy these timings to weekend"}
                    </button>

                    {/* Session cards for the active tab */}'''

def count_exact(name, text, needle):
    n = text.count(needle)
    if n != 1:
        sys.exit(f"STOP: anchor '{name}' matched {n} times (need 1). Nothing was changed.")

def count_regex(name, text, pattern):
    n = len(re.findall(pattern, text, flags=re.DOTALL))
    if n != 1:
        sys.exit(f"STOP: anchor '{name}' matched {n} times (need 1). Nothing was changed.")

P_START = (r'<Input\s+type="time"\s+value=\{entry\.start\}\s+onChange=\{\(e\) =>\s+'
           r'updateScheduleEntry\(scheduleTab, s, "start", e\.target\.value\)\s+\}\s+'
           r'className="text-sm"\s+data-ocid="profile\.input"\s+/>')
P_END = (r'<Input\s+type="time"\s+value=\{entry\.end\}\s+onChange=\{\(e\) =>\s+'
         r'updateScheduleEntry\(scheduleTab, s, "end", e\.target\.value\)\s+\}\s+'
         r'className="text-sm"\s+data-ocid="profile\.input"\s+/>')
P_EXTRAS = (r'(\n[ \t]*)\)\}(\s*</div>\s*\);\s*\}\)\}\s*<p className="text-xs text-gray-400">\s*'
            r'Token count of 0)')

# verify every anchor first
count_exact("helpers", src, "const DOCTOR_STATUS_OPTIONS = [")
count_exact("copy button", src, "{/* Session cards for the active tab */}")
count_regex("start input", src, P_START)
count_regex("end input", src, P_END)
count_regex("extras", src, P_EXTRAS)

out = src
out = out.replace("const DOCTOR_STATUS_OPTIONS = [", HELPERS, 1)
out = out.replace("{/* Session cards for the active tab */}", COPY_BTN, 1)
out = re.sub(P_START, lambda m: START_SELECT, out, count=1, flags=re.DOTALL)
out = re.sub(P_END, lambda m: END_SELECT, out, count=1, flags=re.DOTALL)
out = re.sub(P_EXTRAS, lambda m: m.group(1) + ")}" + EXTRAS + m.group(2), out, count=1, flags=re.DOTALL)

if crlf:
    out = out.replace("\n", "\r\n")
PATH.write_bytes(out.encode("utf-8"))
print(f"OK: applied 5 edits to {PATH}")
print("Next: git diff, npx tsc --noEmit, test, then commit.")
print("Then: git reset apply_session_simple.py  (don't commit the script)")
