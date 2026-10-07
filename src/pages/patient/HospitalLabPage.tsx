import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as api from "../../api";
import { useRouter } from "../../router/RouterContext";
import { useStore } from "../../context/StoreContext";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Test = { id: string; name: string; category: string; sample_type: string; report_hours: number; price: number };
type Booked = { token_number: number | null; slot_date: string; slot_time: string; testName: string };

export default function HospitalLabPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { navigate } = useRouter();
  const { user, hospitals } = useStore();
  const hospital = hospitals.find((h) => h.id === id);
  const [tests, setTests] = useState<Test[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Test | null>(null);
  const [mine, setMine] = useState<any[]>([]);
  async function loadMine() {
    if (!user) return;
    try {
      const r = await fetch(`${BASE}/hospital-lab/my-orders`, { headers: { Authorization: `Bearer ${api.getToken()}` } });
      const d = await r.json();
      if (Array.isArray(d)) setMine(d);
    } catch {}
  }
  useEffect(() => {
    loadMine();
    const t = setInterval(loadMine, 30000);
    return () => clearInterval(t);
  }, [id, user]);
  const STATUS: Record<string, { label: string; cls: string }> = {
    ordered: { label: "Booked", cls: "bg-blue-50 text-blue-700" },
    sample_collected: { label: "Sample collected", cls: "bg-amber-50 text-amber-700" },
    processing: { label: "Processing", cls: "bg-amber-50 text-amber-700" },
    report_ready: { label: "Report ready", cls: "bg-green-50 text-green-700" },
    cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-500" },
  };

  useEffect(() => {
    fetch(`${BASE}/hospital-lab/public/${id}`)
      .then((r) => r.json())
      .then((d) => { setEnabled(!!d.enabled); setTests(d.tests || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  function pick(t: Test) {
    if (!user) { navigate({ path: "/login", tab: "patient", patientMode: "login" }); return; }
    setSelected(t);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" /><p className="text-sm">Loading lab...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-2 pb-6">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to {hospital?.name || "hospital"}
      </button>
      <div className="h-28 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-end p-4 sm:p-6 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Lab facility</h1>
          <p className="text-white/80 text-sm">{hospital?.name}</p>
        </div>
      </div>

      {mine.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">My lab bookings</h2>
          <div className="space-y-2">
            {mine.map((o) => {
              const st = STATUS[o.status] || { label: o.status, cls: "bg-gray-100 text-gray-500" };
              return (
                <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{o.test_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{o.hospital_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {o.slot_date} · {o.slot_time} session{o.token_number != null ? ` · Token #${o.token_number}` : ""}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${st.cls}`}>{st.label}</span>
                  </div>
                  {o.status === "report_ready" && o.result_value && (
                    <p className="text-xs text-green-700 mt-2 font-medium">Result: {o.result_value}</p>
                  )}
                  {o.status === "report_ready" && o.report_url && (
                    <a href={o.report_url} target="_blank" rel="noreferrer" className="text-xs text-teal-600 underline mt-1 inline-block">View report</a>
                  )}
                  {o.status !== "report_ready" && o.status !== "cancelled" && (
                    <p className="text-xs text-gray-400 mt-2">Pay ₹{o.price} at the hospital lab. This updates automatically.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold text-gray-900 mb-3">Available Tests</h2>
      {!enabled || tests.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No tests available for booking right now.</p>
      ) : (
        <div className="space-y-3">
          {tests.map((t) => (
            <div key={t.id} role="button" tabIndex={0} onClick={() => pick(t)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(t); } }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-teal-200 hover:shadow-md transition-colors">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{t.name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Clock className="w-3.5 h-3.5" /> Report in {t.report_hours}h · {t.sample_type} sample
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900 text-sm">₹{t.price}</p>
                <span className="mt-1 text-xs font-semibold text-teal-600 block">Book →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <BookDialog hospitalId={id} hospitalName={hospital?.name || ""} test={selected} onClose={() => { setSelected(null); loadMine(); }} />}
    </div>
  );
}

function BookDialog({ hospitalId, hospitalName, test, onClose }: { hospitalId: string; hospitalName: string; test: Test; onClose: () => void }) {
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<Booked | null>(null);

  useEffect(() => {
    api.patients.getProfile()
      .then((p: any) => {
        if (p?.name) setPatientName(p.name);
        if (p?.phone) setPhone(String(p.phone).replace(/\D/g, "").slice(-10));
      })
      .catch(() => {});
  }, []);

  const dates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toLocaleDateString("en-CA");
  });

  async function submit() {
    setError("");
    if (!patientName.trim() || !/^\d{10}$/.test(phone.trim())) { setError("Please enter a valid name and 10-digit phone number."); return; }
    if (!slotDate || !slotTime) { setError("Please select a date and session."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/hospital-lab/public/${hospitalId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}` },
        body: JSON.stringify({ testId: test.id, patientName: patientName.trim(), phone: phone.trim(), slotDate, slotTime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not book");
      toast.success("Lab test booked!");
      setBooked(data);
    } catch (e: any) {
      setError(e.message || "Could not book. Please try again.");
    } finally { setSubmitting(false); }
  }

  const shell = "fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4";

  if (booked) {
    return (
      <div className={shell}>
        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-teal-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Booking confirmed</h3>
          <p className="text-xs text-gray-500 mt-0.5">{test.name} · {hospitalName}</p>
          {booked.token_number != null && (
            <div className="my-5 rounded-2xl bg-teal-50 border border-teal-100 py-4">
              <p className="text-[11px] uppercase tracking-wide text-teal-600 font-semibold">Your token number</p>
              <p className="text-5xl font-extrabold text-teal-700 leading-none mt-1">#{booked.token_number}</p>
            </div>
          )}
          <p className="text-xs text-gray-500 mb-1">{booked.slot_date} · {booked.slot_time} session</p>
          <p className="text-xs text-gray-400 mb-5">Pay ₹{test.price} at the hospital lab.</p>
          <button type="button" onClick={onClose} className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-full py-3 text-sm font-semibold">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Book {test.name}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Select Date</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dates.map((d) => (
                <button key={d} type="button" onClick={() => setSlotDate(d)}
                  className={`shrink-0 px-3 py-2 rounded-lg border text-xs font-medium ${slotDate === d ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600"}`}>
                  {new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Select Session</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ k: "morning", l: "Morning" }, { k: "afternoon", l: "Afternoon" }].map((s) => (
                <button key={s.k} type="button" onClick={() => setSlotTime(s.k)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium ${slotTime === s.k ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600"}`}>
                  {s.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Patient Name</label>
            <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Enter patient name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Phone Number</label>
            <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit phone number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          </div>
          <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
            <span className="text-gray-500">Total (pay at hospital)</span>
            <span className="font-bold text-gray-900">₹{test.price}</span>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="button" onClick={submit} disabled={submitting}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitting ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}