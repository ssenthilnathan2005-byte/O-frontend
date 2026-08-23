import { useEffect, useState } from "react";
import { MapPin, Phone, Clock, Mail, Loader2, Pill, Send, ChevronLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "../../api";
import { useRouter } from "../../router/RouterContext";
import { useStore } from "../../context/StoreContext";

export default function PharmacyDetailPage({ id }: { id: string }) {
  const { goBack } = useRouter();
  const { user } = useStore();
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: (user as any)?.name || "", phone: "", message: "" });

  useEffect(() => {
    api.pharmacies.get(id).then(setPharmacy).catch(() => toast.error("Pharmacy not found")).finally(() => setLoading(false));
  }, [id]);

  async function handleEnquire() {
    if (!form.name.trim() || !form.phone.trim()) { toast.error("Name and phone are required"); return; }
    setSending(true);
    try {
      await api.pharmacies.enquire(id, form);
      setSent(true);
      toast.success("Enquiry sent! The pharmacy will contact you.");
    } catch (err: any) { toast.error(err.message || "Failed to send"); }
    finally { setSending(false); }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
    </div>
  );
  if (!pharmacy) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Pharmacy not found</div>
  );

  const mapsUrl = pharmacy.latitude && pharmacy.longitude
    ? `https://maps.google.com/?q=${pharmacy.latitude},${pharmacy.longitude}`
    : pharmacy.address ? `https://maps.google.com/?q=${encodeURIComponent(pharmacy.address)}` : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-600 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center shrink-0">
              <Pill className="w-7 h-7 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{pharmacy.name}</h1>
              {pharmacy.description && <p className="text-sm text-gray-500 mt-1">{pharmacy.description}</p>}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {pharmacy.address && (
              <div className="flex items-start gap-2.5 text-sm text-gray-700">
                <MapPin className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <span>{pharmacy.address}{pharmacy.area ? `, ${pharmacy.area}` : ""}</span>
              </div>
            )}
            {pharmacy.phone && (
              <a href={`tel:${pharmacy.phone}`} className="flex items-center gap-2.5 text-sm text-teal-600 hover:underline">
                <Phone className="w-4 h-4 shrink-0" />{pharmacy.phone}
              </a>
            )}
            {pharmacy.email && (
              <a href={`mailto:${pharmacy.email}`} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-teal-600">
                <Mail className="w-4 h-4 shrink-0" />{pharmacy.email}
              </a>
            )}
            {pharmacy.opening_hours && (
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-teal-500" />{pharmacy.opening_hours}
              </div>
            )}
          </div>

          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 text-sm text-teal-600 hover:underline font-medium">
              <ExternalLink className="w-3.5 h-3.5" /> View on Google Maps
            </a>
          )}
        </div>

        {/* Enquiry form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Send an Enquiry</h2>
          {sent ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
                <Send className="w-5 h-5 text-teal-600" />
              </div>
              <p className="font-medium text-gray-900">Enquiry Sent!</p>
              <p className="text-sm text-gray-500 mt-1">The pharmacy will reach out to you soon.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Your Name *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number *</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 9999 999999" />
              </div>
              <div className="space-y-1.5">
                <Label>Message (optional)</Label>
                <Input value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="What medicines do you need?" />
              </div>
              <Button className="w-full bg-teal-600 hover:bg-teal-700 gap-2" onClick={handleEnquire} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Enquiry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
