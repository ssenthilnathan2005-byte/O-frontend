import { useState } from "react";
import { Pill, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "../api";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";

export default function PharmacyOwnerLogin() {
  const { login } = useStore();
  const { navigate } = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { toast.error("Enter email and password"); return; }
    setLoading(true);
    try {
      const res = await api.pharmacyOwner.login(email.trim(), password.trim());
      login(res.user, res.token);
      toast.success("Welcome back!");
      navigate({ path: "/pharmacy-owner/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center mb-3">
            <Pill className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Pharmacy Owner Login</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">Manage your pharmacy profile & enquiries</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@pharmacy.com" type="email" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password"
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={handleLogin} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
          </Button>
          <p className="text-center text-xs text-gray-400">
            New pharmacy?{" "}
            <button type="button" className="text-teal-600 hover:underline" onClick={() => navigate({ path: "/pharmacy-owner/register" })}>
              Register here
            </button>
          </p>
          <button type="button" onClick={() => navigate({ path: "/" })}
            className="w-full text-center text-xs text-gray-400 hover:text-teal-600 transition-colors">
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
