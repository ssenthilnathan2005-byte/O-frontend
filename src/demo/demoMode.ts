/* DEMO BUILD ONLY: fake server + auto login. Never merge this branch into main. */
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
  role: "hospital_admin", hospitalId: HID, hospital_id: HID, hospitalName: "Demo City Hospital",
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

function route(method: string, path: string): any {
  const p = path.replace(/^.*?\/api/, "").replace(/\/+$/, "");
  if (method !== "GET") return { ok: true, success: true, id: "demo-" + Date.now() };
  if (/^\/auth\/me$|^\/me$|\/patients\/profile$/.test(p)) return currentUser();
  if (/^\/hospitals\/[^/]+\/website/.test(p)) return {};
  if (/^\/hospitals\/[^/]+$/.test(p)) return hospital;
  if (p === "/hospitals") return [hospital];
  if (/^\/dashboard\/kpis/.test(p)) return kpis;
  if (/^\/doctors/.test(p)) return doctors;
  if (/\/wards/.test(p)) return wards;
  if (/^\/inward/.test(p)) return inward;
  if (/bed-bookings\/free/.test(p)) return wards.flatMap((w: any) => w.beds.filter((b: any) => b.status === "available"));
  if (/bookings|\/hospital\/patients|^\/patients/.test(p)) return patients;
  if (/pharmacy\/medicines|pharmacy\/stock|pharmacy\/inventory/.test(p)) return medicines;
  if (/pharmacy\/prescriptions|^\/prescriptions/.test(p)) return prescriptions;
  if (/^\/doctor/.test(p)) return patients;
  return [];
}

function fakeJwt(u: any): string {
  const b64 = (o: any) => btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
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
