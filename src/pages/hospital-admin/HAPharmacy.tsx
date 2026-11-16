import { useState, useEffect } from "react";
import { useStore } from "../../context/StoreContext";
import { getToken } from "@/api";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Pill, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  code: string;
  is_active: number;
  created_at: string;
}

const CARD = "rounded-xl border border-gray-200 bg-white shadow-sm";

export default function HAPharmacy() {
  const { user, updateHospital } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? user.hospitalId : "";
  const [hasPharmacy, setHasPharmacy] = useState<boolean | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [rx, setRx] = useState<{ waiting: number; today: number; total: number } | null>(null);

  async function fetchHospitalSettings() {
    try {
      const res = await fetch(`${BASE}/hospitals/${hospitalId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setHasPharmacy(!!data.hasPharmacy);
    } catch { }
  }

  async function togglePharmacy(val: boolean) {
    try {
      await fetch(`${BASE}/hospitals/${hospitalId}/pharmacy-toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ hasPharmacy: val }),
      });
      setHasPharmacy(val);
      await updateHospital(hospitalId, { hasPharmacy: val });
      toast.success(val ? "Pharmacy enabled" : "Pharmacy disabled");
    } catch { toast.error("Failed to update setting"); }
  }

  async function fetchStaff() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/pharmacy/staff?hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load pharmacy staff"); }
    finally { setLoading(false); }
  }

  async function fetchRxStats() {
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

  async function handleAdd() {
    if (!name.trim() || !phone.trim()) return toast.error("Name and phone required");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/pharmacy/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name, phone, hospitalId, password }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Failed to add staff");
      toast.success(`Staff added — Login code: ${data.code}`);
      setName(""); setPhone(""); setPassword("");
      fetchStaff();
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  }

  async function handleRemove(id: string) {
    if (!confirm("Deactivate this staff member?")) return;
    try {
      await fetch(`${BASE}/pharmacy/staff/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      toast.success("Staff deactivated");
      fetchStaff();
    } catch { toast.error("Network error"); }
  }

  async function handleResetPassword(id: string) {
    const pw = prompt("New password (min 6 characters):");
    if (!pw) return;
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    try {
      const res = await fetch(`${BASE}/pharmacy/staff/${id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); return toast.error(d.error ?? "Failed to reset password"); }
      toast.success("Password reset");
    } catch { toast.error("Network error"); }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success(`Code ${code} copied!`);
  }

  const stats = [
    { label: "Waiting", n: rx?.waiting, color: "text-amber-600", bar: "bg-amber-400" },
    { label: "Given today", n: rx?.today, color: "text-teal-600", bar: "bg-teal-500" },
    { label: "Given in total", n: rx?.total, color: "text-gray-800", bar: "bg-gray-400" },
  ];

  const codeBadge = (s: StaffMember) => (
    <button type="button" onClick={() => copyCode(s.code)} title="Copy login code"
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700 hover:bg-teal-50">
      {s.code}<Copy className="h-3 w-3 text-gray-400" />
    </button>
  );
  const statusBadge = (s: StaffMember) => (
    <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (s.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500")}>
      {s.is_active ? "Active" : "Inactive"}
    </span>
  );
  const actions = (s: StaffMember) => s.is_active ? (
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={() => handleResetPassword(s.id)} title="Reset password"
        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-teal-600"><KeyRound className="h-4 w-4" /></button>
      <button type="button" onClick={() => handleRemove(s.id)} title="Deactivate"
        className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
    </div>
  ) : null;

  return (
    <div className="w-full space-y-4 p-4 md:p-6">
      {/* Header + module switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><Pill className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Pharmacy Staff</h1>
            <p className="text-sm text-gray-500">Manage pharmacy logins and see prescriptions handed over.</p>
          </div>
        </div>
        <div className={CARD + " flex items-center gap-3 px-4 py-2.5"}>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Pharmacy Module</p>
            <p className="text-xs leading-snug text-gray-500">Allow prescription and medicine management</p>
          </div>
          <button type="button" onClick={() => togglePharmacy(!hasPharmacy)} aria-label="Toggle pharmacy module"
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${hasPharmacy ? "bg-teal-500" : "bg-gray-300"}`}>
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hasPharmacy ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map(t => (
          <div key={t.label} className={CARD + " flex items-center gap-3 px-4 py-3"}>
            <span className={"h-10 w-1 rounded-full " + t.bar} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t.label}</p>
              <p className={`text-2xl font-bold ${t.color}`}>{rx ? t.n : "-"}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="-mt-2 text-xs text-gray-400">Counts are prescriptions handed over by the pharmacy.</p>

      {/* Add staff + list */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className={CARD + " p-4 md:p-5 lg:col-span-1"}>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Add Pharmacy Staff</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <Label className="text-xs text-gray-500">Name</Label>
              <Input placeholder="Staff name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Phone</Label>
              <Input placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <Label className="text-xs text-gray-500">Password</Label>
              <Input placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={saving} className="mt-4 w-full bg-teal-600 text-white hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Adding..." : "Add Staff Member"}
          </Button>
          <p className="mt-3 text-xs text-gray-400">
            A unique login code will be generated. Share it with the staff member along with the password you set.
          </p>
        </div>

        <div className={CARD + " overflow-hidden lg:col-span-2"}>
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 md:px-5">
            <h2 className="text-sm font-semibold text-gray-900">Staff members ({staff.length})</h2>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-gray-400">Loading...</p>
          ) : staff.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No pharmacy staff added yet.</p>
          ) : (
            <>
              {/* Table: tablets and up */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-5 py-2.5 font-medium">Name</th>
                      <th className="px-3 py-2.5 font-medium">Phone</th>
                      <th className="px-3 py-2.5 font-medium">Login code</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => (
                      <tr key={s.id} className={"border-b border-gray-50 last:border-0 " + (s.is_active ? "" : "opacity-60")}>
                        <td className="px-5 py-3 font-medium text-gray-900">{s.name}</td>
                        <td className="px-3 py-3 text-gray-600">{s.phone}</td>
                        <td className="px-3 py-3">{codeBadge(s)}</td>
                        <td className="px-3 py-3">{statusBadge(s)}</td>
                        <td className="px-5 py-2">{actions(s)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards: phones */}
              <div className="divide-y divide-gray-100 md:hidden">
                {staff.map(s => (
                  <div key={s.id} className={"space-y-2 p-4 " + (s.is_active ? "" : "opacity-60")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.phone}</p>
                      </div>
                      {statusBadge(s)}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {codeBadge(s)}
                      {actions(s)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
