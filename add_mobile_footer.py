"""Adds About Us / Terms / Privacy links at the bottom of the phone home screen. Run from the O-frontend repo root."""
import sys

P = "src/pages/patient/PatientHomePage.tsx"
s = open(P, encoding="utf-8").read()

if "db-mobile-footer" in s:
    sys.exit("Already patched, nothing to do")

old = """          )}
        </div>
      </div>
    </div>
  );

  // ── Desktop dashboard"""

new = """          )}

          {/* db-mobile-footer */}
          <div className="mt-6 pt-5 border-t border-gray-200 text-center">
            <p className="text-sm font-bold text-gray-800">Doctor<span className="text-teal-500">Booked</span></p>
            <p className="text-xs text-gray-400 mt-1">Skip the waiting room. Track your token live.</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-gray-500">
              <button type="button" onClick={() => navigate({ path: "/about" })} className="hover:text-teal-600">About Us</button>
              <button type="button" onClick={() => navigate({ path: "/terms" })} className="hover:text-teal-600">Terms &amp; Conditions</button>
              <button type="button" onClick={() => navigate({ path: "/privacy" })} className="hover:text-teal-600">Privacy Policy</button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-400">
              <button type="button" onClick={() => navigate({ path: "/hospital-admin/login" })} className="hover:text-teal-600">Hospital Admin Login</button>
              <button type="button" onClick={() => navigate({ path: "/pharmacy-owner/login" })} className="hover:text-teal-600">Pharmacy Owner Login</button>
              <button type="button" onClick={() => navigate({ path: "/lab-admin/login" })} className="hover:text-teal-600">Lab Staff Login</button>
            </div>
            <p className="mt-4 text-[11px] text-gray-400">2026 Doctor Booked. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Desktop dashboard"""

if s.count(old) != 1:
    sys.exit(f"ABORT, nothing written: anchor found {s.count(old)} times")

open(P, "w", encoding="utf-8", newline="").write(s.replace(old, new))
print("patched", P)
