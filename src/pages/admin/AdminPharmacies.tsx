import { useEffect, useState } from "react";
import { Pill, Trash2, MapPin, Phone, Mail, Clock, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as api from "../../api";

export default function AdminPharmacies() {
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loadingEnq, setLoadingEnq] = useState(false);

  useEffect(() => {
    api.pharmacies.list()
      .then(setPharmacies)
      .catch(() => toast.error("Failed to load pharmacies"))
      .finally(() => setLoading(false));
  }, []);

  async function viewEnquiries(pharmacy: any) {
    setSelected(pharmacy);
    setLoadingEnq(true);
    try {
      // Admin calls public list endpoint — no owner-specific enquiry endpoint needed for read
      const res = await fetch(
        `${(import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api"}/pharmacies/${pharmacy.id}/enquiries-admin`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("db_token") || ""}` } }
      );
      const data = await res.json();
      setEnquiries(Array.isArray(data) ? data : []);
    } catch { setEnquiries([]); }
    finally { setLoadingEnq(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacies</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pharmacies.length} registered pharmacies</p>
        </div>
      </div>

      {selected ? (
        <div>
          <button type="button" onClick={() => setSelected(null)}
            className="mb-4 text-sm text-gray-500 hover:text-teal-600 flex items-center gap-1">
            ← Back to list
          </button>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <h2 className="font-bold text-lg text-gray-900 mb-3">{selected.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
              {selected.address && <div className="flex gap-2"><MapPin className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />{selected.address}, {selected.area}</div>}
              {selected.phone && <div className="flex gap-2"><Phone className="w-4 h-4 text-teal-500" />{selected.phone}</div>}
              {selected.email && <div className="flex gap-2"><Mail className="w-4 h-4 text-teal-500" />{selected.email}</div>}
              {selected.opening_hours && <div className="flex gap-2"><Clock className="w-4 h-4 text-teal-500" />{selected.opening_hours}</div>}
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-3">Enquiries</h3>
          {loadingEnq ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          : enquiries.length === 0 ? <p className="text-gray-400 text-sm">No enquiries yet.</p>
          : enquiries.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-4 mb-2">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">{e.name}</span>
                <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString()}</span>
              </div>
              <div className="text-sm text-teal-600 mt-0.5">{e.phone}</div>
              {e.message && <p className="text-sm text-gray-600 mt-1">{e.message}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pharmacies.length === 0 ? (
            <div className="col-span-2 text-center py-16 text-gray-400">
              <Pill className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No pharmacies registered yet.</p>
              <p className="text-xs mt-1">Pharmacy owners can register at <span className="text-teal-500">/pharmacy-owner/register</span></p>
            </div>
          ) : pharmacies.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  {p.area && <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5"><MapPin className="w-3 h-3" />{p.area}</div>}
                  {p.phone && <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5"><Phone className="w-3 h-3" />{p.phone}</div>}
                  {p.opening_hours && <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5"><Clock className="w-3 h-3" />{p.opening_hours}</div>}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => viewEnquiries(p)} className="gap-1.5 shrink-0">
                <Eye className="w-3.5 h-3.5" /> Enquiries
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
