import { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { ClipboardList, Plus, X, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Staff = {
  id: string; name: string; role: string; department: string | null;
  phone: string | null; email: string | null; shift: string; shifts: string[] | null;
  join_date: string | null; is_active: number; notes: string | null;
};

const ROLES = ["nurse","lab_technician","pharmacist","receptionist","housekeeping","maintenance","security","accountant","other"];
const SHIFTS = ["morning","afternoon","evening","night"];
const EMPTY = { name:"", role:"nurse", department:"", phone:"", email:"", shifts:["morning"] as string[], joinDate:"", salary:"", notes:"" };

const ROLE_COLORS: Record<string,string> = {
  nurse:"bg-pink-50 text-pink-700",
  lab_technician:"bg-purple-50 text-purple-700",
  pharmacist:"bg-blue-50 text-blue-700",
  receptionist:"bg-teal-50 text-teal-700",
  housekeeping:"bg-gray-100 text-gray-600",
  maintenance:"bg-yellow-50 text-yellow-700",
  security:"bg-orange-50 text-orange-700",
  accountant:"bg-green-50 text-green-700",
  other:"bg-gray-100 text-gray-500",
};

export default function HAHR() {
  const { user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";

  const [staff, setStaff] = useState<Staff[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);

  async function apiFetch(path: string, method="GET", body?: any) {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: { "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async function load() {
    try { setStaff(await apiFetch("/hr")); } catch {}
  }

  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  function openAdd() { setForm({ ...EMPTY }); setEditId(null); setShowForm(true); }
  function openEdit(s: Staff) {
    setForm({ name:s.name, role:s.role, department:s.department||"", phone:s.phone||"",
      email:s.email||"", shifts:(Array.isArray(s.shifts) && s.shifts.length ? s.shifts : [s.shift]), joinDate:s.join_date||"", salary:s.salary != null ? String(s.salary) : "", notes:s.notes||"" });
    setEditId(s.id); setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const payload = { ...form, salary: form.salary ? Number(form.salary) : null };
      if (editId) await apiFetch(`/hr/${editId}`, "PATCH", payload);
      else await apiFetch("/hr", "POST", payload);
      setShowForm(false); await load();
    } catch {} finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this staff member?")) return;
    try { await apiFetch(`/hr/${id}`, "DELETE"); await load(); } catch {}
  }

  async function toggleActive(s: Staff) {
    try { await apiFetch(`/hr/${s.id}`, "PATCH", { ...s, isActive: s.is_active === 1 ? false : true }); await load(); } catch {}
  }

  const filtered = staff.filter(s =>
    (filter === "all" || s.role === filter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
     (s.department||"").toLowerCase().includes(search.toLowerCase()))
  );

  const roleCounts = ROLES.reduce((acc, r) => {
    acc[r] = staff.filter(s => s.role === r).length;
    return acc;
  }, {} as Record<string,number>);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold">HR / Staff</h1>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter==="all" ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>
          All ({staff.length})
        </button>
        {ROLES.filter(r => roleCounts[r] > 0).map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${filter===r ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>
            {r.replace("_"," ")} ({roleCounts[r]})
          </button>
        ))}
      </div>

      <Input placeholder="Search by name or department..." value={search}
        onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No staff found.</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Name","Role","Department","Phone","Shift","Status",""].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-t hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.name}</p>
                    {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[s.role]||"bg-gray-100 text-gray-500"}`}>
                      {s.role.replace("_"," ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.department||"—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.phone||"—"}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{Array.isArray(s.shifts) && s.shifts.length ? s.shifts.join(", ") : s.shift}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(s)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-muted transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">{editId ? "Edit Staff" : "Add Staff"}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {[
                { label:"Name *", key:"name", placeholder:"Full name" },
                { label:"Department", key:"department", placeholder:"e.g. Cardiology, Emergency" },
                { label:"Phone", key:"phone", placeholder:"Mobile number" },
                { label:"Email", key:"email", placeholder:"Email address" },
                { label:"Join Date", key:"joinDate", placeholder:"YYYY-MM-DD" },
                { label:"Salary (₹)", key:"salary", placeholder:"Monthly salary" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">{label}</label>
                  <Input placeholder={placeholder} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Role *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  {ROLES.map(r => <option key={r} value={r} className="capitalize">{r.replace("_"," ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Shift (select one or more)</label>
                <div className="flex flex-wrap gap-3 border rounded-md px-3 py-2 bg-white">
                  {SHIFTS.map(s => (
                    <label key={s} className="flex items-center gap-1.5 text-sm capitalize cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.shifts.includes(s)}
                        onChange={e => setForm(f => ({
                          ...f,
                          shifts: e.target.checked
                            ? [...f.shifts, s]
                            : f.shifts.filter(x => x !== s),
                        }))}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Additional notes..."
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                {loading ? "Saving..." : editId ? "Update" : "Add Staff"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
