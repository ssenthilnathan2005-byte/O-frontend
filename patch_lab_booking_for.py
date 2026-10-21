import io, sys

path = r"src\pages\patient\LabDetailPage.tsx"
with io.open(path, "r", encoding="utf-8", newline="") as f:
    raw = f.read()

crlf = "\r\n" in raw
text = raw.replace("\r\n", "\n")

if "bookingFor" in text:
    print("Already patched. Nothing to do.")
    sys.exit(0)

# ---- 1. state + profile loading ----
old1 = '  const [booked, setBooked] = useState<api.LabBooking | null>(null);\n'
new1 = old1 + '''  const [step, setStep] = useState<"for-whom" | "form">("for-whom");
  const [bookingFor, setBookingFor] = useState<"self" | "other" | "">("");
  const [profile, setProfile] = useState<{ name: string; phone: string; age: string; isComplete: boolean } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Load the patient's saved profile when the dialog opens
  useEffect(() => {
    setProfileLoading(true);
    api.patients.getProfile()
      .then((p: any) => setProfile(p))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, []);
'''
if old1 not in text:
    sys.exit("ERROR: could not find booked state line")
text = text.replace(old1, new1, 1)

# ---- 2. "Who is this booking for?" screen ----
old2 = '''  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6">'''
new2 = '''  if (step === "for-whom") {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-gray-900">Book {test.name}</h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          <div className="text-center pb-3">
            <h3 className="font-semibold text-gray-900 text-base">Who is this booking for?</h3>
            <p className="text-sm text-gray-400 mt-1">This helps us fill in the right details.</p>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              disabled={profileLoading}
              onClick={() => {
                if (!profile || !profile.isComplete) {
                  onClose();
                  navigate({ path: "/patient/profile" });
                  return;
                }
                setPatientName(profile.name);
                setPhone((profile.phone || "").replace(/\\D/g, "").slice(-10));
                setBookingFor("self");
                setStep("form");
              }}
              className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-teal-500 hover:bg-teal-50 transition-all text-left disabled:opacity-50"
            >
              <p className="font-medium text-gray-900 text-sm">Booking for Myself</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {profileLoading
                  ? "Checking your profile..."
                  : profile?.isComplete
                  ? "We'll use your saved details"
                  : "You'll need to complete your profile first"}
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setPatientName("");
                setPhone("");
                setBookingFor("other");
                setStep("form");
              }}
              className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-teal-500 hover:bg-teal-50 transition-all text-left"
            >
              <p className="font-medium text-gray-900 text-sm">Booking for Someone Else</p>
              <p className="text-xs text-gray-400 mt-0.5">Fill in their details fully</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

''' + old2
if old2 not in text:
    sys.exit("ERROR: could not find main dialog return")
text = text.replace(old2, new2, 1)

# ---- 3. name/phone inputs -> saved card OR inputs ----
start_marker = '''          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Patient Name</label>'''
end_marker = '''          <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">'''
s = text.find(start_marker)
e = text.find(end_marker)
if s == -1 or e == -1 or e < s:
    sys.exit("ERROR: could not find name/phone block")

new3 = '''          {bookingFor === "self" ? (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{patientName}</p>
                <p className="text-xs text-gray-500">{phone}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep("for-whom")}
                className="text-xs font-medium text-teal-600 hover:text-teal-700"
              >
                Change
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}

'''
text = text[:s] + new3 + text[e:]

if crlf:
    text = text.replace("\n", "\r\n")
with io.open(path, "w", encoding="utf-8", newline="") as f:
    f.write(text)
print("Patched OK")
