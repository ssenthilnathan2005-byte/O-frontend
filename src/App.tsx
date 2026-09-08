import { Toaster } from "@/components/ui/sonner";
import PullToRefresh from "./components/PullToRefresh";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Calendar, ChevronRight, Clock, MapPin, User, Search, Navigation, Loader2, XCircle, Users, Hospital, Pill, Ambulance, FileText } from "lucide-react";
import { useEffect, useRef, useCallback, useState as useMobileState } from "react";
import { useNearMe } from "./hooks/useNearMe";
import { motion } from "motion/react";
import TopNav from "./components/layout/TopNav";
import { StoreProvider, useStore } from "./context/StoreContext";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
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
import PharmaciesPage from "./pages/patient/PharmaciesPage"; // eslint-disable-line -- kept for quick revert, see ComingSoonPage swap below
import ComingSoonPage from "./pages/patient/ComingSoonPage";
import PharmacyDetailPage from "./pages/patient/PharmacyDetailPage";
import PharmacyOwnerLogin from "./pages/PharmacyOwnerLogin";
import PharmacyOwnerRegister from "./pages/PharmacyOwnerRegister";
import PharmacyOwnerDashboard from "./pages/PharmacyOwnerDashboard";
import AmbulancePage from "./pages/patient/AmbulancePage";
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

// ── helpers ──────────────────────────────────────────────────────────────────
const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "";

