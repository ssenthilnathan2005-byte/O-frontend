#!/usr/bin/env python3
"""
Doctor Booked bed button - STEP 2: bottom bar: Hospitals, Bookings, Home, Prescriptions, Login

Run from the repo root (the folder that contains src/):
    python patch_step2.py
Then:
    git diff
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


# ───────────────────────── 3. TopNav.tsx (bottom bar) ─────────────────────────
p = path("src", "components", "layout", "TopNav.tsx")
s = rd(p)

# guest bar: Hospitals · Bookings · Home · Prescriptions · Login
GUEST_PHARM = '''          <button
            type="button"
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-gray-400 hover:text-teal-600 transition-colors"
            onClick={() => navigate({ path: "/pharmacies" })}
            data-ocid="nav.link"
          >
            <Pill className="w-5 h-5"  strokeWidth={2} />
            <span className="text-[10px] font-medium">Pharmacies</span>
          </button>
'''
GUEST_BOOK = '''          <button
            type="button"
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-gray-400 hover:text-teal-600 transition-colors"
            onClick={() => navigate({ path: "/patient/tokens" })}
            data-ocid="nav.link"
          >
            <BookOpen className="w-5 h-5"  strokeWidth={2} />
            <span className="text-[10px] font-medium">Bookings</span>
          </button>
'''
s = sub(s, GUEST_PHARM, GUEST_BOOK, "guest Pharmacies -> Bookings")

GUEST_AMB = '''          <button
            type="button"
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-gray-400 hover:text-red-500 transition-colors"
            onClick={() => navigate({ path: "/ambulance" })}
            data-ocid="nav.link"
          >
            <Ambulance className="w-5 h-5"  strokeWidth={2} />
            <span className="text-[10px] font-medium">Ambulance</span>
          </button>
'''
GUEST_RX = '''          <button
            type="button"
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-gray-400 hover:text-teal-600 transition-colors"
            onClick={() => navigate({ path: "/login", tab: "patient", patientMode: "login" })}
            data-ocid="nav.link"
          >
            <Pill className="w-5 h-5"  strokeWidth={2} />
            <span className="text-[10px] font-medium">Prescriptions</span>
          </button>
'''
s = sub(s, GUEST_AMB, GUEST_RX, "guest Ambulance -> Prescriptions")

# logged-in bar: remove the Admission tab (it is the floating button now)
ADM = '''          {showAdmission && (
            <button
              type="button"
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors ${isActive(["/patient/admission"])}`}
              onClick={() => navigate({ path: "/patient/admission" })}
            >
              <span className="relative">
                <BedDouble className="w-5 h-5" strokeWidth={2} />
                {admissionActive && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />}
              </span>
              <span className="text-[10px] font-medium">Admission</span>
            </button>
          )}

'''
s = sub(s, ADM, "", "remove Admission tab")
wr(p, s)


print("Done. Now run: git diff   then   npx tsc --noEmit")
