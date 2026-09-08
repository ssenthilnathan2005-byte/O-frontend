import { Toaster } from "@/components/ui/sonner";
import PullToRefresh from "./components/PullToRefresh";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Calendar, ChevronRight, MapPin, User, Search, Navigation, Loader2, XCircle, Users } from "lucide-react";
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
  const { hospitals, doctors } = useStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [search, setSearch] = useMobileState("");
  const [mapReady, setMapReady] = useMobileState(false);
  const [mapHeight, setMapHeight] = useMobileState(220);
  const dragStartY = useRef<number>(0);
  const dragStartH = useRef<number>(220);
  const { state: nearState, locate, clear, sorted: sortedByDistance } = useNearMe(hospitals);

  const baseList = sortedByDistance ?? hospitals;
  const filtered = baseList.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.area.toLowerCase().includes(search.toLowerCase())
  );
  const citySet = Array.from(new Set(hospitals.map(h => h.area).filter(Boolean))).sort();

  useEffect(() => {
    loadMapsScriptLanding().then(() => {
      if (!mapRef.current || mapObj.current) return;
      const google = (window as any).google;
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 9.9252, lng: 78.1198 }, zoom: 11,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: "greedy",
        styles: [
          { elementType: "geometry", stylers: [{ color: "#f5f7f6" }] },
          { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },

          { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
          { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
          { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
          { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#374151" }] },

          { featureType: "poi", stylers: [{ visibility: "off" }] },

          { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
          { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e5e7eb" }] },
          { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
          { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },

          { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ccebe6" }] },
          { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#99d8cd" }] },
          { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#0d9488" }] },
          { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#99d8cd" }] },
          { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },

          { featureType: "transit", stylers: [{ visibility: "off" }] },

          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f7f6" }] },
          { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#eef2f1" }] },

          { featureType: "water", elementType: "geometry", stylers: [{ color: "#bfe8e2" }] },
          { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#0d9488" }] },
        ],
      });
      mapObj.current = map;
      setMapReady(true);
    }).catch(() => setMapReady(false));
  }, []);

  useEffect(() => {
    if (!mapReady || !mapObj.current) return;
    const google = (window as any).google;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    filtered.forEach(h => {
      const coords = parseCoords((h as any).address) || parseCoords(h.area);
      if (!coords) return;
      const marker = new google.maps.Marker({
        position: coords, map: mapObj.current, title: h.name,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#14b8a6", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 },
      });
      const iw = new google.maps.InfoWindow({ content: `<div style="font-family:sans-serif;font-size:13px;font-weight:700">${h.name}</div><div style="font-size:11px;color:#6b7280">${h.area}</div>` });
      marker.addListener("click", () => iw.open(mapObj.current, marker));
      markersRef.current.push(marker);
    });
  }, [mapReady, filtered]);

  useEffect(() => {
    if (nearState.status === "done" && (nearState as any).userLat && mapObj.current) {
      const google = (window as any).google;
      mapObj.current.panTo(new google.maps.LatLng((nearState as any).userLat, (nearState as any).userLng));
      mapObj.current.setZoom(13);
    }
  }, [nearState.status]);

  // Drag handle logic
  function onDragStart(clientY: number) {
    dragStartY.current = clientY;
    dragStartH.current = mapHeight;
  }
  function onDragMove(clientY: number) {
    const delta = clientY - dragStartY.current;
    const newH = Math.min(Math.max(dragStartH.current + delta, 160), window.innerHeight * 0.65);
    setMapHeight(newH);
  }
  function onDragEnd(clientY: number) {
    const delta = clientY - dragStartY.current;
    // Snap: if dragged down >40px expand, up >40px collapse
    if (delta > 40) setMapHeight(Math.round(window.innerHeight * 0.6));
    else if (delta < -40) setMapHeight(220);
  }

  function resolvePhoto(url: string | null | undefined) {
    if (!url) return null;
    if (url.startsWith("data:") || url.startsWith("http")) return url;
    const base = (import.meta.env.VITE_API_URL as string || "").replace(/\/api$/, "");
    return base ? `${base}${url}` : url;
  }

  return (
    <div className="flex flex-col bg-gray-50" style={{ minHeight: "100dvh" }}>
      {/* Map — draggable height */}
      <div className="relative shrink-0 transition-all duration-200" style={{ height: mapHeight }}>
        <div ref={mapRef} className="w-full h-full" />
        {!mapReady && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
          </div>
        )}
        {/* Search bar over map */}
        <div className="absolute bottom-5 left-3 right-3 z-10 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search hospitals, doctors or areas"
              className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          {nearState.status === "done" ? (
            <button onClick={clear} className="flex items-center gap-1 bg-teal-500 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-md whitespace-nowrap">
              <XCircle className="w-3.5 h-3.5" /> Clear
            </button>
          ) : (
            <button onClick={locate} disabled={nearState.status === "loading"}
              className="flex items-center gap-1 bg-white border border-teal-300 text-teal-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-md whitespace-nowrap disabled:opacity-60">
              {nearState.status === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
              Near me
            </button>
          )}
        </div>
      </div>

      {/* Drag handle — touch to resize map */}
      <div
        className="shrink-0 flex flex-col items-center justify-center bg-white z-10 cursor-row-resize"
        style={{ height: 26, borderRadius: "16px 16px 0 0", marginTop: -10, boxShadow: "0 -2px 8px rgba(0,0,0,0.08)" }}
        onMouseDown={e => { onDragStart(e.clientY); const mm = (ev: MouseEvent) => onDragMove(ev.clientY); const mu = (ev: MouseEvent) => { onDragEnd(ev.clientY); window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); }; window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu); }}
        onTouchStart={e => { onDragStart(e.touches[0].clientY); const tm = (ev: TouchEvent) => onDragMove(ev.touches[0].clientY); const te = (ev: TouchEvent) => { onDragEnd(ev.changedTouches[0].clientY); window.removeEventListener("touchmove", tm); window.removeEventListener("touchend", te); }; window.addEventListener("touchmove", tm); window.addEventListener("touchend", te); }}
      >
        <div className="w-8 h-1 bg-gray-300 rounded-full" />
      </div>

      {/* Scrollable hospital list */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-4 pt-6 pb-28">
          <h2 className="text-base font-bold text-gray-900 mb-1">Find hospitals near you</h2>
          <p className="text-xs text-gray-400 mb-3">Book your token and skip the waiting time</p>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
            {citySet.map(c => (
              <button key={c} onClick={() => navigate({ path: "/patient/hospitals", city: c })}
                className="shrink-0 bg-gray-100 hover:bg-teal-50 hover:text-teal-700 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hospitals found</p>
              </div>
            ) : filtered.map(h => {
              const photo = resolvePhoto(h.photoUrl);
              const docCount = doctors.filter(d => d.hospitalId === h.id).length;
              const distKm = (h as any).distanceKm as number | undefined;
              const specialties: string[] = (h as any).specialties || [];
              return (
                <div key={h.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  onClick={() => navigate({ path: "/patient/hospital", id: h.id })}>
                  <div className="relative h-40">
                    {photo ? <img src={photo} alt={h.name} className="w-full h-full object-cover" /> : <div className={`w-full h-full bg-gradient-to-br ${h.gradient}`} />}
                    {distKm != null && (
                      <span className="absolute top-2 left-2 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`}
                      </span>
                    )}
                    <button className="absolute top-2 right-2 flex items-center gap-1 bg-teal-500 text-white text-[10px] font-semibold px-2 py-1 rounded-full"
                      onClick={e => { e.stopPropagation(); navigate({ path: "/patient/hospitals" }); }}>
                      <Navigation className="w-2.5 h-2.5" /> Map
                    </button>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-gray-900 text-sm">{h.name}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{h.area}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-teal-700"><Users className="w-3 h-3" />{docCount} Doctor{docCount !== 1 ? "s" : ""} available</span>
                    </div>
                    {specialties.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {specialties.slice(0, 3).map((s: string) => <span key={s} className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">{s}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
    { title: "Find Hospitals", sub: "TOP CLINICS", path: "/patient/hospitals" as const },
    { title: "Pharmacies", sub: "FIND NEAR YOU", path: "/pharmacies" as const },
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
          <div className="mb-6 lg:mb-8 rounded-2xl bg-gradient-to-br from-teal-50 to-white border border-teal-100 px-5 py-8 lg:px-8 lg:py-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">Save Time on Your<br /><span className="text-teal-600">Doctor Visits</span></h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-10 lg:mb-12">
            {quickLinks.map((card, i) => (
              <div key={i} onClick={() => navigate({ path: card.path })} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all">
                <div><h3 className="font-semibold text-sm text-gray-800">{card.title}</h3><p className="text-[10px] font-bold text-gray-400 mt-0.5 tracking-wide">{card.sub}</p></div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
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
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-6">Top Hospitals ({hospitals.length})</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-4">
              {hospitals.slice(0, 16).map(h => (
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
