import re, sys, pathlib

path = pathlib.Path("src/App.tsx")
if not path.exists():
    print("ERROR: run this from the root of the O-frontend repo (src/App.tsx not found)")
    sys.exit(1)

text = path.read_text()

# --- 1. Add the Clock icon to the lucide-react import line ---
old_import = 'import { Calendar, ChevronRight, MapPin, User, Search, Navigation, Loader2, XCircle, Users, Hospital, Pill, Ambulance, FileText } from "lucide-react";'
new_import = 'import { Calendar, ChevronRight, Clock, MapPin, User, Search, Navigation, Loader2, XCircle, Users, Hospital, Pill, Ambulance, FileText } from "lucide-react";'

if old_import not in text:
    print("ERROR: import line marker not found — file may have changed since this script was written.")
    sys.exit(1)
text = text.replace(old_import, new_import, 1)

# --- 2. Replace the whole MobileLanding() function body ---
start_marker = "function MobileLanding() {"
end_marker = "\n\nfunction LandingPage() {"

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx == -1 or end_idx == -1 or end_idx < start_idx:
    print("ERROR: could not locate MobileLanding()...LandingPage() boundaries — file may have changed.")
    sys.exit(1)

new_component = '''function MobileLanding() {
  const { navigate } = useRouter();
  const { user } = useStore();

  return (
    <div className="flex flex-col bg-gray-50" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-8 pb-28">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Care, without the wait</h1>
          <p className="text-sm text-gray-500 mb-7">Everything you need for your next visit</p>

          <button
            type="button"
            onClick={() => navigate({ path: "/patient/hospitals" })}
            className="w-full flex items-center gap-4 bg-teal-700 rounded-2xl px-5 py-5 text-left mb-4 shadow-sm active:bg-teal-800 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-white text-[15px]">Book an appointment</h2>
              <p className="text-teal-50/80 text-xs mt-0.5">Find a hospital and reserve your visit in minutes</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/70 shrink-0" />
          </button>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => navigate({ path: "/patient/tokens" })}
              className="flex flex-col items-start gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-5 text-left shadow-sm active:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">Track your token</h2>
                <p className="text-gray-500 text-xs mt-1">See your exact position in the queue</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate(user ? { path: "/patient/prescriptions" } : { path: "/login", tab: "patient", patientMode: "login" })}
              className="flex flex-col items-start gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-5 text-left shadow-sm active:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">Prescriptions</h2>
                <p className="text-gray-500 text-xs mt-1">View and download your records</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}'''

text = text[:start_idx] + new_component + text[end_idx:]
path.write_text(text)
print("SUCCESS: MobileLanding redesigned and import updated.")
