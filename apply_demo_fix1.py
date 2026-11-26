"""
apply_demo_fix1.py  -  run on the `demo` branch of F:\\O-frontend.
Fixes the Doctor login crash: the doctor screen looks up the doctor by user.doctorId and
needs sessions, timings and fee fields. Also gives bookings the real field names.
"""
import os, sys

P = os.path.join("src", "demo", "demoMode.ts")
if not os.path.exists(P):
    sys.exit("Run this from F:\\O-frontend (src/demo/demoMode.ts missing)")
s = open(P, encoding="utf-8").read()
if "tokensPerSession" in s:
    sys.exit("Already applied.")


def rep(old, new, label):
    global s
    if old not in s:
        sys.exit("Could not find: " + label + ". Send me src/demo/demoMode.ts")
    s = s.replace(old, new, 1)


rep('status: "available", isAvailable: true, onBreak: false,',
    'status: "available", isAvailable: true, onBreak: false,\n'
    '  price: 300 + i * 100, tokensPerSession: 30, doctorFee: 300 + i * 100, code: "DOC" + (i + 1),\n'
    '  sessions: ["morning", "afternoon"], bio: "Experienced consultant at Demo City Hospital.", photo: null,\n'
    '  sessionTimings: { morning: { start: "09:00", end: "13:00" }, afternoon: { start: "16:00", end: "20:00" } },\n'
    '  yearsOfExperience: String(6 + i * 3), education: "MBBS, MD", languages: ["English", "Tamil"], walkInInterval: 10,',
    "doctor fields")

rep('status: statuses[i],',
    'status: statuses[i] === "completed" ? "completed" : "confirmed", queueStatus: statuses[i],',
    "booking status")

rep('sessionId: "sess-" + (i % 3),',
    'session: "morning", sessionId: d.id + "_" + today + "_morning", patientId: "pt-" + (i + 1),\n'
    '    hospitalName: "Demo City Hospital", paymentDone: true, complaint: reasons[i % reasons.length],\n'
    '    patientAge: 22 + i * 3, patientGender: i % 2 ? "Female" : "Male", patientArea: "Trichy",',
    "booking session")

rep('role: "doctor", hospitalId: HID,', 'role: "doctor", doctorId: "doc-1", hospitalId: HID,', "doctor user")

open(P, "w", encoding="utf-8", newline="\n").write(s)
print("Done. Next: npx tsc --noEmit")
