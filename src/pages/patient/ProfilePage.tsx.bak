import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserCog, Loader2, Save, CheckCircle2 } from "lucide-react";
import { patients } from "../../api";
import { useRouter } from "../../router/RouterContext";

export default function ProfilePage() {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wasComplete, setWasComplete] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await patients.getProfile();
        if (cancelled) return;
        setName(data.name || "");
        setPhone(data.phone || "");
        setAge(data.age || "");
        setWasComplete(data.isComplete);
      } catch (err: any) {
        toast.error(err.message || "Could not load your profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function isValidPhone(value: string): boolean {
    return /^\d{10}$/.test(value.trim());
  }

  async function handleSave() {
    if (!name.trim() || !phone.trim() || !age.trim()) {
      toast.error("Please fill in your name, phone number, and age");
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum <= 0 || ageNum > 120) {
      toast.error("Please enter a valid age");
      return;
    }

    setSaving(true);
    try {
      await patients.updateProfile({ name: name.trim(), phone: phone.trim(), age: age.trim() });
      toast.success("Profile saved");
      setWasComplete(true);
      navigate({ path: "/" });
    } catch (err: any) {
      toast.error(err.message || "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="text-center pb-4">
        <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <UserCog className="w-7 h-7 text-teal-500" />
        </div>
        <h1 className="font-bold text-gray-900 text-xl">My Profile</h1>
        <p className="text-sm text-gray-400 mt-1">
          {wasComplete
            ? "These details are used to auto-fill your bookings."
            : "Fill this in once — we'll auto-fill it for future bookings."}
        </p>
      </div>

      <div className="space-y-3 bg-white border border-gray-200 rounded-2xl p-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Phone Number <span className="text-red-500">*</span></label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Enter 10-digit phone number"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Age <span className="text-red-500">*</span></label>
          <input
            type="number"
            placeholder="Enter your age"
            value={age}
            onChange={e => setAge(e.target.value)}
            min={0} max={120}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 mt-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : wasComplete ? (
            <><CheckCircle2 className="w-4 h-4" /> Update Profile</>
          ) : (
            <><Save className="w-4 h-4" /> Save Profile</>
          )}
        </button>
      </div>
    </div>
  );
}
