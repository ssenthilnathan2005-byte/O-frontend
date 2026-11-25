"""
Frontend (O-frontend): show gender + patient area in
  - Front Office > Admit inpatient > "Currently admitted"
  - Front Office > Bed requests (IPD bed bookings)
Run from the O-frontend folder:  python fix_location_frontend.py
Stops without changing anything if the code differs from what is expected.
"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
FO = root / "src/pages/FrontOfficeDashboard.tsx"
HB = root / "src/pages/hospital-admin/HABedRequests.tsx"

def load(p):
    raw = p.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n"), "\r\n" in raw

def save(p, s, crlf):
    p.write_bytes((s.replace("\n", "\r\n") if crlf else s).encode("utf-8"))

def rep(s, old, new, label):
    if s.count(old) != 1:
        sys.exit(f"STOP: '{label}' not found exactly once - nothing was changed.")
    return s.replace(old, new)

fo, fo_crlf = load(FO)
hb, hb_crlf = load(HB)
if "p.area" in fo or "b.area" in hb:
    sys.exit("Already patched - nothing to do.")

fo = rep(fo,
  "admitting_doctor_name: string | null; diagnosis: string | null; admitted_at: string;",
  "admitting_doctor_name: string | null; diagnosis: string | null; admitted_at: string; area?: string | null;",
  "Admitted interface")
fo = rep(fo,
  "[p.patient_name, p.phone, p.ward, p.bed_number, p.admitting_doctor_name, p.diagnosis]",
  "[p.patient_name, p.phone, p.ward, p.bed_number, p.admitting_doctor_name, p.diagnosis, p.gender, p.area]",
  "admitted search fields")
fo = rep(fo,
  'placeholder="Search admitted patients (name, phone, ward, bed, doctor)"',
  'placeholder="Search admitted patients (name, phone, ward, bed, doctor, area)"',
  "search placeholder")
fo = rep(fo,
  '<p className="font-medium text-gray-900">{p.patient_name}{p.age != null ? ", " + p.age : ""}</p>',
  '<p className="font-medium text-gray-900">{p.patient_name}{p.age != null ? ", " + p.age : ""}{p.gender ? " · " + p.gender : ""}</p>',
  "admitted name line")
fo = rep(fo,
  '<p className="text-xs text-gray-500">{p.ward} / {p.bed_number}{p.admitting_doctor_name ? " | " + p.admitting_doctor_name : ""}</p>',
  '<p className="text-xs text-gray-500">{p.ward} / {p.bed_number}{p.admitting_doctor_name ? " | " + p.admitting_doctor_name : ""}</p>\n              {p.area && <p className="text-xs text-gray-500">Area: {p.area}</p>}',
  "admitted ward line")

hb = rep(hb,
  '{shortPhone(b.phone)}{b.doctor_name ? " · " + b.doctor_name : ""}',
  '{shortPhone(b.phone)}{b.doctor_name ? " · " + b.doctor_name : ""}{b.area ? " · Area: " + b.area : ""}',
  "bed request contact line")

save(FO, fo, fo_crlf)
save(HB, hb, hb_crlf)
print("Patched:", FO.name, "and", HB.name)
