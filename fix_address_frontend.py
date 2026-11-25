"""
Frontend (O-frontend): add an Address box to
  - Front Office > Admit inpatient
  - Front Office > Register patient
Existing patients picked by UHID/phone get their saved address filled in.
Run from the O-frontend folder:  python fix_address_frontend.py
Stops without changing anything if the code differs from what is expected.
"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
FO = root / "src/pages/FrontOfficeDashboard.tsx"

def load(p):
    raw = p.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n"), "\r\n" in raw

def save(p, s, crlf):
    p.write_bytes((s.replace("\n", "\r\n") if crlf else s).encode("utf-8"))

def rep(s, old, new, label):
    if s.count(old) != 1:
        sys.exit(f"STOP: '{label}' not found exactly once - nothing was changed.")
    return s.replace(old, new)

fo, crlf = load(FO)
if "f.patientArea" in fo or "f.area" in fo:
    sys.exit("Already patched - nothing to do.")

# ---- Register patient ----
fo = rep(fo,
  'date: today, uhid: "", phoneRelation: "" };',
  'date: today, uhid: "", phoneRelation: "", patientArea: "" };',
  "register empty state")
fo = rep(fo,
  'patientGender: g || p.patientGender }));',
  'patientGender: g || p.patientGender, patientArea: r.area || p.patientArea }));',
  "register onPick")
fo = rep(fo,
  'age: "", patientGender: "", phoneRelation: "" }));',
  'age: "", patientGender: "", phoneRelation: "", patientArea: "" }));',
  "register onNew")
fo = rep(fo,
  '<div className="space-y-1.5"><Label className="block">Type of doctor</Label>',
  '<div className="space-y-1.5"><Label className="block">Address</Label><Input style={{ height: 40 }} placeholder="Street, area, city" value={f.patientArea} onChange={(e) => setF({ ...f, patientArea: e.target.value })} /></div>\n      <div className="space-y-1.5"><Label className="block">Type of doctor</Label>',
  "register address box")

# ---- Admit inpatient ----
fo = rep(fo,
  'notes: "", uhid: "" };',
  'notes: "", uhid: "", area: "" };',
  "admit empty state")
fo = rep(fo,
  'gender: r.gender || p.gender }))} />',
  'gender: r.gender || p.gender, area: r.area || p.area }))} />',
  "admit onPick")
fo = rep(fo,
  'patientName: f.patientName, phone: f.phone, age: f.age, gender: f.gender, uhid: found ? found.uhid : undefined, confirmNew,',
  'patientName: f.patientName, phone: f.phone, age: f.age, gender: f.gender, area: f.area, uhid: found ? found.uhid : undefined, confirmNew,',
  "admit submit payload")
fo = rep(fo,
  '<div className="space-y-1"><Label>Ward / bed *</Label>',
  '<div className="space-y-1"><Label>Address</Label><Input placeholder="Street, area, city" value={f.area} onChange={e => setF({ ...f, area: e.target.value })} /></div>\n        <div className="space-y-1"><Label>Ward / bed *</Label>',
  "admit address box")

save(FO, fo, crlf)
print("Patched:", FO.name)
