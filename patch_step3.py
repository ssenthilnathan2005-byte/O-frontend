#!/usr/bin/env python3
"""
Doctor Booked bed button - STEP 3: Bed Bookings & Receipts page: 'No bed bookings for now' + previous stays

Run from the repo root (the folder that contains src/):
    python patch_step3.py
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


# ───────────────────────── 4. MyAdmissionPage.tsx ─────────────────────────
p = path("src", "pages", "patient", "MyAdmissionPage.tsx")
s = rd(p)
s = sub(s, '<h1 className="font-bold text-lg">My Admission</h1>',
           '<h1 className="font-bold text-lg">Bed Bookings &amp; Receipts</h1>', "page title")

OLD_EMPTY = '''        {!loading && !err && current.length === 0 && open.length === 0 && past.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <BedDouble className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500">You have no admissions or bed requests.</p>
            <button onClick={() => navigate({ path: "/patient/hospitals" })} className="text-sm font-medium text-teal-700">Find a hospital</button>
          </div>
        )}
'''
s = sub(s, OLD_EMPTY, "", "remove old empty state")

NEW_NOTICE = '''        {!loading && !err && current.length === 0 && open.length === 0 && (
          <div className="rounded-2xl bg-white border border-gray-200 p-5 text-center space-y-2">
            <BedDouble className="w-9 h-9 text-gray-300 mx-auto" />
            <p className="text-sm font-semibold text-gray-800">No bed bookings for now</p>
            <p className="text-xs text-gray-500">
              {past.length > 0 ? "Your previous stays and receipts are below." : "When you book a bed, it will show here."}
            </p>
            {past.length === 0 && (
              <button onClick={() => navigate({ path: "/patient/hospitals" })} className="text-sm font-medium text-teal-700">Find a hospital</button>
            )}
          </div>
        )}

'''
s = sub(s, '        {err && <p className="text-sm text-red-600">{err}</p>}\n\n',
           '        {err && <p className="text-sm text-red-600">{err}</p>}\n\n' + NEW_NOTICE, "insert notice")
s = sub(s, '<h2 className="text-sm font-semibold text-gray-800">Past stays</h2>',
           '<h2 className="text-sm font-semibold text-gray-800">Previous stays &amp; receipts</h2>', "past heading")
wr(p, s)

print("Done. Now run: git diff   then   npx tsc --noEmit")
