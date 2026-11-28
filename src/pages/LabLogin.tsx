import { Eye, EyeOff, FlaskConical, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "../api";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";
import FirstLoginPasswordForm from "@/components/FirstLoginPasswordForm";

export default function LabLogin() {
  const { login } = useStore();
  const { navigate } = useRouter();

  function normalizeLabAdminUser(res: { user?: any; labId?: string; labName?: string }) {
    const u = res.user;
    if (!u) return null;
    const role = String(u.role ?? "").toLowerCase();
    if (role === "lab_admin") return u;
    return u;
  }

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "set-password">("login");
  const [labName, setLabName] = useState("");

  async function handleContinue() {
    if (!loginId.trim() || !password) {
      toast.error("Enter your login ID and password");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await api.auth.labLogin(loginId.trim(), password);
        if (res.firstLogin) {
          setLabName(res.labName || "");
          setMode("set-password");
          setPassword("");
          toast.message("First time here — set a password for your account");
          return;
        }
        if (res.token && res.user) {
          const normalizedUser = normalizeLabAdminUser(res);
          if (!normalizedUser || normalizedUser.role !== "lab_admin") {
            toast.error("Lab admin access required for this account");
            return;
          }
          login(normalizedUser, res.token);
          toast.success("Welcome back");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(newPw: string) {
    setLoading(true);
    try {
      const res = await api.auth.labSetPassword(loginId.trim(), newPw);
      const normalizedUser = normalizeLabAdminUser(res as any);
      if (!normalizedUser || normalizedUser.role !== "lab_admin") {
        toast.error("Lab admin access required for this account");
        return;
      }
      login(normalizedUser, res.token);
      toast.success("Password set — you're in");
    } catch (err: any) {
      toast.error(err.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-500 flex items-center justify-center mb-3">
            <FlaskConical className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Lab Staff Login</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            {mode === "login"
              ? "Sign in to manage your lab's tests and bookings"
              : `Set a password for ${labName || "your lab"}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Login ID</Label>
            <Input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="e.g. sunrise_lab"
              disabled={mode === "set-password"}
              autoFocus
            />
          </div>

          {mode === "login" ? (
            <>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button className="w-full" onClick={handleContinue} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
              </Button>
            </>
          ) : (
            <FirstLoginPasswordForm minLength={6} loading={loading} onSubmit={handleSetPassword} />
          )}

          <button
            type="button"
            onClick={() => navigate({ path: "/login", tab: "patient", patientMode: "login" })}
            className="w-full text-center text-sm text-gray-400 hover:text-teal-600 transition-colors"
          >
            &larr; Back
          </button>
        </div>
      </div>
    </div>
  );
}
