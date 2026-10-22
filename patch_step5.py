#!/usr/bin/env python3
"""
Doctor Booked - STEP 5: Maternity profile keeps its values after Save.

 - dates (LMP / EDD) are normalised so the date boxes always fill (they were blank on reopen)
 - after Save the form stays open and is refilled from what the server saved, so values can be adjusted
 - same component is used by hospital admin and nurse screens, so this fixes both

Run from the repo root (the folder that contains src/):
    python patch_step5.py
Then:
    git diff --stat
    npx tsc --noEmit
"""
import os
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
P = os.path.join(ROOT, "src", "pages", "hospital-admin", "MaternityModal.tsx")

with open(P, "r", encoding="utf-8") as f:
    s = f.read()


def sub(src, old, new, label):
    n = src.count(old)
    if n != 1:
        sys.exit(f"ABORT [{label}]: expected 1 match, found {n}. Nothing was written.")
    return src.replace(old, new)


# 1. helpers: date normaliser + one place that turns a saved profile into form values
HELPERS = '''
// date inputs only accept yyyy-mm-dd; a timestamp like 2026-03-20T00:00:00.000Z leaves the box blank
function normDate(v: any): string {
  if (!v) return "";
  const s = String(v);
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function profileToForm(p: any) {
  return {
    lmp: normDate(p.lmp), edd: normDate(p.edd),
    gravida: p.gravida ?? "", para: p.para ?? "", abortions: p.abortions ?? "", living: p.living ?? "",
    previousCs: String(p.previous_cs ?? 0), bloodGroup: p.blood_group || "",
    riskLevel: p.risk_level || "low", riskFactors: Array.isArray(p.risk_factors) ? p.risk_factors : [],
    bookingStatus: p.booking_status || "booked", allergies: p.allergies || "",
    heightCm: p.height_cm ?? "", prePregWeight: p.pre_preg_weight ?? "",
    attendantName: p.attendant_name || "", attendantPhone: p.attendant_phone || "",
    deliveryPlan: p.delivery_plan || "", notes: p.notes || "",
  } as any;
}
'''
s = sub(s, "function gaText(lmp: string) {", HELPERS.lstrip("\n") + "\nfunction gaText(lmp: string) {", "helpers")

# 2. load: use the shared converter
OLD_LOAD = '''        if (r.profile) {
          const p = r.profile;
          setF({
            lmp: p.lmp || "", edd: p.edd || "",
            gravida: p.gravida ?? "", para: p.para ?? "", abortions: p.abortions ?? "", living: p.living ?? "",
            previousCs: String(p.previous_cs ?? 0), bloodGroup: p.blood_group || "",
            riskLevel: p.risk_level || "low", riskFactors: Array.isArray(p.risk_factors) ? p.risk_factors : [],
            bookingStatus: p.booking_status || "booked", allergies: p.allergies || "",
            heightCm: p.height_cm ?? "", prePregWeight: p.pre_preg_weight ?? "",
            attendantName: p.attendant_name || "", attendantPhone: p.attendant_phone || "",
            deliveryPlan: p.delivery_plan || "", notes: p.notes || "",
          } as any);
        }
'''
NEW_LOAD = '''        if (r.profile) setF(profileToForm(r.profile));
'''
s = sub(s, OLD_LOAD, NEW_LOAD, "load")

# 3. save: stay open and refill from the saved record
OLD_SAVE = '''      await maternityApi.save(inwardId, { ...f, previousCs: Number(f.previousCs) || 0 });
      toast.success("Maternity profile saved");
      onClose();
'''
NEW_SAVE = '''      const saved = await maternityApi.save(inwardId, { ...f, previousCs: Number(f.previousCs) || 0 });
      if (saved) setF(profileToForm(saved));
      toast.success("Maternity profile saved");
'''
s = sub(s, OLD_SAVE, NEW_SAVE, "save")

# 4. the left button is now a plain Close
s = sub(s, '<button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">Cancel</button>',
           '<button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">Close</button>', "close button")

with open(P, "w", encoding="utf-8", newline="\n") as f:
    f.write(s)

print("Done. Now run: git diff --stat   then   npx tsc --noEmit")
