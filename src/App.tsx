import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Calendar, ChevronRight, Clock, MapPin, User } from "lucide-react";
import { motion } from "motion/react";
import TopNav from "./components/layout/TopNav";
import { StoreProvider, useStore } from "./context/StoreContext";
import TermsPage from "./pages/TermsPage";
import LoginPage from "./pages/LoginPage";
import HospitalAdminLogin from "./pages/HospitalAdminLogin";
import PharmacyDashboard from "./pages/PharmacyDashboard";
import PharmacyLogin from "./pages/PharmacyLogin";
import AdminPanel from "./pages/admin/AdminPanel";
import HospitalAdminPanel from "./pages/hospital-admin/HospitalAdminPanel";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import HospitalDoctorsPage from "./pages/patient/HospitalDoctorsPage";
import HospitalsPage from "./pages/patient/HospitalsPage";
import MyTokensPage from "./pages/patient/MyTokensPage";
import MyPrescriptionsPage from "./pages/patient/MyPrescriptionsPage";
import TokenTrackerPage from "./pages/patient/TokenTrackerPage";
import PharmaciesPage from "./pages/patient/PharmaciesPage";
import PharmacyDetailPage from "./pages/patient/PharmacyDetailPage";
import PharmacyOwnerLogin from "./pages/PharmacyOwnerLogin";
import PharmacyOwnerRegister from "./pages/PharmacyOwnerRegister";
import PharmacyOwnerDashboard from "./pages/PharmacyOwnerDashboard";
import ErrorBoundary from "./components/ErrorBoundary";
import ChatbotWidget from "./components/ChatbotWidget";
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

  const quickLinks = [
    { title: "Find Hospitals", sub: "TOP CLINICS", path: "/patient/hospitals" as const },
    { title: "Doctor Appointment", sub: "BOOK NOW", path: "/patient/hospitals" as const },
    { title: "My Tokens", sub: "TRACK LIVE", path: "/patient/tokens" as const },
    { title: "My Prescriptions", sub: "VIEW RECORDS", path: "/patient/prescriptions" as const },
    { title: "Pharmacies", sub: "FIND NEAR YOU", path: "/pharmacies" as const },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Apollo-like Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto flex items-center justify-between px-4 py-3">
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

          {/* Desktop-only nav: extra links only appear at lg+, mobile is untouched */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-700">
            <button onClick={() => navigate({ path: "/patient/hospitals" })} className="hover:text-teal-600 transition-colors">Find Hospitals</button>
            <button onClick={() => navigate({ path: "/patient/hospitals" })} className="hover:text-teal-600 transition-colors">Find Doctors</button>
            <button onClick={() => navigate({ path: "/patient/tokens" })} className="hover:text-teal-600 transition-colors">My Tokens</button>
            <button onClick={() => navigate({ path: "/patient/prescriptions" })} className="hover:text-teal-600 transition-colors">My Prescriptions</button>
          </nav>

          {/* Original mobile-visible nav, unchanged */}
          <nav className="flex lg:hidden items-center gap-6 text-sm font-medium text-gray-700">
            <button onClick={() => navigate({ path: "/patient/hospitals" })} className="hover:text-teal-600 transition-colors hidden md:inline">Find Hospitals</button>
            <button onClick={() => navigate({ path: "/patient/hospitals" })} className="hover:text-teal-600 transition-colors hidden md:inline">Find Doctors</button>
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

      <main className="flex-1 w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 py-6 lg:py-10">
        {/* Banner */}
        <div className="mb-6 lg:mb-8 rounded-2xl bg-gradient-to-br from-teal-50 to-white border border-teal-100 px-5 py-8 lg:px-8 lg:py-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
            Save Time on Your
            <br />
            <span className="text-teal-600">Doctor Visits</span>
          </h2>
        </div>

        {/* Quick Links: 2 cols on mobile (unchanged), 4 cols on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-10 lg:mb-12">
          {quickLinks.map((card, i) => (
            <div key={i} onClick={() => navigate({ path: card.path })} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all">
              <div>
                <h3 className="font-semibold text-sm text-gray-800">{card.title}</h3>
                <p className="text-[10px] font-bold text-gray-400 mt-0.5 tracking-wide">{card.sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Available Cities — small chips, click to jump straight to that city's hospitals */}
        {(() => {
          const cityCounts = new Map<string, number>();
          for (const h of hospitals) {
            const c = (h.area || "").trim();
            if (!c) continue;
            cityCounts.set(c, (cityCounts.get(c) ?? 0) + 1);
          }
          const cityList = Array.from(cityCounts.keys()).sort((a, b) => a.localeCompare(b));
          if (cityList.length === 0) return null;
          return (
            <div className="mb-10 lg:mb-14">
              <h2 className="text-sm font-semibold text-gray-500 mb-3 tracking-wide uppercase">
                Available Cities
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {cityList.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => navigate({ path: "/patient/hospitals", city })}
                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    data-ocid={`landing.city_chip.${city}`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    {city}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Hospitals List — more columns as the screen widens */}
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-6">Top Hospitals ({hospitals.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-4">
             {hospitals.slice(0, 16).map((h) => (
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

      <footer className="border-t border-gray-200 mt-auto bg-white px-4 py-8 lg:py-10">
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-gray-900">Doctor</span>
              <span className="font-bold text-teal-500">Booked</span>
            </div>
            <p className="text-gray-400 text-sm">Skip the waiting room. Track your token live.</p>
          </div>
          <div className="hidden lg:block">
            <h5 className="text-xs font-semibold text-gray-900 uppercase mb-3">For Patients</h5>
            <div className="flex flex-col gap-2 text-sm text-gray-500">
              <button onClick={() => navigate({ path: "/patient/hospitals" })} className="text-left hover:text-teal-600 transition-colors">Find Hospitals</button>
              <button onClick={() => navigate({ path: "/patient/tokens" })} className="text-left hover:text-teal-600 transition-colors">My Tokens</button>
              <button onClick={() => navigate({ path: "/patient/prescriptions" })} className="text-left hover:text-teal-600 transition-colors">My Prescriptions</button>
            </div>
          </div>
          <div className="hidden lg:block">
            <h5 className="text-xs font-semibold text-gray-900 uppercase mb-3">Company</h5>
            <div className="flex flex-col gap-2 text-sm text-gray-500">
              <button onClick={() => navigate({ path: "/terms" })} className="text-left hover:text-teal-600 transition-colors">Terms & Conditions</button>
              <button onClick={() => navigate({ path: "/hospital-admin/login" })} className="text-left hover:text-teal-600 transition-colors">Hospital Admin Login</button>
              <button onClick={() => navigate({ path: "/pharmacy-owner/login" })} className="text-left hover:text-teal-600 transition-colors">Pharmacy Owner Login</button>
            </div>
          </div>
          <div className="flex lg:items-start lg:justify-end">
            <p className="text-xs text-gray-400">2026 Doctor Booked. All rights reserved.</p>
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
      if (route.path === "/hospital-admin/login") return <HospitalAdminLogin />;
      if (route.path === "/pharmacy/login") return <PharmacyLogin />;
      if (route.path === "/patient/hospitals") return <HospitalsPage city={(route as { city?: string }).city} />;
      if (route.path === "/patient/hospital") return <HospitalDoctorsPage id={(route as { id: string }).id} />;
      if (route.path === "/pharmacies") return <PharmaciesPage />;
      if (route.path === "/pharmacy/detail") return <PharmacyDetailPage id={(route as any).id} />;
      if (route.path === "/pharmacy-owner/login") return <PharmacyOwnerLogin />;
      if (route.path === "/pharmacy-owner/register") return <PharmacyOwnerRegister />;
      if (route.path === "/login") {
        const loginRoute = route as {
          tab?: "patient" | "doctor";
          patientMode?: "login" | "signup";
        };
        const initialTab = loginRoute.tab ?? "patient";
        const initialPatientMode =
          loginRoute.patientMode ??
          (initialTab === "doctor" ? "login" : "login");
        return (
          <LoginPage
            key={`${initialTab}-${initialPatientMode}`}
            initialTab={initialTab}
            initialPatientMode={initialPatientMode}
          />
        );
      }
      return <LoginPage initialTab="patient" initialPatientMode="login" />;
    }
    if (user.role === "admin") return <AdminPanel />;
    if (user.role === "hospital_admin") return <HospitalAdminPanel />;
    if (user.role === "pharmacy") return <PharmacyDashboard />;
    if (user.role === "doctor") return <DoctorDashboard />;
    if (route.path === "/patient/hospitals") return <HospitalsPage city={(route as { city?: string }).city} />;
    if (route.path === "/patient/hospital")
      return <HospitalDoctorsPage id={(route as { id: string }).id} />;
    if (route.path === "/pharmacies") return <PharmaciesPage />;
    if (route.path === "/pharmacy/detail") return <PharmacyDetailPage id={(route as any).id} />;
    if (route.path === "/pharmacy-owner/dashboard") return <PharmacyOwnerDashboard />;
    if (route.path === "/patient/tokens") return <MyTokensPage />;
    if (route.path === "/patient/prescriptions") return <MyPrescriptionsPage />;
    if (route.path === "/patient/track") {
      const r = route as { sessionId: string; tokenNumber: number };
      return (
        <ErrorBoundary fallbackLabel="your queue tracker">
          <TokenTrackerPage sessionId={r.sessionId} tokenNumber={r.tokenNumber} />
        </ErrorBoundary>
      );
    }
    return <HospitalsPage />;
  }

  const isAdmin = user?.role === "admin" || user?.role === "hospital_admin" || user?.role === "pharmacy" || user?.role === "pharmacy_owner";
  // Only hide TopNav for routes that don't require login (landing/login/terms)
  // AND only when there's no logged-in user — a page refresh resets the
  // in-memory router to "/" even though the user is still authenticated
  // (login state lives in localStorage, not in the URL), so we must not
  // hide the nav purely based on route.path when `user` is already set.
  const hideTopNav =
    isAdmin ||
    (!user && (route.path === "/" || route.path === "/login" || route.path === "/terms" || route.path === "/hospital-admin/login" || route.path === "/pharmacy/login" || route.path === "/pharmacy-owner/login" || route.path === "/pharmacy-owner/register")) ||
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
      <main className="flex-1 pb-24 md:pb-8">{renderPage()}</main>
      <Toaster richColors position="top-right" />
      <ChatbotWidget />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallbackLabel="Doctor Booked">
      <QueryClientProvider client={queryClient}>
        <RouterProvider>
          <StoreProvider>
            <AppRoutes />
          </StoreProvider>
        </RouterProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
