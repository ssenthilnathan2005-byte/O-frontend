import { useEffect, useState } from "react";
import { ChevronDown, Copy, KeyRound, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
type Staff = { id: string; name: string; phone: string | null; code: string };

export default function HALabStaff({ hospitalId }: { hospitalId: string }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Staff[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function call(path: string, method = "GET", body?: any) {
    const res = await fetch(`${BASE}/hospital-lab-staff${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  async function load() { try { const d = await call("/staff"); if (Array.isArray(d)) setList(d); } catch {} }
  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  async function add() {
    if (!name.trim()) return toast.error("Name is required");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setSaving(true);
    try {
      const d = await call("/staff", "POST", { name, phone, password });
      toast.success(`Staff added. Login code: ${d.code}`);
      setName(""); setPhone(""); setPassword(""); await load();
    } catch (e: any) { toast.error(e.message || "Failed to add staff"); }
    finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!confirm("Remove this lab staff member?")) return;
    try { await call(`/staff/${id}`, "DELETE"); toast.success("Removed"); await load(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  }
  async function reset(id: string) {
    const pw = prompt("New temporary password (min 6 characters):");
    if (!pw) return;
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    try { await call(`/staff/${id}/password`, "PATCH", { password: pw }); toast.success("Password reset. Staff must set a new one at next login."); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  }
  function copy(text: string) { navigator.clipboard.writeText(text); toast.success("Copied"); }

  return (
    <div className="bg-white border rounded-xl">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div>
          <p className="font-medium text-sm">Lab staff logins ({list.length})</p>
          <p className="text-xs text-gray-400">Staff who update sample status and results</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <p className="text-xs text-gray-500">
            Staff sign in at <span className="font-mono">{window.location.origin}/hospital-lab/login</span>
            <button onClick={() => copy(`${window.location.origin}/hospital-lab/login`)} className="ml-1 text-teal-600 underline">copy</button>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input type="password" placeholder="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button onClick={add} disabled={saving}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            <UserPlus className="w-4 h-4" /> {saving ? "Adding..." : "Add staff"}
          </button>
          {list.length > 0 && (
            <div className="divide-y border rounded-lg">
              {list.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.phone || "no phone"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => copy(s.code)} className="flex items-center gap-1 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {s.code} <Copy className="w-3 h-3" />
                    </button>
                    <button onClick={() => reset(s.id)} title="Reset password" className="p-1.5 rounded hover:bg-gray-100"><KeyRound className="w-3.5 h-3.5 text-gray-500" /></button>
                    <button onClick={() => remove(s.id)} title="Remove" className="p-1.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}