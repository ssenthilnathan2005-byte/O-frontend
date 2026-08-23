import { useState } from "react";
import { Pill, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "../api";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";

export default function PharmacyOwnerRegister() {
  const { login } = useStore();
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "",
    pharmacyName: "", description: "", address: "", area: "",
    pharmacyPhone: "", openingHours: "", latitude: "", longitude: "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function handleRegister() {
    if (!form.name || !form.email || !form.password || !form.pharmacyName) {
      toast.error("Fill in all required fields"); return;
    }
    setLoading(true);
    try {
      const res = await api.pharmacyOwner.register(form);
      login(res.user, res.token);
      toast.success("Pharmacy registered!");
      navigate({ path: "/pharmacy-owner/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally { setLoading(false); }
  }

  const field = (label: string, key: string, placeholder = "", type = "text") => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={(form as any)[key]} onChange={set(key)} placeholder={placeholder} type={type} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="w-full max-w-lg mx-auto">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center mb-3">
            <Pill className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Register Your Pharmacy</h1>
          <p className="text-sm text-gray-500 mt-1">List your pharmacy for patients to find & contact you</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Owner Details</p>
          {field("Your Name *", "name", "Full name")}
          {field("Email *", "email", "you@example.com", "email")}
          {field("Password *", "password", "Min 8 chars", "password")}
          {field("Phone", "phone", "+91 9999 999999")}

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">Pharmacy Details</p>
          {field("Pharmacy Name *", "pharmacyName", "Apollo Pharmacy, Andheri")}
          {field("Description", "description", "What you specialise in...")}
          {field("Address", "address", "Full street address")}
          {field("Area / City", "area", "Mumbai")}
          {field("Pharmacy Phone", "pharmacyPhone", "Contact number for patients")}
          {field("Opening Hours", "openingHours", "Mon–Sat 9am–9pm")}

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">Location (optional)</p>
          <div className="grid grid-cols-2 gap-3">
            {field("Latitude", "latitude", "19.0760")}
            {field("Longitude", "longitude", "72.8777")}
          </div>

          <Button className="w-full bg-teal-600 hover:bg-teal-700 mt-2" onClick={handleRegister} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Pharmacy"}
          </Button>
          <p className="text-center text-xs text-gray-400">
            Already registered?{" "}
            <button type="button" className="text-teal-600 hover:underline" onClick={() => navigate({ path: "/pharmacy-owner/login" })}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
