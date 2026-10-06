import { useState, useEffect } from "react";
import { useStore } from "../../context/StoreContext";
import { getToken } from "@/api";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Pill, Settings, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  code: string;
  is_active: number;
  created_at: string;
}

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

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Pill className="w-5 h-5 text-teal-600" />
        <h1 className="text-xl font-bold">Pharmacy Staff</h1>
      </div>

      {/* Pharmacy Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-2 min-w-0">
            <Settings className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm">Pharmacy Module</p>
              <p className="text-xs text-gray-400 leading-snug">Enable to allow prescription and medicine management</p>
            </div>
          </div>
          <button
            onClick={() => togglePharmacy(!hasPharmacy)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${hasPharmacy ? "bg-teal-500" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hasPharmacy ? "translate-x-5" : ""}`} />
          </button>
        </CardContent>
      </Card>

      <Card>
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
        <CardHeader><CardTitle className="text-base">Add Pharmacy Staff</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">Name</Label>
              <Input placeholder="Staff name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Phone</Label>
              <Input placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Password</Label>
            <Input placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <Button onClick={handleAdd} disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            {saving ? "Adding..." : "Add Staff Member"}
          </Button>
          <p className="text-xs text-gray-400 text-center">
            A unique login code will be generated. Share it with the staff member along with the password you set.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No pharmacy staff added yet.</p>
        ) : staff.map(s => (
          <Card key={s.id} className={s.is_active ? "" : "opacity-50"}>
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div>
                <p className="font-semibold text-sm">{s.name}</p>
                <p className="text-xs text-gray-500">{s.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-sm cursor-pointer hover:bg-teal-50"
                  onClick={() => copyCode(s.code)}
                >
                  {s.code} <Copy className="w-3 h-3 ml-1" />
                </Badge>
                {s.is_active && (
                  <button onClick={() => handleResetPassword(s.id)} className="text-gray-400 hover:text-teal-600" title="Reset password">
                    <KeyRound className="w-4 h-4" />
                  </button>
                )}
                {s.is_active ? (
                  <button onClick={() => handleRemove(s.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <Badge variant="outline" className="text-gray-400">Inactive</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
