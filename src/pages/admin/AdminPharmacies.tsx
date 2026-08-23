import { useEffect, useState } from "react";
import { Pill, MapPin, Phone, Mail, Clock, Loader2, Eye, Plus, X, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToken } from "@/api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

async function apiFetch(path: string, method = "GET", body?: any) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const EMPTY_FORM = {
  ownerName: "", ownerEmail: "", ownerPassword: "",
  ownerPhone: "", pharmacyName: "", description: "",
  address: "", area: "", pharmacyPhone: "", openingHours: "",
  latitude: "", longitude: "",
};

export default function AdminPharmacies() {
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create" | "enquiries">("list");
  const [selected, setSelected] = useState<any>(null);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loadingEnq, setLoadingEnq] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    apiFetch("/pharmacies").then(setPharmacies).catch(() => toast.error("Failed to load")).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleCreate() {
    if (!form.ownerName || !form.ownerEmail || !form.ownerPassword || !form.pharmacyName) {
      toast.error("Owner name, email, password and pharmacy name are required"); return;
    }
    setSaving(true);
    try {
      await apiFetch("/pharmacy-owner/register", "POST", {
        name: form.ownerName, email: form.ownerEmail, password: form.ownerPassword,
        phone: form.ownerPhone, pharmacyName: form.pharmacyName,
        description: form.description, address: form.address, area: form.area,
        pharmacyPhone: form.pharmacyPhone, openingHours: form.openingHours,
        latitude: form.latitude, longitude: form.longitude,
      });
      toast.success("Pharmacy created!");
      setForm(EMPTY_FORM);
      setView("list");
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function openEnquiries(p: any) {
    setSelected(p);
    setView("enquiries");
    setLoadingEnq(true);
    try {
      const data = await apiFetch(`/pharmacies/${p.id}/enquiries-admin`);
      setEnquiries(Array.isArray(data) ? data : []);
    } catch { setEnquiries([]); }
    finally { setLoadingEnq(false); }
  }

  async function toggleActive(p: any) {
    try {
      await apiFetch(`/pharmacies/${p.id}/toggle-active`, "PATCH");
      load();
      toast.success("Status updated");
    } catch (err: any) { toast.error(err.message); }
  }

  const field = (label: string, key: string, placeholder = "", type = "text") => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={(form as any)[key]} onChange={set(key)} placeholder={placeholder} type={type} />
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacies</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pharmacies.length} registered pharmacies</p>
        </div>
        {view === "list" && (
          <Button className="bg-teal-600 hover:bg-teal-700 gap-2" onClick={() => setView("create")}>
            <Plus className="w-4 h-4" /> Add Pharmacy
          </Button>
        )}
        {view !== "list" && (
          <button type="button" onClick={() => { setView("list"); setSelected(null); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-600">
            <X className="w-4 h-4" /> Close
          </button>
        )}
      </div>

      {/* Create form */}
      {view === "create" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Owner Account</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field("Owner Name *", "ownerName", "Full name")}
            {field("Owner Email *", "ownerEmail", "owner@pharmacy.com", "email")}
            {field("Password *", "ownerPassword", "Temp password", "password")}
            {field("Owner Phone", "ownerPhone", "+91 9999 999999")}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">Pharmacy Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field("Pharmacy Name *", "pharmacyName", "Apollo Pharmacy, Madurai")}
            {field("Description", "description", "What they specialise in")}
            {field("Address", "address", "Street address")}
            {field("Area / City", "area", "Madurai")}
            {field("Pharmacy Phone", "pharmacyPhone", "Public contact number")}
            {field("Opening Hours", "openingHours", "Mon–Sat 9am–9pm")}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">GPS Location (optional)</p>
          <div className="grid grid-cols-2 gap-4">
            {field("Latitude", "latitude", "9.9252")}
            {field("Longitude", "longitude", "78.1198")}
          </div>

          <div className="flex gap-3 pt-2">
            <Button className="bg-teal-600 hover:bg-teal-700 gap-2" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Create Pharmacy
            </Button>
            <Button variant="outline" onClick={() => { setView("list"); setForm(EMPTY_FORM); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Enquiries view */}
      {view === "enquiries" && selected && (
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <h2 className="font-bold text-lg text-gray-900 mb-3">{selected.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
              {selected.address && <div className="flex gap-2"><MapPin className="w-4 h-4 text-teal-500 shrink-0" />{selected.address}, {selected.area}</div>}
              {selected.phone && <div className="flex gap-2"><Phone className="w-4 h-4 text-teal-500" />{selected.phone}</div>}
              {selected.email && <div className="flex gap-2"><Mail className="w-4 h-4 text-teal-500" />{selected.email}</div>}
              {selected.opening_hours && <div className="flex gap-2"><Clock className="w-4 h-4 text-teal-500" />{selected.opening_hours}</div>}
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-3">Patient Enquiries</h3>
          {loadingEnq ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          : enquiries.length === 0 ? <p className="text-gray-400 text-sm py-6 text-center">No enquiries yet for this pharmacy.</p>
          : enquiries.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-4 mb-2 flex justify-between items-start">
              <div>
                <span className="font-medium text-gray-900">{e.name}</span>
                <div className="text-sm text-teal-600 mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" />{e.phone}</div>
                {e.message && <p className="text-sm text-gray-600 mt-1">{e.message}</p>}
              </div>
              <span className="text-xs text-gray-400 shrink-0 ml-3">{new Date(e.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pharmacy list */}
      {view === "list" && (
        pharmacies.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Pill className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No pharmacies yet</p>
            <p className="text-sm mt-1">Click <span className="text-teal-600 font-medium">Add Pharmacy</span> to create the first one</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pharmacies.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                    <Pill className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    {p.area && <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5"><MapPin className="w-3 h-3" />{p.area}</div>}
                    {p.phone && <div className="flex items-center gap-1 text-xs text-gray-500"><Phone className="w-3 h-3" />{p.phone}</div>}
                    {p.opening_hours && <div className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3 h-3" />{p.opening_hours}</div>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEnquiries(p)}>
                    <Eye className="w-3.5 h-3.5" /> Enquiries
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => toggleActive(p)}>
                    {p.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
