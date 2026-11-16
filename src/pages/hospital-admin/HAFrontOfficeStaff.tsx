import { useEffect, useState } from "react";
import { Copy, KeyRound, Power, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
type Staff = { id: string; name: string; phone: string | null; code: string; is_active: number; first_login: number };

export default function HAFrontOfficeStaff({ hospitalId }: { hospitalId?: string }) {
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
  async function remove(s: Staff) {
    if (!confirm("Remove " + s.name + " permanently? They can no longer log in and will disappear from this list.")) return;
    try { await call("/staff/" + s.id, "DELETE"); toast.success("Removed"); await load(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  }
  function copy(t: string) { navigator.clipboard.writeText(t); toast.success("Copied"); }

  const codeBadge = (s: Staff) => (
    <button type="button" onClick={() => copy(s.code)} title="Copy login code"
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700 hover:bg-teal-50">
      {s.code}<Copy className="h-3 w-3 text-gray-400" />
    </button>
  );
  const statusBadge = (s: Staff) => !s.is_active
    ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
    : s.first_login
      ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Password not set yet</span>
      : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span>;
  const actions = (s: Staff) => (
    <div className="flex items-center justify-end gap-1">
      <button type="button" title="Reset password" onClick={() => reset(s)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-teal-600"><KeyRound className="h-4 w-4" /></button>
      <button type="button" title={s.is_active ? "Deactivate" : "Activate"} onClick={() => toggle(s)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-800"><Power className="h-4 w-4" /></button>
      <button type="button" title="Remove" onClick={() => remove(s)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3 md:px-5">
        <p className="text-sm font-semibold text-gray-900">Front office logins ({list.length})</p>
        <p className="text-xs text-gray-500">Staff who check in patients and admit inpatients</p>
      </div>

      <div className="grid grid-cols-1 gap-2 border-b border-gray-100 p-4 sm:grid-cols-2 md:px-5 lg:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Phone (first password)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button onClick={add} disabled={saving} className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-teal-500 px-5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60 sm:col-span-2 lg:col-span-1">
          <UserPlus className="h-4 w-4" />{saving ? "Adding..." : "Add staff"}
        </button>
      </div>

      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">No front office staff yet.</p>
      ) : (
        <>
          {/* Table: tablets and up */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Phone</th>
                  <th className="px-3 py-2.5 font-medium">Login ID</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
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
            {list.map((s) => (
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
  );
}
