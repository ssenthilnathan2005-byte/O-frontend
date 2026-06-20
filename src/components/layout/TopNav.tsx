import { Button } from "@/components/ui/button";
import { BookOpen, Hospital, LogOut, User } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";

export default function TopNav() {
  const { user, logout, doctors, bookings } = useStore();
  const { navigate, route } = useRouter();

  // Resolve display name: for doctors look up from live doctors list
  const displayName =
    user?.role === "patient"
      ? (user as { name: string }).name
      : user?.role === "doctor"
        ? (doctors.find((d) => d.code === (user as { code: string }).code)?.name ?? "Doctor")
        : "Admin";

  const isPatient = user?.role === "patient";
  const isDoctor  = user?.role === "doctor";

  return (
    <header className="sticky top-0 z-70 bg-white border-b border-gray-200 px-3 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-6">
        {/* Logo */}
        <button
          type="button"
          className="flex items-center gap-1.5 shrink-0"
          onClick={() =>
            navigate(isDoctor ? { path: "/doctor" } : { path: "/patient/hospitals" })
          }
          data-ocid="nav.link"
        >
          <img
            src="/assets/Logo.jpg"
            alt="Doctor Booked Logo"
            className="w-8 h-8 rounded-full object-cover" onError={(e)=>{(e.target as HTMLImageElement).src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E"}}
          />
          <span className="text-sm sm:text-base hidden xs:inline">
            <span className="font-bold text-gray-900">Doctor</span>
            <span className="font-bold text-teal-500"> Booked</span>
          </span>
        </button>

        {/* Patient nav */}
        {isPatient && (
          <nav className="flex items-center gap-1 flex-1">
            <Button
              variant="ghost"
              size="sm"
              className={`text-sm gap-1.5 ${route.path === "/patient/hospitals" ? "text-teal-600 bg-teal-50" : "text-gray-600"}`}
              onClick={() => navigate({ path: "/patient/hospitals" })}
              data-ocid="nav.link"
            >
              <Hospital className="w-4 h-4" /> Hospitals
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`text-sm gap-1.5 ${route.path === "/patient/tokens" ? "text-teal-600 bg-teal-50" : "text-gray-600"}`}
              onClick={() => navigate({ path: "/patient/tokens" })}
              data-ocid="nav.link"
            >
              <span className="relative">
                <BookOpen className="w-4 h-4" />
                {bookings && bookings.filter(b => b.status === "confirmed" && b.date >= new Date().toISOString().split("T")[0]).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-teal-500 rounded-full border border-white" />
                )}
              </span>
              <span className="text-xs sm:text-sm">My Bookings</span>
            </Button>
          </nav>
        )}

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          {user ? (
            <>
              <span className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-full px-3 py-1.5">
                <User className="w-3.5 h-3.5" />
                {displayName}
              </span>
              <span className="hidden sm:block text-gray-300 text-lg">|</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-red-500 gap-1.5 font-medium"
                onClick={logout}
                data-ocid="nav.logout_button"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-teal-600 border-teal-600 hover:bg-teal-50 gap-1.5 rounded-full"
              onClick={() => navigate({ path: "/login", tab: "patient", patientMode: "login" })}
              data-ocid="nav.login_button"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Login</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
