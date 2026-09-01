import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
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
  | { path: "/admin/ambulance" }
  | { path: "/hospital-admin/login" }
  | { path: "/hospital-admin" }
  | { path: "/hospital-admin/doctors" }
  | { path: "/hospital-admin/patients" }
  | { path: "/hospital-admin/pharmacy" }
  | { path: "/hospital-admin/inward" }
  | { path: "/pharmacy/login" }
  | { path: "/terms" }
  | { path: "/privacy" }
  | { path: "/pharmacies" }
  | { path: "/pharmacy/detail"; id: string }
  | { path: "/pharmacy-owner/login" }
  | { path: "/pharmacy-owner/register" }
  | { path: "/pharmacy-owner/dashboard" }
  | { path: "/ambulance" };
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
  if (pathname === "/admin/ambulance") return { path: "/admin/ambulance" };
  if (pathname === "/hospital-admin/login") return { path: "/hospital-admin/login" };
  if (pathname === "/hospital-admin/doctors") return { path: "/hospital-admin/doctors" };
  if (pathname === "/hospital-admin/patients") return { path: "/hospital-admin/patients" };
  if (pathname === "/hospital-admin/pharmacy") return { path: "/hospital-admin/pharmacy" };
  if (pathname === "/hospital-admin/inward") return { path: "/hospital-admin/inward" };
  if (pathname === "/hospital-admin") return { path: "/hospital-admin" };
  if (pathname === "/pharmacy/login") return { path: "/pharmacy/login" };
  if (pathname === "/terms") return { path: "/terms" };
  if (pathname === "/privacy") return { path: "/privacy" };

  if (pathname === "/pharmacies") return { path: "/pharmacies" };
  if (pathname === "/pharmacy/detail") return { path: "/pharmacy/detail", id: hospitalId };
  if (pathname === "/pharmacy-owner/login") return { path: "/pharmacy-owner/login" };
  if (pathname === "/pharmacy-owner/register") return { path: "/pharmacy-owner/register" };
  if (pathname === "/pharmacy-owner/dashboard") return { path: "/pharmacy-owner/dashboard" };
  if (pathname === "/ambulance") return { path: "/ambulance" };
  return { path: "/" };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  // full in-app navigation stack (used for rendering)
  const [history, setHistory] = useState<Route[]>([getInitialRoute()]);
  const route = history[history.length - 1];

  // keep a ref in sync so the popstate handler always reads the latest stack
  const historyRef = useRef(history);
  historyRef.current = history;

  // On first mount, seed the browser's real history entry with our stack so
  // that popstate events (from the hardware/browser back button) have
  // something to compare against.
  useEffect(() => {
    window.history.replaceState({ stack: history }, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useCallback((r: Route) => {
    setHistory((prev) => {
      const next = [...prev, r];
      // Push a REAL browser/webview history entry (same pathname, so hosts
      // that 404 on a direct pathname refresh are unaffected) carrying our
      // in-app stack in its state. This is what makes the hardware/browser
      // back button step back through in-app pages instead of leaving the
      // site immediately.
      window.history.pushState({ stack: next }, "");
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    // Delegate to the browser's own back navigation. This fires a
    // popstate event, which the listener below uses to update our
    // in-app stack — so both the on-screen "back" buttons and the
    // phone's hardware back button go through the same code path and
    // stay in sync.
    if (historyRef.current.length > 1) {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const stack = (e.state as { stack?: Route[] } | null)?.stack;
      if (stack && stack.length > 0) {
        setHistory(stack);
      }
      // If there's no stack in state (user has backed out past everything
      // we pushed), we simply do nothing here and let the browser itself
      // navigate away/exit — which is the correct, expected behavior once
      // the in-app stack is exhausted.
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Hardware back button — native app only
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = CapApp.addListener("backButton", () => {
      if (historyRef.current.length > 1) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });
    return () => { handler.then(h => h.remove()); };
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
