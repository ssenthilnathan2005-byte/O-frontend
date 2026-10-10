import { useEffect, useState } from "react";
import { HeartPulse, Plus, X, KeyRound, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Nurse = { id: string; nurse_code: string; name: string; phone: string; first_login: number; created_at: string };
type Creds = { name: string; nurse_code: string; tempPassword: string; reset?: boolean };

async function call(path: string, method = "GET", body?: any) {
  const res = await fetch(`${BASE}/nurses${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function HANurses() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [copied, setCopied] = useState("");

  async function load() {
    try { setNurses(await call("")); } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addNurse() {
    if (!name.trim() || !phone.trim()) { toast.error("Enter name and contact number"); return; }
    setSaving(true);
    try {
      const r = await call("", "POST", { name: name.trim(), phone: phone.trim() });
      setCreds({ name: r.name, nurse_code: r.nurse_code, tempPassword: r.tempPassword });
      setShowForm(false); setName(""); setPhone("");
      load();
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  }

  async function resetPw(n: Nurse) {
    if (!window.confirm(`Reset password for ${n.name}? Their current password will stop working.`)) return;
    try {
      const r = await call(`/${n.id}/reset-password`, "POST");
      setCreds({ name: r.name, nurse_code: r.nurse_code, tempPassword: r.tempPassword, reset: true });
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(n: Nurse) {
    if (!window.confirm(`Remove ${n.name}? They will no longer be able to log in.`)) return;
    try { await call(`/${n.id}`, "DELETE"); load(); } catch (e: any) { toast.error(e.message); }
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nurses</h1>
            <p className="text-sm text-gray-500">Add nurses and manage their login access</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Add Nurse
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-400">Loading...</p>
        ) : nurses.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No nurses added yet. Click Add Nurse to create the first login.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Nurse ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {nurses.map((n) => (
                  <tr key={n.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{n.name}</td>
                    <td className="px-4 py-3 text-gray-600">{n.phone}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono tracking-wider text-gray-900">{n.nurse_code}</span>
                      <button type="button" onClick={() => copy(n.nurse_code, n.id)} className="ml-2 text-gray-400 hover:text-teal-600 align-middle">
                        {copied === n.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={"text-xs px-2 py-0.5 rounded-full " + (n.first_login === 1 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700")}>
                        {n.first_login === 1 ? "Not logged in yet" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => resetPw(n)} className="flex items-center gap-1 text-xs text-teal-700 hover:underline">
                          <KeyRound className="w-3.5 h-3.5" /> Reset password
                        </button>
                        <button type="button" onClick={() => remove(n)} className="text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Add Nurse</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-700">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nurse full name" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-700">Contact number</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel" />
            </div>
            <p className="text-xs text-gray-400">A Nurse ID and a temporary password are generated automatically.</p>
            <button
              type="button"
              onClick={addNurse}
              disabled={saving}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg"
            >
              {saving ? "Creating..." : "Create Nurse Login"}
            </button>
          </div>
        </div>
      )}

      {creds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{creds.reset ? "Password reset" : "Nurse login created"}</h2>
              <button type="button" onClick={() => setCreds(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600">Share these with {creds.name}. The temporary password is shown only now. They must set a new password at first login.</p>
            <div className="rounded-xl bg-gray-50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Nurse ID</p>
                  <p className="font-mono font-semibold tracking-wider">{creds.nurse_code}</p>
                </div>
                <button type="button" onClick={() => copy(creds.nurse_code, "c1")} className="text-gray-400 hover:text-teal-600">
                  {copied === "c1" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Temporary password</p>
                  <p className="font-mono font-semibold tracking-wider">{creds.tempPassword}</p>
                </div>
                <button type="button" onClick={() => copy(creds.tempPassword, "c2")} className="text-gray-400 hover:text-teal-600">
                  {copied === "c2" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="button" onClick={() => setCreds(null)} className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}