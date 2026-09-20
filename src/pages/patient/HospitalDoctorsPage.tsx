import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, ChevronRight, LogIn, Phone, User } from "lucide-react";
import { motion } from "motion/react";
import { type KeyboardEvent, type MouseEvent, useState } from "react";
import BookingDialog from "../../components/booking/BookingDialog";
import { useStore } from "../../context/StoreContext";

function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  const base = (import.meta.env.VITE_API_URL as string || "").replace(/\/api$/, "");
  return base ? `${base}${url}` : url;
}
import { getSessionLabelForDate } from "../../data/seed";
import { useRouter } from "../../router/RouterContext";
import type { Doctor } from "../../api";
import type { SessionType } from "../../types";

// "Morning (9:00 AM - 10:00 AM)" -> { name: "Morning", time: "9:00 AM - 10:00 AM" }
function splitSessionLabel(label: string): { name: string; time: string } {
  const m = label.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { name: m[1], time: m[2] } : { name: label, time: "" };
}

function formatExperience(v?: string | null): string {
  const t = v ? String(v).trim() : "";
  if (!t) return "";
  return /^\d+(\.\d+)?$/.test(t) ? t + " yrs experience" : t;
}

interface Props {
  id: string;
}

export default function HospitalDoctorsPage({ id }: Props) {
  const { goBack, navigate } = useRouter();
  const { hospitals, doctors, user, tokenStates, isSessionCancelled } = useStore();
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [loginGateDoctor, setLoginGateDoctor] = useState<Doctor | null>(null);

  const hospital = hospitals.find((h) => h.id === id);
  const hospitalDoctors = doctors.filter((d) => d.hospitalId === id && d.isAvailable !== false);

  if (!hospital)
    return <div className="p-8 text-center">Hospital not found</div>;

  function handleDoctorClick(doctor: Doctor) {
    if (!user) {
      setLoginGateDoctor(doctor);
    } else {
      setBookingDoctor(doctor);
    }
  }

  // Get current token status for a doctor (today's sessions)
  const DOCTOR_STATUS_OPTIONS = {
    running_late: { label: "Running late", color: "yellow", detail: "The doctor is delayed. Please wait a little longer." },
    seeing_patients: { label: "Seeing patients", color: "green", detail: "Your turn will come shortly." },
    short_break: { label: "Short break", color: "yellow", detail: "The doctor will be back shortly." },
    available_soon: { label: "Available soon", color: "green", detail: "Please be ready, the doctor is almost here." },
    attending_emergency: { label: "Attending an emergency", color: "red", detail: "There may be a delay. Please wait." },
  } as const;

  function getDoctorStatus(doctor: Doctor) {
    if (doctor.statusOverride && doctor.statusOverride !== "not_yet_arrived") {
      return DOCTOR_STATUS_OPTIONS[doctor.statusOverride as keyof typeof DOCTOR_STATUS_OPTIONS] ?? {
        label: "Doctor status updated",
        color: "green",
        detail: "See the latest update from the doctor.",
      };
    }

    const today = new Date().toISOString().split("T")[0];
    for (const session of doctor.sessions as SessionType[]) {
      const sid = `${doctor.id}_${today}_${session}`;
      const state = tokenStates[sid];
      if (state) {
        if (state.isClosed) return { label: "Session Ended", color: "red", detail: "This session has ended for today." };
        if (state.currentToken !== null && state.currentToken > 0) return { label: `Now serving token #${state.currentToken}`, color: "green", detail: "Doctor is actively seeing patients." };
      }
    }
    return { label: "Doctor not yet arrived", color: "yellow", detail: "Please wait. The doctor has not reached the clinic yet." };
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-2 pb-6">

      {/* ── Browse banner (shown when not logged in) ── */}
      {!user && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-semibold text-gray-800">Browse doctors and availability</p>
            <p className="text-xs text-gray-400 mt-0.5">Login will be required only when you are ready to pay.</p>
          </div>
          <Button
            size="sm"
            className="bg-teal-500 hover:bg-teal-600 text-white rounded-full gap-1.5 shrink-0 ml-3"
            onClick={() => navigate({ path: "/login", tab: "patient", patientMode: "login" })}
          >
            <LogIn className="w-3.5 h-3.5" /> Login
          </Button>
        </div>
      )}

      {/* Back button */}
      <button
        type="button"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        onClick={goBack}
      >
        <ArrowLeft className="w-4 h-4" /> Back to Hospitals
      </button>

      {/* Hospital header */}
      {resolvePhotoUrl(hospital.photoUrl) ? (
        <div
          className="h-28 sm:h-36 rounded-2xl relative overflow-hidden flex items-end p-4 sm:p-6 mb-6"
          style={{
            backgroundImage: `url(${resolvePhotoUrl(hospital.photoUrl)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="relative">
            <h1 className="text-xl sm:text-2xl font-bold text-white">{hospital.name}</h1>
            <p className="text-white/80 text-sm flex items-center gap-3 mt-0.5">
              <span>{hospital.area}</span>
              <span>· {hospitalDoctors.length} Doctors</span>
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`h-28 sm:h-36 rounded-2xl bg-gradient-to-br ${(hospital as any).gradient || "from-teal-400 to-teal-600"} flex items-end p-4 sm:p-6 mb-6`}
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{hospital.name}</h1>
            <p className="text-white/80 text-sm">
              {hospital.area} · {hospitalDoctors.length} Doctors
            </p>
          </div>
        </div>
      )}

      {/* Doctors header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">Doctors</h2>
          <span className="bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {hospitalDoctors.length} available
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Availability updates live
        </div>
      </div>

      <div className="space-y-4">
        {hospitalDoctors.map((doctor, idx) => {
          const status = getDoctorStatus(doctor);
          const statusColors = {
            yellow: { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400", label: "text-amber-700", detail: "text-amber-600" },
            green:  { bg: "bg-green-50",  border: "border-green-200",  dot: "bg-green-500",  label: "text-green-700",  detail: "text-green-600" },
            red:    { bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-500",    label: "text-red-700",    detail: "text-red-600" },
          };
          const sc = statusColors[status.color as keyof typeof statusColors];

          return (
            <motion.div
              key={doctor.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07 }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleDoctorClick(doctor)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDoctorClick(doctor);
                  }
                }}
                className="bg-white rounded-xl border-2 border-gray-300 p-5 cursor-pointer hover:border-teal-600 hover:shadow-sm transition-all"
              >
                {(() => {
                  const fee = (doctor as any).doctorFee;
                  const exp = formatExperience(doctor.yearsOfExperience);
                  const edu = doctor.education ? String(doctor.education).trim() : "";
                  const langs = Array.isArray(doctor.languages) ? doctor.languages.filter(Boolean) : [];
                  const bio = doctor.bio ? String(doctor.bio).trim() : "";
                  const photo = resolvePhotoUrl(doctor.photo);
                  const today = new Date().toLocaleDateString("en-CA");
                  const qualification = [edu, exp].filter(Boolean).join(" · ");
                  return (
                    <>
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {photo ? (
                            <img src={photo} alt={doctor.name} className="w-14 h-14 object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-base leading-tight">{doctor.name}</p>
                          <p className="text-sm text-teal-700 mt-0.5">{doctor.specialty}</p>
                          {qualification && <p className="text-xs text-gray-500 mt-1">{qualification}</p>}
                          {langs.length > 0 && <p className="text-xs text-gray-500 mt-0.5">Languages: {langs.join(", ")}</p>}
                        </div>
                        {fee != null && (
                          <div className="text-right shrink-0">
                            <p className="text-[11px] text-gray-500">Consultation fee</p>
                            <p className="text-base font-bold text-gray-900 mt-0.5">₹{fee}</p>
                          </div>
                        )}
                      </div>

                      {bio && <p className="text-xs text-gray-600 mt-3 leading-relaxed line-clamp-2">{bio}</p>}

                      <div className="mt-4 border-t border-gray-100 pt-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1">Sessions today</p>
                        {doctor.sessions.length > 0 ? (
                          <div className="divide-y divide-gray-100">
                            {doctor.sessions.map((sess) => {
                              const { name, time } = splitSessionLabel(
                                getSessionLabelForDate(today, sess as SessionType, (doctor as any).scheduleConfig, doctor.sessionTimings),
                              );
                              return (
                                <div key={sess} className="flex items-center justify-between py-1.5">
                                  <span className="text-sm text-gray-800">{name}</span>
                                  <span className="text-xs text-gray-500">{time}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 py-1">No sessions today</p>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* Current status */}
                <div className="mt-3 flex items-start gap-2.5 border-t border-gray-100 pt-3">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Current status</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{status.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{status.detail}</p>
                  </div>
                </div>

                <div className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 transition-colors">
                  View schedule &amp; book <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Login Gate Dialog ── */}
      {loginGateDoctor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Book Appointment</h3>
              <button type="button" onClick={() => setLoginGateDoctor(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-5">
              Login is required before payment. Your hospital and doctor selection will stay available, then you can finish the booking.
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setLoginGateDoctor(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-teal-500 hover:bg-teal-600 rounded-full"
                onClick={() => {
                  setLoginGateDoctor(null);
                  navigate({ path: "/login", tab: "patient", patientMode: "login" });
                }}
              >
                Login to Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Booking Dialog ── */}
      {bookingDoctor && (
        <BookingDialog
          doctor={bookingDoctor}
          hospital={hospital}
          open={!!bookingDoctor}
          onClose={() => setBookingDoctor(null)}
        />
      )}
    </div>
  );
}