function loadMapsScriptLanding(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); return; }
    if (!MAPS_KEY) { reject(new Error("NO_KEY")); return; }
    const s = document.createElement("script");
    s.id = "google-maps-script";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}`;
    s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error("LOAD_FAILED"));
    document.head.appendChild(s);
  });
}

function parseCoords(str?: string): { lat: number; lng: number } | null {
  if (!str) return null;
  const m = str.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90) return null;
  return { lat, lng };
}

function MobileLanding() {
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
}

function LandingPage() {
  const { navigate } = useRouter();
  const { hospitals } = useStore();
  const quickLinks = [
    { title: "Find hospitals", sub: "Top clinics near you", route: { path: "/patient/hospitals" } as const, icon: Hospital },
    { title: "Pharmacies", sub: "Order medicines", route: { path: "/pharmacies" } as const, icon: Pill },
    { title: "Book ambulance", sub: "Emergency response", route: { path: "/ambulance" } as const, icon: Ambulance },
    { title: "My prescriptions", sub: "View your records", route: { path: "/login", tab: "patient", patientMode: "login" } as const, icon: FileText },
  ];
  return (
    <>
      <div className="md:hidden"><MobileLanding /></div>
      <div className="hidden md:flex flex-col min-h-screen bg-gray-50 font-sans">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <img src="/assets/Logo.jpg" alt="Logo" className="w-10 h-10 rounded-full object-contain"
                onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E"; }} />
              <span className="text-xl font-bold text-gray-800"><span className="text-teal-600">Doctor</span>Booked</span>
            </div>
            <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-700">
              <button onClick={() => navigate({ path: "/patient/hospitals" })} className="hover:text-teal-600 transition-colors">Find Hospitals</button>
              <button onClick={() => navigate({ path: "/patient/hospitals" })} className="hover:text-teal-600 transition-colors">Find Doctors</button>
              <button onClick={() => navigate({ path: "/patient/tokens" })} className="hover:text-teal-600 transition-colors">My Tokens</button>
              <button onClick={() => navigate({ path: "/patient/prescriptions" })} className="hover:text-teal-600 transition-colors">My Prescriptions</button>
            </nav>
            <button type="button" onClick={() => navigate({ path: "/login", tab: "patient", patientMode: "login" })}
              className="flex items-center gap-2 border border-teal-600 text-teal-600 hover:bg-teal-50 px-4 py-1.5 rounded-full font-medium transition-colors">
              Login <User className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 py-6 lg:py-10">
          <div className="mb-8 lg:mb-10 rounded-2xl bg-gradient-to-br from-teal-50 to-white border border-teal-100 px-5 py-8 lg:px-8 lg:py-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight mb-6">Save Time on Your<br /><span className="text-teal-600">Doctor Visits</span></h2>
            <button
              type="button"
              onClick={() => navigate({ path: "/patient/hospitals" })}
              className="w-full max-w-md flex items-center gap-2.5 bg-white border-2 border-teal-600 rounded-xl px-4 py-3 text-left shadow-md hover:shadow-lg transition-shadow"
            >
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500">Search hospitals, doctors or specialty</span>
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10 lg:mb-12">
            {quickLinks.map((card, i) => (
              <div key={i} onClick={() => navigate(card.route)} className="bg-white border border-gray-200 rounded-xl px-4 py-4 flex items-center gap-3 cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                  <card.icon className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 truncate">{card.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{card.sub}</p>
                </div>
              </div>
            ))}
          </div>
          {(() => {
            const cityCounts = new Map<string, number>();
            for (const h of hospitals) { const c = (h.area || "").trim(); if (!c) continue; cityCounts.set(c, (cityCounts.get(c) ?? 0) + 1); }
            const cityList = Array.from(cityCounts.keys()).sort((a, b) => a.localeCompare(b));
            if (cityList.length === 0) return null;
            return (
              <div className="mb-10 lg:mb-14">
                <h2 className="text-sm font-semibold text-gray-500 mb-3 tracking-wide uppercase">Available Cities</h2>
                <div className="flex flex-wrap gap-2.5">
                  {cityList.map(city => (
                    <button key={city} type="button" onClick={() => navigate({ path: "/patient/hospitals", city })}
                      className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />{city}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Popular hospitals</h2>
              <button type="button" onClick={() => navigate({ path: "/patient/hospitals" })} className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors">
                View all hospitals
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-4">
              {hospitals.slice(0, 8).map(h => (
                <div key={h.id} className="cursor-pointer group" onClick={() => navigate({ path: "/patient/hospital", id: h.id })}>
                  <div className="bg-gray-50 rounded-2xl aspect-square mb-3 overflow-hidden border border-gray-100 flex items-center justify-center p-4 group-hover:border-teal-300 transition-colors">
                    {h.photoUrl ? <img src={(() => { const u = h.photoUrl; if (!u) return ""; if (u.startsWith("data:") || u.startsWith("http")) return u; const base = (import.meta.env.VITE_API_URL as string || "").replace(/\/api$/, ""); return base ? `${base}${u}` : u; })()} alt={h.name} className="w-full h-full object-cover rounded-xl" /> : <div className={`w-full h-full rounded-xl bg-gradient-to-br ${h.gradient}`} />}
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
            <div><div className="flex items-center gap-2 mb-2"><span className="font-bold text-gray-900">Doctor</span><span className="font-bold text-teal-500">Booked</span></div><p className="text-gray-400 text-sm">Skip the waiting room. Track your token live.</p></div>
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
                <button onClick={() => navigate({ path: "/terms" })} className="text-left hover:text-teal-600 transition-colors">Terms &amp; Conditions</button>
                <button onClick={() => navigate({ path: "/hospital-admin/login" })} className="text-left hover:text-teal-600 transition-colors">Hospital Admin Login</button>
                <button onClick={() => navigate({ path: "/pharmacy-owner/login" })} className="text-left hover:text-teal-600 transition-colors">Pharmacy Owner Login</button>
              </div>
            </div>
            <div className="flex lg:items-start lg:justify-end"><p className="text-xs text-gray-400">2026 Doctor Booked. All rights reserved.</p></div>
          </div>
        </footer>
      </div>
    </>
  );
}

function AppRoutes() {
  const { user, serverStatus, refreshFromStorage } = useStore();
  const { route } = useRouter();

  function renderPage() {
    if (!user) {
      if (route.path === "/") return <LandingPage />;
      if (route.path === "/terms") return <TermsPage />;
      if (route.path === "/privacy") return <PrivacyPage />;
      if (route.path === "/hospital-admin/login") return <HospitalAdminLogin />;
      if (route.path === "/pharmacy/login") return <PharmacyLogin />;
      if (route.path === "/patient/hospitals") return <HospitalsPage city={(route as { city?: string }).city} />;
      if (route.path === "/patient/hospital") return <HospitalDoctorsPage id={(route as { id: string }).id} />;
      if (route.path === "/pharmacies") return <ComingSoonPage title="Pharmacies" />; // was: <PharmaciesPage />
      if (route.path === "/pharmacy/detail") return <PharmacyDetailPage id={(route as any).id} />;
      if (route.path === "/pharmacy-owner/login") return <PharmacyOwnerLogin />;
      if (route.path === "/pharmacy-owner/register") return <PharmacyOwnerRegister />;
      if (route.path === "/ambulance") return <ComingSoonPage title="Ambulance" />; // was: <AmbulancePage />
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
    if (route.path === "/pharmacies") return <ComingSoonPage title="Pharmacies" />; // was: <PharmaciesPage />
    if (route.path === "/pharmacy/detail") return <PharmacyDetailPage id={(route as any).id} />;
    if (route.path === "/pharmacy-owner/dashboard") return <PharmacyOwnerDashboard />;
    if (route.path === "/ambulance") return <ComingSoonPage title="Ambulance" />; // was: <AmbulancePage />
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
    return (
      <>
        <div className="md:hidden"><MobileLanding /></div>
        <div className="hidden md:block"><HospitalsPage /></div>
      </>
    );
  }

  const isAdmin = user?.role === "admin" || user?.role === "hospital_admin" || user?.role === "pharmacy" || user?.role === "pharmacy_owner";
  // Only hide TopNav for routes that don't require login (landing/login/terms)
  // AND only when there's no logged-in user — a page refresh resets the
  // in-memory router to "/" even though the user is still authenticated
  // (login state lives in localStorage, not in the URL), so we must not
  // hide the nav purely based on route.path when `user` is already set.
  const hideTopNav =
    isAdmin ||
    (!user && (route.path === "/login" || route.path === "/terms" || route.path === "/privacy" || route.path === "/hospital-admin/login" || route.path === "/pharmacy/login" || route.path === "/pharmacy-owner/login" || route.path === "/pharmacy-owner/register")) ||
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
      <main className="flex-1 pb-24 md:pb-8">
        <PullToRefresh onRefresh={refreshFromStorage}>{renderPage()}</PullToRefresh>
      </main>
      <Toaster position="top-right" />
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
