import { Input } from "@/components/ui/input";
import { ChevronLeft, MapPin, Search, Users, Navigation, Loader2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Fragment, useState } from "react";
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

function norm(s: string | null | undefined): string { return (s || "").trim().toLowerCase(); }

const TYPE_LABELS: Record<string, string> = { general: "General Hospital", eye: "Eye Hospital", ent: "ENT Hospital", dental: "Dental Clinic", pediatrics: "Children's Hospital", gynecology: "Women's Hospital", orthopedics: "Orthopedic Hospital", dermatology: "Skin Clinic", cardiology: "Heart Hospital", diabetology: "Diabetes Centre", clinic: "Clinic" };
const typeOf = (h: any): string => h?.hospitalType || "general";

export default function HospitalsPage({ city, q }: { city?: string; q?: string }) {
  const [search, setSearch] = useState(q ?? "");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { navigate, goBack } = useRouter();
  const { hospitals, doctors } = useStore();
  const [mapHospital, setMapHospital] = useState<(typeof hospitals)[0] | null>(null);

  const { state: nearState, locate, clear, sorted: sortedByDistance } = useNearMe(hospitals);

  const baseList = sortedByDistance ?? hospitals;
  const cityScoped0 = city ? baseList.filter((h) => norm(h.area) === norm(city)) : baseList;
  const typeList = Array.from(new Set(cityScoped0.map((h) => typeOf(h))));
  const cityScoped = typeFilter === "all" ? cityScoped0 : cityScoped0.filter((h) => typeOf(h) === typeFilter);

  const filtered = cityScoped.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.area.toLowerCase().includes(search.toLowerCase()),
  );

  const isNearMeActive = nearState.status === "done";

  const keyOf = (h: { area: string }) => norm(h.area) || "other";
  const groupLabel = new Map<string, string>();
  const groupCount = new Map<string, number>();
  for (const h of filtered) {
    const k = keyOf(h);
    if (!groupLabel.has(k)) groupLabel.set(k, (h.area || "").trim() || "Other");
    groupCount.set(k, (groupCount.get(k) ?? 0) + 1);
  }
  const ordered = isNearMeActive
    ? filtered
    : [...filtered].sort((x, y) => (groupLabel.get(keyOf(x)) as string).localeCompare(groupLabel.get(keyOf(y)) as string));

  return (
    <div className="max-w-7xl mx-auto px-4 pt-4 pb-28 md:pb-8">

      {mapHospital && (
        <HospitalMapModal
          hospital={{ name: mapHospital.name, area: mapHospital.area, address: (mapHospital as any).address }}
          onClose={() => setMapHospital(null)}
        />
      )}

      {/* Header band (matches the patient home page) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-100 border border-teal-100 px-4 pt-4 pb-5 text-gray-900 shadow-sm">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-teal-300/30 pointer-events-none" />
        <button type="button" onClick={goBack} className="relative flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-900 transition-colors -ml-1 mb-3" data-ocid="hospitals.back_button">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="relative text-2xl font-extrabold leading-tight">
          {city ? `Hospitals in ${city}` : "Find a Hospital"}
        </h1>
        <p className="relative text-sm text-teal-700 mt-1">
          {isNearMeActive
            ? "Showing hospitals within 20 km of your location"
            : city
            ? `${cityScoped.length} hospital${cityScoped.length === 1 ? "" : "s"} available for booking`
            : "Search and book appointments at top hospitals near you"}
        </p>

        <div className="relative flex gap-2 mt-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input className="h-11 pl-10 pr-9 rounded-xl bg-white border border-teal-100 text-base text-gray-900 shadow-md placeholder:text-gray-400" placeholder="Search hospital or area..." value={search} onChange={(e) => setSearch(e.target.value)} data-ocid="hospitals.search_input" />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {isNearMeActive ? (
            <button type="button" onClick={clear} className="shrink-0 h-11 flex items-center justify-center gap-1.5 px-3.5 rounded-xl bg-white text-teal-800 text-sm font-semibold shadow-md active:scale-95 transition-transform whitespace-nowrap" data-ocid="hospitals.near_me_clear">
              <XCircle className="w-4 h-4" />
              <span className="sm:hidden">Clear</span>
              <span className="hidden sm:inline">Clear Near Me</span>
            </button>
          ) : (
            <button type="button" onClick={locate} disabled={nearState.status === "loading"} className="shrink-0 h-11 flex items-center justify-center gap-1.5 px-3.5 rounded-xl bg-white border border-teal-200 text-teal-800 text-sm font-semibold hover:bg-teal-50 active:scale-95 transition-all whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed" data-ocid="hospitals.near_me_button">
              {nearState.status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              <span className="sm:hidden">{nearState.status === "loading" ? "Locating…" : "Near me"}</span>
              <span className="hidden sm:inline">{nearState.status === "loading" ? "Locating…" : "Hospitals Near Me"}</span>
            </button>
          )}
        </div>

        <AnimatePresence>
          {nearState.status === "denied" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="relative mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              Location access was denied. Please allow location in your browser and try again.
            </motion.div>
          )}
          {nearState.status === "unsupported" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="relative mt-3 px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700 flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              Your browser doesn't support location. Try Chrome or Safari.
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
          <div className="mt-5">
            <h2 className="text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">Available Cities</h2>
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {cityList.map((c) => {
                const active = norm(search) === norm(c);
                return (
                  <button key={c} type="button" onClick={() => navigate({ path: "/patient/hospitals", city: c })} className={"shrink-0 flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-full border transition-colors " + (active ? "bg-teal-700 text-white border-teal-700" : "bg-white text-gray-700 border-gray-200 hover:border-teal-300")} data-ocid={`hospitals.city_chip.${c}`}>
                    <MapPin className={"w-3.5 h-3.5 " + (active ? "text-teal-100" : "text-gray-400")} />
                    {c}
                    <span className={"text-xs " + (active ? "text-teal-100" : "text-gray-400")}>{cityCounts.get(c)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {typeList.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {["all", ...typeList].map((tp) => (
            <button key={tp} type="button" onClick={() => setTypeFilter(tp)} className={"shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors " + (typeFilter === tp ? "bg-teal-700 text-white border-teal-700" : "bg-white text-gray-600 border-gray-200")}>
              {tp === "all" ? "All" : TYPE_LABELS[tp] || tp}
            </button>
          ))}
        </div>
      )}

      <p className="mt-5 mb-3 text-sm text-gray-500" aria-live="polite">
        <span className="font-semibold text-gray-800">{filtered.length}</span> hospital{filtered.length === 1 ? "" : "s"} found{search.trim() ? ` for "${search.trim()}"` : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400" data-ocid="hospitals.empty_state">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No hospitals found</p>
          <p className="text-sm">
            {isNearMeActive ? "No hospitals found within 20 km of your location" : city ? "No hospitals are currently available in this area. Try a nearby city or search by name." : "Try a different name or area"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ordered.map((hospital, idx) => {
            const docCount = doctors.filter((d) => d.hospitalId === hospital.id).length;
            const photoUrl = resolvePhotoUrl(hospital.photoUrl);
            const distKm = (hospital as any).distanceKm as number | null | undefined;
            const showHead = !isNearMeActive && (idx === 0 || keyOf(ordered[idx - 1]) !== keyOf(hospital));
            const openHospital = () => navigate({ path: "/patient/hospital", id: hospital.id });

            return (
              <Fragment key={hospital.id}>
                {showHead && (
                  <div className="col-span-full flex items-center gap-2 pt-1">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    <h2 className="text-base font-semibold text-gray-800">{groupLabel.get(keyOf(hospital))}</h2>
                    <span className="text-xs text-gray-400">({groupCount.get(keyOf(hospital))})</span>
                  </div>
                )}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx, 8) * 0.04 }} data-ocid={`hospitals.item.${idx + 1}`}>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 hover:shadow-md transition-shadow">
                    <div className="flex gap-3 cursor-pointer" onClick={openHospital}>
                      {photoUrl ? (
                        <div className="w-20 h-20 shrink-0 rounded-xl bg-cover bg-center border border-gray-100" style={{ backgroundImage: `url(${photoUrl})` }} />
                      ) : (
                        <div className={`w-20 h-20 shrink-0 rounded-xl bg-gradient-to-br ${hospital.gradient} flex items-center justify-center text-white text-2xl font-bold`}>
                          {(hospital.name || "H").trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-[15px] leading-snug truncate">{hospital.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{hospital.area}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="flex items-center gap-1 bg-teal-50 text-teal-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            <Users className="w-3 h-3" />
                            {docCount} Doctors
                          </span>
                          {typeOf(hospital) !== "general" && (
                            <span className="bg-gray-100 text-gray-600 text-[11px] font-medium px-2 py-0.5 rounded-full">{TYPE_LABELS[typeOf(hospital)] || typeOf(hospital)}</span>
                          )}
                          {isNearMeActive && (
                            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${distKm != null ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                              <Navigation className="w-3 h-3" />
                              {distKm != null ? formatDistance(distKm) : "No GPS"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button type="button" title="View on map" onClick={(e) => { e.stopPropagation(); setMapHospital(hospital); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-teal-200 text-teal-700 text-sm font-semibold py-2 hover:bg-teal-50 active:scale-[0.98] transition-all">
                        <MapPin className="w-4 h-4" />
                        Map
                      </button>
                      <button type="button" onClick={openHospital} className="flex-1 rounded-xl bg-teal-700 text-white text-sm font-semibold py-2 hover:bg-teal-800 active:scale-[0.98] transition-all">
                        View doctors
                      </button>
                    </div>
                  </div>
                </motion.div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
