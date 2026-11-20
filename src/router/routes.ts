// ─────────────────────────────────────────────────────────────────────────────
// DoctorBooked URL routing: the ONE place that knows how URLs and pages relate.
//
//   parseUrl()      browser URL      -> Route   (refresh, direct links, Back/Forward)
//   toUrl()         Route            -> URL     (every navigate()/replace())
//   resolveAccess() Route + role     -> allowed, or where to send the user instead
//
// Pure TypeScript (no React, no DOM, only erasable syntax) so it can be tested
// with plain Node:  node scripts/check-routes.mjs
// ─────────────────────────────────────────────────────────────────────────────

export type Role =
  | "patient"
  | "doctor"
  | "admin" // platform owner / super admin
  | "hospital_admin"
  | "pharmacy"
  | "front_office"
  | "nurse"
  | "hospital_lab"
  | "lab_admin"
  | "pharmacy_owner";

export const ROLES: readonly Role[] = [
  "patient", "doctor", "admin", "hospital_admin", "pharmacy",
  "front_office", "nurse", "hospital_lab", "lab_admin", "pharmacy_owner",
];

export function isRole(x: unknown): x is Role {
  return typeof x === "string" && (ROLES as readonly string[]).includes(x);
}

// ── Role dashboards that have several pages (tabs) inside them ───────────────
// URL = <base>/<slug>.  The default page uses the slug "dashboard", so the
// documented entry points are /doctor/dashboard, /pharmacy/dashboard,
// /front-office/dashboard ... and other pages are /doctor/profile, etc.
export type TabBase =
  | "/doctor"
  | "/pharmacy"
  | "/front-office"
  | "/nurse"
  | "/hospital-lab"
  | "/lab-admin"
  | "/pharmacy-owner";

// tab key (what the dashboard uses internally) -> URL slug
export const TAB_CONFIG: Record<TabBase, { default: string; slugs: Record<string, string> }> = {
  "/doctor": {
    default: "regulator",
    slugs: {
      regulator: "dashboard", livetokens: "live-tokens", profile: "profile",
      followups: "follow-ups", presets: "presets", nurse: "nurse", staff: "staff",
    },
  },
  "/pharmacy": {
    default: "rx",
    slugs: {
      rx: "dashboard", revenue: "revenue", inventory: "inventory",
      patients: "patients", sold: "sales", gst: "gst", stock: "stock",
    },
  },
  "/front-office": {
    default: "op",
    slugs: { op: "dashboard", walkin: "register-patient", admit: "admit-inpatient", beds: "bed-requests" },
  },
  "/nurse": { default: "dashboard", slugs: { dashboard: "dashboard", wards: "wards" } },
  "/hospital-lab": {
    default: "board",
    slugs: { board: "dashboard", orders: "bookings", inpatients: "inpatients" },
  },
  "/lab-admin": { default: "tokens", slugs: { tokens: "dashboard", bookings: "bookings", tests: "tests" } },
  "/pharmacy-owner": { default: "profile", slugs: { profile: "dashboard", enquiries: "enquiries" } },
};

const TAB_BASES = Object.keys(TAB_CONFIG) as TabBase[];

// Optional "extra" pages a role can be granted by the hospital (key "x:<module>").
// URL slug: x-<module with _ -> ->   e.g. "x:live_patients" <-> "x-live-patients"
export function tabToSlug(base: TabBase, tab: string | undefined): string {
  if (!tab || tab === TAB_CONFIG[base].default) return "dashboard";
  if (tab.startsWith("x:")) return "x-" + tab.slice(2).replace(/_/g, "-");
  const s = TAB_CONFIG[base].slugs[tab];
  return s ?? tab.replace(/[^a-zA-Z0-9-]/g, "-");
}

// Returns undefined for the default page. An unknown slug is returned as-is so
// that the dashboard can reject it (it knows which tabs this user may open).
export function slugToTab(base: TabBase, slug: string): string | undefined {
  const s = slug.toLowerCase();
  if (s === "dashboard") return undefined;
  if (s.startsWith("x-")) return "x:" + s.slice(2).replace(/-/g, "_");
  for (const [tab, sl] of Object.entries(TAB_CONFIG[base].slugs)) {
    if (sl === s) return tab === TAB_CONFIG[base].default ? undefined : tab;
  }
  return s;
}

