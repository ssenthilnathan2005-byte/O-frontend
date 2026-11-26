"""
apply_demo_roles.py  -  run ONLY on the `demo` branch of F:\\O-frontend, after apply_demo.py.

Adds a "choose a demo login" screen (Hospital Admin / Doctor / Pharmacy / Nurse).
One tap logs straight in, no username or password. Logout brings the screen back.
"""
import os, sys

P = os.path.join("src", "demo", "demoMode.ts")
if not os.path.exists(P):
    sys.exit("Run this from F:\\O-frontend on the demo branch (src/demo/demoMode.ts missing)")

s = open(P, encoding="utf-8").read()
if "demo-picker" in s:
    sys.exit("Already applied.")

# 1. /auth/me should return whoever is logged in right now
old_me = "if (/^\\/auth\\/me$|^\\/me$|\\/patients\\/profile$/.test(p)) return user;"
if old_me not in s:
    sys.exit("Could not find the auth/me line in demoMode.ts. Send me the first 120 lines of that file.")
s = s.replace(old_me, "if (/^\\/auth\\/me$|^\\/me$|\\/patients\\/profile$/.test(p)) return currentUser();")

# 2. extra sample data for pharmacy / doctor screens
extras = '''  if (/pharmacy\\/medicines|pharmacy\\/stock|pharmacy\\/inventory/.test(p)) return medicines;
  if (/pharmacy\\/prescriptions|^\\/prescriptions/.test(p)) return prescriptions;
  if (/^\\/doctor/.test(p)) return patients;
  return [];
}'''
marker = "  return [];\n}"
if marker not in s:
    sys.exit("Could not find the end of route() in demoMode.ts. Send me that file.")
s = s.replace(marker, extras, 1)

data_block = '''
const medicines: any[] = [
  ["Paracetamol 500mg", "Paracetamol", "Tablet", 240, 2], ["Amoxicillin 500mg", "Amoxicillin", "Capsule", 120, 9],
  ["Cetirizine 10mg", "Cetirizine", "Tablet", 180, 3], ["Cough Syrup 100ml", "Dextromethorphan", "Syrup", 60, 85],
  ["Pantoprazole 40mg", "Pantoprazole", "Tablet", 150, 7], ["ORS Sachet", "ORS", "Sachet", 300, 12],
  ["Metformin 500mg", "Metformin", "Tablet", 200, 4], ["Azithromycin 500mg", "Azithromycin", "Tablet", 90, 22],
].map((m: any[], i) => ({
  id: "med-" + (i + 1), name: m[0], medicineName: m[0], genericName: m[1], category: m[2], form: m[2],
  stock: m[3], quantity: m[3], price: m[4], mrp: m[4], batch: "B" + (2610 + i), expiry: "2027-12-31",
  hospitalId: HID, hospital_id: HID,
}));

const prescriptions: any[] = patients.slice(0, 5).map((p: any, i: number) => ({
  id: "rx-" + (i + 1), patientName: p.patientName, patient_name: p.patientName, doctorName: p.doctorName,
  doctor_name: p.doctorName, status: i < 2 ? "pending" : "dispensed", createdAt: p.createdAt,
  created_at: p.createdAt, hospitalId: HID, medicines: [
    { name: medicines[i].name, dosage: "1-0-1", days: 5, quantity: 10 },
    { name: medicines[(i + 2) % medicines.length].name, dosage: "0-0-1", days: 3, quantity: 3 },
  ],
}));

const roleUsers: Record<string, any> = {
  hospital_admin: user,
  doctor: { id: "doc-1", name: "Dr. Arun Kumar", email: "doctor1@demohospital.in", phone: "9876500110",
    role: "doctor", hospitalId: HID, hospital_id: HID, hospitalName: "Demo City Hospital",
    specialty: "General Medicine", specialization: "General Medicine" },
  pharmacy: { id: "ph-1", name: "Demo Pharmacy", email: "pharmacy@demohospital.in", phone: "9876500120",
    role: "pharmacy", hospitalId: HID, hospital_id: HID, hospitalName: "Demo City Hospital" },
  nurse: { id: "nr-1", name: "Nurse Priya", email: "nurse@demohospital.in", phone: "9876500130",
    role: "nurse", hospitalId: HID, hospital_id: HID, hospitalName: "Demo City Hospital" },
};

function currentUser(): any {
  try { return JSON.parse(localStorage.getItem("db_user") || "null") || user; } catch { return user; }
}
'''

