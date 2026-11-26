"""
apply_demo.py  -  run ONLY on the `demo` branch of F:\\O-frontend.

What it does:
  1. Adds src/demo/demoMode.ts  (fake server with sample data + auto login as hospital admin)
  2. main.tsx            -> turns the demo mode on
  3. App.tsx             -> removes the yellow "waking / offline" strip
  4. HospitalAdminPanel  -> keeps only Dashboard, Live Patients (first, starred),
                            Beds & Wards, Doctors, IPD / Inward

Nothing here touches main. Never merge `demo` into `main`.
"""
import os, re, sys

ROOT = os.getcwd()
if not os.path.exists(os.path.join(ROOT, "src", "main.tsx")):
    sys.exit("Run this from F:\\O-frontend")


def rd(p):
    with open(os.path.join(ROOT, p), "r", encoding="utf-8") as f:
        return f.read()


def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)


# ---- detect which role spelling the app uses for hospital admin ----------
variants = ["hospital_admin", "hospital-admin", "hospitalAdmin"]
counts = {v: 0 for v in variants}
for dp, dn, fn in os.walk(os.path.join(ROOT, "src")):
    for f in fn:
        if f.endswith((".ts", ".tsx")) and ".bak" not in f:
            try:
                t = open(os.path.join(dp, f), encoding="utf-8").read()
            except Exception:
                continue
            for v in variants:
                counts[v] += t.count('"' + v + '"')
ROLE = max(counts, key=counts.get) if max(counts.values()) > 0 else "hospital_admin"
print("role spelling counts:", counts, "-> using", ROLE)

