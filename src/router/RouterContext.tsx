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
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const mode = params.get("mode");
  if (token && (!mode || mode === "reset")) {
    return { path: "/login", tab: "patient", patientMode: "login" };
  }
  return { path: "/" };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<Route[]>([getInitialRoute()]);
  const route = history[history.length - 1];
  const navigate = useCallback((r: Route) => {
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