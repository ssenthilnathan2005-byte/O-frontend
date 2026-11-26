/* DEMO BUILD ONLY: fake server + role picker. Never merge the demo branch into main. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const HID = "demo-hospital";
const HNAME = "Demo City Hospital";
const NOW = Date.now();
const iso = (minAgo: number) => new Date(NOW - minAgo * 60000).toISOString();
const ymd = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const today = ymd(new Date());
const uid = () => "demo-" + Math.random().toString(36).slice(2, 9);

// ── Hospital ───────────────────────────────────────────────────────────────
const hospital: any = {
  id: HID, name: HNAME, area: "Srirangam", city: "Tiruchirappalli", address: "12 Main Road, Srirangam, Trichy",
  phone: "0431 2400000", email: "admin@demohospital.in", rating: 4.6, gradient: "from-teal-500 to-emerald-600",
  photoUrl: null, website: null, doctorCount: 5, isFree: false, hasPharmacy: true, plan: "premium",
  ratePerToken: 10, hospitalType: "multispeciality", status: "active", approved: true, isApproved: true,
};

// ── Role users (shapes follow AppUser in api.ts) ───────────────────────────
const roleUsers: Record<string, any> = {
  hospital_admin: { id: "ha-1", name: "Demo Hospital Admin", role: "hospital_admin", hospitalId: HID, hospitalName: HNAME },
  doctor: { id: "du-1", name: "Dr. Arun Kumar", code: "DOC001", doctorId: "doc-1", role: "doctor", hospitalId: HID, hospitalName: HNAME },
  pharmacy: { id: "pu-1", name: "Demo Pharmacist", code: "PH001", pharmacyStaffId: "ph-1", role: "pharmacy", hospitalId: HID, hospitalName: HNAME },
  nurse: { id: "nu-1", name: "Nurse Priya", code: "NUR001", nurseId: "nr-1", role: "nurse", hospitalId: HID, hospitalName: HNAME },
};
const ROLE_CARDS: [string, string, string][] = [
  ["hospital_admin", "Hospital Admin", "Live patients, wards, doctors, IPD"],
  ["doctor", "Doctor", "Token queue and prescriptions"],
  ["pharmacy", "Pharmacy", "Prescriptions and stock"],
  ["nurse", "Nurse", "Beds, wards and vitals"],
];
function currentUser(): any {
  try { return JSON.parse(localStorage.getItem("db_user") || "null") || roleUsers.hospital_admin; }
  catch { return roleUsers.hospital_admin; }
}

// ── Doctors ────────────────────────────────────────────────────────────────
const docDefs: [string, string, string][] = [
  ["Dr. Arun Kumar", "General Medicine", "DOC001"], ["Dr. Meera Nair", "Paediatrics", "DOC002"],
  ["Dr. Suresh Babu", "Orthopaedics", "DOC003"], ["Dr. Lakshmi Priya", "Gynaecology", "DOC004"],
  ["Dr. Rahman Ali", "Cardiology", "DOC005"],
];
const doctors: any[] = docDefs.map(([name, sp, code], i) => ({
  id: "doc-" + (i + 1), hospitalId: HID, code, name, specialty: sp, phone: "98765001" + (10 + i),
  contactPhone: "98765001" + (10 + i), bio: "Experienced consultant at " + HNAME + ".", photo: null,
  price: 300 + i * 100, consultationFee: 300 + i * 100, doctorFee: 300 + i * 100, tokensPerSession: 30,
  sessions: ["morning", "afternoon"],
  sessionTimings: { morning: { start: "00:00", end: "23:59" }, afternoon: { start: "00:00", end: "23:59" } },
  scheduleConfig: {
    weekday: { morning: { count: 30, start: "09:00", end: "13:00" }, afternoon: { count: 30, start: "16:00", end: "20:00" } },
    weekend: { morning: { count: 20, start: "09:00", end: "12:00" } },
  },
  isAvailable: true, yearsOfExperience: String(6 + i * 3), education: "MBBS, MD", languages: ["English", "Tamil"],
  walkInInterval: 10, department: sp, specialization: sp, status: "available", email: "doctor" + (i + 1) + "@demohospital.in",
}));

// ── Bookings (Booking[] in api.ts) ─────────────────────────────────────────
const pNames = ["Ravi Shankar", "Anitha Devi", "Karthik Raja", "Divya Bharathi", "Mohamed Irfan", "Sangeetha M",
  "Vignesh Kumar", "Priya Dharshini", "Balaji S", "Revathi K", "Naveen Raj", "Kavitha R", "Gopinath T", "Lakshmi N",
  "Arun Prasad", "Meenakshi S", "Sathish Kumar", "Jothi Lakshmi", "Dinesh B", "Pooja R", "Harish M", "Nandhini V",
  "Senthil Nathan", "Rekha P", "Manoj K", "Swathi D", "Ilango R", "Bharathi S", "Yuvaraj C", "Tamilselvi A"];
const reasons = ["Fever", "Cough", "Fatigue / Weakness", "Back pain", "Headache", "Routine check-up", "Cold / Runny nose", "Stomach pain"];
const bookings: any[] = [];
let pi = 0;
doctors.forEach((d: any) => {
  for (let n = 1; n <= 6; n++) {
    const name = pNames[pi % pNames.length];
    const done = n <= 2;
    bookings.push({
      id: "bk-" + (pi + 1), patientId: "pt-" + (pi + 1), patientName: name, patient_name: name, name,
      doctorId: d.id, doctorName: d.name, doctor_name: d.name, specialty: d.specialty, hospitalName: HNAME,
      hospitalId: HID, hospital_id: HID, date: today, session: "morning", tokenNumber: n, token_number: n,
      sessionId: d.id + "_" + today + "_morning", paymentDone: true, status: done ? "completed" : "confirmed",
      live: n === 3 ? "ongoing" : "", phone: "98400" + String(10000 + pi * 37), complaint: reasons[pi % reasons.length],
      patientAge: 22 + ((pi * 3) % 50), age: 22 + ((pi * 3) % 50), patientArea: "Srirangam", patientGender: pi % 2 ? "Female" : "Male",
      gender: pi % 2 ? "Female" : "Male", patientBloodGroup: ["O+", "A+", "B+", "AB+"][pi % 4], uhid: "UH" + (100200 + pi),
      createdAt: iso(300 - pi * 6), created_at: iso(300 - pi * 6), amount: d.price, lateFlag: false, lateEtaMinutes: null,
      closeReason: null,
    });
    pi++;
  }
});

function sessionState(sid: string): any {
  const bs = bookings.filter((b) => b.sessionId === sid).sort((a, b) => a.tokenNumber - b.tokenNumber);
  const [doctorId, date, session] = sid.split("_");
  const tokenStatuses: Record<number, string> = {};
  let current: number | null = null, next: number | null = null;
  bs.forEach((b) => {
    if (b.status === "completed") tokenStatuses[b.tokenNumber] = "green";
    else if (b.live === "ongoing") { tokenStatuses[b.tokenNumber] = "orange"; current = b.tokenNumber; }
    else if (b.live === "skipped") tokenStatuses[b.tokenNumber] = "unvisited";
    else tokenStatuses[b.tokenNumber] = "red";
  });
  const waiting = bs.filter((b) => b.status !== "completed" && b.live !== "ongoing" && b.live !== "skipped");
  if (waiting.length) { next = waiting[0].tokenNumber; tokenStatuses[next as number] = "yellow"; }
  return { sessionId: sid, doctorId, date: date || today, session: session || "morning", tokenStatuses,
    prioritySlots: {}, currentToken: current, nextToken: next, isClosed: false, cancelledSessions: [] };
}
function tokenAction(sid: string, action: string, body: any): any {
  const bs = bookings.filter((b) => b.sessionId === sid);
  const cur = bs.find((b) => b.live === "ongoing");
  const startNext = () => {
    const nx = bs.filter((b) => b.status !== "completed" && !b.live).sort((a, b) => a.tokenNumber - b.tokenNumber)[0];
    if (nx) nx.live = "ongoing";
  };
  if (action === "complete") { if (cur) { cur.status = "completed"; cur.live = ""; } startNext(); }
  else if (action === "skip") {
    const t = body && body.tokenNum != null ? bs.find((b) => b.tokenNumber === body.tokenNum) : cur;
    if (t) { t.live = "skipped"; } if (!body || body.tokenNum == null) startNext();
  } else if (action === "regulate") {
    const t = bs.find((b) => b.tokenNumber === body.clickedToken);
    if (t) { if (cur) cur.live = ""; t.live = "ongoing"; }
  } else if (action === "complete-skipped") {
    const t = bs.find((b) => b.tokenNumber === body.tokenNum);
    if (t) { t.status = "completed"; t.live = ""; }
  }
  return sessionState(sid);
}

// ── Wards, beds, inward ────────────────────────────────────────────────────
const wardDefs: [string, string, string, number, string[]][] = [
  ["w-1", "General Ward", "general", 12, ["Suresh Kumar", "Malathi R", "Arjun P"]],
  ["w-2", "ICU", "icu", 4, ["Ramesh T"]],
  ["w-3", "Private Rooms", "private", 8, ["Fatima Begum", "Gopal S"]],
];
const wardPrefix: Record<string, string> = { "w-1": "G", "w-2": "ICU", "w-3": "P" };
const beds: Record<string, any[]> = {};
wardDefs.forEach(([wid, , , n, occ]) => {
  const pre = wardPrefix[wid];
  beds[wid] = Array.from({ length: n }, (_, i) => {
    const o = i < occ.length;
    return {
      id: wid + "-b" + (i + 1), bed_number: pre + "-" + String(i + 1).padStart(2, "0"), status: o ? "occupied" : "available",
      patient_name: o ? occ[i] : null, occupant_name: o ? occ[i] : null, occupant_phone: o ? "984102" + (1000 + i) : null,
      occupant_age: o ? 35 + i * 7 : null, occupant_gender: o ? (i % 2 ? "Female" : "Male") : null,
      occupant_doctor: o ? "Dr. Arun Kumar" : null, occupant_diagnosis: o ? ["Pneumonia", "Dengue fever", "Fracture"][i % 3] : null,
      occupant_notes: null, occupant_admitted_at: o ? iso(1440 * (i + 1)) : null, inward_id: o ? "ip-" + wid + "-" + (i + 1) : null,
      bill_paid: o ? false : null, bill_balance: o ? 4200 + i * 900 : null, bill_total: o ? 6500 + i * 900 : null,
      cleaning_started_at: null, cleaning_ends_at: null, cleaning_duration_minutes: null, cleaning_override_minutes: null,
      effective_cleaning_minutes: 30, cleaning_source: "hospital", server_now: new Date().toISOString(),
    };
  });
});
const wardList = (): any[] =>
  wardDefs.map(([id, name, type, n]) => {
    const occ = beds[id].filter((b) => b.status === "occupied").length;
    const mnt = beds[id].filter((b) => b.status === "maintenance").length;
    return { id, hospitalId: HID, name, type, total_beds: n, occupied_beds: occ, available_beds: n - occ - mnt,
      maintenance_beds: mnt, bed_prefix: wardPrefix[id], cleaning_minutes: null, ratePerDay: type === "icu" ? 5000 : 1500, daily_rate: type === "icu" ? 5000 : 1500 };
  });
const inwardList: any[] = [];
wardDefs.forEach(([wid, wname]) => {
  beds[wid].filter((b) => b.status === "occupied").forEach((b, i) => {
    inwardList.push({
      id: b.inward_id, patient_name: b.occupant_name, phone: b.occupant_phone, age: b.occupant_age, gender: b.occupant_gender,
      ward: wname, bed_number: b.bed_number, admitting_doctor_name: b.occupant_doctor, diagnosis: b.occupant_diagnosis,
      notes: null, status: "admitted", admitted_at: b.occupant_admitted_at, discharged_at: null, uhid: "UH" + (300100 + i),
    });
  });
});
inwardList.push({
  id: "ip-old-1", patient_name: "Sumathi K", phone: "9841022222", age: 44, gender: "Female", ward: "General Ward", bed_number: "G-09",
  admitting_doctor_name: "Dr. Meera Nair", diagnosis: "Typhoid", notes: null, status: "discharged",
  admitted_at: iso(1440 * 6), discharged_at: iso(1440 * 2), uhid: "UH300200",
});

// ── Pharmacy ───────────────────────────────────────────────────────────────
const stockDefs: [string, string, string, number, number, number][] = [
  ["Paracetamol 500mg", "Tablet", "Tablet", 240, 10, 25], ["Amoxicillin 500mg", "Capsule", "Capsule", 120, 10, 90],
  ["Cetirizine 10mg", "Tablet", "Tablet", 180, 10, 30], ["Cough Syrup 100ml", "Bottle", "Syrup", 60, 1, 85],
  ["Pantoprazole 40mg", "Tablet", "Tablet", 150, 10, 70], ["ORS Sachet", "Sachet", "Powder", 300, 1, 12],
  ["Metformin 500mg", "Tablet", "Tablet", 200, 10, 40], ["Azithromycin 500mg", "Tablet", "Tablet", 90, 6, 120],
];
const stock: any[] = stockDefs.map((s, i) => ({
  id: "st-" + (i + 1), name: s[0], unit: s[1], med_category: s[2], quantity: s[3], pack_size: s[4], selling_price: s[5],
  pack_unit: s[2] === "Syrup" ? "bottle" : s[2] === "Powder" ? "sachet" : "strip", hospitalId: HID,
  genericName: s[0], category: s[2], stock: s[3], price: s[5], mrp: s[5], batch: "B" + (2610 + i), expiry: "2027-12-31",
}));
const rxStatuses = ["pending", "pending", "packed", "ready", "handed_over", "handed_over"];
const prescriptions: any[] = bookings.filter((b) => b.status === "completed" || b.live === "ongoing").slice(0, 8).map((b, i) => ({
  id: "rx-" + (i + 1), patient_name: b.patientName, doctor_name: String(b.doctorName).replace(/^Dr\.\s*/, ""), notes: "Take rest and drink plenty of water.",
  status: rxStatuses[i % rxStatuses.length], created_at: iso(20 + i * 25), dispensed_items: null,
  patient_type: i % 5 === 4 ? "IP" : "OP", inward_id: null, hospitalId: HID,
  items: [
    { name: "Paracetamol 500mg", dosage: "1 tablet", duration: "3 days", instructions: "Morning, Night after food", form: "tablet", quantity: 6 },
    { name: i % 2 ? "Cough Syrup 100ml" : "Cetirizine 10mg", dosage: i % 2 ? "5 ml" : "1 tablet", duration: "5 days",
      instructions: "Night", form: i % 2 ? "syrup" : "tablet", quantity: i % 2 ? 1 : 5 },
  ],
}));

