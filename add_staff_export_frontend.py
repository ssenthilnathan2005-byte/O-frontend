FILE = "src/pages/hospital-admin/HAHR.tsx"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

old_import = '''import { ClipboardList, Plus, X, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";'''
new_import = '''import { ClipboardList, Plus, X, Pencil, Trash2, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";
import { downloadFile } from "../../lib/downloadFile";'''

if old_import not in content:
    print("ERROR: import anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_import, new_import, 1)

old_state = '''  const [paidSet, setPaidSet] = useState<Set<string>>(new Set());'''
new_state = '''  const [paidSet, setPaidSet] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);'''

if old_state not in content:
    print("ERROR: state anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_state, new_state, 1)

old_toggle_active = '''  async function toggleActive(s: Staff) {
    try { await apiFetch(`/hr/${s.id}`, "PATCH", { ...s, isActive: s.is_active === 1 ? false : true }); await load(); } catch {}
  }'''
new_toggle_active = '''  async function toggleActive(s: Staff) {
    try { await apiFetch(`/hr/${s.id}`, "PATCH", { ...s, isActive: s.is_active === 1 ? false : true }); await load(); } catch {}
  }

  async function handleExport() {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (hospitalId) qs.set("hospitalId", hospitalId);
      const res = await fetch(`${BASE}/hr/export?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 404) { alert("No staff records found."); return; }
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      await downloadFile(blob, `staff_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }'''

if old_toggle_active not in content:
    print("ERROR: toggleActive anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_toggle_active, new_toggle_active, 1)

old_header = '''        <button onClick={openAdd}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>'''
new_header = '''        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> {exporting ? "Exporting..." : "Download"}
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>'''

if old_header not in content:
    print("ERROR: header anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_header, new_header, 1)

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("Success: Download button added to HAHR.tsx")
