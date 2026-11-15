import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, KeyRound, Loader2, RotateCcw, Search, X } from "lucide-react";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(BASE + "/password-management" + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Request failed");
  return data;
}

type Row = { type: string; role: string; id: string; name: string; loginId: string; status: string };
type Action = { kind: "show" | "change" | "reset"; row: Row };

const FILTERS = ["All", "Hospital Admin", "Doctor", "Nurse", "Front Office", "Laboratory", "Pharmacy"];

function statusClass(s: string) {
  if (s === "Active") return "bg-emerald-50 text-emerald-700";
  if (s === "Inactive") return "bg-gray-100 text-gray-500";
  return "bg-amber-50 text-amber-700";
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

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success("Copied"), () => toast.error("Could not copy"));
}

export default function HAPasswordManagement() {
  const [rows, setRows] = useState<Row[]>([]);
  const [vaultEnabled, setVaultEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ password: string; note?: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await call("/");
      setRows(d.users || []);
      setVaultEnabled(!!d.vaultEnabled);
    } catch (e: any) { toast.error(e.message || "Could not load users"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r =>
      (filter === "All" || r.role === filter) &&
      (!s || r.name.toLowerCase().includes(s) || r.loginId.toLowerCase().includes(s)));
  }, [rows, filter, q]);

  function open(kind: Action["kind"], row: Row) { setAction({ kind, row }); setInput(""); setRevealed(null); }
  function close() { setAction(null); setInput(""); setRevealed(null); }

  async function submit() {
    if (!action) return;
    const { kind, row } = action;
    const base = `/${row.type}/${encodeURIComponent(row.id)}`;
    setBusy(true);
    try {
      if (kind === "show") {
        if (!input) { toast.error("Enter your admin password"); return; }
        const d = await call(base + "/show", "POST", { adminPassword: input });
        setRevealed({ password: d.password, note: d.note || undefined });
      } else if (kind === "change") {
        if (input.trim().length < 6) { toast.error("Password must be at least 6 characters"); return; }
        await call(base + "/change", "POST", { password: input.trim() });
        toast.success("Password changed for " + row.name);
        close(); load();
      } else {
        const d = await call(base + "/reset", "POST");
        setRevealed({ password: d.tempPassword, note: "Temporary password. Share it with the user - it is shown only once here." });
        load();
      }
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-6xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Password Management</h1>
        <p className="text-sm text-gray-500">Manage login passwords for every user of your hospital.</p>
      </div>

      {!vaultEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Show Current Password is switched off on the server (encryption key not set). Change and Reset still work.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={"rounded-full px-3 py-1.5 text-xs font-medium transition-colors " + (filter === f ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {f}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or login ID"
            className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-teal-400" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">Login ID</th><th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Password</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>}
            {shown.map(r => (
              <tr key={r.type + r.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.loginId}</td>
                <td className="px-4 py-3 text-gray-600">{r.role}</td>
                <td className="px-4 py-3"><span className={"rounded-full px-2 py-0.5 text-xs font-medium " + statusClass(r.status)}>{r.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => open("show", r)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs hover:bg-gray-50"><Eye className="h-3.5 w-3.5" />Show</button>
                    <button type="button" onClick={() => open("change", r)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs hover:bg-gray-50"><KeyRound className="h-3.5 w-3.5" />Change</button>
                    <button type="button" onClick={() => open("reset", r)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {action && (
        <Modal
          title={(action.kind === "show" ? "Show current password" : action.kind === "change" ? "Change password" : "Reset password") + " - " + action.row.name}
          onClose={close}>
          {revealed ? (
            <div className="space-y-3">
              {revealed.note && <p className="text-xs text-gray-500">{revealed.note}</p>}
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                <span className="break-all font-mono text-sm text-gray-900">{revealed.password}</span>
                <button type="button" onClick={() => copy(revealed.password)} className="ml-2 rounded-lg p-1.5 hover:bg-gray-200"><Copy className="h-4 w-4" /></button>
              </div>
              <button type="button" onClick={close} className="w-full rounded-lg bg-teal-500 py-2 text-sm font-medium text-white">Done</button>
            </div>
          ) : (
            <div className="space-y-3">
              {action.kind === "show" && (<>
                <p className="text-sm text-gray-600">For security, enter <b>your own</b> admin password to view this password.</p>
                <input type="password" autoFocus value={input} onChange={e => setInput(e.target.value)} placeholder="Your admin password"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
              </>)}
              {action.kind === "change" && (<>
                <p className="text-sm text-gray-600">Type the new password (minimum 6 characters).</p>
                <input type="text" autoFocus value={input} onChange={e => setInput(e.target.value)} placeholder="New password"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
              </>)}
              {action.kind === "reset" && (
                <p className="text-sm text-gray-600">This creates a new temporary password for <b>{action.row.name}</b>. The old password stops working immediately.</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={close} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm">Cancel</button>
                <button type="button" disabled={busy} onClick={submit}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-500 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {action.kind === "show" ? "Show" : action.kind === "change" ? "Save" : "Reset"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
