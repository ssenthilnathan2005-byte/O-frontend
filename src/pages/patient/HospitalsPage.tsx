// ============================================================
// FILE: src/pages/patient/HospitalsPage.tsx
// Changes: added "Hospitals Near Me" button + distance badges
// ============================================================

import { Input } from "@/components/ui/input";
import { ChevronLeft, MapPin, Search, Users, Navigation, Loader2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";
import HospitalMapModal from "../../components/hospital/HospitalMapModal";
import { useNearMe } from "../../hooks/useNearMe";

function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  const base = (import.meta.env.VITE_API_URL as string || "").replace(/\/api$/, "");
  return base ? `${base}${url}` : url;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export default function HospitalsPage({ city }: { city?: string }) {
  const [search, setSearch] = useState("");
  const { navigate, goBack } = useRouter();
  const { hospitals, doctors } = useStore();
  const [mapHospital, setMapHospital] = useState<(typeof hospitals)[0] | null>(null);

  const { state: nearState, locate, clear, sorted: sortedByDistance } = useNearMe(hospitals);

  // When near-me is active, use the sorted list; otherwise use original
  const baseList = sortedByDistance ?? hospitals;
  const cityScoped = city ? baseList.filter((h) => h.area === city) : baseList;

  const filtered = cityScoped.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.area.toLowerCase().includes(search.toLowerCase()),
  );

  const isNearMeActive = nearState.status === "done";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {mapHospital && (
        <HospitalMapModal
          hospital={{
            name: mapHospital.name,
            area: mapHospital.area,
            address: (mapHospital as any).address,
          }}
          onClose={() => setMapHospital(null)}
        />
      )}

      {city && (
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-teal-600 transition-colors mb-4"
          data-ocid="hospitals.back_button"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      )}

      {/* Header + search + near me */}
      <div className="bg-teal-50 rounded-2xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {city ? `Hospitals in ${city}` : "Find a Hospital"}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {isNearMeActive
                ? "Showing hospitals sorted by distance from you"
                : city
                ? `${cityScoped.length} hospital${cityScoped.length === 1 ? "" : "s"} available for booking`
                : "Search and book appointments at top hospitals near you"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Search input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
              <Input
                className="pl-10 bg-white border-gray-200"
                placeholder="Search hospital or area..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-ocid="hospitals.search_input"
              />
            </div>

            {/* Near Me button */}
            {isNearMeActive ? (
              <button
                type="button"
                onClick={clear}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap"
                data-ocid="hospitals.near_me_clear"
              >
                <XCircle className="w-4 h-4" />
                Clear Near Me
              </button>
            ) : (
              <button
                type="button"
                onClick={locate}
                disabled={nearState.status === "loading"}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-teal-300 text-teal-700 text-sm font-semibold hover:bg-teal-50 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                data-ocid="hospitals.near_me_button"
              >
                {nearState.status === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
                {nearState.status === "loading" ? "Locating…" : "Hospitals Near Me"}
              </button>
            )}
          </div>
        </div>

        {/* Error states */}
        <AnimatePresence>
          {nearState.status === "denied" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2"
            >
              <XCircle className="w-4 h-4 flex-shrink-0" />
              Location access was denied. Please allow location in your browser and try again.
            </motion.div>
          )}
          {nearState.status === "unsupported" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700 flex items-center gap-2"
            >
              <XCircle className="w-4 h-4 flex-shrink-0" />
              Your browser doesn't support location. Try Chrome or Safari.
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Available Cities */}
      {!city && !isNearMeActive && (() => {
        const cityCounts = new Map<string, number>();
        for (const h of hospitals) {
          const c = (h.area || "").trim();
          if (!c) continue;
          cityCounts.set(c, (cityCounts.get(c) ?? 0) + 1);
        }
        const cityList = Array.from(cityCounts.keys()).sort((a, b) => a.localeCompare(b));
        if (cityList.length === 0) return null;
        return (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 tracking-wide uppercase">
              Available Cities
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {cityList.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => navigate({ path: "/patient/hospitals", city: c })}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  data-ocid={`hospitals.city_chip.${c}`}
                >
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {c}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400" data-ocid="hospitals.empty_state">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No hospitals found</p>
          <p className="text-sm">
            {city ? "Try a different search, or go back and pick another city" : "Try a different name or area"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((hospital, idx) => {
            const docCount = doctors.filter((d) => d.hospitalId === hospital.id).length;
            const photoUrl = resolvePhotoUrl(hospital.photoUrl);
            const distKm = (hospital as any).distanceKm as number | null | undefined;

            return (
              <motion.div
                key={hospital.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                data-ocid={`hospitals.item.${idx + 1}`}
              >
                <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all text-left">

                  {/* Card photo / gradient */}
                  {photoUrl ? (
                    <div
                      className="h-36 relative flex flex-col justify-between p-3 bg-cover bg-center cursor-pointer"
                      style={{ backgroundImage: `url(${photoUrl})` }}
                      onClick={() => navigate({ path: "/patient/hospital", id: hospital.id })}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                      <div className="relative flex justify-between items-start">
                        {/* Distance badge — top left */}
                        {isNearMeActive && (
                          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full shadow-sm ${
                            distKm != null
                              ? "bg-teal-500 text-white"
                              : "bg-white/80 text-gray-500"
                          }`}>
                            <Navigation className="w-3 h-3" />
                            {distKm != null ? formatDistance(distKm) : "No GPS"}
                          </span>
                        )}
                        {/* Map button — top right */}
                        <button
                          type="button"
                          title="View on map"
                          onClick={e => { e.stopPropagation(); setMapHospital(hospital); }}
                          className="ml-auto flex items-center gap-1.5 bg-white/90 hover:bg-white text-teal-600 text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-sm transition-all hover:scale-105"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Map
                        </button>
                      </div>

                      <div className="relative">
                        <p className="text-white font-bold text-sm leading-tight">{hospital.name}</p>
                        <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {hospital.area}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`h-36 bg-gradient-to-br ${hospital.gradient} flex flex-col justify-between p-3 cursor-pointer`}
                      onClick={() => navigate({ path: "/patient/hospital", id: hospital.id })}
                    >
                      <div className="flex justify-between items-start">
                        {isNearMeActive && (
                          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full shadow-sm ${
                            distKm != null
                              ? "bg-white/90 text-teal-700"
                              : "bg-white/60 text-gray-500"
                          }`}>
                            <Navigation className="w-3 h-3" />
                            {distKm != null ? formatDistance(distKm) : "No GPS"}
                          </span>
                        )}
                        <button
                          type="button"
                          title="View on map"
                          onClick={e => { e.stopPropagation(); setMapHospital(hospital); }}
                          className="ml-auto flex items-center gap-1.5 bg-white/90 hover:bg-white text-teal-600 text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-sm transition-all hover:scale-105"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Map
                        </button>
                      </div>

                      <div>
                        <p className="text-white font-bold text-sm leading-tight">{hospital.name}</p>
                        <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {hospital.area}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Card footer */}
                  <button
                    type="button"
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    onClick={() => navigate({ path: "/patient/hospital", id: hospital.id })}
                  >
                    <span className="flex items-center gap-1.5 bg-teal-50 text-teal-700 text-xs font-medium px-2.5 py-1 rounded-full">
                      <Users className="w-3 h-3" />
                      {docCount} Doctors
                    </span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
