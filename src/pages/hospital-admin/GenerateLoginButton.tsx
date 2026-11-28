import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

// Shown in HR/Staff -> "Login code" for employees that have no login yet. Uses the same code pattern as every module
// (hospital prefix + role letters + counter, e.g. vhhn07).
export default function GenerateLoginButton({ staffId, onDone }: { staffId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<{ code: string; tempPassword: string | null } | null>(null);

  async function go() {
    if (!confirm("Generate a Login ID for this employee? A temporary password will be created and shown once.")) return;
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/employees/${staffId}/login`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: "{}",
      });
      let d: any = null;
      try { d = await res.json(); } catch { /* empty */ }
      if (!res.ok) { toast.error((d && d.error) || "Could not create the login"); return; }
      setCreds({ code: d.login.code, tempPassword: d.login.tempPassword });
    } catch {
      toast.error("Could not reach the server");
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={go} disabled={busy}
        className="px-2 py-1 rounded border border-teal-200 text-teal-700 hover:bg-teal-50 text-xs font-sans disabled:opacity-50">
        {busy ? "..." : "Generate ID"}
      </button>
      {creds && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 text-left">
            <h2 className="font-semibold text-lg">Login created</h2>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Login ID</span><span className="font-mono font-semibold">{creds.code}</span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Password</span><span className="font-mono font-semibold">{creds.tempPassword || "the one you set"}</span></div>
            </div>
            <p className="text-xs text-amber-700">Copy the temporary password now. It is shown only once; you can read it later in Password Management.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { navigator.clipboard?.writeText(`Login ID: ${creds.code}${creds.tempPassword ? "\nPassword: " + creds.tempPassword : ""}`); toast.success("Copied"); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border hover:bg-gray-50"><Copy className="w-4 h-4" /> Copy</button>
              <button onClick={() => { setCreds(null); onDone(); }} className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium">Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
