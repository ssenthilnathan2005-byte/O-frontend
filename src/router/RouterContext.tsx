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
  | { path: "/patient/hospitals" }
  | { path: "/patient/hospital"; id: string }
  | { path: "/patient/tokens" }
  | { path: "/patient/track"; sessionId: string; tokenNumber: number }
  | { path: "/doctor" }
  | { path: "/admin" }
  | { path: "/admin/hospitals" }
  | { path: "/admin/doctors" }
  | { path: "/admin/patients" }
  | { path: "/admin/sessions" }
  | { path: "/admin/bookings" }
  | { path: "/terms" };
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

  if (token && (!mode || mode === "reset")) {
    return { path: "/login", tab: "patient", patientMode: "login" };
  }

  if (pathname === "/login") {
    return {
      path: "/login",
      tab: tab ?? "patient",
      patientMode:
        patientMode ?? (tab === "doctor" ? "login" : "signup"),
    };
  }

  if (pathname === "/patient/hospitals") return { path: "/patient/hospitals" };
  if (pathname === "/patient/hospital") return { path: "/patient/hospital", id: hospitalId };
  if (pathname === "/patient/tokens") return { path: "/patient/tokens" };
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
  if (pathname === "/terms") return { path: "/terms" };

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