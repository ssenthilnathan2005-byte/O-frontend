import { HeartPulse, LogOut, Building2, User } from "lucide-react";
import { useStore } from "../context/StoreContext";

export default function NurseDashboard() {
  const { user, logout } = useStore();
  const u = user as any;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Nurse Dashboard</p>
            <p className="text-xs text-gray-500">{u?.hospitalName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, {u?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <User className="w-5 h-5 text-teal-600" />
            <div>
              <p className="text-xs text-gray-500">Nurse ID</p>
              <p className="font-mono font-semibold text-gray-900">{u?.code}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <Building2 className="w-5 h-5 text-teal-600" />
            <div>
              <p className="text-xs text-gray-500">Hospital</p>
              <p className="font-semibold text-gray-900">{u?.hospitalName}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
          Nursing tools for your hospital will appear here.
        </div>
      </main>
    </div>
  );
}