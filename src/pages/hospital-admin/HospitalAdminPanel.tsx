import { BedDouble, Building2, LayoutDashboard, LogOut, Menu, UserCog, Users2, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";
import HADashboard from "./HADashboard";
import HADoctors from "./HADoctors";
import HAPatients from "./HAPatients";
import HAPharmacy from "./HAPharmacy";
import HAInward from "./HAInward";

const NAV_ITEMS = [
  { path: "/hospital-admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/hospital-admin/doctors", label: "Doctors", icon: UserCog },
  { path: "/hospital-admin/patients", label: "Live Patients", icon: Users2 },
  { path: "/hospital-admin/pharmacy", label: "Pharmacy", icon: Building2 },
  { path: "/hospital-admin/inward", label: "Inward", icon: BedDouble },
] as const;

export default function HospitalAdminPanel() {
  const { user, logout } = useStore();
  const { route, navigate } = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hospitalName = user && user.role === "hospital_admin" ? user.hospitalName : "Hospital Admin";

  function renderContent() {
    if (route.path === "/hospital-admin/inward") return <HAInward />;
    if (route.path === "/hospital-admin/patients") return <HAPatients />;
    if (route.path === "/hospital-admin/pharmacy") return <HAPharmacy />;
    if (route.path === "/hospital-admin/doctors") return <HADoctors />;
    return <HADashboard />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-admin-sidebar text-admin-sidebar-fg flex-col shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm truncate">{hospitalName}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">
                Hospital Console
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = route.path === path || (route.path === "/hospital-admin" && path === "/hospital-admin");
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate({ path } as Parameters<typeof navigate>[0])}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/8 hover:text-white/90"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-admin-sidebar text-white flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-5 h-5 shrink-0" />
          <span className="font-bold text-sm truncate">{hospitalName}</span>
        </div>
        <button type="button" onClick={() => setDrawerOpen(true)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Drawer */}
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
                <Building2 className="w-6 h-6 text-white shrink-0" />
                <p className="font-bold text-white text-sm truncate">{hospitalName}</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => { navigate({ path } as Parameters<typeof navigate>[0]); setDrawerOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-white/10">
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </>
      )}

      <main className="flex-1 md:pt-0 pt-14">{renderContent()}</main>
    </div>
  );
}
