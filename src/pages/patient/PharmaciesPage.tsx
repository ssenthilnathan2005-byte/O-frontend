import { useEffect, useState } from "react";
import { Search, MapPin, Phone, Clock, ChevronRight, Loader2, Pill } from "lucide-react";
import * as api from "../../api";
import { useRouter } from "../../router/RouterContext";
import TopNav from "../../components/layout/TopNav";

export default function PharmaciesPage() {
  const { navigate } = useRouter();
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.pharmacies.list().then(setPharmacies).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = pharmacies.filter(p =>
    [p.name, p.area, p.description].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Pharmacies</h1>
          <p className="text-sm text-gray-500">Find pharmacies near you and get in touch</p>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or area…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>
        ) : pharmacies.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Pill className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No pharmacies listed yet</p>
            <p className="text-xs mt-1">Check back soon — pharmacies are being added</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Pill className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No pharmacies match your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => (
              <button key={p.id} type="button" onClick={() => navigate({ path: "/pharmacy/detail", id: p.id })}
                className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:border-teal-300 hover:shadow-md transition-all flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                    <Pill className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <MapPin className="w-3 h-3" />{p.area || "—"}
                    </div>
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
