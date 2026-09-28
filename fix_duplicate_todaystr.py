FILE = "src/pages/hospital-admin/HAInward.tsx"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

old = '''function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  patientName: "", phone: "", age: "", gender: "", ward: "",
  bedNumber: "", admittingDoctorName: "", diagnosis: "", notes: "",
  admittedAt: todayStr(),
};'''
new = '''const EMPTY_FORM = {
  patientName: "", phone: "", age: "", gender: "", ward: "",
  bedNumber: "", admittingDoctorName: "", diagnosis: "", notes: "",
  admittedAt: todayStr(),
};'''

if old not in content:
    print("ERROR: anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old, new, 1)

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("Success: removed duplicate todayStr() declaration.")
