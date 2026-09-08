import { Calendar, ChevronRight, Clock, FileText, Building2, MapPin } from "lucide-react";
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

  const activeBooking = patientBookings[patientBookings.length - 1] ?? null;
  const tokenState = activeBooking?.sessionId ? tokenStates[activeBooking.sessionId] : null;
  const myTokenNum = activeBooking?.tokenNumber ?? null;
  const currentToken = tokenState?.currentToken ?? null;
  const aheadCount =
    myTokenNum != null && currentToken != null
      ? Math.max(0, myTokenNum - currentToken - 1)
      : null;

  const prescriptionCount = patientBookings.length;
  const nearbyHospitals = hospitals.slice(0, 6);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Greeting — bigger */}
      <div className="px-4 pt-7 pb-2">
        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">
          {getGreeting()} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-1 font-medium">Your health matters. We're here to help.</p>
      </div>

      <div className="px-4 space-y-4 mt-4">
        {/* Book an appointment — hero card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-teal-600 to-teal-700 rounded-3xl px-5 py-6 overflow-hidden cursor-pointer shadow-lg shadow-teal-200"
          onClick={() => navigate({ path: "/patient/hospitals" })}
        >
          {/* Decorative circles */}
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-teal-500 rounded-full opacity-30" />
          <div className="absolute -right-2 -bottom-8 w-40 h-40 bg-teal-500 rounded-full opacity-20" />
          <Building2 className="absolute right-4 bottom-2 w-20 h-20 text-white opacity-20" strokeWidth={0.8} />

          <div className="relative z-10 max-w-[65%]">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 rounded-xl p-2 backdrop-blur-sm">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-white font-bold text-lg leading-tight">Book an appointment</h2>
            </div>
            <p className="text-teal-100 text-sm mb-5">Find a hospital and get your token in minutes</p>
            <button
              type="button"
              className="flex items-center gap-2 bg-white text-teal-700 font-bold text-sm px-5 py-2.5 rounded-full shadow-md hover:bg-teal-50 transition-colors"
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
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all"
            onClick={() =>
              activeBooking?.sessionId
                ? navigate({ path: "/patient/track", sessionId: activeBooking.sessionId, tokenNumber: activeBooking.tokenNumber ?? 0 })
                : navigate({ path: "/patient/tokens" })
            }
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Track your token</h3>
            <p className="text-gray-400 text-xs mt-0.5 leading-snug">See your position in the queue</p>

            {myTokenNum != null ? (
              <div className="mt-3 flex items-center gap-1.5 bg-green-50 rounded-lg px-2 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs font-semibold text-green-700 truncate">
                  #{myTokenNum}{aheadCount != null ? ` · ${aheadCount} ahead` : ""}
                </span>
                <ChevronRight className="w-3 h-3 text-green-500 ml-auto shrink-0" />
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                <span className="text-xs text-gray-400">No active token</span>
                <ChevronRight className="w-3 h-3 text-gray-300 ml-auto" />
              </div>
            )}
          </motion.div>

          {/* Prescriptions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate({ path: "/patient/prescriptions" })}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Prescriptions</h3>
            <p className="text-gray-400 text-xs mt-0.5 leading-snug">View and download your records</p>

            <div className="mt-3 flex items-center gap-1.5 bg-blue-50 rounded-lg px-2 py-1.5">
              <FileText className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="text-xs font-semibold text-blue-700 truncate">
                {prescriptionCount > 0 ? `${prescriptionCount} record${prescriptionCount > 1 ? "s" : ""}` : "No records"}
              </span>
              <ChevronRight className="w-3 h-3 text-blue-400 ml-auto shrink-0" />
            </div>
          </motion.div>
        </div>

        {/* Hospitals — small compact boxes */}
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

            <div className="grid grid-cols-3 gap-2">
              {nearbyHospitals.map((hospital, idx) => {
                const photoUrl = resolvePhotoUrl(hospital.photoUrl);
                return (
                  <motion.div
                    key={hospital.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.04 }}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
                    onClick={() => navigate({ path: "/patient/hospital", id: hospital.id })}
                  >
                    {/* Photo or gradient — smaller height */}
                    <div className="h-16 relative">
                      {photoUrl ? (
                        <img src={photoUrl} alt={hospital.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${hospital.gradient}`} />
                      )}
                      <span className="absolute top-1.5 left-1.5 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        Open
                      </span>
                    </div>
                    <div className="p-2">
                      <p className="font-semibold text-gray-900 text-[10px] leading-tight line-clamp-2">{hospital.name}</p>
                      <p className="text-gray-400 text-[9px] mt-0.5 flex items-center gap-0.5 truncate">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />{hospital.area}
                      </p>
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