// ── Dashboard numbers ──────────────────────────────────────────────────────
const kpis: any = {
  revenue: 186500, revenuePrevious: 164200, paymentSplit: { cash: 82000, upi: 71500, tpa: 33000 }, receivables: 24800,
  unbilledAccounts: 3, tpaApproved: 5, tpaPendingPreAuth: 2, avgWaitMins: 14, dischargesScheduled: 4, dischargesDone: 2,
  labTatMins: 95, criticalAlerts: 1,
  bookings: { total: bookings.length, completed: bookings.filter((b) => b.status === "completed").length, unvisited: 0,
    confirmed: bookings.filter((b) => b.status !== "completed").length },
  opdRevenue: 72500, ipdRevenue: 94000, pharmacyRevenue: 20000,
};
const daily = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(NOW - (6 - i) * 86400000);
  return { date: ymd(d), revenue: 9000 + i * 1400 };
});
const pharmStats: any = { patientsServed: 18, tabletsSold: 640, revenue: 20000, daily };

const intakeCfg: any = {
  source: "hospital", department: "General Medicine", departmentTemplate: null,
  departments: [{ key: "general", label: "General", fields: ["temperature", "pulse", "bp", "spo2"] },
    { key: "paeds", label: "Paediatrics", fields: ["temperature", "weight", "spo2"] }],
  allFields: [{ key: "temperature", label: "Temperature", unit: "F" }, { key: "pulse", label: "Pulse", unit: "bpm" },
    { key: "bp", label: "Blood pressure", unit: "mmHg" }, { key: "spo2", label: "SpO2", unit: "%" },
    { key: "weight", label: "Weight", unit: "kg" }],
  keys: ["temperature", "pulse", "bp", "spo2"], fields: ["temperature", "pulse", "bp", "spo2"],
};