// ── Hospital admin area: /admin/*   (role "hospital_admin") ──────────────────
export const HOSPITAL_ADMIN_PATHS = [
  "/admin/dashboard",
  "/admin/functioning",
  "/admin/billing",
  "/admin/all-patients",
  "/admin/attendance",
  "/admin/wards",
  "/admin/doctors",
  "/admin/front-desk",
  "/admin/hr",
  "/admin/inventory",
  "/admin/ipd",
  "/admin/lab",
  "/admin/patients",
  "/admin/nurses",
  "/admin/permissions",
  "/admin/passwords",
  "/admin/pharmacy",
  "/admin/pharmacy/revenue",
  "/admin/pharmacy/inventory",
  "/admin/pharmacy/patients",
  "/admin/pharmacy/sold",
  "/admin/pharmacy/gst",
  "/admin/pharmacy/stock",
] as const;

// ── Platform owner area: /super-admin/*   (role "admin") ─────────────────────
export const SUPER_ADMIN_PATHS = [
  "/super-admin/dashboard",
  "/super-admin/hospitals",
  "/super-admin/doctors",
  "/super-admin/patients",
  "/super-admin/bookings",
  "/super-admin/pharmacies",
  "/super-admin/ambulance",
  "/super-admin/labs",
  "/super-admin/lab-bookings",
  "/super-admin/billing",
  "/super-admin/enquiries",
] as const;

type HospitalAdminPath = (typeof HOSPITAL_ADMIN_PATHS)[number];
type SuperAdminPath = (typeof SUPER_ADMIN_PATHS)[number];

export type Route =
  | { path: "/" }
  | { path: "/login"; tab?: "patient" | "doctor"; patientMode?: "login" | "signup" }
  | { path: "/terms" | "/privacy" | "/about" | "/delete-account" | "/mobile-preview" }
  | {
      path:
        | "/hospital-admin/login"
        | "/pharmacy/login"
        | "/front-office/login"
        | "/nurse/login"
        | "/lab-admin/login"
        | "/hospital-lab/login"
        | "/pharmacy-owner/login"
        | "/pharmacy-owner/register";
    }
  // patient: public browsing
  | { path: "/patient/hospitals"; city?: string }
  | { path: "/patient/hospital"; id: string }
  | { path: "/labs" | "/pharmacies" | "/ambulance" }
  | { path: "/labs/detail"; id: string }
  | { path: "/labs/track"; bookingId: string }
  | { path: "/pharmacy/detail"; id: string }
  // patient: signed-in pages
  | {
      path:
        | "/patient/dashboard"
        | "/patient/tokens"
        | "/patient/admission"
        | "/patient/prescriptions"
        | "/patient/profile";
    }
  | { path: "/patient/track"; sessionId: string; tokenNumber: number }
  // staff dashboards with pages inside (path is the dashboard base, tab the page)
  | { path: TabBase; tab?: string }
  | { path: HospitalAdminPath; query?: Record<string, string> }
  | { path: SuperAdminPath };

// ── helpers ──────────────────────────────────────────────────────────────────
const SIMPLE = new Set<string>([
  "/terms", "/privacy", "/about", "/delete-account", "/mobile-preview",
  "/ambulance", "/pharmacies", "/labs",
  "/patient/dashboard", "/patient/tokens", "/patient/admission",
  "/patient/prescriptions", "/patient/profile",
  "/hospital-admin/login", "/pharmacy/login", "/front-office/login", "/nurse/login",
  "/lab-admin/login", "/hospital-lab/login", "/pharmacy-owner/login", "/pharmacy-owner/register",
]);
const HA_SET = new Set<string>(HOSPITAL_ADMIN_PATHS);
const SUPER_SET = new Set<string>(SUPER_ADMIN_PATHS);

const dec = (s: string): string => {
  try { return decodeURIComponent(s); } catch { return s; }
};
const enc = (s: string): string => encodeURIComponent(s);

