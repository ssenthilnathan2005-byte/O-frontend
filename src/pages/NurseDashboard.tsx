import { useState } from "react";
import { HeartPulse, LogOut, Building2, User, LayoutDashboard, Stethoscope, Menu, X } from "lucide-react";
import { useStore } from "../context/StoreContext";
import NurseWards from "./nurse/NurseWards";

type Tab = "dashboard" | "wards";

const NAV: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "wards", label: "Beds & Wards", icon: Stethoscope },
];

export default function NurseDashboard() {
  const { user, logout } = useStore();
  const u = user as any;
  const [tab, setTab] = useState<Tab>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hospitalName = u?.hospitalName || "Hospital";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  function go(t: Tab) {
    setTab(t);
    setDrawerOpen(false);
  }

  const navButtons = NAV.map(({ key, label, icon: Icon }) => (
    <button
      key={key}
      type="button"
      onClick={() => go(key)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        tab === key ? "bg-white/15 text-white border-l-2 border-teal-400" : "text-white/60 hover:bg-white/8 hover:text-white/90"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  ));

  const logoutButton = (
    <button
      type="button"
      onClick={logout}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white transition-colors"
    >
      <LogOut className="w-4 h-4" />
      Logout
    </button>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-admin-sidebar text-admin-sidebar-fg flex-col shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm truncate">{hospitalName}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">Nurse Console</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">{navButtons}</nav>
        <div className="px-3 py-4 border-t border-white/10">{logoutButton}</div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-admin-sidebar text-white flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <HeartPulse className="w-5 h-5 shrink-0" />
          <span className="font-bold text-sm truncate">{hospitalName}</span>
        </div>
        <button type="button" onClick={() => setDrawerOpen(true)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 z-50 bg-black/50 cursor-default"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="md:hidden fixed left-0 top-0 bottom-0 w-72 z-50 bg-admin-sidebar flex flex-col">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <HeartPulse className="w-6 h-6 text-white shrink-0" />
                <p className="font-bold text-white text-sm truncate">{hospitalName}</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">{navButtons}</nav>
            <div className="px-3 py-4 border-t border-white/10">{logoutButton}</div>
          </div>
        </>
      )}

      <main className="flex-1 min-w-0 md:pt-0 pt-14">
        {tab === "wards" ? (
          <NurseWards />
        ) : (
          <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{greeting}, {u?.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
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
            <button
              type="button"
              onClick={() => go("wards")}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
            >
              <Stethoscope className="w-5 h-5 text-teal-600" />
              <div>
                <p className="font-semibold text-gray-900">Beds & Wards</p>
                <p className="text-xs text-gray-500">View beds, admit or discharge patients, and manage cleaning</p>
              </div>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}