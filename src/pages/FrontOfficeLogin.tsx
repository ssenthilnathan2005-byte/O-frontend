import { ClipboardList, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "../context/StoreContext";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

async function post(path: string, body: any) {
  const r = await fetch(BASE + "/front-office" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}

export default function FrontOfficeLogin() {
  const { login } = useStore();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [setupMode, setSetupMode] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!code.trim() || !password.trim()) { toast.error("Enter your code and password"); return; }
    setLoading(true);
    try {
      const res = await post("/login", { code: code.trim(), password });
      if (res.firstLogin) { setSetupMode(true); toast.info("Please set a new password to continue"); return; }
      login(res.user, res.token);
      toast.success("Welcome back");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally { setLoading(false); }
  }

  async function handleSetPassword() {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await post("/set-password", { code: code.trim(), currentPassword: password, newPassword });
      login(res.user, res.token);
      toast.success("Password updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to set password");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-500 flex items-center justify-center mb-3">
            <ClipboardList className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Front Office Login</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            {setupMode ? "Set a new password for your account" : "Sign in to check in patients and admit inpatients"}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {setupMode ? (
            <>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters" onKeyDown={(e) => e.key === "Enter" && handleSetPassword()} autoFocus />
              </div>
              <Button className="w-full" onClick={handleSetPassword} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Password & Sign In"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Access Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. FO1234" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
              </div>
              <Button className="w-full" onClick={handleLogin} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