// ── URL -> Route ─────────────────────────────────────────────────────────────
export function parseUrl(pathname: string, search = ""): Route {
  const q = new URLSearchParams(search);

  // Password-reset link from e-mail: /login?mode=reset&token=...
  const token = q.get("token");
  const mode = q.get("mode");
  if (token && (!mode || mode === "reset") && (pathname === "/" || pathname === "/login")) {
    return { path: "/login", tab: "patient", patientMode: "login" };
  }

  const segs = pathname.split("/").filter(Boolean); // original case, still encoded
  if (segs.length === 0) return { path: "/" };
  const low = segs.map((s) => s.toLowerCase());

  // Legacy: the hospital admin area used to live at /hospital-admin/*
  if (low[0] === "hospital-admin" && low[1] !== "login") {
    low[0] = "admin";
    if (low.length === 1) low.push("dashboard");
    if (low[1] === "inward") low[1] = "ipd";
  }
  const lp = "/" + low.join("/");

  if (lp === "/login") {
    return {
      path: "/login",
      tab: q.get("tab") === "doctor" ? "doctor" : "patient",
      patientMode: q.get("patientMode") === "signup" ? "signup" : "login",
    };
  }
  if (SIMPLE.has(lp)) return { path: lp } as Route;

  // hospital admin / platform admin
  if (lp === "/admin") return { path: "/admin/dashboard" };
  if (lp === "/super-admin") return { path: "/super-admin/dashboard" };
  if (HA_SET.has(lp)) {
    if (lp === "/admin/all-patients") {
      const query: Record<string, string> = {};
      q.forEach((v, k) => { query[k] = v; });
      return Object.keys(query).length ? { path: lp, query } : { path: lp };
    }
    return { path: lp } as Route;
  }
  if (SUPER_SET.has(lp)) return { path: lp } as Route;
  // Legacy platform-admin URLs (/admin/hospitals ...) used to be /admin/*
  if (low[0] === "admin" && low.length === 2 && SUPER_SET.has("/super-admin/" + low[1])) {
    return { path: ("/super-admin/" + low[1]) as SuperAdminPath };
  }

  // patient: browsing with ids in the URL
  if (low[0] === "patient" && low[1] === "hospitals") {
    if (low.length === 3) return { path: "/patient/hospital", id: dec(segs[2]) };
    if (low.length === 2) {
      const city = q.get("city");
      return city ? { path: "/patient/hospitals", city } : { path: "/patient/hospitals" };
    }
  }
  if (lp === "/patient/hospital") return { path: "/patient/hospital", id: q.get("id") ?? "" }; // legacy
  if (low[0] === "patient" && low[1] === "track") {
    if (low.length === 4) {
      const n = Number.parseInt(segs[3], 10);
      return { path: "/patient/track", sessionId: dec(segs[2]), tokenNumber: Number.isFinite(n) ? n : 0 };
    }
    if (low.length === 2) { // legacy ?sessionId=&tokenNumber=
      const n = Number.parseInt(q.get("tokenNumber") ?? "0", 10);
      return { path: "/patient/track", sessionId: q.get("sessionId") ?? "", tokenNumber: Number.isFinite(n) ? n : 0 };
    }
  }
  if (low[0] === "labs") {
    if (low[1] === "track") {
      if (low.length === 3) return { path: "/labs/track", bookingId: dec(segs[2]) };
      if (low.length === 2) return { path: "/labs/track", bookingId: q.get("bookingId") ?? "" }; // legacy / push links
    }
    if (low[1] === "detail" && low.length === 2) return { path: "/labs/detail", id: q.get("id") ?? "" }; // legacy
    if (low.length === 2) return { path: "/labs/detail", id: dec(segs[1]) };
  }
  if (low[0] === "pharmacies" && low.length === 2) return { path: "/pharmacy/detail", id: dec(segs[1]) };
  if (lp === "/pharmacy/detail") return { path: "/pharmacy/detail", id: q.get("id") ?? "" }; // legacy

  // staff dashboards with pages inside
  const base = ("/" + low[0]) as TabBase;
  if ((TAB_BASES as string[]).includes(base)) {
    if (low.length === 1) {
      // legacy: /doctor?doctorTab=livetokens
      const legacyTab = base === "/doctor" ? q.get("doctorTab") : null;
      return legacyTab && legacyTab !== "regulator" ? { path: base, tab: legacyTab } : { path: base };
    }
    if (low.length === 2) {
      const tab = slugToTab(base, low[1]);
      return tab === undefined ? { path: base } : { path: base, tab };
    }
  }

  return { path: "/" }; // unknown URL
}