// ── Router ─────────────────────────────────────────────────────────────────
function route(method: string, path: string, search: string, body: any): any {
  let p = path.replace(/^.*?\/api/, "");
  while (p.startsWith("/api")) p = p.slice(4);
  p = p.replace(/\/+$/, "");
  const q = new URLSearchParams(search);
  let m: RegExpMatchArray | null;

  // Mutations
  if (method !== "GET") {
    if ((m = p.match(/^\/tokens\/([^/]+)\/(regulate|complete|skip|complete-skipped)$/))) return tokenAction(m[1], m[2], body || {});
    if ((m = p.match(/^\/tokens\/([^/]+)\/(close|priority-slot)$/))) return sessionState(m[1]);
    if ((m = p.match(/^\/pharmacy\/prescriptions\/([^/]+)\/status$/))) {
      const rx = prescriptions.find((r) => r.id === m![1]); if (rx && body && body.status) rx.status = body.status; return rx || { ok: true };
    }
    if ((m = p.match(/^\/bookings\/([^/]+)\/status$/))) {
      const b = bookings.find((x) => x.id === m![1]); if (b && body && body.status) b.status = body.status; return b || { ok: true };
    }
    if ((m = p.match(/^\/wards\/([^/]+)\/beds\/([^/]+)\/(occupy|vacate|ready)$/))) {
      const bed = (beds[m[1]] || []).find((b) => b.id === m![2]);
      if (bed) {
        if (m[3] === "occupy") {
          bed.status = "occupied"; bed.patient_name = bed.occupant_name = (body && body.patientName) || "New Patient";
          bed.occupant_phone = (body && body.phone) || null; bed.occupant_doctor = (body && body.admittingDoctorName) || null;
          bed.occupant_diagnosis = (body && body.diagnosis) || null; bed.occupant_admitted_at = new Date().toISOString();
          bed.inward_id = uid(); bed.bill_balance = 0; bed.bill_total = 0;
        } else {
          bed.status = "available"; bed.patient_name = bed.occupant_name = null; bed.occupant_phone = null;
          bed.occupant_doctor = null; bed.occupant_diagnosis = null; bed.occupant_admitted_at = null; bed.inward_id = null;
        }
      }
      return { ok: true, success: true, bed };
    }
    if ((m = p.match(/^\/inward\/([^/]+)\/discharge$/))) {
      const r = inwardList.find((x) => x.id === m![1]); if (r) { r.status = "discharged"; r.discharged_at = new Date().toISOString(); }
      return r || { ok: true };
    }
    if (p === "/inward") {
      const r = { id: uid(), status: "admitted", admitted_at: new Date().toISOString(), discharged_at: null, ...(body || {}),
        patient_name: (body && (body.patientName || body.patient_name)) || "New Patient" };
      inwardList.unshift(r); return r;
    }
    if (p === "/auth/logout") return { ok: true };
    return { ok: true, success: true, id: uid() };
  }

  // Reads
  if (/^\/auth\/me$/.test(p)) return { user: currentUser() };
  if (/^\/my-modules$|\/hospitals\/[^/]+\/modules$/.test(p)) return { modules: null };
  if (/^\/permissions\/me$/.test(p)) return { modules: ["beds_wards","vitals"] };
  if (/^\/health$/.test(p)) return { ok: true };
  if (/\/hospitals\/[^/]+\/intake-config$/.test(p)) return { hospitalType: "multispeciality", ...intakeCfg };
  if (/^\/hospitals\/[^/]+\/website/.test(p)) return { website: "" };
  if (/^\/hospitals\/[^/]+$/.test(p)) return hospital;
  if (p === "/hospitals") return [hospital];
  if (/^\/doctor-vitals\/config/.test(p)) return intakeCfg;
  if (/^\/doctor-vitals/.test(p)) return [];
  if (/^\/dashboard\/kpis/.test(p)) return kpis;
  if (/^\/pharmacy-stats/.test(p)) return pharmStats;
  if (/^\/pharmacy-module\/medicines-sold/.test(p)) return stock.slice(0, 6).map((s, i) => ({ name: s.name, unitPrice: Math.round(s.selling_price / (s.pack_size || 1) * 100) / 100, unitsToday: 20 + i * 11, unitsWeek: 140 + i * 40, unitsMonth: 520 + i * 90, revenueToday: 500 + i * 220, revenueWeek: 3500 + i * 900, revenueMonth: 12000 + i * 2600 }));
  if (/^\/pharmacy\/prescriptions/.test(p)) return prescriptions;
  if (/^\/pharmacy\/(stock|medicines)/.test(p)) {
    const term = (q.get("q") || "").toLowerCase();
    return term ? stock.filter((s) => s.name.toLowerCase().includes(term)) : stock;
  }
  if (/^\/pharmacy\/staff/.test(p)) return [{ id: "ph-1", name: "Demo Pharmacist", code: "PH001", hospitalId: HID, phone: "9876500120" }];
  if (/^\/doctors\/[^/]+$/.test(p)) return doctors.find((d) => p.endsWith(d.id)) || doctors[0];
  if (/^\/doctors/.test(p)) return doctors;
  if (/^\/availability\/doctor/.test(p)) return { availability: { doctorId: "doc-1", doctor_id: "doc-1", status: "available", breakStartedAt: null, breakEndsAt: null, reason: null } };
  if (/exports/.test(p)) return [];
  if (p === "/tokens/cancelled/list") return [];
  if ((m = p.match(/^\/tokens\/([^/]+)$/))) return sessionState(m[1]);
  if ((m = p.match(/^\/bookings\/session\/([^/]+)$/))) return bookings.filter((b) => b.sessionId === m![1]);
  if (/^\/bookings\/follow-ups/.test(p)) return [];
  if (/^\/bookings\/stats/.test(p)) return { totalHospitals: 1, totalDoctors: 5, totalPatients: 148, totalBookings: bookings.length, activeSessions: 5 };
  if (/^\/(hospital\/)?(patients|bookings)$/.test(p) || /^\/hospital\/(patients|bookings)/.test(p)) {
    if (/\/export/.test(p)) return [];
    return bookings;
  }
  if (/^\/wards\/cleaning-settings/.test(p)) return { minutes: 30 };
  if ((m = p.match(/^\/wards\/([^/]+)\/beds$/))) return beds[m[1]] || [];
  if (/^\/wards/.test(p)) return wardList();
  if (/^\/bed-bookings\/free-beds/.test(p)) {
    const out: any[] = [];
    wardDefs.forEach(([wid, wname]) => beds[wid].filter((b) => b.status === "available").forEach((b) => out.push({ bed_id: b.id, bed_number: b.bed_number, ward_name: wname, ward_id: wid })));
    return out;
  }
  if (/^\/bed-bookings/.test(p)) return [];
  if (/^\/maternity-eligible/.test(p)) return { ids: [] };
  if (/^\/inward\/export/.test(p)) return [];
  if (/^\/inward/.test(p)) return inwardList;
  if (/^\/ipd-billing\/summary/.test(p)) {
    const out = inwardList.filter((r) => r.status === "admitted").map((r, i) => ({ inwardId: r.id, patientName: r.patient_name, ward: r.ward, bedNumber: r.bed_number, status: r.status, balance: 3200 + i * 1100 }));
    return { collectedToday: 18500, collectedMonth: 94000, outstandingTotal: out.reduce((a, r) => a + r.balance, 0), outstanding: out };
  }
  if (/^\/pharmacy-module\/revenue/.test(p)) return { grossRevenue: 20000, costOfGoods: 12400, netMargin: 7600, netMarginPct: 38, tabletsSold: 640, prescriptions: 18, byPayment: { cash: 9000, upi: 8500, insurance: 2500 }, daily };
  if (/^\/pharmacy-module\/inventory-categories/.test(p)) return ["Tablet", "Capsule", "Syrup/Tonic", "Injection", "Powder", "Ointment/Cream"];
  if (/^\/pharmacy-module\/inventory\/[^/]+\/history/.test(p)) return [];
  if (/^\/pharmacy-module\/inventory/.test(p)) return stock.map((s, i) => ({
    id: s.id, name: s.name, quantity: s.quantity, packSize: s.pack_size, packUnit: s.pack_unit, tabletsAvailable: s.quantity * s.pack_size,
    reorderLevel: 40, purchasePrice: Math.round(s.selling_price * 0.6), sellingPrice: s.selling_price, supplier: "MediCare Distributors",
    batchNo: s.batch, batches: [{ batchNo: s.batch, expiryDate: "2027-12-31", tablets: s.quantity * s.pack_size, supplier: "MediCare Distributors" }],
    medCategory: s.med_category, expiryDate: "2027-12-31", location: "Rack " + (i + 1), status: i === 5 ? "low_stock" : "ok",
    stripsPerBox: 10, tabletsPerBox: s.pack_size * 10, schedule: "none", gstPercent: 12, hsnCode: "3004", breakdown: { boxes: 2, strips: 3, tablets: 0 } }));
  if (/^\/pharmacy-module\/dispensing-log/.test(p)) return prescriptions.filter((r) => r.status === "handed_over").map((r) => ({
    prescriptionId: r.id, patientId: "pt-" + r.id, patientName: r.patient_name, doctorName: r.doctor_name,
    medicines: r.items.map((it: any) => ({ name: it.name, tablets: it.quantity, dosage: it.dosage })),
    billAmount: 180 + r.id.length * 7, paymentMode: "UPI", billStatus: "Billed", timestamp: r.created_at }));
  if (/^\/pharmacy-module\/(invoice|my-invoice)\//.test(p)) return { invoiceNo: "INV-0001", billNo: 1, hospitalName: HNAME, patientId: "pt-1", patientName: "Ravi Shankar", doctorName: "Arun Kumar", issuedAt: iso(30), paymentMode: "UPI", status: "Billed", subtotal: 180, discountPct: 0, discountAmount: 0, cgstPct: 6, sgstPct: 6, cgstAmount: 10.8, sgstAmount: 10.8, total: 201.6, lines: [{ name: "Paracetamol 500mg", tablets: 6, unitPrice: 2.5, amount: 15 }, { name: "Cough Syrup 100ml", tablets: 1, unitPrice: 85, amount: 85 }] };
  if (/^\/pharmacy-module\/stock-pending/.test(p)) return { date: today, medicines: [{ name: "Paracetamol 500mg", soldTablets: 40, deductedTablets: 10, pendingTablets: 30, pendingLines: 3 }], pending: [{ rxId: "rx-1", patient: "Ravi Shankar", index: 0, name: "Paracetamol 500mg", tablets: 6 }] };
  if (/^\/ipd-billing\/[^/]+$/.test(p)) return { id: "bill-1", items: [], payments: [], total: 0, paid: 0, balance: 0 };
  if (/^\/ipd-billing/.test(p)) return [];
  if (/^\/nursing\//.test(p)) return [];
  if (/^\/inventory/.test(p)) return stock.map((s) => ({ ...s, itemName: s.name, reorderLevel: 40 }));
  if (/^\/front-office\/fees\/summary/.test(p)) return { total: 0, today: 0 };
  if (/^\/hospital-lab/.test(p)) return [];
  if (/^\/chat/.test(p)) return { reply: "This is a demo." };
  return [];
}

function fakeJwt(u: any): string {
  const b64 = (o: any) => btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return b64({ alg: "none", typ: "JWT" }) + "." + b64({ id: u.id, role: u.role, hospitalId: HID, exp: 4102444800 }) + ".demo";
}

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
    b.setAttribute("data-role", key);
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
    let body: any = null;
    try { if (init && typeof init.body === "string") body = JSON.parse(init.body); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 60));
    return new Response(JSON.stringify(route(method, u.pathname, u.search, body)), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }) as typeof window.fetch;

  const check = () => { if (!localStorage.getItem("db_user")) showPicker(); };
  check();
  window.setInterval(check, 400);
}
