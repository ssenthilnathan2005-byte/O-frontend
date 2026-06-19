// ============================================================
// FILE: src/frontend/src/pages/patient/HospitalsPage.tsx
// REPLACE: entire file
// Base: your existing HospitalsPage code (Tailwind + motion/react
//       + shadcn Input + camelCase hospital props)
// Change: added map pin button in top-right of each card photo
//         that opens HospitalMapModal
// ============================================================

import { Input }  from "@/components/ui/input";
import { MapPin, Search, Users } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useStore }  from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";
import HospitalMapModal from "../../components/hospital/HospitalMapModal";

// Resolve photo URL — Railway returns relative /uploads/... paths
function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http"))  return url;
  const base = (import.meta.env.VITE_API_URL as string || "").replace(/\/api$/, "");
  return base ? `${base}${url}` : url;
}

export default function HospitalsPage() {
  const [search, setSearch] = useState("");
  const { navigate }        = useRouter();
  const { hospitals, doctors } = useStore();

  // Which hospital's map modal is open (null = none)
  const [mapHospital, setMapHospital] = useState<(typeof hospitals)[0] | null>(null);

  const filtered = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.area.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Map modal — renders on top of everything */}
      {mapHospital && (
        <HospitalMapModal
          hospital={{
            name:    mapHospital.name,
            area:    mapHospital.area,
            address: (mapHospital as any).address,
          }}
          onClose={() => setMapHospital(null)}
        />
      )}

      {/* Header + search */}
      <div className="bg-teal-50 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Find a Hospital</h1>
          <p className="text-gray-500 text-sm mt-1">
            Search and book appointments at top hospitals near you
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <Input
            className="pl-10 bg-white border-gray-200"
            placeholder="Search hospital or area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-ocid="hospitals.search_input"
          />
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400" data-ocid="hospitals.empty_state">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No hospitals found</p>
          <p className="text-sm">Try a different name or area</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((hospital, idx) => {
            const docCount  = doctors.filter((d) => d.hospitalId === hospital.id).length;
            const photoUrl  = resolvePhotoUrl(hospital.photoUrl);

            return (
              <motion.div
                key={hospital.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
                data-ocid={`hospitals.item.${idx + 1}`}
              >
                <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all text-left">

                  {/* ── Card photo / gradient area ── */}
                  {photoUrl ? (
                    <div
                      className="h-36 relative flex flex-col justify-between p-3 bg-cover bg-center cursor-pointer"
                      style={{ backgroundImage: `url(${photoUrl})` }}
                      onClick={() => navigate({ path: "/patient/hospital", id: hospital.id })}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                      {/* ── MAP BUTTON — top right corner ── */}
                      <div className="relative flex justify-end">
                        <button
                          type="button"
                          title="View on map"
                          onClick={e => {
                            e.stopPropagation();     // don't navigate to hospital page
                            setMapHospital(hospital);
                          }}
                          className="flex items-center gap-1.5 bg-white/90 hover:bg-white text-teal-600 text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-sm transition-all hover:scale-105"
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
                      {/* ── MAP BUTTON — top right corner (gradient card) ── */}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          title="View on map"
                          onClick={e => {
                            e.stopPropagation();
                            setMapHospital(hospital);
                          }}
                          className="flex items-center gap-1.5 bg-white/90 hover:bg-white text-teal-600 text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-sm transition-all hover:scale-105"
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

                  {/* ── Card footer ── */}
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
