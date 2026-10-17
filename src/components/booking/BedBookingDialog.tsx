import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BedDouble, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { bedBookings } from "../../api";
import { useStore } from "../../context/StoreContext";

interface Props { hospitalId: string; hospitalName?: string; open: boolean; onClose: () => void }

const STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: "Waiting for hospital", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Bed reserved", cls: "bg-green-100 text-green-700" },
  admitted:  { label: "Admitted", cls: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-600" },
  rejected:  { label: "Declined", cls: "bg-red-100 text-red-700" },
  expired:   { label: "Reservation expired", cls: "bg-gray-100 text-gray-600" },
};
const rupee = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white";
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");

export default function BedBookingDialog({ hospitalId, hospitalName, open, onClose }: Props) {
  const { user, doctors } = useStore() as any;
  const [tab, setTab] = useState<"book" | "mine">("book");
  const [wards, setWards] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    wardId: "", patientName: user?.name || "", phone: (user?.phone || "").replace(/^91/, ""),
    age: "", gender: "", doctorId: "", reason: "", expectedAdmitAt: new Date().toLocaleDateString("en-CA"),
  });
  const hospDoctors = (doctors || []).filter((d: any) => d.hospitalId === hospitalId);

  async function loadAll() {
    setLoading(true);
    try {
      const [w, m] = await Promise.all([bedBookings.availability(hospitalId), bedBookings.mine()]);
      setWards(w);
      setMine(m.filter((b: any) => b.hospital_id === hospitalId));
    } catch (e: any) { toast.error(e.message || "Could not load beds"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (open) loadAll(); /* eslint-disable-next-line */ }, [open, hospitalId]);

  async function submit() {
    if (!f.wardId) return toast.error("Choose a ward");
    if (!f.patientName.trim()) return toast.error("Enter the patient name");
    if (!/^\d{10}$/.test(f.phone.replace(/\D/g, "").slice(-10))) return toast.error("Enter a valid 10-digit mobile number");
    setSaving(true);
    try {
      await bedBookings.create({
        hospitalId, wardId: f.wardId, patientName: f.patientName.trim(), phone: f.phone,
        age: f.age || null, gender: f.gender || null, doctorId: f.doctorId || null,
        reason: f.reason || null, expectedAdmitAt: f.expectedAdmitAt || null,
      });
      toast.success("Bed request sent. The hospital will confirm shortly.");
      setF({ ...f, reason: "" });
      await loadAll();
      setTab("mine");
    } catch (e: any) { toast.error(e.message || "Could not send request"); }
    finally { setSaving(false); }
  }

  async function cancel(id: string) {
    if (!window.confirm("Cancel this bed request?")) return;
    try { await bedBookings.cancel(id); toast.success("Cancelled"); await loadAll(); }
    catch (e: any) { toast.error(e.message || "Could not cancel"); }
  }

  const tabCls = (on: boolean) => "flex-1 py-2 text-sm font-medium rounded-lg " + (on ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BedDouble className="w-5 h-5 text-teal-600" />Book a bed{hospitalName ? " - " + hospitalName : ""}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <button className={tabCls(tab === "book")} onClick={() => setTab("book")}>New request</button>
          <button className={tabCls(tab === "mine")} onClick={() => setTab("mine")}>My requests{mine.length ? ` (${mine.length})` : ""}</button>
        </div>

        {loading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-teal-600" /></div>}

        {!loading && tab === "book" && (
          <div className="space-y-3">
            {wards.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">This hospital has not set up inpatient wards yet.</p>}
            {wards.length > 0 && (
              <>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">Choose a ward</p>
                  <div className="space-y-2">
                    {wards.map((w) => {
                      const full = w.availableBeds < 1;
                      const sel = f.wardId === w.id;
                      return (
                        <button key={w.id} type="button" onClick={() => setF({ ...f, wardId: w.id })}
                          className={"w-full text-left rounded-xl border-2 p-3 flex items-center justify-between " + (sel ? "border-teal-600 bg-teal-50" : "border-gray-200 bg-white")}>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{w.type}{w.dailyRate > 0 ? " · " + rupee(w.dailyRate) + " / day" : ""}</p>
                          </div>
                          <span className={"text-xs font-semibold px-2 py-1 rounded-full " + (full ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
                            {full ? "Full - can request" : w.availableBeds + " free"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input className={inp} placeholder="Patient name" value={f.patientName} onChange={(e) => setF({ ...f, patientName: e.target.value })} />
                <input className={inp} placeholder="Mobile number (10 digits)" inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inp} placeholder="Age" inputMode="numeric" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} />
                  <select className={inp} value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
                    <option value="">Gender</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <select className={inp} value={f.doctorId} onChange={(e) => setF({ ...f, doctorId: e.target.value })}>
                  <option value="">Preferred doctor (optional)</option>
                  {hospDoctors.map((d: any) => <option key={d.id} value={d.id}>{d.name} - {d.specialty}</option>)}
                </select>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Expected admission date</p>
                  <input type="date" className={inp} min={new Date().toLocaleDateString("en-CA")} value={f.expectedAdmitAt} onChange={(e) => setF({ ...f, expectedAdmitAt: e.target.value })} />
                </div>
                <textarea className={inp} rows={2} placeholder="Reason / condition (optional)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
                <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={submit} disabled={saving}>{saving ? "Sending..." : "Request bed"}</Button>
                <p className="text-[11px] text-gray-500">No payment now. The hospital confirms and reserves a bed for you, then you will get a notification.</p>
              </>
            )}
          </div>
        )}

        {!loading && tab === "mine" && (
          <div className="space-y-2">
            {mine.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">No bed requests yet.</p>}
            {mine.map((b) => {
              const st = STATUS[b.status] || { label: b.status, cls: "bg-gray-100 text-gray-600" };
              return (
                <div key={b.id} className="border border-gray-200 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{b.patient_name}</p>
                    <span className={"text-[11px] font-semibold px-2 py-0.5 rounded-full " + st.cls}>{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-600">{b.ward_name}{b.bed_number ? " · Bed " + b.bed_number : ""}</p>
                  {b.expected_admit_at && <p className="text-xs text-gray-500">Expected: {fmt(b.expected_admit_at)}</p>}
                  {b.status === "confirmed" && b.reserved_until && <p className="text-xs text-green-700">Bed held until {fmt(b.reserved_until)}. Please arrive before then.</p>}
                  {b.status === "rejected" && b.staff_note && <p className="text-xs text-red-600">Reason: {b.staff_note}</p>}
                  {(b.status === "requested" || b.status === "confirmed") && (
                    <button className="text-xs text-red-600 font-medium mt-1" onClick={() => cancel(b.id)}>Cancel request</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
