import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Calendar, ChevronRight, Clock, MapPin, User } from "lucide-react";
import { motion } from "motion/react";
import TopNav from "./components/layout/TopNav";
import { StoreProvider, useStore } from "./context/StoreContext";
import TermsPage from "./pages/TermsPage";
import LoginPage from "./pages/LoginPage";
import AdminPanel from "./pages/admin/AdminPanel";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import HospitalDoctorsPage from "./pages/patient/HospitalDoctorsPage";
import HospitalsPage from "./pages/patient/HospitalsPage";
import MyTokensPage from "./pages/patient/MyTokensPage";
import TokenTrackerPage from "./pages/patient/TokenTrackerPage";
import { RouterProvider, useRouter } from "./router/RouterContext";

function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  const base = (import.meta.env.VITE_API_URL as string || "").replace(/\/api$/, "");
  return base ? `${base}${url}` : url;
}

const queryClient = new QueryClient();

function LandingPage() {
  const { navigate } = useRouter();
  const { hospitals } = useStore();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Apollo-like Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              src="/assets/Logo.jpg"
              alt="Logo"
              className="w-10 h-10 rounded-full object-contain" 
              onError={(e)=>{(e.target as HTMLImageElement).src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E"}}
            />
            <span className="text-xl font-bold text-gray-800">
              <span className="text-teal-600">Doctor</span>Booked
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
            <button onClick={() => navigate({ path: "/patient/hospitals" })} className="hover:text-teal-600 transition-colors">Find Hospitals</button>
            <button onClick={() => navigate({ path: "/patient/hospitals" })} className="hover:text-teal-600 transition-colors">Find Doctors</button>
          </nav>

          <button
            type="button"
            onClick={() => navigate({ path: "/login", tab: "patient", patientMode: "login" })}
            className="flex items-center gap-2 border border-teal-600 text-teal-600 hover:bg-teal-50 px-4 py-1.5 rounded-full font-medium transition-colors"
          >
            Login <User className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
        {/* Banner Carousel */}
        <div className="relative w-full h-[240px] sm:h-[320px] rounded-2xl overflow-hidden mb-8 group cursor-pointer" onClick={() => navigate({ path: "/patient/hospitals" })}>
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-700 flex items-center p-8 sm:p-16">
             <div className="max-w-xl text-white relative z-10">
               <h2 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight">Save Time on Your<br/><span className="text-teal-400">Doctor Visits</span></h2>
               <p className="text-sm sm:text-lg text-gray-300">Book appointments online, track your token live, and skip the waiting room completely.</p>
               <button className="mt-6 bg-gradient-to-r from-yellow-500 to-yellow-600 text-gray-900 font-bold px-6 py-2.5 rounded-lg shadow-lg hover:from-yellow-400 hover:to-yellow-500 transition-all">Book Now</button>
             </div>
             {/* Decorative element */}
             <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden md:block w-72 h-48 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl shadow-2xl rotate-12 opacity-80 border-4 border-white/10"></div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          {[
            { title: "Find Hospitals", sub: "TOP CLINICS", icon: "🏥", bg: "bg-teal-50", text: "text-teal-900" },
            { title: "Doctor Appointment", sub: "BOOK NOW", icon: "👨‍⚕️", bg: "bg-orange-50", text: "text-orange-900" },
          ].map((card, i) => (
            <div key={i} onClick={() => navigate({ path: "/patient/hospitals" })} className={`${card.bg} rounded-xl p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{card.icon}</span>
                <div>
                  <h3 className={`font-bold text-sm sm:text-base ${card.text}`}>{card.title}</h3>
                  <p className="text-[10px] font-bold text-gray-500 mt-0.5">{card.sub}</p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 ${card.text} opacity-50`} />
            </div>
          ))}
        </div>

        {/* Hospitals List */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Top Hospitals ({hospitals.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
             {hospitals.slice(0, 12).map((h) => (
                <div key={h.id} className="cursor-pointer group" onClick={() => navigate({ path: "/patient/hospital", id: h.id })}>
                  <div className="bg-gray-50 rounded-2xl aspect-square mb-3 overflow-hidden border border-gray-100 flex items-center justify-center p-4 group-hover:border-teal-300 transition-colors relative">
                    {h.photoUrl ? (
                      <img src={resolvePhotoUrl(h.photoUrl) || ""} alt={h.name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <div className={`w-full h-full rounded-xl bg-gradient-to-br ${h.gradient}`}></div>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm text-center leading-tight">{h.name}</h3>
                  <p className="text-xs text-gray-500 text-center mt-1">{h.area}</p>
                </div>
             ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-auto bg-white px-4 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">Doctor</span>
            <span className="font-bold text-teal-500">Booked</span>
            <span className="text-gray-400 text-sm ml-2">— Skip the waiting room.</span>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs text-gray-400">2026 Doctor Booked. All rights reserved.</p>
            <button type="button" onClick={() => navigate({ path: "/terms" })} className="text-xs text-teal-600 hover:underline">Terms & Conditions</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AppRoutes() {
  const { user, serverStatus } = useStore();
  const { route } = useRouter();

  function renderPage() {
    if (!user) {
      if (route.path === "/") return <LandingPage />;
      if (route.path === "/terms") return <TermsPage />;
      if (route.path === "/patient/hospitals") return <HospitalsPage />;
      if (route.path === "/patient/hospital") return <HospitalDoctorsPage id={(route as { id: string }).id} />;
      if (route.path === "/login") {
        const loginRoute = route as {
          tab?: "patient" | "doctor";
          patientMode?: "login" | "signup";
        };
        const initialTab = loginRoute.tab ?? "patient";
        const initialPatientMode =
          loginRoute.patientMode ??
          (initialTab === "doctor" ? "login" : "signup");
        return (
          <LoginPage
            key={`${initialTab}-${initialPatientMode}`}
            initialTab={initialTab}
            initialPatientMode={initialPatientMode}
          />
        );
      }
      return <LoginPage initialTab="patient" initialPatientMode="signup" />;
    }
    if (user.role === "admin") return <AdminPanel />;
    if (user.role === "doctor") return <DoctorDashboard />;
    if (route.path === "/patient/hospitals") return <HospitalsPage />;
    if (route.path === "/patient/hospital")
      return <HospitalDoctorsPage id={(route as { id: string }).id} />;
    if (route.path === "/patient/tokens") return <MyTokensPage />;
    if (route.path === "/patient/track") {
      const r = route as { sessionId: string; tokenNumber: number };
      return (
        <TokenTrackerPage sessionId={r.sessionId} tokenNumber={r.tokenNumber} />
      );
    }
    return <HospitalsPage />;
  }

  const isAdmin = user?.role === "admin";
  // Only hide TopNav for routes that don't require login (landing/login/terms)
  // AND only when there's no logged-in user — a page refresh resets the
  // in-memory router to "/" even though the user is still authenticated
  // (login state lives in localStorage, not in the URL), so we must not
  // hide the nav purely based on route.path when `user` is already set.
  const hideTopNav =
    isAdmin ||
    (!user && (route.path === "/" || route.path === "/login" || route.path === "/terms")) ||
    (!!user && route.path === "/terms");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {!hideTopNav && <TopNav />}
      {/* Server status banner — shown when Railway is waking up or unreachable */}
      {serverStatus === "waking" && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-sm font-medium py-2.5 px-4 flex items-center justify-center gap-2 shadow-md">
          <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span>Server is starting up — connecting automatically, please wait…</span>
        </div>
      )}
      {serverStatus === "offline" && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white text-sm font-medium py-2.5 px-4 flex items-center justify-center gap-2 shadow-md">
          <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span>Taking longer than usual — still trying to connect, please wait…</span>
        </div>
      )}
      <main className="flex-1">{renderPage()}</main>
      <Toaster richColors position="top-right" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider>
        <StoreProvider>
          <AppRoutes />
        </StoreProvider>
      </RouterProvider>
    </QueryClientProvider>
  );
}
