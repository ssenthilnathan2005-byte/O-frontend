import { useBodyScrollLock } from "../../lib/useBodyScrollLock";
import { ShieldCheck, HeartPulse, Activity, BarChart3, ChevronDown, ShoppingCart, Fingerprint, BedDouble, Building2, ClipboardList, FlaskConical, LayoutDashboard, LogOut, Menu, Package, Pill, Receipt, Stethoscope, UserCog, Users2, Users, X, Settings2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import useAdminSession from "../../hooks/useAdminSession";
import { useRouter } from "../../router/RouterContext";
import HADashboard from "./HADashboard";
import HADoctors from "./HADoctors";
import HAPatients from "./HAPatients";
import HAAllPatients from "./HAAllPatients";
import HAPharmacy from "./HAPharmacy";
import HAInward from "./HAInward";
import HAWards from "./HAWards";
import HAHR from "./HAHR";
import HANurses from "./HANurses";
import HAFrontOfficeStaff from "./HAFrontOfficeStaff";
import HospitalFunctioning from "./HospitalFunctioning";
import HAFrontDeskCollections from "./HAFrontDeskCollections";
import HAInventory from "./HAInventory";
import HALab from "./HALab";
import HAAttendance from "./HAAttendance";
import HABilling from "./HABilling";
import HAPermissions from "./HAPermissions";
import HAPasswordManagement from "./HAPasswordManagement";
import HAActivity, { useActivityUnread } from "./HAActivity";
import GstInvoice from "./GstInvoice";
import useModules from "../../hooks/useModules";
import { PharmRevenue, PharmInventory, PharmPatients, PharmSold, PharmStockUpdate, usePharmacySocket } from "./PharmacyModule";

const NAV_ITEMS = [
  { path: "/admin/functioning", label: "Hospital Functioning", icon: Settings2 },
  { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/activity", label: "Activity Monitor", icon: Activity },
  { path: "/admin/billing", label: "Revenue", icon: Receipt },
  { path: "/admin/all-patients", label: "All Patients", icon: Users },
  { path: "/admin/attendance", label: "Attendance", icon: Fingerprint },
  { path: "/admin/wards", label: "Beds & Wards", icon: Stethoscope },
  { path: "/admin/doctors", label: "Doctors", icon: UserCog },
  { path: "/admin/front-desk", label: "Front Desk", icon: ClipboardList },
  { path: "/admin/hr", label: "HR / Staff", icon: ClipboardList },
  { path: "/admin/inventory", label: "Inventory", icon: Package },
  { path: "/admin/ipd", label: "IPD / Inward", icon: BedDouble },
  { path: "/admin/lab", label: "Laboratory", icon: FlaskConical },
  { path: "/admin/patients", label: "Live Patients", icon: Users2 },
  { path: "/admin/nurses", label: "Nurses", icon: HeartPulse },
  { path: "/admin/permissions", label: "Permissions", icon: ShieldCheck },
  { path: "/admin/passwords", label: "Password Management", icon: KeyRound },
  { path: "/admin/pharmacy", label: "Pharmacy", icon: Pill },
] as const;

const NAV_MODULE: Record<string, string | undefined> = {
  "/admin/wards": "wards",
  "/admin/ipd": "ipd",
  "/admin/inventory": "inventory",
  "/admin/lab": "lab",
  "/admin/nurses": "nursing",
  "/admin/pharmacy": "pharmacy",
};

const PHARMACY_SUB = [
  { path: "/admin/pharmacy/inventory", label: "Inventory Management", icon: Package },
  { path: "/admin/pharmacy/patients", label: "Patient Purchases", icon: Users },
  { path: "/admin/pharmacy/sold", label: "Sales History", icon: ShoppingCart },
  { path: "/admin/pharmacy/gst", label: "GST Invoice", icon: Receipt },
  { path: "/admin/pharmacy/stock", label: "Stock Update", icon: ClipboardList },
  { path: "/admin/pharmacy", label: "Staff & Setup", icon: UserCog },
] as const;

function PharmacyMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { route, navigate } = useRouter();
  const inPharmacy = route.path.startsWith("/admin/pharmacy");
  const [open, setOpen] = useState(inPharmacy);
  useEffect(() => { if (inPharmacy) setOpen(true); }, [inPharmacy]);
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors " + (inPharmacy ? "text-white" : "text-white/60 hover:bg-white/8 hover:text-white/90")}>
        <Pill className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">Pharmacy</span>
        <ChevronDown className={"w-4 h-4 shrink-0 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="mt-1 ml-4 pl-2 border-l border-white/10 space-y-1">
          {PHARMACY_SUB.map(({ path, label, icon: Icon }) => {
            const active = route.path === path;
            return (
              <button key={path} type="button"
                onClick={() => { navigate({ path } as Parameters<typeof navigate>[0]); onNavigate?.(); }}
                className={"w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors " + (active ? "bg-white/15 text-white border-l-2 border-teal-400" : "text-white/60 hover:bg-white/8 hover:text-white/90")}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-left leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HospitalAdminPanel() {
  const { user, logout } = useStore();
  const { has } = useModules();
  useAdminSession(logout);
  const { route, navigate } = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useBodyScrollLock(drawerOpen);
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => { html.style.overflow = prevHtml; body.style.overflow = prevBody; };
  }, []);
  usePharmacySocket(user && user.role === "hospital_admin" ? user.hospitalId : "");
  const activityUnread = useActivityUnread();

  const hospitalName = user && user.role === "hospital_admin" ? user.hospitalName : "Hospital Admin";

  function renderContent() {
    const need = route.path.startsWith("/admin/pharmacy") ? "pharmacy" : NAV_MODULE[route.path];
    if (!has(need)) return <div className="p-6 text-sm text-gray-500">This module is not enabled for your hospital type.</div>;
    if (route.path === "/admin/ipd") return <HAInward />;
    if (route.path === "/admin/patients") return <HAPatients />;
    if (route.path === "/admin/all-patients") return <HAAllPatients />;
    if (route.path === "/admin/pharmacy/revenue") return <PharmRevenue />;
    if (route.path === "/admin/pharmacy/inventory") return <PharmInventory iconActions />;
    if (route.path === "/admin/pharmacy/patients") return <PharmPatients />;
    if (route.path === "/admin/pharmacy/sold") return <PharmSold />;
    if (route.path === "/admin/pharmacy/gst") return <GstInvoice />;
    if (route.path === "/admin/pharmacy/stock") return <PharmStockUpdate />;
    if (route.path === "/admin/pharmacy") return <HAPharmacy />;
    if (route.path === "/admin/doctors") return <HADoctors />;
    if (route.path === "/admin/lab") return <HALab />;
    if (route.path === "/admin/wards") return <HAWards />;
    if (route.path === "/admin/inventory") return <HAInventory />;
    if (route.path === "/admin/hr") return <HAHR />;
    if (route.path === "/admin/nurses") return <HANurses />;
    if (route.path === "/admin/front-desk") return <div className="w-full space-y-4 p-4 md:p-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><ClipboardList className="h-5 w-5" /></div><div><h1 className="text-xl font-bold text-gray-900">Front Desk</h1><p className="text-sm text-gray-500">Daily fee collections and front office logins.</p></div></div><HAFrontDeskCollections /><HAFrontOfficeStaff /></div>;
    if (route.path === "/admin/attendance") return <HAAttendance />;
    if (route.path === "/admin/billing") return <HABilling />;
    if (route.path === "/admin/permissions") return <HAPermissions />;
    if (route.path === "/admin/passwords") return <HAPasswordManagement />;
    if (route.path === "/admin/activity") return <HAActivity />;
    if (route.path === "/admin/functioning") return <HospitalFunctioning />;
    return <HADashboard />;
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 h-full overflow-hidden bg-admin-sidebar text-admin-sidebar-fg flex-col shrink-0">
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

        <nav className="violet-scroll-dark flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-1">
          {NAV_ITEMS.filter((n) => has(NAV_MODULE[n.path])).map(({ path, label, icon: Icon }) => {
            if (path === "/admin/pharmacy") return <PharmacyMenu key={path} />;
            const isActive = route.path === path || (route.path === "/admin/dashboard" && path === "/admin/dashboard");
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate({ path } as Parameters<typeof navigate>[0])}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-white/15 text-white border-l-2 border-teal-400" : "text-white/60 hover:bg-white/8 hover:text-white/90"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {path === "/admin/activity" && activityUnread > 0 && (<span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{activityUnread > 99 ? "99+" : activityUnread}</span>)}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pt-4 pb-6 border-t border-white/10 shrink-0">
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-admin-sidebar text-white flex items-center justify-between px-4 py-3 border-b border-white/10">
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
            className="lg:hidden fixed inset-0 z-50 bg-black/50 cursor-default"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 w-72 z-50 bg-admin-sidebar flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Building2 className="w-6 h-6 text-white shrink-0" />
                <p className="font-bold text-white text-sm truncate">{hospitalName}</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <nav className="violet-scroll-dark flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3 py-4 space-y-1">
              {NAV_ITEMS.filter((n) => has(NAV_MODULE[n.path])).map(({ path, label, icon: Icon }) => path === "/admin/pharmacy" ? <PharmacyMenu key={path} onNavigate={() => setDrawerOpen(false)} /> : (
                <button
                  key={path}
                  type="button"
                  onClick={() => { navigate({ path } as Parameters<typeof navigate>[0]); setDrawerOpen(false); }}
                  className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors " + (route.path === path ? "bg-white/15 text-white border-l-2 border-teal-400" : "text-white/70 hover:bg-white/10 hover:text-white")}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                  {path === "/admin/activity" && activityUnread > 0 && (<span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{activityUnread > 99 ? "99+" : activityUnread}</span>)}
                </button>
              ))}
            </nav>
            <div className="px-3 pt-4 pb-6 border-t border-white/10 shrink-0">
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

      <main className="violet-scroll flex-1 min-w-0 h-full overflow-y-auto overscroll-contain lg:pt-0 pt-14"><div className="mx-auto w-full max-w-[1760px]">{renderContent()}</div></main>
    </div>
  );
}