# ---- 1. demo layer -------------------------------------------------------
DEMO_TS = r'''/* DEMO BUILD ONLY: fake server + auto login. Never merge this branch into main. */
const HID = "demo-hospital";
const NOW = Date.now();
const iso = (minAgo: number) => new Date(NOW - minAgo * 60000).toISOString();
const today = new Date().toISOString().slice(0, 10);

const hospital: any = {
  id: HID, name: "Demo City Hospital", city: "Tiruchirappalli", address: "12 Main Road, Trichy",
  phone: "0431 2400000", email: "admin@demohospital.in", status: "active", approved: true,
  isApproved: true, type: "Multi-speciality", beds: 24,
};

const user: any = {
  id: "demo-admin", name: "Demo Hospital Admin", email: "admin@demohospital.in", phone: "9876500000",
  role: "__ROLE__", hospitalId: HID, hospital_id: HID, hospitalName: "Demo City Hospital",
};

const docNames: [string, string][] = [
  ["Dr. Arun Kumar", "General Medicine"], ["Dr. Meera Nair", "Paediatrics"],
  ["Dr. Suresh Babu", "Orthopaedics"], ["Dr. Lakshmi Priya", "Gynaecology"],
  ["Dr. Rahman Ali", "Cardiology"],
];
const doctors: any[] = docNames.map(([name, sp], i) => ({
  id: "doc-" + (i + 1), hospitalId: HID, hospital_id: HID, name, specialty: sp, specialization: sp,
  department: sp, qualification: "MBBS, MD", experience: 6 + i * 3, phone: "98765001" + (10 + i),
  email: "doctor" + (i + 1) + "@demohospital.in", fee: 300 + i * 100, consultationFee: 300 + i * 100,
  status: "available", isAvailable: true, onBreak: false,
}));

const pNames = ["Ravi Shankar", "Anitha Devi", "Karthik Raja", "Divya Bharathi", "Mohamed Irfan", "Sangeetha M",
  "Vignesh Kumar", "Priya Dharshini", "Balaji S", "Revathi K", "Naveen Raj", "Kavitha R"];
const reasons = ["Fever", "Cough", "Fatigue / Weakness", "Back pain", "Headache", "Routine check-up"];
const statuses = ["in_consultation", "waiting", "waiting", "waiting", "waiting", "waiting", "completed", "completed",
  "completed", "completed", "completed", "completed"];
const patients: any[] = pNames.map((name, i) => {
  const d = doctors[i % doctors.length];
  return {
    id: "bk-" + (i + 1), tokenNumber: i + 1, token_number: i + 1, token: i + 1, patientName: name,
    patient_name: name, name, phone: "98400" + (10000 + i * 37), age: 22 + i * 3, gender: i % 2 ? "Female" : "Male",
    uhid: "UH" + (100200 + i), doctorId: d.id, doctorName: d.name, doctor_name: d.name, specialty: d.specialty,
    status: statuses[i], reason: reasons[i % reasons.length], hospitalId: HID, hospital_id: HID,
    sessionId: "sess-" + (i % 3), date: today, time: (9 + Math.floor(i / 2)) + ":" + (i % 2 ? "30" : "00"),
    createdAt: iso(200 - i * 12), created_at: iso(200 - i * 12), paymentStatus: "paid", amount: d.fee,
  };
});

const mkBeds = (prefix: string, n: number, occ: string[]) =>
  Array.from({ length: n }, (_, i) => ({
    id: prefix + "-" + (i + 1), number: prefix + "-" + String(i + 1).padStart(2, "0"),
    bedNumber: prefix + "-" + String(i + 1).padStart(2, "0"), label: prefix + "-" + String(i + 1).padStart(2, "0"),
    status: i < occ.length ? "occupied" : "available", patientName: i < occ.length ? occ[i] : null,
  }));
const wardDefs: [string, string, number, string, string[]][] = [
  ["w-1", "General Ward", 12, "G", ["Suresh Kumar", "Malathi R", "Arjun P"]],
  ["w-2", "ICU", 4, "ICU", ["Ramesh T"]],
  ["w-3", "Private Rooms", 8, "P", ["Fatima Begum", "Gopal S"]],
];
const wards: any[] = wardDefs.map(([id, name, n, pre, occ]) => ({
  id, hospitalId: HID, hospital_id: HID, name, type: name, floor: 1, totalBeds: n, total_beds: n,
  occupiedBeds: occ.length, occupied: occ.length, availableBeds: n - occ.length, available: n - occ.length,
  ratePerDay: pre === "ICU" ? 5000 : pre === "P" ? 2500 : 800, beds: mkBeds(pre, n, occ),
}));

const inward: any[] = [
  ["Suresh Kumar", 54, "Male", "General Ward", "G-01", "Dr. Arun Kumar", "Pneumonia"],
  ["Malathi R", 47, "Female", "General Ward", "G-02", "Dr. Meera Nair", "Dengue fever"],
  ["Arjun P", 31, "Male", "General Ward", "G-03", "Dr. Suresh Babu", "Fracture - left leg"],
  ["Ramesh T", 63, "Male", "ICU", "ICU-01", "Dr. Rahman Ali", "Cardiac monitoring"],
  ["Fatima Begum", 38, "Female", "Private Rooms", "P-01", "Dr. Lakshmi Priya", "Post-delivery care"],
].map((r: any[], i) => ({
  id: "ip-" + (i + 1), patientName: r[0], patient_name: r[0], name: r[0], age: r[1], gender: r[2],
  ward: r[3], wardName: r[3], bed: r[4], bedNumber: r[4], bed_number: r[4], doctorName: r[5],
  doctor_name: r[5], diagnosis: r[6], status: "admitted", hospitalId: HID,
  admittedAt: iso(1440 * (i + 1)), admitted_at: iso(1440 * (i + 1)), phone: "98410" + (20000 + i * 91),
}));

const kpis: any = {
  totalPatients: 148, patients: 148, totalBookings: 162, bookings: 162, opdPatients: 121, ipdPatients: 27,
  admissions: 5, activeAdmissions: 5, totalRevenue: 186500, revenue: 186500, opdRevenue: 72500,
  ipdRevenue: 94000, pharmacyRevenue: 14000, labRevenue: 6000, doctors: doctors.length,
  totalDoctors: doctors.length, occupiedBeds: 6, availableBeds: 18, totalBeds: 24,
  series: [], daily: [], trend: [], byDoctor: [], bySpecialty: [],
};

function route(method: string, path: string): any {
  const p = path.replace(/^.*?\/api/, "").replace(/\/+$/, "");
  if (method !== "GET") return { ok: true, success: true, id: "demo-" + Date.now() };
  if (/^\/auth\/me$|^\/me$|\/patients\/profile$/.test(p)) return user;
  if (/^\/hospitals\/[^/]+\/website/.test(p)) return {};
  if (/^\/hospitals\/[^/]+$/.test(p)) return hospital;
  if (p === "/hospitals") return [hospital];
  if (/^\/dashboard\/kpis/.test(p)) return kpis;
  if (/^\/doctors/.test(p)) return doctors;
  if (/\/wards/.test(p)) return wards;
  if (/^\/inward/.test(p)) return inward;
  if (/bed-bookings\/free/.test(p)) return wards.flatMap((w: any) => w.beds.filter((b: any) => b.status === "available"));
  if (/bookings|\/hospital\/patients|^\/patients/.test(p)) return patients;
  return [];
}

function fakeJwt(): string {
  const b64 = (o: any) => btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return b64({ alg: "none", typ: "JWT" }) + "." +
    b64({ id: user.id, role: user.role, hospitalId: HID, exp: 4102444800 }) + ".demo";
}

export function installDemo() {
  try {
    localStorage.setItem("db_jwt", fakeJwt());
    localStorage.setItem("db_user", JSON.stringify(user));
  } catch { /* ignore */ }

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

  const here = window.location.pathname;
  if (here === "/" || here === "/login" || here.startsWith("/login")) {
    window.history.replaceState(null, "", "/admin/patients");
  }
}
'''
wr("src/demo/demoMode.ts", DEMO_TS.replace("__ROLE__", ROLE))
print("1. wrote src/demo/demoMode.ts")

