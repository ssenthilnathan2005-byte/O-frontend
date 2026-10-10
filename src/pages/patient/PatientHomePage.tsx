import { Calendar, ChevronRight, Clock, FileText, FlaskConical, Building2, MapPin, Search, Navigation, Loader2, XCircle, Bell, Hospital, BookOpen, Pill, Ambulance, Maximize2, Minimize2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";
import { useNearMe } from "../../hooks/useNearMe";
import { loadGoogleMaps } from "../../lib/googleMaps";
import { getToken } from "@/api";
import { enablePushNotifications } from "../../lib/push";

function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  const base = (import.meta.env.VITE_API_URL as string || "").replace(/\/api$/, "");
  return base ? `${base}${url}` : url;
}

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}


function parseCoords(str?: string): { lat: number; lng: number } | null {
  if (!str) return null;
  const m = str.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90) return null;
  return { lat, lng };
}

export default function PatientHomePage() {
  const { navigate } = useRouter();
  const { user, bookings, hospitals, tokenStates } = useStore();

  // Map state
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [search, setSearch] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [mapHeight, setMapHeight] = useState(220);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const dragStartY = useRef<number>(0);
  const dragStartH = useRef<number>(220);
  const { state: nearState, locate, clear, sorted: sortedByDistance } = useNearMe(hospitals);
  const baseList = sortedByDistance ?? hospitals;
  const filtered = baseList.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.area.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!mapRef.current || mapObj.current) return;
      const google = (window as any).google;
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 11.1271, lng: 78.6569 }, zoom: 7,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: "greedy",
        styles: [
          { elementType: "geometry", stylers: [{ color: "#f5f7f6" }] },
          { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
          { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
          { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e5e7eb" }] },
          { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ccebe6" }] },
          { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#99d8cd" }] },
          { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#0d9488" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#bfe8e2" }] },
          { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#0d9488" }] },
        ],
      });
      mapObj.current = map;
      setMapReady(true);
    }).catch(() => setMapReady(false));
    return () => { mapObj.current = null; markersRef.current = []; setMapReady(false); };
  }, [isDesktop]);

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
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
            `<svg width="36" height="36" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="20" width="60" height="60" rx="14" fill="#14b8a6"/>
              <path d="M50 32 L50 68 M32 50 L68 50" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/>
            </svg>`
          ),
          scaledSize: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 18),
        },
      });
      const iw = new google.maps.InfoWindow({ content: `<div style="font-family:sans-serif;font-size:13px;font-weight:700">${h.name}</div><div style="font-size:11px;color:#6b7280">${h.area}</div>` });
      marker.addListener("click", () => iw.open(mapObj.current, marker));
      markersRef.current.push(marker);
    });
  }, [mapReady, filtered]);

  useEffect(() => {
    if (nearState.status === "done" && (nearState as any).lat && mapObj.current) {
      const google = (window as any).google;
      mapObj.current.panTo(new google.maps.LatLng((nearState as any).lat, (nearState as any).lng));
      mapObj.current.setZoom(13);
    }
  }, [nearState.status, mapReady]);

  // Ask for the patient's location once when the home page opens
  useEffect(() => {
    locate();
  }, []);

  // If location is unavailable, zoom out to show all hospitals
  useEffect(() => {
    if (!mapReady || !mapObj.current) return;
    const s = nearState.status;
    if (s !== "denied" && s !== "gps-off" && s !== "unsupported") return;
    const google = (window as any).google;
    const bounds = new google.maps.LatLngBounds();
    let n = 0;
    hospitals.forEach(h => {
      const c = parseCoords((h as any).address) || parseCoords(h.area);
      if (c) { bounds.extend(c); n++; }
    });
    if (n === 1) { mapObj.current.setCenter(bounds.getCenter()); mapObj.current.setZoom(12); }
    else if (n > 1) mapObj.current.fitBounds(bounds, 40);
  }, [nearState.status, mapReady, hospitals]);

  function onDragStart(clientY: number) { dragStartY.current = clientY; dragStartH.current = mapHeight; }
  function onDragMove(clientY: number) {
    const delta = clientY - dragStartY.current;
    setMapHeight(Math.min(Math.max(dragStartH.current + delta, 160), window.innerHeight * 0.65));
  }
  function onDragEnd(clientY: number) {
    const delta = clientY - dragStartY.current;
    if (delta > 40) setMapHeight(Math.round(window.innerHeight * 0.6));
    else if (delta < -40) setMapHeight(220);
  }

  // Token / booking data
  const patientBookings = bookings.filter(
    (b) => b.patientId === user?.id && b.status === "confirmed" && b.paymentDone
  );
  const activeBooking = patientBookings[patientBookings.length - 1] ?? null;
  const tokenState = activeBooking?.sessionId ? tokenStates[activeBooking.sessionId] : null;
  const myTokenNum = activeBooking?.tokenNumber ?? null;
  const currentToken = tokenState?.currentToken ?? null;
  const aheadCount = myTokenNum != null && currentToken != null ? Math.max(0, myTokenNum - currentToken - 1) : null;
  const [notifState, setNotifState] = useState<"default"|"granted"|"denied"|"unsupported">("granted");
  useEffect(() => {
    if (typeof Notification === "undefined") { setNotifState("unsupported"); return; }
    setNotifState(Notification.permission as "default"|"granted"|"denied");
  }, []);
  const [realPrescriptionCount, setRealPrescriptionCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getToken();
        if (!token) { if (!cancelled) setRealPrescriptionCount(0); return; }
        const res = await fetch(`${BASE}/prescriptions/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled) setRealPrescriptionCount(Array.isArray(data) ? data.length : 0);
      } catch {
        if (!cancelled) setRealPrescriptionCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);
  const prescriptionCount = realPrescriptionCount ?? 0;
  const nearbyHospitals = hospitals.slice(0, 6);

  const mobileView = (
    <div className="flex flex-col bg-gray-50" style={{ minHeight: "100dvh" }}>
      {/* Map */}
      <div className="relative shrink-0 transition-all duration-200 lg:w-[calc(100%-3rem)] lg:max-w-6xl lg:mx-auto lg:mt-4 lg:rounded-3xl lg:overflow-hidden lg:border lg:border-gray-200 lg:shadow-md" style={{ height: isDesktop ? 190 : mapHeight }}>
        <div ref={mapRef} className="w-full h-full" />
        {!mapReady && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
          </div>
        )}
        <div className="absolute bottom-5 left-3 right-3 z-10 flex gap-2 lg:right-auto lg:left-4 lg:bottom-4 lg:w-[420px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search hospitals, doctors or areas"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-teal-600 bg-white text-sm font-medium shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          {nearState.status === "done" ? (
            <button onClick={clear} className="flex items-center gap-1 bg-teal-500 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-md whitespace-nowrap">
              <XCircle className="w-3.5 h-3.5" /> Clear
            </button>
          ) : nearState.status === "gps-off" ? (
            <button onClick={() => { import("@capacitor/core").then(({ Capacitor }) => { if (Capacitor.isNativePlatform()) { import("capacitor-native-settings").then(({ NativeSettings, AndroidSettings }) => NativeSettings.openAndroid({ option: AndroidSettings.Location }).catch(() => {})); } }); }} className="flex items-center gap-1 bg-orange-50 border border-orange-300 text-orange-600 text-xs font-semibold px-3 py-2 rounded-xl shadow-md whitespace-nowrap">
              <Navigation className="w-3.5 h-3.5" /> Go to Settings
            </button>
          ) : nearState.status === "denied" ? (
            <button onClick={() => { import("@capacitor/core").then(({ Capacitor }) => { if (Capacitor.isNativePlatform()) { import("capacitor-native-settings").then(({ NativeSettings, AndroidSettings }) => NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails }).catch(() => {})); } else { locate(); } }); }} className="flex items-center gap-1 bg-red-50 border border-red-300 text-red-600 text-xs font-semibold px-3 py-2 rounded-xl shadow-md whitespace-nowrap">
              <Navigation className="w-3.5 h-3.5" /> Allow location
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

      {/* Drag handle */}
      <div
        className="shrink-0 flex flex-col items-center justify-center bg-white z-10 cursor-row-resize lg:hidden"
        style={{ height: 26, borderRadius: "16px 16px 0 0", marginTop: -10, boxShadow: "0 -2px 8px rgba(0,0,0,0.08)" }}
        onMouseDown={e => { onDragStart(e.clientY); const mm = (ev: MouseEvent) => onDragMove(ev.clientY); const mu = (ev: MouseEvent) => { onDragEnd(ev.clientY); window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); }; window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu); }}
        onTouchStart={e => { onDragStart(e.touches[0].clientY); const tm = (ev: TouchEvent) => onDragMove(ev.touches[0].clientY); const te = (ev: TouchEvent) => { onDragEnd(ev.changedTouches[0].clientY); window.removeEventListener("touchmove", tm); window.removeEventListener("touchend", te); }; window.addEventListener("touchmove", tm); window.addEventListener("touchend", te); }}
      >
        <div className="w-8 h-1 bg-gray-300 rounded-full" />
      </div>

      {/* Scrollable content below map */}
      <div className="flex-1 overflow-y-auto bg-white lg:bg-gray-50">
        <div className="px-4 pb-28 space-y-4 lg:max-w-6xl lg:mx-auto lg:px-6 lg:pb-8 lg:space-y-4">
          {/* Notification permission banner */}
          {notifState === "default" && (
            <div className="mt-4 flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3">
              <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-teal-900">Stay updated</p>
                <p className="text-xs text-teal-600 leading-snug">Get notified when your token is called or report is ready</p>
              </div>
              <button
                type="button"
                onClick={() => enablePushNotifications().then(() => setNotifState(Notification.permission as "default"|"granted"|"denied"))}
                className="shrink-0 bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-teal-600 transition-colors"
              >
                Enable
              </button>
            </div>
          )}

          {/* Greeting */}
          <div className="pt-5 pb-1 lg:pt-4 lg:pb-0">
            <h1 className="text-4xl lg:text-2xl font-extrabold text-gray-900 leading-tight">{getGreeting()} 👋</h1>
            <p className="text-sm text-gray-400 mt-1 font-medium">Your health matters. We're here to help.</p>
          </div>

          {/* Action cards (3 columns on desktop) */}
          <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4">
          {/* Book an appointment */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="relative bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl px-4 py-3.5 overflow-hidden cursor-pointer shadow-md shadow-teal-200 lg:order-1 lg:flex lg:items-center lg:px-5 lg:py-4 lg:rounded-2xl"
            onClick={() => navigate({ path: "/patient/hospitals" })}
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-teal-500 rounded-full opacity-30" />
            <div className="absolute -right-2 -bottom-8 w-28 h-28 bg-teal-500 rounded-full opacity-20" />
            <Building2 className="absolute right-3 bottom-2 w-14 h-14 lg:w-12 lg:h-12 text-white opacity-20" strokeWidth={0.8} />
            <div className="relative z-10 max-w-[72%] lg:max-w-[80%]">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 rounded-xl p-2 backdrop-blur-sm">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-white font-bold text-base lg:text-base leading-tight">Book an appointment</h2>
              </div>
              <p className="text-teal-100 text-xs mb-3 lg:text-xs lg:mb-3">Find a hospital and get your token in minutes</p>
              <button type="button"
                className="flex items-center gap-2 bg-white text-teal-700 font-bold text-xs px-4 py-1.5 lg:text-xs lg:px-4 lg:py-1.5 rounded-full shadow-md hover:bg-teal-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); navigate({ path: "/patient/hospitals" }); }}
              >
                Get Started <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* Track token + Prescriptions */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-3 lg:order-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl p-4 lg:p-3 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all"
              onClick={() => activeBooking?.sessionId
                ? navigate({ path: "/patient/track", sessionId: activeBooking.sessionId, tokenNumber: activeBooking.tokenNumber ?? 0 })
                : navigate({ path: "/patient/tokens" })}
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-3 lg:w-8 lg:h-8 lg:mb-2">
                <Clock className="w-5 h-5 text-teal-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">Track your token</h3>
              <p className="text-gray-400 text-xs mt-0.5 leading-snug">See your position in the queue</p>
              {myTokenNum != null ? (
                <div className="mt-3 flex items-center gap-1.5 bg-green-50 rounded-lg px-2 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-xs font-semibold text-green-700 truncate">#{myTokenNum}{aheadCount != null ? ` · ${aheadCount} ahead` : ""}</span>
                  <ChevronRight className="w-3 h-3 text-green-500 ml-auto shrink-0" />
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                  <span className="text-xs text-gray-400">No active token</span>
                  <ChevronRight className="w-3 h-3 text-gray-300 ml-auto" />
                </div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-4 lg:p-3 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all"
              onClick={() => navigate({ path: "/patient/prescriptions" })}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3 lg:w-8 lg:h-8 lg:mb-2">
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

          {/* Lab Tests — full width, matches Book an appointment style */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="relative bg-gradient-to-br from-sky-600 to-sky-700 rounded-2xl px-4 py-3.5 overflow-hidden cursor-pointer shadow-md shadow-sky-200 lg:order-2 lg:flex lg:items-center lg:px-5 lg:py-4 lg:rounded-2xl"
            onClick={() => navigate({ path: "/labs" })}
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-sky-500 rounded-full opacity-30" />
            <div className="absolute -right-2 -bottom-8 w-28 h-28 bg-sky-500 rounded-full opacity-20" />
            <FlaskConical className="absolute right-3 bottom-2 w-14 h-14 lg:w-12 lg:h-12 text-white opacity-20" strokeWidth={0.8} />
            <div className="relative z-10 max-w-[72%] lg:max-w-[80%]">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 rounded-xl p-2 backdrop-blur-sm">
                  <FlaskConical className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-white font-bold text-base lg:text-base leading-tight">Lab Tests</h2>
              </div>
              <p className="text-sky-100 text-xs mb-3 lg:text-xs lg:mb-3">Book a diagnostic test with home sample collection</p>
              <button type="button"
                className="flex items-center gap-2 bg-white text-sky-700 font-bold text-xs px-4 py-1.5 lg:text-xs lg:px-4 lg:py-1.5 rounded-full shadow-md hover:bg-sky-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); navigate({ path: "/labs" }); }}
              >
                Book a Test <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
          </div>

          {/* Hospitals near you — 3 col compact */}
          {nearbyHospitals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Hospitals near you</h2>
                  <p className="text-xs text-gray-400">Quality care, close to home</p>
                </div>
                <button type="button" className="text-teal-600 text-sm font-semibold flex items-center gap-0.5 hover:underline"
                  onClick={() => navigate({ path: "/patient/hospitals" })}>
                  See all <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-6 lg:gap-3">
                {nearbyHospitals.map((hospital, idx) => {
                  const photoUrl = resolvePhotoUrl(hospital.photoUrl);
                  return (
                    <motion.div key={hospital.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + idx * 0.04 }}
                      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
                      onClick={() => navigate({ path: "/patient/hospital", id: hospital.id })}
                    >
                      <div className="h-16 lg:h-20 relative">
                        {photoUrl
                          ? <img src={photoUrl} alt={hospital.name} className="w-full h-full object-cover" />
                          : <div className={`w-full h-full bg-gradient-to-br ${hospital.gradient}`} />}
                        <span className="absolute top-1.5 left-1.5 bg-green-500 text-white text-[9px] lg:text-[10px] font-bold px-1.5 py-0.5 rounded-full">Open</span>
                      </div>
                      <div className="p-2 lg:p-2.5">
                        <p className="font-semibold text-gray-900 text-[10px] lg:text-xs leading-tight line-clamp-2">{hospital.name}</p>
                        <p className="text-gray-400 text-[9px] lg:text-[11px] mt-0.5 flex items-center gap-0.5 truncate">
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
    </div>
  );

  // ── Desktop dashboard (lg and up): everything visible, no page scroll ──
  const [mapExpanded, setMapExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem("db_map_expanded") === "1"; } catch { return false; }
  });
  function toggleMap() {
    setMapExpanded(v => {
      try { localStorage.setItem("db_map_expanded", v ? "0" : "1"); } catch {}
      return !v;
    });
  }
  useEffect(() => {
    const t = setTimeout(() => {
      const g = (window as any).google;
      if (g && mapObj.current) {
        const c = mapObj.current.getCenter();
        g.maps.event.trigger(mapObj.current, "resize");
        if (c) mapObj.current.setCenter(c);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [mapExpanded]);

  const [navH, setNavH] = useState(58);
  useEffect(() => {
    const el = Array.from(document.querySelectorAll("header")).find(h => h.offsetHeight > 0);
    const measure = () => {
      const target = Array.from(document.querySelectorAll("header")).find(h => h.offsetHeight > 0);
      setNavH(target ? Math.ceil(target.getBoundingClientRect().height) : 58);
    };
    measure();
    window.addEventListener("resize", measure);
    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(measure); ro.observe(el); }
    return () => { window.removeEventListener("resize", measure); ro?.disconnect(); };
  }, [isDesktop]);

  const firstName = (((user as any)?.name as string) || "").split(" ")[0];
  const services = [
    { label: "Hospitals", sub: "Find & book", Icon: Hospital, path: "/patient/hospitals", tint: "bg-teal-50 text-teal-600" },
    { label: "Labs", sub: "Diagnostic tests", Icon: FlaskConical, path: "/labs", tint: "bg-sky-50 text-sky-600" },
    { label: "Bookings", sub: "Tokens & visits", Icon: BookOpen, path: "/patient/tokens", tint: "bg-indigo-50 text-indigo-600" },
    { label: "Prescriptions", sub: prescriptionCount > 0 ? `${prescriptionCount} record${prescriptionCount > 1 ? "s" : ""}` : "No records", Icon: FileText, path: "/patient/prescriptions", tint: "bg-blue-50 text-blue-600" },
    { label: "Pharmacies", sub: "Order medicines", Icon: Pill, path: "/pharmacies", tint: "bg-emerald-50 text-emerald-600" },
    { label: "Ambulance", sub: "Emergency", Icon: Ambulance, path: "/ambulance", tint: "bg-red-50 text-red-600" },
  ];

  const big = !mapExpanded; // map collapsed => actions panel gets the room and larger sizing
  const desktopView = (
    <div className="bg-gray-50 overflow-hidden" style={{ height: `calc(100dvh - ${navH}px)` }}>
      <div className="h-full w-full mx-auto px-6 py-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-end justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{getGreeting()}{firstName ? `, ${firstName}` : ""} 👋</h1>
            <p className="text-xs text-gray-500 mt-0.5">Your health matters. We're here to help.</p>
          </div>
          {notifState === "default" && (
            <button type="button"
              onClick={() => enablePushNotifications().then(() => setNotifState(Notification.permission as "default"|"granted"|"denied"))}
              className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-teal-100 transition-colors">
              <Bell className="w-3.5 h-3.5" /> Enable notifications
            </button>
          )}
        </div>

        {/* Content: map (left) + actions */}
        <div className="flex-1 min-h-0 grid gap-4"
          style={{
            gridTemplateColumns: mapExpanded
              ? "minmax(0, 1fr) clamp(400px, 34vw, 620px)"
              : "clamp(320px, 28vw, 440px) minmax(0, 1fr)",
            gridTemplateRows: "minmax(0, 1fr)",
          }}>
          {/* Map */}
          <div className="relative min-h-0 rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
            <div ref={mapRef} className="absolute inset-0" />
            {!mapReady && (
              <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
              </div>
            )}
            <div className={`absolute top-3 left-3 z-10 flex gap-2 ${mapExpanded ? "w-[440px] max-w-[calc(100%-4rem)]" : "right-14"}`}>
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search hospitals, doctors or areas"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              {nearState.status === "done" ? (
                <button onClick={clear} className="flex items-center gap-1 bg-teal-500 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-md whitespace-nowrap">
                  <XCircle className="w-3.5 h-3.5" /> Clear
                </button>
              ) : (
                <button onClick={locate} disabled={nearState.status === "loading"}
                  className="flex items-center gap-1 bg-white border border-gray-200 text-teal-700 text-xs font-semibold px-3 py-2 rounded-lg shadow-md whitespace-nowrap disabled:opacity-60">
                  {nearState.status === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                  {nearState.status === "denied" || nearState.status === "gps-off" ? "Allow location" : "Near me"}
                </button>
              )}
            </div>
            <button type="button" onClick={toggleMap}
              title={mapExpanded ? "Shrink map" : "Expand map"}
              aria-label={mapExpanded ? "Shrink map" : "Expand map"}
              className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-md text-gray-700 hover:text-teal-700 hover:border-teal-300 transition-colors">
              {mapExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Actions */}
          <div className="min-h-0 flex flex-col gap-3 overflow-y-auto">
            {/* Primary action */}
            <div
              className={`shrink-0 flex items-center justify-between gap-3 bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl cursor-pointer shadow-sm hover:shadow-md transition-shadow ${big ? "px-5 py-4" : "px-4 py-3"}`}
              onClick={() => navigate({ path: "/patient/hospitals" })}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`bg-white/20 rounded-lg shrink-0 ${big ? "p-2.5" : "p-2"}`}><Calendar className={big ? "w-6 h-6 text-white" : "w-5 h-5 text-white"} /></div>
                <div className="min-w-0">
                  <h2 className={`text-white font-semibold leading-tight ${big ? "text-base" : "text-sm"}`}>Book an appointment</h2>
                  <p className={`text-teal-100 truncate ${big ? "text-sm" : "text-xs"}`}>Find a hospital and get your token in minutes</p>
                </div>
              </div>
              <button type="button"
                className={`shrink-0 flex items-center gap-1 bg-white text-teal-700 font-semibold rounded-full hover:bg-teal-50 transition-colors ${big ? "text-sm px-5 py-2" : "text-xs px-3.5 py-1.5"}`}
                onClick={(e) => { e.stopPropagation(); navigate({ path: "/patient/hospitals" }); }}>
                Get Started <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* All services */}
            <div className={`shrink-0 grid ${big ? "grid-cols-6 gap-3" : "grid-cols-3 gap-2"}`}>
              {services.map(({ label, sub, Icon, path, tint }) => (
                <button key={label} type="button"
                  onClick={() => navigate({ path } as any)}
                  className={`bg-white border border-gray-200 rounded-xl text-left hover:border-teal-300 hover:shadow-sm transition-all ${big ? "p-3.5" : "p-2.5"}`}>
                  <div className={`rounded-lg flex items-center justify-center ${tint} ${big ? "w-10 h-10 mb-2.5" : "w-8 h-8 mb-2"}`}>
                    <Icon className={big ? "w-5 h-5" : "w-4 h-4"} />
                  </div>
                  <p className={`font-semibold text-gray-900 leading-tight truncate ${big ? "text-base" : "text-sm"}`}>{label}</p>
                  <p className={`text-gray-500 truncate ${big ? "text-xs" : "text-[11px]"}`}>{sub}</p>
                </button>
              ))}
            </div>

            {/* Token status */}
            <button type="button"
              className={`shrink-0 flex items-center gap-3 bg-white border border-gray-200 rounded-xl text-left hover:border-teal-300 hover:shadow-sm transition-all ${big ? "px-4 py-3" : "px-3 py-2.5"}`}
              onClick={() => activeBooking?.sessionId
                ? navigate({ path: "/patient/track", sessionId: activeBooking.sessionId, tokenNumber: activeBooking.tokenNumber ?? 0 })
                : navigate({ path: "/patient/tokens" })}>
              <div className={`rounded-lg bg-teal-50 flex items-center justify-center shrink-0 ${big ? "w-10 h-10" : "w-8 h-8"}`}><Clock className={big ? "w-5 h-5 text-teal-600" : "w-4 h-4 text-teal-600"} /></div>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold text-gray-900 leading-tight ${big ? "text-base" : "text-sm"}`}>Track your token</p>
                <p className={`text-gray-500 truncate ${big ? "text-xs" : "text-[11px]"}`}>See your position in the queue</p>
              </div>
              {myTokenNum != null ? (
                <span className={`flex items-center gap-1.5 bg-green-50 text-green-700 font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${big ? "text-sm" : "text-xs"}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />#{myTokenNum}{aheadCount != null ? ` · ${aheadCount} ahead` : ""}
                </span>
              ) : (
                <span className={`bg-gray-100 text-gray-500 font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${big ? "text-sm" : "text-xs"}`}>No active token</span>
              )}
            </button>

            {/* Hospitals near you — takes all remaining height */}
            <div className={`flex-1 min-h-[150px] bg-white border border-gray-200 rounded-xl flex flex-col ${big ? "p-4" : "p-3"}`}>
              <div className="flex items-center justify-between mb-2 shrink-0">
                <h2 className={`font-semibold text-gray-900 ${big ? "text-base" : "text-sm"}`}>Hospitals near you</h2>
                <button type="button" className="text-teal-600 text-xs font-semibold flex items-center gap-0.5 hover:underline"
                  onClick={() => navigate({ path: "/patient/hospitals" })}>
                  See all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className={`flex-1 min-h-0 overflow-y-auto ${big ? "grid grid-cols-2 gap-x-3 gap-y-1.5 content-start" : "space-y-1.5"}`}>
                {nearbyHospitals.length === 0 && <p className="text-xs text-gray-400 py-2">No hospitals available yet</p>}
                {nearbyHospitals.map((hospital) => {
                  const photoUrl = resolvePhotoUrl(hospital.photoUrl);
                  return (
                    <button key={hospital.id} type="button"
                      onClick={() => navigate({ path: "/patient/hospital", id: hospital.id })}
                      className="w-full flex items-center gap-3 rounded-lg p-1.5 text-left hover:bg-gray-50 transition-colors">
                      <div className={`rounded-lg overflow-hidden shrink-0 ${big ? "w-12 h-12" : "w-10 h-10"}`}>
                        {photoUrl
                          ? <img src={photoUrl} alt={hospital.name} className="w-full h-full object-cover" />
                          : <div className={`w-full h-full bg-gradient-to-br ${hospital.gradient}`} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold text-gray-900 truncate leading-tight ${big ? "text-base" : "text-sm"}`}>{hospital.name}</p>
                        <p className={`text-gray-500 flex items-center gap-0.5 truncate ${big ? "text-xs" : "text-[11px]"}`}><MapPin className="w-3 h-3 shrink-0" />{hospital.area}</p>
                      </div>
                      <span className="bg-green-50 text-green-700 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">Open</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return isDesktop ? desktopView : mobileView;
}
