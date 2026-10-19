import sys, os, re, shutil

def rd(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()

def once(t, f, old, new):
    if t.count(old) != 1:
        sys.exit("ABORT %s: expected 1 match, found %d for: %s" % (f, t.count(old), old[:70]))
    return t.replace(old, new)

def rx(t, f, pat, new):
    r, n = re.subn(pat, lambda m: new, t, count=1)
    if n != 1:
        sys.exit("ABORT %s: regex not found once: %s" % (f, pat[:70]))
    return r

out = {}
HA = "src/pages/hospital-admin/"
HID = '(user as any)?.hospitalId || ""'

p = HA + "HAAllPatients.tsx"
out[p] = rx(rd(p), p, r'user\?\.role === "hospital_admin" \? \(user as any\)\.hospitalId : ""', HID)
p = HA + "HAPatients.tsx"
out[p] = rx(rd(p), p, r'user\?\.role === "hospital_admin" \? user\.hospitalId : ""', HID)
p = HA + "HABilling.tsx"
out[p] = rx(rd(p), p, r'user && user\.role === "hospital_admin" \? user\.hospitalId : ""', HID)
p = HA + "PharmacyModule.tsx"
out[p] = rx(rd(p), p, r'user\?\.role === "hospital_admin" \|\| user\?\.role === "pharmacy" \? user\.hospitalId : ""', HID)
p = HA + "HAAttendance.tsx"
out[p] = once(rd(p), p, 'get(""),', 'get("").catch(() => []),') if rd(p).count('get(""),') == 1 else once(rd(p), p, 'get("")', 'get("").catch(() => [])')

# Store: staff get hospital bookings; doctors learn their hospitalId
p = "src/context/StoreContext.tsx"; t = rd(p)
t = once(t, p, 'const REFRESH_MS = 10_000; // 10 seconds',
  'const REFRESH_MS = 10_000; // 10 seconds\nlet _bkDeniedAt = 0;')
t = once(t, p, 'setHospitals(h);',
  'setHospitals(h);\n'
  '        if ((u as any)?.role === "doctor" && !(u as any).hospitalId) {\n'
  '          const me = (d as any[]).find((x) => x.id === (u as any).doctorId);\n'
  '          if (me?.hospitalId) {\n'
  '            const nu = { ...(u as any), hospitalId: me.hospitalId };\n'
  '            try { localStorage.setItem("db_user", JSON.stringify(nu)); } catch {}\n'
  '            setUser(nu);\n'
  '          }\n'
  '        }')
t = once(t, p, 'if (u.role === "nurse") return; // nurses do not need hospital-wide bookings',
  'if (["nurse", "front_office", "pharmacy", "hospital_lab"].includes((u as any).role)) {\n'
  '      const hid = (u as any).hospitalId;\n'
  '      if (hid && Date.now() - _bkDeniedAt > 60000) {\n'
  '        try { setBookings(await api.bookings.forHospital(hid)); _bkDeniedAt = 0; }\n'
  '        catch { _bkDeniedAt = Date.now(); }\n'
  '      }\n'
  '      return;\n'
  '    }')
out[p] = t

# StaffExtras: new panels
p = "src/components/StaffExtras.tsx"; t = rd(p)
t = once(t, p, 'import ErrorBoundary from "./ErrorBoundary";',
  'import ErrorBoundary from "./ErrorBoundary";\n'
  'import { Users, Receipt, Fingerprint, Pill } from "lucide-react";\n'
  'import HAAllPatients from "../pages/hospital-admin/HAAllPatients";\n'
  'import HAPatients from "../pages/hospital-admin/HAPatients";\n'
  'import HABilling from "../pages/hospital-admin/HABilling";\n'
  'import HAAttendance from "../pages/hospital-admin/HAAttendance";\n'
  'import { PharmRevenue, PharmInventory, PharmPatients, PharmSold, PharmStockUpdate } from "../pages/hospital-admin/PharmacyModule";')
PANEL = '''function PharmacyPanel() {
  const [t, setT] = useState("revenue");
  const tabs: [string, string][] = [["revenue", "Revenue"], ["inventory", "Inventory"], ["patients", "Purchases"], ["sold", "Sales"], ["stock", "Stock Update"]];
  return (
    <div>
      <div className="flex flex-wrap gap-2 px-4 pt-4 md:px-6">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setT(k)}
            className={"px-3 py-1.5 rounded-full text-xs font-medium " + (t === k ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600")}>{l}</button>
        ))}
      </div>
      {t === "revenue" ? <PharmRevenue /> : t === "inventory" ? <PharmInventory /> : t === "patients" ? <PharmPatients /> : t === "sold" ? <PharmSold /> : <PharmStockUpdate />}
    </div>
  );
}

'''
t = once(t, p, 'type Extra = {', PANEL + 'type Extra = {')
t = once(t, p, 'beds_wards: { label: "Beds & Wards", icon: Stethoscope, render: () => <HAWards /> },',
  'beds_wards: { label: "Beds & Wards", icon: Stethoscope, render: () => <HAWards /> },\n'
  '  all_patients: { label: "All Patients", icon: Users, render: () => <HAAllPatients /> },\n'
  '  live_patients: { label: "Live Patients", icon: Users, render: () => <HAPatients /> },\n'
  '  billing: { label: "Billing", icon: Receipt, render: () => <HABilling /> },\n'
  '  attendance: { label: "Attendance", icon: Fingerprint, render: () => <HAAttendance /> },\n'
  '  pharmacy: { label: "Pharmacy", icon: Pill, render: () => <PharmacyPanel /> },')
out[p] = t

for f, txt in out.items():
    if not os.path.exists(f + ".bak-gate2"):
        shutil.copy(f, f + ".bak-gate2")
    with open(f, "w", encoding="utf-8", newline="") as fh:
        fh.write(txt)
    print("updated", f)
print("ALL EDITS APPLIED")
