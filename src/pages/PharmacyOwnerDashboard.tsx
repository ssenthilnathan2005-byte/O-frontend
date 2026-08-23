import { useEffect, useState } from "react";
import { Pill, LogOut, Edit2, MessageSquare, Loader2, Save, Phone, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "../api";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";

export default function PharmacyOwnerDashboard() {
  const { user, logout } = useStore();
  const { navigate } = useRouter();
  const [tab, setTab] = useState<"profile" | "enquiries">("profile");
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    api.pharmacyOwner.getMyPharmacy().then(p => { setPharmacy(p); setForm(p); }).catch(() => toast.error("Failed to load pharmacy"));
    api.pharmacyOwner.getMyEnquiries().then(setEnquiries).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.pharmacyOwner.updateMyPharmacy({
        name: form.name, description: form.description, address: form.address,
        area: form.area, phone: form.phone, email: form.email,
        latitude: form.latitude, longitude: form.longitude, openingHours: form.opening_hours,
      });
      setPharmacy(updated);
      setEditing(false);
      toast.success("Profile updated");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev: any) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <Pill className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">{pharmacy?.name || "My Pharmacy"}</span>
          </div>
          <button type="button" onClick={() => { logout(); navigate({ path: "/" }); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          {(["profile", "enquiries"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${tab === t ? "bg-teal-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-teal-400"}`}>
              {t} {t === "enquiries" && enquiries.length > 0 && <span className="ml-1 bg-teal-100 text-teal-700 text-xs rounded-full px-1.5">{enquiries.length}</span>}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Pharmacy Profile</h2>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm(pharmacy); }}>Cancel</Button>
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700 gap-1.5" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                  </Button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                {[["Pharmacy Name","name"],["Description","description"],["Address","address"],
                  ["Area","area"],["Phone","phone"],["Email","email"],
                  ["Opening Hours","opening_hours"],["Latitude","latitude"],["Longitude","longitude"]
                ].map(([label, key]) => (
                  <div key={key} className="space-y-1">
                    <Label>{label}</Label>
                    <Input value={form[key] || ""} onChange={set(key)} />
                  </div>
                ))}
              </div>
            ) : pharmacy ? (
              <div className="space-y-3 text-sm">
                <p className="text-gray-700">{pharmacy.description || <span className="text-gray-400 italic">No description yet</span>}</p>
                <div className="flex items-start gap-2 text-gray-600"><MapPin className="w-4 h-4 shrink-0 mt-0.5 text-teal-500" />{pharmacy.address || "No address"}, {pharmacy.area}</div>
                <div className="flex items-center gap-2 text-gray-600"><Phone className="w-4 h-4 text-teal-500" />{pharmacy.phone || "No phone"}</div>
                <div className="flex items-center gap-2 text-gray-600"><Clock className="w-4 h-4 text-teal-500" />{pharmacy.opening_hours || "Hours not set"}</div>
                {pharmacy.latitude && <div className="flex items-center gap-2 text-gray-400 text-xs"><MapPin className="w-3.5 h-3.5" />GPS: {pharmacy.latitude}, {pharmacy.longitude}</div>}
              </div>
            ) : <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>}
          </div>
        )}

        {tab === "enquiries" && (
          <div className="space-y-3">
            {enquiries.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No enquiries yet</p>
              </div>
            ) : enquiries.map(e => (
              <div key={e.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{e.name}</span>
                  <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-teal-600"><Phone className="w-3.5 h-3.5" />{e.phone}</div>
                {e.message && <p className="text-sm text-gray-600">{e.message}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
