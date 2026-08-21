import { BookOpen, Hospital, LogOut, Mail, Phone, Pill, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";
import { enablePushNotifications } from "../../lib/push";

export default function TopNav() {
  const { user, logout, doctors, bookings, hasNewPrescription, clearPrescriptionDot } = useStore();
  const { navigate, route } = useRouter();
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);

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

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideMobile = menuRef.current?.contains(target) ?? false;
      const insideDesktop = desktopMenuRef.current?.contains(target) ?? false;
      if (!insideMobile && !insideDesktop) {
        setShowProfileMenu(false);
      }
    }
    if (showProfileMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu]);

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

  // Google login stores the account email here; phone-based login stores the
  // 10-digit number here instead — either way it's the right thing to show.
  const patientContact = user?.role === "patient" ? (user as { email?: string }).email : undefined;
  const isEmailContact = !!patientContact && patientContact.includes("@");

  const activeBookingCount = bookings?.filter(
    (b) => b.status === "confirmed" && b.date >= new Date().toISOString().split("T")[0]
  ).length ?? 0;

  // ── Doctor / non-patient: slim top bar ──────────────────────────────────
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
      </header>
    );
  }

  // ── Patient: bottom nav ──────────────────────────────────────────────────
  const navActive = "text-teal-600";
  const navInactive = "text-gray-400";

  function isActive(paths: string[]) {
    return paths.includes(route.path) ? navActive : navInactive;
  }

  return (
    <>
      {/* Notification prompt */}
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

      {/* Profile menu popup */}
      {showProfileMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
          <div
            ref={menuRef}
            className="w-full max-w-sm bg-white rounded-t-3xl px-4 pt-4 pb-8 shadow-2xl"
            style={{ animation: "slideUp 0.2s ease-out" }}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* User info */}
            <div className="flex items-center gap-3 px-2 pb-5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-[15px] leading-tight truncate">{displayName}</p>
                {patientContact && (
                  <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 truncate">
                    {isEmailContact ? (
                      <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                    ) : (
                      <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                    )}
                    <span className="truncate">{patientContact}</span>
                  </p>
                )}
              </div>
              <button
                className="ml-auto shrink-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1.5 transition-colors"
                onClick={() => setShowProfileMenu(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu items — add more here later */}
            <div className="space-y-1">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
                onClick={() => { setShowProfileMenu(false); logout(); }}
              >
                <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-red-500" />
                </div>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Desktop top nav — md and up only, phones never see this */}
      <header className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-8">
          <button
            type="button"
            className="flex items-center gap-2 shrink-0"
            onClick={() => navigate({ path: "/patient/hospitals" })}
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
            <span className="text-base font-bold text-gray-900">
              Doctor<span className="text-teal-500"> Booked</span>
            </span>
          </button>

          <nav className="flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              className={`flex items-center gap-1.5 transition-colors ${isActive(["/patient/hospitals", "/patient/hospital"])} hover:text-teal-600`}
              onClick={() => navigate({ path: "/patient/hospitals" })}
              data-ocid="nav.link"
            >
              <Hospital className="w-4 h-4" /> Hospitals
            </button>
            <button
              type="button"
              className={`relative flex items-center gap-1.5 transition-colors ${isActive(["/patient/tokens"])} hover:text-teal-600`}
              onClick={() => navigate({ path: "/patient/tokens" })}
              data-ocid="nav.link"
            >
              <BookOpen className="w-4 h-4" /> Bookings
              {activeBookingCount > 0 && (
                <span className="absolute -top-1 -right-2 w-2 h-2 bg-teal-500 rounded-full border border-white" />
              )}
            </button>
            <button
              type="button"
              className={`relative flex items-center gap-1.5 transition-colors ${isActive(["/patient/prescriptions"])} hover:text-teal-600`}
              onClick={() => { clearPrescriptionDot(); navigate({ path: "/patient/prescriptions" }); }}
            >
              <Pill className="w-4 h-4" /> Prescriptions
              {hasNewPrescription && (
                <span className="absolute -top-1 -right-2 w-2 h-2 bg-green-500 rounded-full border border-white" />
              )}
            </button>
          </nav>

          <div className="flex-1" />

          <div className="relative" ref={desktopMenuRef}>
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-full pl-1.5 pr-3 py-1.5 hover:bg-gray-50 transition-colors"
              onClick={() => setShowProfileMenu((v) => !v)}
            >
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-white" />
              </span>
              <span className="font-medium truncate max-w-[120px]">{displayName}</span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg py-2 z-50">
                <div className="px-3 pb-2 mb-1 border-b border-gray-100">
                  <p className="font-semibold text-gray-900 text-sm truncate">{displayName}</p>
                  {patientContact && (
                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 truncate">
                      {isEmailContact ? <Mail className="w-3 h-3 shrink-0" /> : <Phone className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{patientContact}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  onClick={() => { setShowProfileMenu(false); logout(); }}
                  data-ocid="nav.logout_button"
                >
                  <LogOut className="w-4 h-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Bottom navigation bar — mobile only, untouched on phones */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-inset-bottom">
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

          {/* Profile — opens menu instead of direct logout */}
          <button
            type="button"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${navInactive} hover:text-teal-500`}
            onClick={() => setShowProfileMenu(true)}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium truncate max-w-[52px]">{displayName.split(" ")[0]}</span>
          </button>

        </div>
      </nav>
    </>
  );
}
