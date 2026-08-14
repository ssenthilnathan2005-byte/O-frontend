import { Pill, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "../api";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";

export default function PharmacyLogin() {
  const { login } = useStore();
  const { navigate } = useRouter();

  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!code.trim() || !phone.trim()) {
      toast.error("Enter your pharmacy code and registered phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.pharmacyLogin(code.trim(), phone.trim());
      login(res.user, res.token);
      toast.success("Welcome back");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mb-3">
            <Pill className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Pharmacy Staff Login</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Sign in to manage the prescription queue
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Pharmacy Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. PH.APLO.CHN.01"
              className="font-mono tracking-widest"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Registered Phone Number</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Your registered phone"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
          </Button>

          <button
            type="button"
            onClick={() => navigate({ path: "/login", tab: "patient", patientMode: "login" })}
            className="w-full text-center text-xs text-gray-400 hover:text-emerald-600 transition-colors"
          >
            Not pharmacy staff? Go to patient/doctor login
          </button>
        </div>
      </div>
    </div>
  );
}
