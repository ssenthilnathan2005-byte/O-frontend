import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Phone, Star, Clock, FlaskConical, Loader2, CheckCircle2 } from "lucide-react";
import * as api from "../../api";
import { useRouter } from "../../router/RouterContext";
import { useStore } from "../../context/StoreContext";
import { toast } from "sonner";

interface Props {
  id: string;
}

export default function LabDetailPage({ id }: Props) {
  const { goBack, navigate } = useRouter();
  const { user } = useStore();
  const [lab, setLab] = useState<api.Lab | null>(null);
  const [tests, setTests] = useState<api.LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingTest, setBookingTest] = useState<api.LabTest | null>(null);

  useEffect(() => {
    Promise.all([api.labs.get(id), api.labs.getTests(id)])
      .then(([labData, testsData]) => { setLab(labData); setTests(testsData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading lab...</p>
      </div>
    );
  }

  if (!lab) return <div className="p-8 text-center">Lab not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-2 pb-6">
      <button
        type="button"
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Labs
      </button>

      {/* Lab header */}
      <div className="h-28 sm:h-36 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-end p-4 sm:p-6 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{lab.name}</h1>
          <p className="text-white/80 text-sm flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{lab.area}</span>
            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-white" />{lab.rating.toFixed(1)}</span>
          </p>
        </div>
      </div>

      {lab.phone && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
          <Phone className="w-4 h-4" /> {lab.phone}
        </div>
      )}

      <h2 className="text-lg font-bold text-gray-900 mb-3">Available Tests</h2>

      {tests.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No tests listed for this lab yet.</p>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <div
              key={test.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{test.name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Clock className="w-3.5 h-3.5" /> Report in {test.report_hours}h · {test.sample_type} sample
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900 text-sm">₹{test.price}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      navigate({ path: "/login", tab: "patient", patientMode: "login" });
                      return;
                    }
                    setBookingTest(test);
                  }}
                  className="mt-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
                >
                  Book →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {bookingTest && (
        <LabBookingDialog
          lab={lab}
          test={bookingTest}
          open={!!bookingTest}
          onClose={() => setBookingTest(null)}
        />
      )}
    </div>
  );
}

// ── Lightweight booking dialog ──────────────────────────────────────────────
function LabBookingDialog({
  lab, test, open, onClose,
}: { lab: api.Lab; test: api.LabTest; open: boolean; onClose: () => void }) {
  const { navigate } = useRouter();
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [collectionType, setCollectionType] = useState<"home" | "walk_in">("home");
  const [address, setAddress] = useState("");
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<api.LabBooking | null>(null);

  if (!open) return null;

  if (booked) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-teal-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Booking confirmed</h3>
          <p className="text-xs text-gray-500 mt-0.5">{test.name} · {lab.name}</p>

          {booked.token_number != null && (
            <div className="my-5 rounded-2xl bg-teal-50 border border-teal-100 py-4">
              <p className="text-[11px] uppercase tracking-wide text-teal-600 font-semibold">Your token number</p>
              <p className="text-5xl font-extrabold text-teal-700 leading-none mt-1">#{booked.token_number}</p>
            </div>
          )}

          <p className="text-xs text-gray-500 mb-5">
            {booked.slot_date} · {api.labSessionLabel(booked.slot_time)} session
          </p>

          <button
            type="button"
            onClick={() => navigate({ path: "/labs/track", bookingId: booked.id })}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-full py-3 text-sm font-semibold"
          >
            Track my token
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 border border-gray-200 rounded-full py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const availableDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
  const timeSlots = [{ key: "morning", label: "Morning" }, { key: "afternoon", label: "Afternoon" }];

  async function handleSubmit() {
    setError("");
    if (!patientName.trim() || !/^\d{10}$/.test(phone.trim())) {
      setError("Please enter a valid name and 10-digit phone number.");
      return;
    }
    if (!slotDate || !slotTime) { setError("Please select a date and session."); return; }
    if (collectionType === "home" && !address.trim()) { setError("Please enter your address for home collection."); return; }

    setSubmitting(true);
    try {
      const booking = await api.labs.book({
        patientName: patientName.trim(),
        phone: phone.trim(),
        labId: lab.id,
        testId: test.id,
        slotDate,
        slotTime,
        collectionType,
        address: collectionType === "home" ? address.trim() : undefined,
      });
      toast.success("Lab test booked!");
      setBooked(booking);
    } catch (err: any) {
      setError(err.message || "Could not book. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Book {test.name}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Select Date</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {availableDates.map((d) => (
                <button key={d} type="button" onClick={() => setSlotDate(d)}
                  className={`shrink-0 px-3 py-2 rounded-lg border text-xs font-medium ${
                    slotDate === d ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600"
                  }`}>
                  {new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Select Session</label>
            <div className="grid grid-cols-2 gap-2">
              {timeSlots.map((t) => (
                <button key={t.key} type="button" onClick={() => setSlotTime(t.key)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                    slotTime === t.key ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Collection Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setCollectionType("home")}
                className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                  collectionType === "home" ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600"
                }`}>Home Collection</button>
              <button type="button" onClick={() => setCollectionType("walk_in")}
                className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                  collectionType === "walk_in" ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600"
                }`}>Walk-in</button>
            </div>
          </div>

          {collectionType === "home" && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Address</label>
              <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your full address"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-300" />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Patient Name</label>
            <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)}
              placeholder="Enter patient name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Phone Number</label>
            <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit phone number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          </div>

          <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="font-bold text-gray-900">₹{test.price}</span>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitting ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
