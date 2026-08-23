import { useEffect, useState, useCallback } from "react";
import { Search, MapPin, Phone, Clock, ChevronRight, Loader2, Pill, Navigation } from "lucide-react";
import * as api from "../../api";
import { useRouter } from "../../router/RouterContext";

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function PharmaciesPage() {
  const { navigate } = useRouter();
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [nearMe, setNearMe] = useState(false);

  useEffect(() => {
    api.pharmacies.list()
      .then(setPharmacies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleNearMe = useCallback(() => {
    if (!navigator.geolocation) { alert("Geolocation not supported on this device"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setNearMe(true);
        setLocating(false);
      },
      () => { alert("Could not get your location. Please allow location access."); setLocating(false); }
    );
  }, []);

  const withDistance = pharmacies.map(p => ({
    ...p,
    distanceKm: userLocation && p.latitude && p.longitude
      ? getDistanceKm(userLocation.lat, userLocation.lon, parseFloat(p.latitude), parseFloat(p.longitude))
      : null,
  }));

  const filtered = withDistance
    .filter(p => !search || [p.name, p.area, p.description].some(f => f?.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      if (!nearMe) return 0;
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Pharmacies</h1>
          <p className="text-sm text-gray-500">Find pharmacies near you and get in touch</p>
        </div>

        {/* Search + Near Me */}
        <div className="flex gap-2 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or area…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          </div>
          <button type="button" onClick={handleNearMe} disabled={locating}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors shrink-0 ${nearMe ? "bg-teal-600 text-white border-teal-600" : "bg-white border-gray-200 text-gray-700 hover:border-teal-400 hover:text-teal-600"}`}>
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            {nearMe ? "Near Me ✓" : "Near Me"}
          </button>
        </div>

        {nearMe && userLocation && (
          <p className="text-xs text-teal-600 mb-4 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Sorted by distance from your location
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>
        ) : pharmacies.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Pill className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No pharmacies listed yet</p>
            <p className="text-xs mt-1">Check back soon</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Pill className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No pharmacies match your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => (
              <button key={p.id} type="button"
                onClick={() => navigate({ path: "/pharmacy/detail", id: p.id })}
                className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:border-teal-300 hover:shadow-md transition-all flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                    <Pill className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <MapPin className="w-3 h-3" />{p.area || "—"}
                      {p.distanceKm != null && (
                        <span className="ml-2 text-teal-600 font-medium">
                          {p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)}m` : `${p.distanceKm.toFixed(1)}km`} away
                        </span>
                      )}
                    </div>
                    {p.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <Phone className="w-3 h-3" />{p.phone}
                      </div>
                    )}
                    {p.opening_hours && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <Clock className="w-3 h-3" />{p.opening_hours}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