# ---- 2. main.tsx ---------------------------------------------------------
m = rd("src/main.tsx")
if "installDemo" not in m:
    m = m.replace('import "./index.css";', 'import "./index.css";\nimport { installDemo } from "./demo/demoMode";', 1)
    m = m.replace("initTranslate();", "installDemo();\ninitTranslate();", 1)
    wr("src/main.tsx", m)
    print("2. patched main.tsx")
else:
    print("2. main.tsx already patched")

# ---- 3. App.tsx: remove yellow strip -------------------------------------
a = rd("src/App.tsx")
a2 = a.replace('serverStatus === "waking" &&', "false &&").replace('serverStatus === "offline" &&', "false &&")
if a2 != a:
    wr("src/App.tsx", a2)
    print("3. patched App.tsx (yellow strip removed)")
else:
    print("3. App.tsx: strip text not found, send me lines 570-600 of src/App.tsx")

# ---- 4. HospitalAdminPanel: keep only 5 modules --------------------------
P = "src/pages/hospital-admin/HospitalAdminPanel.tsx"
lines = rd(P).split("\n")
drop = re.compile(r'^\s*\{\s*path:\s*"/admin/(functioning|activity|billing|all-patients|attendance|front-desk|hr|inventory|lab|nurses|permissions|passwords)"')
drop_pharm = re.compile(r'path:\s*"/admin/pharmacy"[^}]*label:\s*"Pharmacy"')
out, live = [], None
for ln in lines:
    if drop.search(ln) or drop_pharm.search(ln):
        continue
    if re.search(r'path:\s*"/admin/patients"[^}]*label:\s*"Live Patients"', ln):
        live = ln.replace('label: "Live Patients"', 'label: "Live Patients \u2605"')
        continue
    out.append(ln)
if live:
    for i, ln in enumerate(out):
        if re.search(r'path:\s*"/admin/dashboard"', ln):
            out.insert(i + 1, live)
            break
    wr(P, "\n".join(out))
    print("4. patched HospitalAdminPanel.tsx (5 modules, Live Patients starred)")
else:
    print("4. Live Patients line not found, nothing changed in the panel")

print("\nDONE. Next: npx tsc --noEmit, then npm run dev to test.")
