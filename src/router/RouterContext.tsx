import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
type Route =
  | { path: "/" }
  | {
      path: "/login";
      tab?: "patient" | "doctor";
      patientMode?: "login" | "signup";
    }
  | { path: "/patient/hospitals"; city?: string }
  | { path: "/patient/hospital"; id: string }
  | { path: "/patient/tokens" }
  | { path: "/patient/prescriptions" }
  | { path: "/patient/track"; sessionId: string; tokenNumber: number }
  | { path: "/doctor" }
  | { path: "/admin" }
  | { path: "/admin/hospitals" }
  | { path: "/admin/doctors" }
  | { path: "/admin/patients" }
  | { path: "/admin/sessions" }
  | { path: "/admin/bookings" }
  | { path: "/admin/pharmacies" }
  | { path: "/hospital-admin/login" }
  | { path: "/hospital-admin" }
  | { path: "/hospital-admin/doctors" }
  | { path: "/hospital-admin/patients" }
  | { path: "/hospital-admin/pharmacy" }
  | { path: "/hospital-admin/inward" }
  | { path: "/pharmacy/login" }
  | { path: "/terms" }
  | { path: "/pharmacies" }
  | { path: "/pharmacy/detail"; id: string }
  | { path: "/pharmacy-owner/login" }
  | { path: "/pharmacy-owner/register" }
  | { path: "/pharmacy-owner/dashboard" };
interface RouterCtx {
  route: Route;
  navigate: (r: Route) => void;
  goBack: () => void;
}
const RouterContext = createContext<RouterCtx | null>(null);

function getInitialRoute(): Route {
  const { pathname, search } = window.location;
  const params = new URLSearchParams(search);
  const token = params.get("token");
  const mode = params.get("mode");
  const tab = params.get("tab") as "patient" | "doctor" | null;
  const patientMode = params.get("patientMode") as "login" | "signup" | null;
  const sessionId = params.get("sessionId") ?? "";
  const tokenNumber = Number.parseInt(params.get("tokenNumber") ?? "0", 10);
  const hospitalId = params.get("id") ?? "";
  const city = params.get("city") ?? undefined;

  if (token && (!mode || mode === "reset")) {
    return { path: "/login", tab: "patient", patientMode: "login" };
  }

  if (pathname === "/login") {
    return {
      path: "/login",
      tab: tab ?? "patient",
      patientMode:
        patientMode ?? "login",
    };
  }

  if (pathname === "/patient/hospitals") return { path: "/patient/hospitals", city };
  if (pathname === "/patient/hospital") return { path: "/patient/hospital", id: hospitalId };
  if (pathname === "/patient/tokens") return { path: "/patient/tokens" };
  if (pathname === "/patient/prescriptions") return { path: "/patient/prescriptions" };
  if (pathname === "/patient/track") {
    return {
      path: "/patient/track",
      sessionId,
      tokenNumber: Number.isFinite(tokenNumber) ? tokenNumber : 0,
    };
  }
  if (pathname === "/doctor") return { path: "/doctor" };
  if (pathname === "/admin") return { path: "/admin" };
  if (pathname === "/admin/hospitals") return { path: "/admin/hospitals" };
  if (pathname === "/admin/doctors") return { path: "/admin/doctors" };
  if (pathname === "/admin/patients") return { path: "/admin/patients" };
  if (pathname === "/admin/sessions") return { path: "/admin/sessions" };
  if (pathname === "/admin/bookings") return { path: "/admin/bookings" };
  if (pathname === "/admin/pharmacies") return { path: "/admin/pharmacies" };
  if (pathname === "/hospital-admin/login") return { path: "/hospital-admin/login" };
  if (pathname === "/hospital-admin/doctors") return { path: "/hospital-admin/doctors" };
  if (pathname === "/hospital-admin/patients") return { path: "/hospital-admin/patients" };
  if (pathname === "/hospital-admin/pharmacy") return { path: "/hospital-admin/pharmacy" };
  if (pathname === "/hospital-admin/inward") return { path: "/hospital-admin/inward" };
  if (pathname === "/hospital-admin") return { path: "/hospital-admin" };
  if (pathname === "/pharmacy/login") return { path: "/pharmacy/login" };
  if (pathname === "/terms") return { path: "/terms" };

  if (pathname === "/pharmacies") return { path: "/pharmacies" };
  if (pathname === "/pharmacy/detail") return { path: "/pharmacy/detail", id: hospitalId };
  if (pathname === "/pharmacy-owner/login") return { path: "/pharmacy-owner/login" };
  if (pathname === "/pharmacy-owner/register") return { path: "/pharmacy-owner/register" };
  if (pathname === "/pharmacy-owner/dashboard") return { path: "/pharmacy-owner/dashboard" };
  return { path: "/" };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<Route[]>([getInitialRoute()]);
  const route = history[history.length - 1];
  const navigate = useCallback((r: Route) => {
    // keep navigation in-memory only to avoid changing the browser pathname
    // (some hosting environments return 404 for direct pathname refreshes)
    setHistory((prev) => [...prev, r]);
  }, []);
  const goBack = useCallback(() => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);
  return (
    <RouterContext.Provider value={{ route, navigate, goBack }}>
      {children}
    </RouterContext.Provider>
  );
}
export function useRouter(): RouterCtx {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}
export type { Route };