# 3. replace everything from fakeJwt to the end of the file
cut = s.index("function fakeJwt()")
head = s[:cut]
# put data block before route() so the consts exist when route runs (they are only read at call time)
tail = '''function fakeJwt(u: any): string {
  const b64 = (o: any) => btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
  return b64({ alg: "none", typ: "JWT" }) + "." +
    b64({ id: u.id, role: u.role, hospitalId: HID, exp: 4102444800 }) + ".demo";
}

const ROLE_CARDS: [string, string, string][] = [
  ["hospital_admin", "Hospital Admin", "Live patients, wards, doctors, IPD"],
  ["doctor", "Doctor", "Consultation queue and prescriptions"],
  ["pharmacy", "Pharmacy", "Stock and prescriptions"],
  ["nurse", "Nurse", "Vitals and bed care"],
];

function pick(key: string) {
  const u = roleUsers[key];
  try {
    localStorage.setItem("db_jwt", fakeJwt(u));
    localStorage.setItem("db_user", JSON.stringify(u));
  } catch { /* ignore */ }
  document.getElementById("demo-picker")?.remove();
  window.location.href = key === "hospital_admin" ? "/admin/patients" : "/";
}

function showPicker() {
  if (document.getElementById("demo-picker") || !document.body) return;
  const el = document.createElement("div");
  el.id = "demo-picker";
  el.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#0b1f2a;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;gap:12px;font-family:system-ui,sans-serif;color:#fff;padding:24px;overflow:auto";
  el.innerHTML = '<div style="font-size:28px;font-weight:700">Doctor Booked</div>' +
    '<div style="opacity:.75;margin-bottom:12px;text-align:center">Pick a demo login. No password needed.</div>';
  ROLE_CARDS.forEach(([key, title, sub]) => {
    const b = document.createElement("button");
    b.style.cssText = "width:100%;max-width:340px;text-align:left;padding:14px 18px;border-radius:14px;border:1px solid #1f4b5c;" +
      "background:#12303d;color:#fff;cursor:pointer;font-size:17px;font-weight:600";
    b.innerHTML = title + '<div style="font-size:13px;font-weight:400;opacity:.7;margin-top:3px">' + sub + "</div>";
    b.onclick = () => pick(key);
    el.appendChild(b);
  });
  document.body.appendChild(el);
}

export function installDemo() {
  const orig = window.fetch.bind(window);
  window.fetch = (async (input: any, init?: any) => {
    let u: URL;
    try { u = new URL(typeof input === "string" ? input : input.url, window.location.href); }
    catch { return orig(input, init); }
    const isApi = u.pathname.includes("/api/") || u.pathname.endsWith("/api") || u.port === "4000";
    if (!isApi) return orig(input, init);
    const method = ((init && init.method) || (typeof input !== "string" && input.method) || "GET").toUpperCase();
    await new Promise((r) => setTimeout(r, 120));
    return new Response(JSON.stringify(route(method, u.pathname)), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof window.fetch;

  const check = () => { if (!localStorage.getItem("db_user")) showPicker(); };
  check();
  window.setInterval(check, 400);
}
'''
# data block goes just before route()
ridx = head.index("function route(")
head = head[:ridx] + data_block + "\n" + head[ridx:]
open(P, "w", encoding="utf-8", newline="\n").write(head + tail)
print("Done: role picker added to src/demo/demoMode.ts")
print("Next: npx tsc --noEmit")
