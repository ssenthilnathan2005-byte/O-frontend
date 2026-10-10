import { useEffect, useState } from "react";
import { ChevronDown, Copy, KeyRound, Power, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
type Staff = { id: string; name: string; phone: string | null; code: string; is_active: number; first_login: number };

export default function HAFrontOfficeStaff({ hospitalId }: { hospitalId?: string }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Staff[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function call(path: string, method = "GET", body?: any) {
    const res = await fetch(BASE + "/front-office" + path, {
      method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  async function load() { try { const d = await call("/staff"); if (Array.isArray(d)) setList(d); } catch {} }
  useEffect(() => { load(); }, [hospitalId]);

  async function add() {
    if (!name.trim() || !phone.trim()) return toast.error("Name and phone are required");
    setSaving(true);
    try {
      const d = await call("/staff", "POST", { name, phone });
      toast.success("Staff added. Login code: " + d.code + ". First password is the phone number.");
      setName(""); setPhone(""); await load();
    } catch (e: any) { toast.error(e.message || "Failed to add staff"); }
    finally { setSaving(false); }
  }
  async function toggle(s: Staff) {
    try { await call("/staff/" + s.id, "PATCH", { isActive: !s.is_active }); await load(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  }
  async function reset(s: Staff) {
    if (!confirm("Reset password for " + s.name + "? Their phone number becomes the temporary password.")) return;
    try { await call("/staff/" + s.id, "PATCH", { resetPassword: true }); toast.success("Password reset. Staff must set a new one at next login."); await load(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  }
  function copy(t: string) { navigator.clipboard.writeText(t); toast.success("Copied"); }

  return (
    <div className="bg-white border rounded-xl">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div>
          <p className="font-medium text-sm">Front office logins ({list.length})</p>
          <p className="text-xs text-gray-400">Staff who check in patients and admit inpatients</p>
        </div>
        <ChevronDown className={"w-4 h-4 text-gray-400 transition " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Phone (first password)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button onClick={add} disabled={saving} className="h-10 rounded-md bg-teal-500 text-white text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60">
              <UserPlus className="w-4 h-4" />{saving ? "Adding..." : "Add staff"}
            </button>
          </div>
          {list.length === 0 && <p className="text-sm text-gray-400 text-center py-3">No front office staff yet.</p>}
          {list.map((s) => (
            <div key={s.id} className={"flex items-center gap-3 border rounded-lg px-3 py-2 " + (s.is_active ? "" : "opacity-60")}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.name}{s.is_active ? "" : " (inactive)"}</p>
                <p className="text-xs text-gray-500 truncate">{s.phone}{s.first_login ? " | has not set a password yet" : ""}</p>
              </div>
              <button onClick={() => copy(s.code)} className="flex items-center gap-1 text-xs font-mono bg-gray-100 rounded px-2 py-1"><Copy className="w-3 h-3" />{s.code}</button>
              <button title="Reset password" onClick={() => reset(s)} className="p-1.5 text-gray-500 hover:text-gray-800"><KeyRound className="w-4 h-4" /></button>
              <button title={s.is_active ? "Deactivate" : "Activate"} onClick={() => toggle(s)} className="p-1.5 text-gray-500 hover:text-gray-800"><Power className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