// ── Route -> URL ─────────────────────────────────────────────────────────────
export function toUrl(r: Route): string {
  switch (r.path) {
    case "/login":
      return r.tab === "doctor" ? "/login?tab=doctor&patientMode=login" : "/login";
    case "/patient/hospitals":
      return r.city ? "/patient/hospitals?city=" + enc(r.city) : "/patient/hospitals";
    case "/patient/hospital":
      return r.id ? "/patient/hospitals/" + enc(r.id) : "/patient/hospitals";
    case "/patient/track":
      return r.sessionId ? `/patient/track/${enc(r.sessionId)}/${Number(r.tokenNumber) || 0}` : "/patient/tokens";
    case "/labs/detail":
      return r.id ? "/labs/" + enc(r.id) : "/labs";
    case "/labs/track":
      return r.bookingId ? "/labs/track/" + enc(r.bookingId) : "/labs";
    case "/pharmacy/detail":
      return r.id ? "/pharmacies/" + enc(r.id) : "/pharmacies";
    case "/admin/all-patients": {
      const e = r.query ? Object.entries(r.query) : [];
      if (!e.length) return r.path;
      return r.path + "?" + new URLSearchParams(e).toString();
    }
    default: {
      const p = r.path as string;
      if ((TAB_BASES as string[]).includes(p)) {
        return p + "/" + tabToSlug(p as TabBase, (r as { tab?: string }).tab);
      }
      if (SIMPLE.has(p) || HA_SET.has(p) || SUPER_SET.has(p) || p === "/" || p === "/admin/all-patients") return p;
      return "/"; // unknown id (for example a stale value from sessionStorage)
    }
  }
}

export const pathnameOf = (url: string): string => url.split("?")[0].split("#")[0];

// ── Who owns a page ──────────────────────────────────────────────────────────
//   "entry"   : landing + login/register screens (signed-in users are sent home)
//   "any"     : information pages, everyone
//   "browse"  : public patient pages (visitors and patients; staff use their dashboards)
//   <Role>    : only that role
export type Owner = Role | "entry" | "any" | "browse";

const TAB_OWNER: Record<TabBase, Role> = {
  "/doctor": "doctor",
  "/pharmacy": "pharmacy",
  "/front-office": "front_office",
  "/nurse": "nurse",
  "/hospital-lab": "hospital_lab",
  "/lab-admin": "lab_admin",
  "/pharmacy-owner": "pharmacy_owner",
};

export function ownerOf(r: Route): Owner {
  const p = r.path as string;
  if (p in TAB_OWNER) return TAB_OWNER[p as TabBase];
  if (p.startsWith("/admin/")) return "hospital_admin";
  if (p.startsWith("/super-admin/")) return "admin";
  switch (p) {
    case "/":
    case "/login":
    case "/hospital-admin/login":
    case "/pharmacy/login":
    case "/front-office/login":
    case "/nurse/login":
    case "/lab-admin/login":
    case "/hospital-lab/login":
    case "/pharmacy-owner/login":
    case "/pharmacy-owner/register":
      return "entry";
    case "/terms":
    case "/privacy":
    case "/about":
    case "/delete-account":
    case "/mobile-preview":
      return "any";
    case "/patient/hospitals":
    case "/patient/hospital":
    case "/labs":
    case "/labs/detail":
    case "/labs/track":
    case "/pharmacies":
    case "/pharmacy/detail":
    case "/ambulance":
      return "browse";
    default:
      return "patient"; // /patient/dashboard, tokens, admission, prescriptions, profile, track
  }
}

