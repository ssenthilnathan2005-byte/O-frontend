import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

function PasswordInput({ id, label, value, onChange, autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input id={id} type={show ? "text" : "password"} value={value} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)} className="pr-10" />
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function DoctorLoginPassword() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() { setOpen(false); setCur(""); setNext(""); setConfirm(""); setError(""); }

  // Same checks the server repeats, so the doctor gets instant feedback.
  function validate(): string {
    if (!cur.trim()) return "Enter your current password";
    if (next.trim().length < 6) return "New password must be at least 6 characters";
    if (next.trim() === cur.trim()) return "New password must be different from the current one";
    if (next.trim() !== confirm.trim()) return "New password and confirmation do not match";
    return "";
  }

  async function save() {
    const v = validate();
    if (v) { setError(v); return; }
    setError(""); setBusy(true);
    try {
      const res = await fetch(BASE + "/doctor-account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ currentPassword: cur, newPassword: next, confirmPassword: confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError((data as any).error || "Could not change password"); return; }
      toast.success("Password changed successfully. Use the new password next time you log in.");
      reset();
    } catch { setError("Network error. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-sm font-medium">
        <KeyRound className="h-3.5 w-3.5 text-gray-400" /> Login Password
      </Label>
      <div className="relative">
        <Input value="••••••••••" readOnly aria-label="Login password (hidden)"
          className="cursor-default bg-gray-50 pr-28 text-gray-600" />
        {!open && (
          <button type="button" onClick={() => setOpen(true)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-teal-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600">
            Change Password
          </button>
        )}
      </div>
      <p className="flex items-center gap-1 text-xs text-gray-500">
        <Lock className="h-3 w-3" /> Your password is stored securely and cannot be displayed. You can set a new one at any time.
      </p>

      {open && (
        <div className="mt-2 space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <PasswordInput id="doc-pw-current" label="Current password" value={cur} onChange={setCur} autoComplete="current-password" />
          <div className="grid gap-3 sm:grid-cols-2">
            <PasswordInput id="doc-pw-new" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
            <PasswordInput id="doc-pw-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </div>
          <p className="text-xs text-gray-500">At least 6 characters, and different from your current password.</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} disabled={busy}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60">Cancel</button>
            <button type="button" onClick={save} disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Save new password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
