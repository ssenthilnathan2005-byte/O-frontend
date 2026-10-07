import { FlaskConical, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

async function post(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function HospitalLabLogin() {
  const { login } = useStore();
  const { navigate } = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [setup, setSetup] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!code.trim() || !password) { toast.error("Enter your lab code and password"); return; }
    setLoading(true);
    try {
      const res = await post("/hospital-lab-staff/login", { code: code.trim(), password });
      if (res.firstLogin) { setSetup(true); toast.info("Please set a new password to continue"); return; }
      login(res.user as any, res.token);
      toast.success("Welcome back");
    } catch (e: any) { toast.error(e.message || "Login failed"); }
    finally { setLoading(false); }
  }

  async function handleSet() {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await post("/hospital-lab-staff/set-password", { code: code.trim(), currentPassword: password, newPassword });
      login(res.user as any, res.token);
      toast.success("Password updated");
    } catch (e: any) { toast.error(e.message || "Failed to set password"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-500 flex items-center justify-center mb-3">
            <FlaskConical className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Hospital Lab Login</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            {setup ? "Set a new password for your account" : "Sign in to manage your hospital's lab bookings"}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {setup ? (
            <>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters" onKeyDown={(e) => e.key === "Enter" && handleSet()} autoFocus />
              </div>
              <Button className="w-full" onClick={handleSet} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Password & Sign In"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Lab Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. HL1A2B3"
                  className="font-mono tracking-widest" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
              </div>
              <Button className="w-full" onClick={handleLogin} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
              </Button>
            </>
          )}
          <button type="button" onClick={() => navigate({ path: "/login", tab: "patient", patientMode: "login" })}
            className="w-full text-center text-xs text-gray-400 hover:text-teal-600 transition-colors">
            Not lab staff? Go to patient/doctor login
          </button>
        </div>
      </div>
    </div>
  );
}