import io

def patch(path, pairs):
    with io.open(path, "r", encoding="utf-8", newline="") as fh:
        t = fh.read()
    for old, new, label in pairs:
        if new in t:
            print("SKIP : " + label)
        elif old in t:
            t = t.replace(old, new, 1)
            print("OK   : " + label)
        else:
            print("MISS : " + label)
    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(t)

patch("src/pages/hospital-admin/HAPatients.tsx", [
    ('{b.patientAge} yrs</p>',
     '{b.patientAge} yrs{b.patientArea ? ` · ${b.patientArea}` : ""}{b.patientBloodGroup ? ` · ${b.patientBloodGroup}` : ""}</p>',
     "HAPatients: area + blood group under age"),
])

patch("src/components/PrescriptionDialog.tsx", [
    ('patientAge?: number;',
     'patientAge?: number;\n  patientArea?: string;\n  patientBloodGroup?: string;',
     "PrescriptionDialog: booking type"),
    ('{booking.patientAge != null && ` · ${booking.patientAge} yrs`}',
     '{booking.patientAge != null && ` · ${booking.patientAge} yrs`}{booking.patientBloodGroup && ` · ${booking.patientBloodGroup}`}',
     "PrescriptionDialog: blood group next to age"),
])
