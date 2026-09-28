FILE = "src/pages/hospital-admin/HAInward.tsx"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. Imports ────────────────────────────────────────────────────────────
old_imports = '''import { BedDouble, Plus, X, Pencil, LogOut, ChevronDown, ChevronUp, Thermometer, HeartPulse } from "lucide-react";'''
new_imports = '''import { BedDouble, Plus, X, Pencil, LogOut, ChevronDown, ChevronUp, Thermometer, HeartPulse, Download } from "lucide-react";
import { getToken } from "../../api";
import { downloadFile } from "../../lib/downloadFile";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}'''

if old_imports not in content:
    print("ERROR: imports anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_imports, new_imports, 1)

# ── 2. State + export handler ───────────────────────────────────────────
old_state = '''  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";'''
new_state = '''  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState(monthAgoStr());
  const [exportTo, setExportTo] = useState(todayStr());
  const [exporting, setExporting] = useState(false);

  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";'''

if old_state not in content:
    print("ERROR: state anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_state, new_state, 1)

old_discharge_fn = '''  async function handleDischarge(id: string) {
    if (!confirm("Mark this patient as discharged?")) return;
    try { await api.inward.discharge(id); await load(); } catch (_) {}
  }'''
new_discharge_fn = '''  async function handleDischarge(id: string) {
    if (!confirm("Mark this patient as discharged?")) return;
    try { await api.inward.discharge(id); await load(); } catch (_) {}
  }

  async function handleExport() {
    if (!exportFrom || !exportTo) return;
    setExporting(true);
    try {
      const qs = new URLSearchParams({ from: exportFrom, to: exportTo });
      if (hospitalId) qs.set("hospitalId", hospitalId);
      const res = await fetch(`${BASE}/inward/export?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 404) { alert("No inward patient records found for this period."); return; }
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      await downloadFile(blob, `inward_${exportFrom}_to_${exportTo}.xlsx`);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }'''

if old_discharge_fn not in content:
    print("ERROR: handleDischarge anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_discharge_fn, new_discharge_fn, 1)

# ── 3. UI: date pickers + download button next to Admit Patient ─────────
old_header = '''        <button onClick={openAdmit}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Admit Patient
        </button>
      </div>'''
new_header = '''        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
            className="border rounded-lg px-2.5 py-2 text-sm bg-background" />
          <span className="text-sm text-muted-foreground">to</span>
          <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
            className="border rounded-lg px-2.5 py-2 text-sm bg-background" />
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> {exporting ? "Exporting..." : "Download"}
          </button>
          <button onClick={openAdmit}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Admit Patient
          </button>
        </div>
      </div>'''

if old_header not in content:
    print("ERROR: header anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_header, new_header, 1)

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("Success: date pickers + download button added to HAInward.tsx")
