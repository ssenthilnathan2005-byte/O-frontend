import { BookOpen, Hospital, LogOut, Pill, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";
import { enablePushNotifications } from "../../lib/push";

export default function TopNav() {
  const { user, logout, doctors, bookings, hasNewPrescription, clearPrescriptionDot } = useStore();
  const { navigate, route } = useRouter();
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !user || user.role !== "patient") {
      setShowNotificationPrompt(false);
      return;
    }
    if (!("Notification" in window)) {
      setShowNotificationPrompt(false);
      return;
    }
    setShowNotificationPrompt(Notification.permission === "default");
  }, [user]);

  async function handleEnableNotifications() {
    const token = await enablePushNotifications();
    if (token) {
      toast.success("Notifications turned on");
      setShowNotificationPrompt(false);
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window) {
      setShowNotificationPrompt(Notification.permission === "default");
    }
  }

  const displayName =
    user?.role === "patient"
      ? (user as { name: string }).name
      : user?.role === "doctor"
        ? (doctors.find((d) => d.code === (user as { code: string }).code)?.name ?? "Doctor")
        : "Admin";

  const isPatient = user?.role === "patient";
  const isDoctor  = user?.role === "doctor";

  const activeBookingCount = bookings?.filter(
    (b) => b.status === "confirmed" && b.date >= new Date().toISOString().split("T")[0]
  ).length ?? 0;

  // ── Doctor / non-patient: keep a slim top bar ─────────────────────────────
  if (!isPatient) {
    return (
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-3 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-6">
          <button
            type="button"
            className="flex items-center gap-1.5 shrink-0"
            onClick={() => navigate(isDoctor ? { path: "/doctor" } : { path: "/patient/hospitals" })}
            data-ocid="nav.link"
          >
            <img
              src="/assets/Logo.jpg"
              alt="Doctor Booked Logo"
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E";
              }}
            />
            <span className="text-sm sm:text-base hidden xs:inline">
              <span className="font-bold text-gray-900">Doctor</span>
              <span className="font-bold text-teal-500"> Booked</span>
            </span>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-full px-3 py-1.5">
                  <User className="w-3.5 h-3.5" />
                  {displayName}
                </span>
                <button
                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-500 font-medium px-2 py-1.5 rounded-lg transition-colors"
                  onClick={logout}
                  data-ocid="nav.logout_button"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : null}
          </div>
        </div>

        {showNotificationPrompt && (
          <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-teal-900">Turn on notifications</p>
                <p className="text-xs text-teal-700 mt-0.5">
                  Get queue updates even when this page is closed or in the background.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-full px-4 py-1.5"
                  onClick={() => void handleEnableNotifications()}
                >
                  Enable notifications
                </button>
                <button
                  type="button"
                  className="text-teal-700 hover:bg-teal-100 text-sm rounded-full px-3 py-1.5"
                  onClick={() => setShowNotificationPrompt(false)}
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    );
  }

  // ── Patient: bottom nav bar ───────────────────────────────────────────────
  const navActive = "text-teal-600";
  const navInactive = "text-gray-400";

  function isActive(paths: string[]) {
    return paths.includes(route.path) ? navActive : navInactive;
  }

  return (
    <>
      {/* Notification prompt — floats above bottom nav */}
      {showNotificationPrompt && (
        <div className="fixed bottom-20 left-3 right-3 z-50 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-teal-900">Turn on notifications</p>
              <p className="text-xs text-teal-700 mt-0.5">
                Get queue updates even when this page is closed or in the background.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-full px-4 py-1.5"
                onClick={() => void handleEnableNotifications()}
              >
                Enable
              </button>
              <button
                type="button"
                className="text-teal-700 hover:bg-teal-100 text-sm rounded-full px-3 py-1.5"
                onClick={() => setShowNotificationPrompt(false)}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-inset-bottom">
        <div className="flex items-end justify-around px-2 py-2 max-w-lg mx-auto">

          {/* Hospitals */}
          <button
            type="button"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${isActive(["/patient/hospitals", "/patient/hospital"])}`}
            onClick={() => navigate({ path: "/patient/hospitals" })}
            data-ocid="nav.link"
          >
            <Hospital className="w-5 h-5" />
            <span className="text-[10px] font-medium">Hospitals</span>
          </button>

          {/* My Bookings */}
          <button
            type="button"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${isActive(["/patient/tokens"])}`}
            onClick={() => navigate({ path: "/patient/tokens" })}
            data-ocid="nav.link"
          >
            <span className="relative">
              <BookOpen className="w-5 h-5" />
              {activeBookingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-teal-500 rounded-full border border-white" />
              )}
            </span>
            <span className="text-[10px] font-medium">Bookings</span>
          </button>

          {/* Centre logo pill */}
          <button
            type="button"
            className="flex flex-col items-center -mt-5 focus:outline-none"
            onClick={() => navigate({ path: "/patient/hospitals" })}
            data-ocid="nav.link"
          >
            <div className="w-14 h-14 rounded-full bg-teal-600 shadow-lg flex items-center justify-center border-4 border-white">
              <img
                src="/assets/Logo.jpg"
                alt="Doctor Booked"
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23ffffff'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%2314b8a6' font-size='15' font-family='sans-serif' font-weight='bold'%3EDB%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
            <span className="text-[9px] font-bold text-teal-600 mt-0.5">HOME</span>
          </button>

          {/* Prescriptions */}
          <button
            type="button"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${isActive(["/patient/prescriptions"])}`}
            onClick={() => { clearPrescriptionDot(); navigate({ path: "/patient/prescriptions" }); }}
          >
            <span className="relative">
              <Pill className="w-5 h-5" />
              {hasNewPrescription && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white" />
              )}
            </span>
            <span className="text-[10px] font-medium">Prescriptions</span>
          </button>

          {/* Profile / logout */}
          <button
            type="button"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${navInactive} hover:text-red-400`}
            onClick={logout}
            data-ocid="nav.logout_button"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium truncate max-w-[52px]">{displayName.split(" ")[0]}</span>
          </button>

        </div>
      </nav>

      {/* Spacer so page content isn't hidden behind the bottom bar */}
      <div className="h-20" />
    </>
  );
}
