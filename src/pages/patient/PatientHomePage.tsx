import { Calendar, ChevronRight, Clock, FileText, Building2, MapPin, Search, Navigation, Loader2, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";
import { useNearMe } from "../../hooks/useNearMe";

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

const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "";

function loadMapsScript(): Promise<void> {
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
  const dragStartY = useRef<number>(0);
  const dragStartH = useRef<number>(220);
  const { state: nearState, locate, clear, sorted: sortedByDistance } = useNearMe(hospitals);
  const baseList = sortedByDistance ?? hospitals;
  const filtered = baseList.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.area.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    loadMapsScript().then(() => {
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
  const prescriptionCount = patientBookings.length;
  const nearbyHospitals = hospitals.slice(0, 6);

  return (
    <div className="flex flex-col bg-gray-50" style={{ minHeight: "100dvh" }}>
      {/* Map */}
      <div className="relative shrink-0 transition-all duration-200" style={{ height: mapHeight }}>
        <div ref={mapRef} className="w-full h-full" />
        {!mapReady && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
          </div>
        )}
        <div className="absolute bottom-5 left-3 right-3 z-10 flex gap-2">
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
            <button onClick={() => { import("@capacitor/core").then(({ Capacitor }) => { if (Capacitor.isNativePlatform()) { import("capacitor-native-settings").then(({ NativeSettings, AndroidSettings }) => NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails }).catch(() => {})); } }); }} className="flex items-center gap-1 bg-orange-50 border border-orange-300 text-orange-600 text-xs font-semibold px-3 py-2 rounded-xl shadow-md whitespace-nowrap">
              <Navigation className="w-3.5 h-3.5" /> Turn on GPS
            </button>
          ) : nearState.status === "denied" ? (
            <button onClick={locate} className="flex items-center gap-1 bg-red-50 border border-red-300 text-red-600 text-xs font-semibold px-3 py-2 rounded-xl shadow-md whitespace-nowrap">
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
        className="shrink-0 flex flex-col items-center justify-center bg-white z-10 cursor-row-resize"
        style={{ height: 26, borderRadius: "16px 16px 0 0", marginTop: -10, boxShadow: "0 -2px 8px rgba(0,0,0,0.08)" }}
        onMouseDown={e => { onDragStart(e.clientY); const mm = (ev: MouseEvent) => onDragMove(ev.clientY); const mu = (ev: MouseEvent) => { onDragEnd(ev.clientY); window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); }; window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu); }}
        onTouchStart={e => { onDragStart(e.touches[0].clientY); const tm = (ev: TouchEvent) => onDragMove(ev.touches[0].clientY); const te = (ev: TouchEvent) => { onDragEnd(ev.changedTouches[0].clientY); window.removeEventListener("touchmove", tm); window.removeEventListener("touchend", te); }; window.addEventListener("touchmove", tm); window.addEventListener("touchend", te); }}
      >
        <div className="w-8 h-1 bg-gray-300 rounded-full" />
      </div>

      {/* Scrollable content below map */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-4 pb-28 space-y-4">
          {/* Greeting */}
          <div className="pt-5 pb-1">
            <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">{getGreeting()} 👋</h1>
            <p className="text-sm text-gray-400 mt-1 font-medium">Your health matters. We're here to help.</p>
          </div>

          {/* Book an appointment */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="relative bg-gradient-to-br from-teal-600 to-teal-700 rounded-3xl px-5 py-6 overflow-hidden cursor-pointer shadow-lg shadow-teal-200"
            onClick={() => navigate({ path: "/patient/hospitals" })}
          >
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
              <button type="button"
                className="flex items-center gap-2 bg-white text-teal-700 font-bold text-sm px-5 py-2.5 rounded-full shadow-md hover:bg-teal-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); navigate({ path: "/patient/hospitals" }); }}
              >
                Get Started <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* Track token + Prescriptions */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all"
              onClick={() => activeBooking?.sessionId
                ? navigate({ path: "/patient/track", sessionId: activeBooking.sessionId, tokenNumber: activeBooking.tokenNumber ?? 0 })
                : navigate({ path: "/patient/tokens" })}
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
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
              <div className="grid grid-cols-3 gap-2">
                {nearbyHospitals.map((hospital, idx) => {
                  const photoUrl = resolvePhotoUrl(hospital.photoUrl);
                  return (
                    <motion.div key={hospital.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + idx * 0.04 }}
                      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
                      onClick={() => navigate({ path: "/patient/hospital", id: hospital.id })}
                    >
                      <div className="h-16 relative">
                        {photoUrl
                          ? <img src={photoUrl} alt={hospital.name} className="w-full h-full object-cover" />
                          : <div className={`w-full h-full bg-gradient-to-br ${hospital.gradient}`} />}
                        <span className="absolute top-1.5 left-1.5 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">Open</span>
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
    </div>
  );
}
