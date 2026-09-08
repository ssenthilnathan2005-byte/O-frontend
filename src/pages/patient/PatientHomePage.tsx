import { Calendar, ChevronRight, Clock, FileText, Building2 } from "lucide-react";
import { motion } from "motion/react";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";

function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  const base = (import.meta.env.VITE_API_URL as string || "").replace(/\/api$/, "");
  return base ? `${base}${url}` : url;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function PatientHomePage() {
  const { navigate } = useRouter();
  const { user, bookings, hospitals, tokenStates } = useStore();

  const patientBookings = bookings.filter(
    (b) => b.patientId === user?.id && b.status === "confirmed" && b.paymentDone
  );

  // Find the most recent active token
  const activeBooking = patientBookings[patientBookings.length - 1] ?? null;
  const tokenState = activeBooking?.sessionId ? tokenStates[activeBooking.sessionId] : null;
  const myTokenNum = activeBooking?.tokenNumber ?? null;
  const currentToken = tokenState?.currentToken ?? null;
  const aheadCount =
    myTokenNum != null && currentToken != null
      ? Math.max(0, myTokenNum - currentToken - 1)
      : null;

  const prescriptionCount = patientBookings.length; // proxy — replace with actual prescriptions count if API exposes it

  const nearbyHospitals = hospitals.slice(0, 4);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Greeting */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">
          {getGreeting()} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Your health matters. We're here to help.</p>
      </div>

      <div className="px-4 space-y-4 mt-3">
        {/* Book an appointment — hero card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-teal-600 rounded-2xl px-5 py-5 overflow-hidden cursor-pointer"
          onClick={() => navigate({ path: "/patient/hospitals" })}
        >
          {/* Hospital illustration on the right */}
          <div className="absolute right-0 top-0 bottom-0 w-32 flex items-end justify-end pr-3 pb-0 pointer-events-none select-none">
            <Building2 className="w-24 h-24 text-teal-400 opacity-40" strokeWidth={0.8} />
          </div>

          <div className="relative z-10 max-w-[60%]">
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-teal-500 rounded-xl p-2">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-white font-bold text-lg leading-tight">Book an appointment</h2>
            </div>
            <p className="text-teal-100 text-sm mb-4">Find a hospital and get your token in minutes</p>
            <button
              type="button"
              className="flex items-center gap-2 bg-white text-teal-700 font-semibold text-sm px-4 py-2 rounded-full shadow hover:bg-teal-50 transition-colors"
              onClick={(e) => { e.stopPropagation(); navigate({ path: "/patient/hospitals" }); }}
            >
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Track token + Prescriptions — two cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Track your token */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() =>
              activeBooking?.sessionId
                ? navigate({ path: "/patient/track", sessionId: activeBooking.sessionId, tokenNumber: activeBooking.tokenNumber ?? 0 })
                : navigate({ path: "/patient/tokens" })
            }
          >
            <Clock className="w-6 h-6 text-teal-500 mb-3" />
            <h3 className="font-bold text-gray-900 text-sm">Track your token</h3>
            <p className="text-gray-400 text-xs mt-0.5">See your position in the queue</p>

            {myTokenNum != null ? (
              <div className="mt-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs font-semibold text-gray-700">
                  Token #{myTokenNum}
                  {aheadCount != null && ` · ${aheadCount} ahead`}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" />
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-1">
                <span className="text-xs text-gray-400">No active token</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" />
              </div>
            )}
          </motion.div>

          {/* Prescriptions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate({ path: "/patient/prescriptions" })}
          >
            <FileText className="w-6 h-6 text-teal-500 mb-3" />
            <h3 className="font-bold text-gray-900 text-sm">Prescriptions</h3>
            <p className="text-gray-400 text-xs mt-0.5">View and download your records</p>

            <div className="mt-3 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-teal-500" />
              <span className="text-xs font-semibold text-gray-700">
                {prescriptionCount > 0 ? `${prescriptionCount} prescription${prescriptionCount > 1 ? "s" : ""}` : "No records yet"}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" />
            </div>
          </motion.div>
        </div>

        {/* Hospitals near you */}
        {nearbyHospitals.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Hospitals near you</h2>
                <p className="text-xs text-gray-400">Quality care, close to home</p>
              </div>
              <button
                type="button"
                className="text-teal-600 text-sm font-semibold flex items-center gap-0.5 hover:underline"
                onClick={() => navigate({ path: "/patient/hospitals" })}
              >
                See all <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {nearbyHospitals.map((hospital, idx) => {
                const photoUrl = resolvePhotoUrl(hospital.photoUrl);
                return (
                  <motion.div
                    key={hospital.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate({ path: "/patient/hospital", id: hospital.id })}
                  >
                    {/* Photo or gradient */}
                    <div className="h-24 relative">
                      {photoUrl ? (
                        <img src={photoUrl} alt={hospital.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${hospital.gradient}`} />
                      )}
                      <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Open
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-gray-900 text-xs leading-tight">{hospital.name}</p>
                      <p className="text-gray-400 text-[10px] mt-0.5">{hospital.area}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
