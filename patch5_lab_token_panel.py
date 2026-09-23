FILE = "src/pages/LabTokenPanel.tsx"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

old_import = 'import { Loader2, MapPin, Phone } from "lucide-react";'
new_import = 'import { Clock, Loader2, MapPin, Phone } from "lucide-react";'
if old_import not in content:
    print("ERROR: Could not find lucide-react import. No changes made.")
    raise SystemExit(1)
content = content.replace(old_import, new_import, 1)

old_grid_button = '''                      <button
                        key={n}
                        type="button"
                        onClick={() => setDlg(n)}
                        title={b ? b.patient_name : ""}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 text-sm font-semibold transition-all hover:scale-105 ${TOKEN_CLASS[st] || TOKEN_CLASS.red} ${st === "orange" ? "scale-110 shadow-lg" : ""} ${b?.status === "cancelled" ? "opacity-50 line-through" : ""}`}
                      >
                        {n}
                      </button>'''

new_grid_button = '''                      <button
                        key={n}
                        type="button"
                        onClick={() => setDlg(n)}
                        title={b ? b.patient_name : ""}
                        className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 text-sm font-semibold transition-all hover:scale-105 ${TOKEN_CLASS[st] || TOKEN_CLASS.red} ${st === "orange" ? "scale-110 shadow-lg" : ""} ${b?.status === "cancelled" ? "opacity-50 line-through" : ""}`}
                      >
                        {n}
                        {b?.late_flag && (st === "red" || st === "yellow") && (
                          <span
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow ring-2 ring-white"
                            title="Patient is running late"
                          >
                            <Clock className="w-3 h-3" />
                          </span>
                        )}
                      </button>'''

if old_grid_button not in content:
    print("ERROR: Could not find token grid button block. No changes made.")
    raise SystemExit(1)
content = content.replace(old_grid_button, new_grid_button, 1)

old_dialog_block = '''              {dlgBooking.status === "cancelled" && <p className="text-xs font-semibold text-red-600">This booking was cancelled.</p>}
              <div className="pt-1">'''

new_dialog_block = '''              {dlgBooking.status === "cancelled" && <p className="text-xs font-semibold text-red-600">This booking was cancelled.</p>}
              {dlgBooking.late_flag && (dlgStatus === "red" || dlgStatus === "yellow") && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Patient is running late</p>
                    <p className="text-sm text-amber-900 font-medium mt-0.5">
                      {dlgBooking.late_eta_minutes ? `Will arrive in about ${dlgBooking.late_eta_minutes} min` : "Delay time not specified"}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">You may want to call the next token first.</p>
                  </div>
                </div>
              )}
              <div className="pt-1">'''

if old_dialog_block not in content:
    print("ERROR: Could not find dialog block. No changes made.")
    raise SystemExit(1)
content = content.replace(old_dialog_block, new_dialog_block, 1)

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)
print("Success: late badge and notice added to LabTokenPanel.tsx")
