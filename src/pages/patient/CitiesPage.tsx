// ============================================================
// FILE: src/pages/patient/CitiesPage.tsx
// NEW FILE
// Purpose: professional "select your city" landing step shown
//          before the hospital list. Cities are derived from the
//          existing hospital.area field (no backend change needed).
// ============================================================

import { Input } from "@/components/ui/input";
import { Building2, MapPin, Search } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";

// A small rotating set of gradients so the city cards feel designed,
// not random — same palette family as the rest of the app.
const CITY_GRADIENTS = [
  "from-teal-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-violet-500 to-purple-700",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-700",
  "from-emerald-500 to-green-700",
  "from-indigo-500 to-blue-800",
  "from-cyan-500 to-teal-700",
];

export default function CitiesPage() {
  const [search, setSearch] = useState("");
  const { navigate } = useRouter();
  const { hospitals } = useStore();

  // Group hospitals by city (hospital.area holds the city name).
  const cities = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of hospitals) {
      const city = (h.area || "").trim();
      if (!city) continue;
      map.set(city, (map.get(city) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, hospitalCount]) => ({ name, hospitalCount }))
      .sort((a, b) => b.hospitalCount - a.hospitalCount || a.name.localeCompare(b.name));
  }, [hospitals]);

  const filtered = cities.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header + search */}
      <div className="bg-gradient-to-r from-teal-50 to-sky-50 rounded-2xl p-6 sm:p-8 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Choose Your City</h1>
          <p className="text-gray-500 text-sm mt-1.5">
            Select a city to browse hospitals and book appointments near you
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <Input
            className="pl-10 bg-white border-gray-200"
            placeholder="Search city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-ocid="cities.search_input"
          />
        </div>
      </div>

      {/* Empty state — no hospitals in the system yet */}
      {cities.length === 0 ? (
        <div className="text-center py-16 text-gray-400" data-ocid="cities.empty_state">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No cities available yet</p>
          <p className="text-sm">Hospitals will appear here once they're added</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400" data-ocid="cities.no_match">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No cities found</p>
          <p className="text-sm">Try a different search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map((city, idx) => (
            <motion.button
              key={city.name}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => navigate({ path: "/patient/hospitals", city: city.name })}
              data-ocid={`cities.item.${idx + 1}`}
              className="text-left w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div
                className={`h-24 bg-gradient-to-br ${CITY_GRADIENTS[idx % CITY_GRADIENTS.length]} flex items-center justify-center relative`}
              >
                <MapPin className="w-8 h-8 text-white/90" />
              </div>
              <div className="p-4">
                <p className="font-bold text-gray-900 text-base leading-tight truncate">
                  {city.name}
                </p>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {city.hospitalCount} {city.hospitalCount === 1 ? "Hospital" : "Hospitals"}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
