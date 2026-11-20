import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import {
  type Route,
  type TabBase,
  TAB_CONFIG,
  clearNext,
  homeRoute,
  isRole,
  loginUrlForPath,
  ownerOf,
  parseUrl,
  pathnameOf,
  toUrl,
} from "./routes";

// The address bar IS the router state. Every navigation writes a real URL with
// history.pushState; Back/Forward, refresh and pasted links all go through
// parseUrl(). There is no separate in-memory page stack any more.

interface RouterCtx {
  route: Route;
  navigate: (r: Route) => void;
  /** Open a path from a notification or link, e.g. "/labs/track?bookingId=1". */
  navigateUrl: (url: string) => void;
  replace: (r: Route) => void;
  /** Kept for existing callers: same as replace(). */
  reset: (r: Route) => void;
  resetToLogin: (role?: string) => void;
  goBack: () => void;
}
const RouterContext = createContext<RouterCtx | null>(null);

function readLocation(): Route {
  return parseUrl(window.location.pathname, window.location.search);
}

function storedRole(): string | null {
  try {
    if (!localStorage.getItem("db_jwt")) return null;
    return JSON.parse(localStorage.getItem("db_user") || "null")?.role ?? null;
  } catch {
    return null;
  }
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(readLocation);
  const routeRef = useRef(route);
  routeRef.current = route;
  // How many in-app pages sit behind the current one. 0 = first page of this visit.
  const depthRef = useRef(0);

  // First load: adopt the depth stored in history (survives refresh) and rewrite
  // legacy / unknown URLs (/doctor, /hospital-admin/doctors, /nonsense) to the
  // canonical address without adding a history entry.
  useEffect(() => {
    const st = window.history.state as { idx?: number } | null;
    depthRef.current = typeof st?.idx === "number" ? st.idx : 0;
    const canon = toUrl(routeRef.current);
    const keepQuery = routeRef.current.path === "/login" && /[?&]token=/.test(window.location.search);
    const target = keepQuery ? "/login" + window.location.search : canon;
    if (pathnameOf(target) !== window.location.pathname) {
      window.history.replaceState({ idx: depthRef.current }, "", target);
    } else if (typeof st?.idx !== "number") {
      window.history.replaceState({ ...(st ?? {}), idx: depthRef.current }, "");
    }
  }, []);

  const commit = useCallback((r: Route, mode: "push" | "replace") => {
    const url = toUrl(r);
    const current = window.location.pathname + window.location.search;
    if (mode === "push" && url !== current) {
      depthRef.current += 1;
      window.history.pushState({ idx: depthRef.current }, "", url);
    } else {
      window.history.replaceState({ idx: depthRef.current }, "", url);
    }
    setRoute(r);
  }, []);

  const navigate = useCallback((r: Route) => commit(r, "push"), [commit]);
  const replace = useCallback((r: Route) => commit(r, "replace"), [commit]);
  const reset = replace;

  const navigateUrl = useCallback(
    (url: string) => {
      try {
        const u = new URL(url, window.location.origin);
        if (u.origin !== window.location.origin) return; // never leave the app from a link
        commit(parseUrl(u.pathname, u.search), "push");
      } catch {
        /* ignore malformed links */
      }
    },
    [commit],
  );

  const resetToLogin = useCallback(
    (_role?: string) => {
      clearNext();
      commit({ path: "/login", tab: "patient", patientMode: "login" }, "replace");
    },
    [commit],
  );

  const goBack = useCallback(() => {
    if (depthRef.current > 0) {
      window.history.back();
      return;
    }
    // Opened straight on this page (link, refresh, new tab): there is no earlier
    // in-app page, so go to the right home instead of leaving the site.
    const role = storedRole();
    commit(isRole(role) ? homeRoute(role) : { path: "/" }, "replace");
  }, [commit]);

  // Browser Back / Forward / history.go(): the URL decides the page.
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const idx = (e.state as { idx?: number } | null)?.idx;
      if (typeof idx === "number") depthRef.current = idx;
      const next = readLocation();
      if (toUrl(next) !== toUrl(routeRef.current)) setRoute(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Back-forward cache: a frozen copy of a signed-in page can reappear after logout.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const cur = routeRef.current;
      if (isRole(ownerOf(cur)) && !storedRole()) {
        window.location.replace(loginUrlForPath(window.location.pathname, window.location.search));
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Hardware back button (Android app)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = CapApp.addListener("backButton", () => {
      if (depthRef.current > 0) window.history.back();
      else CapApp.exitApp();
    });
    return () => {
      handler.then((h) => h.remove());
    };
  }, []);

  const value = useMemo(
    () => ({ route, navigate, navigateUrl, replace, reset, resetToLogin, goBack }),
    [route, navigate, navigateUrl, replace, reset, resetToLogin, goBack],
  );
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterCtx {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}

/**
 * Binds the pages inside a role dashboard to the URL (doctor/profile, pharmacy/stock ...).
 *   const [tab, setTab] = useTabRoute("/doctor", { allowed, ready });
 * - tab:     the page to show (the dashboard's default when the URL says "dashboard")
 * - setTab:  opens another page; the address bar and Back button follow
 * - allowed: pages this user may open; a URL for any other page is replaced with the dashboard
 * - ready:   set false while permissions are still loading so a valid URL is not bounced early
 */
export function useTabRoute(
  base: TabBase,
  opts: { allowed?: readonly string[]; ready?: boolean } = {},
): readonly [string, (tab: string) => void] {
  const { route, navigate, replace } = useRouter();
  const def = TAB_CONFIG[base].default;
  const here = route.path === base;
  const requested = here ? (route as { tab?: string }).tab : undefined;
  const wanted = requested ?? def;
  const known = !opts.allowed || opts.allowed.includes(wanted);
  const ready = opts.ready !== false;

  useEffect(() => {
    if (here && requested !== undefined && ready && !known) replace({ path: base } as Route);
  }, [here, requested, ready, known, base, replace]);

  const setTab = useCallback(
    (t: string) => {
      if (t === wanted) return;
      navigate({ path: base, tab: t === def ? undefined : t } as Route);
    },
    [base, def, wanted, navigate],
  );
  return [known ? wanted : def, setTab] as const;
}

export type { Route };
