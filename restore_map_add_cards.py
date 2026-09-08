import sys, pathlib

path = pathlib.Path("src/App.tsx")
if not path.exists():
    print("ERROR: run this from the root of the O-frontend repo (src/App.tsx not found)")
    sys.exit(1)

text = path.read_text()

# --- 1. Make sure Clock is in the lucide-react import (idempotent) ---
old_import = 'import { Calendar, ChevronRight, MapPin, User, Search, Navigation, Loader2, XCircle, Users, Hospital, Pill, Ambulance, FileText } from "lucide-react";'
new_import = 'import { Calendar, ChevronRight, Clock, MapPin, User, Search, Navigation, Loader2, XCircle, Users, Hospital, Pill, Ambulance, FileText } from "lucide-react";'
if old_import in text:
    text = text.replace(old_import, new_import, 1)
elif "Clock" not in text.split("\n")[3]:
    print("ERROR: import line not in expected state — paste me `sed -n '1,6p' src/App.tsx` and I'll adjust.")
    sys.exit(1)

# --- 2. Replace the whole MobileLanding() function with the map+search bar restored ---
start_marker = "function MobileLanding() {"
end_marker = "\n\nfunction LandingPage() {"

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx == -1 or end_idx == -1 or end_idx < start_idx:
    print("ERROR: could not locate MobileLanding()...LandingPage() boundaries — file may have changed.")
    sys.exit(1)

new_component = '''function MobileLanding() {
  const { navigate } = useRouter();
  const { hospitals, user } = useStore();
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
    if (delta > 40) setMapHeight(Math.round(window.innerHeight * 0.6));
    else if (delta < -40) setMapHeight(220);
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
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-teal-600 bg-white text-sm font-medium shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-400" />
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

      {/* Feature cards — replaces the hospital results list */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-5 pt-6 pb-28">
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
}'''

text = text[:start_idx] + new_component + text[end_idx:]
path.write_text(text)
print("SUCCESS: map + search bar restored, hospital list replaced with feature cards.")
