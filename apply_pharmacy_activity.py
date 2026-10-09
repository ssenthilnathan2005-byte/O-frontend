#!/usr/bin/env python3
"""apply_pharmacy_activity.py
Hospital admin Pharmacy page: adds a "Pharmacy Activity" section
(Waiting / Given today / Given in total) above "Add Pharmacy Staff".
Stops without changing anything if any anchor doesn't match exactly once.
Run from F:\\O-frontend.
"""
import sys
from pathlib import Path

PATH = Path("src/pages/hospital-admin/HAPharmacy.tsx")
if not PATH.exists():
    sys.exit("STOP: src/pages/hospital-admin/HAPharmacy.tsx not found. Run from F:\\O-frontend.")

raw = PATH.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
src = raw.replace("\r\n", "\n")

EDITS = [
    ("state",
     '  const [saving, setSaving] = useState(false);\n',
     '''  const [saving, setSaving] = useState(false);
  const [rx, setRx] = useState<{ waiting: number; today: number; total: number } | null>(null);
'''),
    ("fetch + effect",
     '  useEffect(() => { if (hospitalId) { fetchStaff(); fetchHospitalSettings(); } }, [hospitalId]);\n',
     '''  async function fetchRxStats() {
    try {
      const res = await fetch(`${BASE}/pharmacy/prescriptions?hospitalId=${encodeURIComponent(hospitalId)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!Array.isArray(data)) return;
      const todayStr = new Date().toDateString();
      const given = data.filter((p: any) => p.status === "handed_over");
      setRx({
        waiting: data.length - given.length,
        today: given.filter((p: any) => p.handed_over_at && new Date(p.handed_over_at).toDateString() === todayStr).length,
        total: given.length,
      });
    } catch { /* summary is optional */ }
  }

  useEffect(() => { if (hospitalId) { fetchStaff(); fetchHospitalSettings(); fetchRxStats(); } }, [hospitalId]);
'''),
    ("activity section",
     '''      <Card>
        <CardHeader><CardTitle className="text-base">Add Pharmacy Staff</CardTitle></CardHeader>''',
     '''      <Card>
        <CardHeader><CardTitle className="text-base">Pharmacy Activity</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Waiting", n: rx?.waiting, color: "text-yellow-600" },
              { label: "Given today", n: rx?.today, color: "text-teal-600" },
              { label: "Given in total", n: rx?.total, color: "text-gray-700" },
            ].map(t => (
              <div key={t.label} className="rounded-lg bg-gray-50 py-3">
                <p className={`text-2xl font-bold ${t.color}`}>{rx ? t.n : "-"}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">Counts are prescriptions handed over by the pharmacy.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Add Pharmacy Staff</CardTitle></CardHeader>'''),
]

for name, old, _ in EDITS:
    n = src.count(old)
    if n != 1:
        sys.exit(f"STOP: anchor '{name}' matched {n} times (need 1). Nothing was changed.")

out = src
for _, old, new in EDITS:
    out = out.replace(old, new, 1)

if crlf:
    out = out.replace("\n", "\r\n")
PATH.write_bytes(out.encode("utf-8"))
print(f"OK: applied {len(EDITS)} edits to {PATH}")
print("Next: git diff, npx tsc --noEmit, test, then commit.")
print("Then: git reset apply_pharmacy_activity.py  (don't commit the script)")