export function homeRoute(role: Role): Route {
  switch (role) {
    case "patient": return { path: "/patient/dashboard" };
    case "doctor": return { path: "/doctor" };
    case "admin": return { path: "/super-admin/dashboard" };
    case "hospital_admin": return { path: "/admin/dashboard" };
    case "pharmacy": return { path: "/pharmacy" };
    case "front_office": return { path: "/front-office" };
    case "nurse": return { path: "/nurse" };
    case "hospital_lab": return { path: "/hospital-lab" };
    case "lab_admin": return { path: "/lab-admin" };
    case "pharmacy_owner": return { path: "/pharmacy-owner" };
  }
}

export function loginRouteFor(role: Role): Route {
  switch (role) {
    case "doctor": return { path: "/login", tab: "doctor", patientMode: "login" };
    case "hospital_admin": return { path: "/hospital-admin/login" };
    case "pharmacy": return { path: "/pharmacy/login" };
    case "front_office": return { path: "/front-office/login" };
    case "nurse": return { path: "/nurse/login" };
    case "hospital_lab": return { path: "/hospital-lab/login" };
    case "lab_admin": return { path: "/lab-admin/login" };
    case "pharmacy_owner": return { path: "/pharmacy-owner/login" };
    default: return { path: "/login", tab: "patient", patientMode: "login" }; // patient, platform admin
  }
}

// Where a legacy platform-admin URL (/admin/hospitals) should go for role "admin".
function superEquivalent(r: Route): Route {
  const slug = r.path.split("/")[2];
  const cand = "/super-admin/" + slug;
  return SUPER_SET.has(cand) ? ({ path: cand } as Route) : { path: "/super-admin/dashboard" };
}

// ── Access control ───────────────────────────────────────────────────────────
// NOTE: this protects what the browser SHOWS. The API enforces roles on its own
// (backend src/middleware/auth.js), so changing the URL never exposes data.
export type Access = { ok: true } | { ok: false; to: Route; why: "login" | "home" };

export function resolveAccess(route: Route, role: string | null): Access {
  const owner = ownerOf(route);
  if (owner === "any") return { ok: true };

  if (role === null || role === undefined || role === "") {
    if (owner === "entry" || owner === "browse") return { ok: true };
    return { ok: false, to: loginRouteFor(owner), why: "login" };
  }

  if (!isRole(role)) return { ok: true }; // unknown role: do not guess, do not loop

  if (owner === "entry") return { ok: false, to: homeRoute(role), why: "home" };
  if (owner === "browse") return role === "patient" ? { ok: true } : { ok: false, to: homeRoute(role), why: "home" };
  if (owner === role) return { ok: true };
  if (role === "admin" && owner === "hospital_admin") return { ok: false, to: superEquivalent(route), why: "home" };
  return { ok: false, to: homeRoute(role), why: "home" };
}

// True for pages that need a signed-in user of one specific role
export function isProtectedPath(pathname: string, search = ""): boolean {
  return isRole(ownerOf(parseUrl(pathname, search)));
}

// Login screen that matches a URL (used when a session expires or the page is restored from cache)
export function loginUrlForPath(pathname: string, search = ""): string {
  const owner = ownerOf(parseUrl(pathname, search));
  return toUrl(isRole(owner) ? loginRouteFor(owner) : { path: "/login", tab: "patient", patientMode: "login" });
}

// ── "Take me back to where I was going" after login ──────────────────────────
const NEXT_KEY = "db_next";

export function rememberNext(r: Route): void {
  try {
    if (isRole(ownerOf(r))) sessionStorage.setItem(NEXT_KEY, toUrl(r));
  } catch { /* storage unavailable */ }
}
export function rememberNextUrl(pathname: string, search = ""): void {
  rememberNext(parseUrl(pathname, search));
}
export function clearNext(): void {
  try { sessionStorage.removeItem(NEXT_KEY); } catch { /* ignore */ }
}
// Returns the saved page ONLY when this role is allowed to open it; always clears it.
export function takeNext(role: string | null): Route | null {
  try {
    const raw = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    if (!raw || !isRole(role)) return null;
    const [p, s] = raw.split("?");
    const r = parseUrl(p, s ? "?" + s : "");
    return ownerOf(r) === role && resolveAccess(r, role).ok ? r : null;
  } catch { return null; }
}
