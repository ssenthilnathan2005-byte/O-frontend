import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, Plus, UsersRound, X } from "lucide-react";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(BASE + "/staff-management" + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Request failed");
  return data;
}

// Used by the Doctor sidebar: Staff Management is shown only when the server says this hospital is on the Basic plan.
export async function fetchStaffAccess(): Promise<boolean> {
  try { return !!(await call("/access")).enabled; } catch { return false; }
}

type StaffRole = "front_office" | "pharmacy" | "doctor";
type Account = { id: string; type: StaffRole; name: string; loginId: string; specialty?: string };

const ROLES: { key: StaffRole; label: string }[] = [
  { key: "front_office", label: "Front Office" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "doctor", label: "Doctor" },
];

function PasswordField({ value, onChange, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        autoFocus={autoFocus}
        autoComplete="new-password"
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 py-2.5 pl-3 pr-10 text-sm outline-none focus:border-teal-400"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function StaffManagementPanel() {
  const [role, setRole] = useState<StaffRole>("front_office");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [changing, setChanging] = useState<Account | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const roleLabel = ROLES.find(r => r.key === role)!.label;
  const list = accounts.filter(a => a.type === role);

  async function load(silent = false) {
    try {
      const d = await call("/");
      setAccounts(d.accounts || []);
    } catch (e: any) { if (!silent) toast.error(e.message || "Could not load accounts"); }
    finally { setLoading(false); }
  }
  // Always reflect the live database: reload on open, every 30s, and when the tab regains focus.
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 30000);
    const onVis = () => { if (document.visibilityState === "visible") load(true); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, []);

  async function create() {
    if (!name.trim()) { toast.error("Enter the full name"); return; }
    if (role === "doctor" && !specialty.trim()) { toast.error("Enter the specialty"); return; }
    if (role !== "doctor" && !/^[0-9+\-\s]{7,15}$/.test(phone.trim())) { toast.error("Enter a valid phone number"); return; }
    if (password.trim().length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      const d = await call("/" + role, "POST", { name: name.trim(), phone: phone.trim(), specialty: specialty.trim(), password: password.trim() });
      setName(""); setPhone(""); setSpecialty(""); setPassword("");
      toast.success(roleLabel + " account created. Login ID: " + d.loginId, { duration: 10000 });
      load(true);
    } catch (e: any) { toast.error(e.message || "Could not create the account"); }
    finally { setBusy(false); }
  }

  async function toggleShow(a: Account) {
    if (revealed[a.id] !== undefined) { setRevealed(r => { const n = { ...r }; delete n[a.id]; return n; }); return; }
    try {
      const d = await call("/" + a.type + "/" + encodeURIComponent(a.id) + "/show", "POST");
      setRevealed(r => ({ ...r, [a.id]: d.password }));
      setTimeout(() => setRevealed(r => { const n = { ...r }; delete n[a.id]; return n; }), 15000);   // hides itself after 15 seconds
    } catch (e: any) { toast.error(e.message || "Could not show the password"); load(true); }
  }

  async function saveNewPassword() {
    if (!changing) return;
    if (newPassword.trim().length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      await call("/" + changing.type + "/" + encodeURIComponent(changing.id) + "/change", "POST", { password: newPassword.trim() });
      toast.success("Password changed for " + changing.loginId);
      setRevealed(r => { const n = { ...r }; delete n[changing.id]; return n; });
      setChanging(null); setNewPassword("");
    } catch (e: any) { toast.error(e.message || "Could not change the password"); load(true); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><UsersRound className="h-5 w-5" /></div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-gray-900">Staff Management</h3>
          <p className="text-sm text-gray-500">Create and manage Front Office, Pharmacy and Doctor logins for your hospital.</p>
        </div>
      </div>

      <div className="inline-flex rounded-xl bg-gray-100 p-1">
        {ROLES.map(r => (
          <button key={r.key} type="button" onClick={() => setRole(r.key)}
            className={"rounded-lg px-5 py-2 text-sm font-medium transition-colors " + (role === r.key ? "bg-teal-500 text-white shadow-sm" : "text-gray-600 hover:text-gray-900")}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Create {roleLabel} account</p>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" autoComplete="off"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400" />
          {role === "doctor" ? (
            <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Specialty" autoComplete="off"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400" />
          ) : (
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel" autoComplete="off"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400" />
          )}
          <PasswordField value={password} onChange={setPassword} placeholder="Password" />
          <div className="flex items-center justify-end">
            <button type="button" disabled={busy} onClick={create}
              className="flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">The Login ID is generated automatically and shown here after the account is created.</p>
      </div>

      {loading && <div className="py-6 text-center text-gray-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}

      {!loading && list.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <p className="border-b border-gray-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{roleLabel} accounts</p>
          <ul className="divide-y divide-gray-100">
            {list.map(a => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-[140px] flex-1">
                  <p className="text-xs text-gray-400">Name</p>
                  <p className="text-sm font-medium text-gray-900">{a.name}</p>
                  {a.specialty && <p className="text-xs text-gray-500">{a.specialty}</p>}
                </div>
                <div className="min-w-[140px] flex-1">
                  <p className="text-xs text-gray-400">Login ID</p>
                  <p className="font-mono text-sm font-medium text-gray-900">{a.loginId}</p>
                </div>
                <div className="min-w-[160px] flex-1">
                  <p className="text-xs text-gray-400">Password</p>
                  <p className="font-mono text-sm text-gray-900">{revealed[a.id] !== undefined ? revealed[a.id] : "••••••••••"}</p>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => toggleShow(a)}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50">
                    {revealed[a.id] !== undefined ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {revealed[a.id] !== undefined ? "Hide" : "Show"}
                  </button>
                  <button type="button" onClick={() => { setChanging(a); setNewPassword(""); }}
                    className="flex items-center gap-1 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600">
                    <KeyRound className="h-3.5 w-3.5" />Change Password
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {changing && (
        <Modal title={"Change password - " + changing.loginId} onClose={() => setChanging(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Type the new password (minimum 6 characters).</p>
            <PasswordField value={newPassword} onChange={setNewPassword} placeholder="New password" autoFocus />
            <div className="flex gap-2">
              <button type="button" onClick={() => setChanging(null)} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm">Cancel</button>
              <button type="button" disabled={busy} onClick={saveNewPassword} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-500 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
