import { useEffect, useState } from "react";
import { Search, MapPin, Phone, Star, ChevronRight, Loader2, FlaskConical } from "lucide-react";
import * as api from "../../api";
import { useRouter } from "../../router/RouterContext";

export default function LabsPage() {
  const { navigate } = useRouter();
  const [labsList, setLabsList] = useState<api.Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.labs.list()
      .then(setLabsList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = labsList.filter((lab) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return lab.name.toLowerCase().includes(q) || lab.area.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-4 pb-6">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-teal-500" />
          Lab Tests
        </h1>
        <p className="text-sm text-gray-500 mt-1">Book a diagnostic test with home sample collection or walk-in</p>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search labs by name or area..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-sm">Loading labs...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <FlaskConical className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No labs found{search ? ` for "${search}"` : ""}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lab) => (
            <button
              key={lab.id}
              type="button"
              onClick={() => navigate({ path: "/labs/detail", id: lab.id })}
              className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left hover:border-teal-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-6 h-6 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-gray-900 text-sm truncate">{lab.name}</p>
                    <div className="flex items-center gap-1 text-xs text-amber-500 shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {lab.rating.toFixed(1)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{lab.area}</span>
                  </div>
                  {lab.phone && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      {lab.phone}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 self-center" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
