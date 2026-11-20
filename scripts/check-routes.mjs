// Run:  node scripts/check-routes.mjs
// Tests the pure routing logic (src/router/routes.ts): URL <-> page mapping,
// role protection, redirect safety (no loops) and legacy URLs. It does not open
// a browser; the browser checklist is in the pull request notes.
import {
  parseUrl, toUrl, resolveAccess, ownerOf, homeRoute, loginRouteFor, loginUrlForPath,
  ROLES, TAB_CONFIG, tabToSlug, slugToTab, HOSPITAL_ADMIN_PATHS, SUPER_ADMIN_PATHS,
  rememberNext, takeNext, clearNext,
} from "../src/router/routes.ts";

let failed = 0;
const expect = (name, cond, detail) => {
  if (cond) console.log("  ok   " + name);
  else { failed++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
};
const sec = (t) => console.log("\n" + t);
const parse = (url) => { const [p, s] = url.split("?"); return parseUrl(p, s ? "?" + s : ""); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// fake sessionStorage for the "return to where I was going" helpers
const mem = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => void mem.set(k, String(v)),
  removeItem: (k) => void mem.delete(k),
};

// ---------- 1. The URLs from the requirement ----------
sec("1. Role dashboards have their own URL");
{
  expect("patient       -> /patient/dashboard", toUrl(homeRoute("patient")) === "/patient/dashboard");
  expect("doctor        -> /doctor/dashboard", toUrl(homeRoute("doctor")) === "/doctor/dashboard");
  expect("hospital admin-> /admin/dashboard", toUrl(homeRoute("hospital_admin")) === "/admin/dashboard");
  expect("front office  -> /front-office/dashboard", toUrl(homeRoute("front_office")) === "/front-office/dashboard");
  expect("pharmacy      -> /pharmacy/dashboard", toUrl(homeRoute("pharmacy")) === "/pharmacy/dashboard");
  expect("nurse         -> /nurse/dashboard", toUrl(homeRoute("nurse")) === "/nurse/dashboard");
  expect("hospital lab  -> /hospital-lab/dashboard", toUrl(homeRoute("hospital_lab")) === "/hospital-lab/dashboard");
  expect("lab admin     -> /lab-admin/dashboard", toUrl(homeRoute("lab_admin")) === "/lab-admin/dashboard");
  expect("pharmacy owner-> /pharmacy-owner/dashboard", toUrl(homeRoute("pharmacy_owner")) === "/pharmacy-owner/dashboard");
  expect("platform admin-> /super-admin/dashboard", toUrl(homeRoute("admin")) === "/super-admin/dashboard");
  for (const role of ROLES) {
    const home = homeRoute(role);
    expect(`${role}: home URL parses back to the same page`, same(parse(toUrl(home)), home), JSON.stringify(parse(toUrl(home))));
    expect(`${role}: owns its own home page`, ownerOf(home) === role);
  }
}

// ---------- 2. Every page round-trips: Route -> URL -> Route (this is what refresh does) ----------
sec("2. Refresh keeps the exact page (Route -> URL -> Route)");
{
  const routes = [
    { path: "/" },
    { path: "/login", tab: "patient", patientMode: "login" },
    { path: "/login", tab: "doctor", patientMode: "login" },
    { path: "/terms" }, { path: "/privacy" }, { path: "/about" }, { path: "/delete-account" },
    { path: "/hospital-admin/login" }, { path: "/pharmacy/login" }, { path: "/front-office/login" },
    { path: "/nurse/login" }, { path: "/lab-admin/login" }, { path: "/hospital-lab/login" },
    { path: "/pharmacy-owner/login" }, { path: "/pharmacy-owner/register" },
    { path: "/patient/hospitals" }, { path: "/patient/hospitals", city: "Chennai" },
    { path: "/patient/hospitals", city: "Navi Mumbai & Pune" },
    { path: "/patient/hospital", id: "h_123" },
    { path: "/patient/hospital", id: "id with space/and slash" },
    { path: "/patient/dashboard" }, { path: "/patient/tokens" }, { path: "/patient/admission" },
    { path: "/patient/prescriptions" }, { path: "/patient/profile" },
    { path: "/patient/track", sessionId: "sess-9", tokenNumber: 14 },
    { path: "/labs" }, { path: "/labs/detail", id: "lab_1" }, { path: "/labs/track", bookingId: "bk_5" },
    { path: "/pharmacies" }, { path: "/pharmacy/detail", id: "ph_2" }, { path: "/ambulance" },
    { path: "/admin/all-patients", query: { filter: "admitted", q: "ravi kumar" } },
    ...HOSPITAL_ADMIN_PATHS.map((path) => ({ path })),
    ...SUPER_ADMIN_PATHS.map((path) => ({ path })),
  ];
  for (const base of Object.keys(TAB_CONFIG)) {
    routes.push({ path: base });
    for (const key of Object.keys(TAB_CONFIG[base].slugs)) {
      if (key !== TAB_CONFIG[base].default) routes.push({ path: base, tab: key });
    }
    routes.push({ path: base, tab: "x:live_patients" }, { path: base, tab: "x:beds_wards" });
  }
  let bad = 0;
  for (const r of routes) {
    const url = toUrl(r);
    const back = parse(url);
    if (!same(back, r)) { bad++; console.log("  FAIL " + JSON.stringify(r) + "  ->  " + url + "  ->  " + JSON.stringify(back)); }
  }
  failed += bad;
  console.log(`  ${routes.length - bad}/${routes.length} pages round-trip`);
  const urls = routes.map(toUrl);
  const dup = urls.filter((u, i) => urls.indexOf(u) !== i);
  expect("every page has its own distinct URL", dup.length === 0, dup.join(", "));
}

// ---------- 3. Pages inside dashboards ----------
sec("3. Pages inside a dashboard get meaningful URLs");
{
  expect("/doctor/dashboard is the regulator", same(parse("/doctor/dashboard"), { path: "/doctor" }));
  expect("/doctor/live-tokens", same(parse("/doctor/live-tokens"), { path: "/doctor", tab: "livetokens" }));
  expect("/doctor/follow-ups", same(parse("/doctor/follow-ups"), { path: "/doctor", tab: "followups" }));
  expect("/pharmacy/sales", same(parse("/pharmacy/sales"), { path: "/pharmacy", tab: "sold" }));
  expect("/front-office/register-patient", same(parse("/front-office/register-patient"), { path: "/front-office", tab: "walkin" }));
  expect("/hospital-lab/bookings", same(parse("/hospital-lab/bookings"), { path: "/hospital-lab", tab: "orders" }));
  expect("extra page slug x-live-patients", tabToSlug("/doctor", "x:live_patients") === "x-live-patients" && slugToTab("/doctor", "x-live-patients") === "x:live_patients");
  expect("default tab is never written as its own slug", toUrl({ path: "/doctor", tab: "regulator" }) === "/doctor/dashboard");
  expect("URL is case-insensitive for fixed words", same(parse("/Doctor/Dashboard"), { path: "/doctor" }));
  expect("trailing slash is fine", same(parse("/doctor/dashboard/"), { path: "/doctor" }));
  expect("unknown tab slug is passed to the dashboard to reject", same(parse("/doctor/zzz"), { path: "/doctor", tab: "zzz" }));
  expect("/pharmacy/login is still the login page (not a tab)", same(parse("/pharmacy/login"), { path: "/pharmacy/login" }));
  expect("/pharmacy-owner/register is still the register page", same(parse("/pharmacy-owner/register"), { path: "/pharmacy-owner/register" }));
  expect("deeper-than-known URL is not guessed", same(parse("/doctor/profile/extra"), { path: "/" }));
}

// ---------- 4. Old links keep working ----------
sec("4. Legacy URLs and links sent by e-mail / push notifications");
{
  expect("/hospital-admin -> /admin/dashboard", same(parse("/hospital-admin"), { path: "/admin/dashboard" }));
  expect("/hospital-admin/doctors -> /admin/doctors", same(parse("/hospital-admin/doctors"), { path: "/admin/doctors" }));
  expect("/hospital-admin/pharmacy/gst -> /admin/pharmacy/gst", same(parse("/hospital-admin/pharmacy/gst"), { path: "/admin/pharmacy/gst" }));
  expect("/hospital-admin/inward -> /admin/ipd", same(parse("/hospital-admin/inward"), { path: "/admin/ipd" }));
  expect("/hospital-admin/login is unchanged", same(parse("/hospital-admin/login"), { path: "/hospital-admin/login" }));
  expect("/admin -> hospital admin dashboard", same(parse("/admin"), { path: "/admin/dashboard" }));
  expect("old platform-admin /admin/hospitals -> /super-admin/hospitals", same(parse("/admin/hospitals"), { path: "/super-admin/hospitals" }));
  expect("/doctor -> /doctor/dashboard", toUrl(parse("/doctor")) === "/doctor/dashboard");
  expect("/doctor?doctorTab=livetokens", same(parse("/doctor?doctorTab=livetokens"), { path: "/doctor", tab: "livetokens" }));
  expect("/nurse -> /nurse/dashboard", toUrl(parse("/nurse")) === "/nurse/dashboard");
  expect("/patient/hospital?id=abc", same(parse("/patient/hospital?id=abc"), { path: "/patient/hospital", id: "abc" }));
  expect("/labs/track?bookingId=bk1 (push notification)", same(parse("/labs/track?bookingId=bk1"), { path: "/labs/track", bookingId: "bk1" }));
  expect("/patient/admission (push notification)", same(parse("/patient/admission"), { path: "/patient/admission" }));
  expect("/patient/track?sessionId=s&tokenNumber=4", same(parse("/patient/track?sessionId=s&tokenNumber=4"), { path: "/patient/track", sessionId: "s", tokenNumber: 4 }));
  expect("/pharmacy/detail?id=p1", same(parse("/pharmacy/detail?id=p1"), { path: "/pharmacy/detail", id: "p1" }));
  expect("password reset e-mail link opens the login screen", same(parse("/login?mode=reset&token=abc123"), { path: "/login", tab: "patient", patientMode: "login" }));
  expect("unknown URL falls back to home", same(parse("/no/such/page"), { path: "/" }));
}

// ---------- 5. Access control ----------
sec("5. Protection: nobody opens another role's pages by editing the URL");
{
  const guarded = [
    ["/patient/dashboard", "patient"], ["/patient/tokens", "patient"], ["/patient/profile", "patient"],
    ["/doctor/dashboard", "doctor"], ["/doctor/profile", "doctor"],
    ["/admin/dashboard", "hospital_admin"], ["/admin/billing", "hospital_admin"], ["/admin/pharmacy/gst", "hospital_admin"],
    ["/super-admin/dashboard", "admin"], ["/super-admin/hospitals", "admin"],
    ["/front-office/dashboard", "front_office"], ["/pharmacy/dashboard", "pharmacy"], ["/pharmacy/stock", "pharmacy"],
    ["/nurse/wards", "nurse"], ["/hospital-lab/bookings", "hospital_lab"], ["/lab-admin/tests", "lab_admin"],
    ["/pharmacy-owner/enquiries", "pharmacy_owner"],
  ];
  for (const [url, owner] of guarded) {
    const r = parse(url);
    // signed-out visitor -> that area's login
    const anon = resolveAccess(r, null);
    expect(`${url}: signed-out -> login`, !anon.ok && anon.why === "login" && ownerOf(anon.to) === "entry", JSON.stringify(anon));
    for (const role of ROLES) {
      const a = resolveAccess(r, role);
      if (role === owner) expect(`${url}: ${role} allowed`, a.ok);
      else expect(`${url}: ${role} blocked and sent to own home`, !a.ok && same(a.to, role === "admin" && owner === "hospital_admin" ? a.to : homeRoute(role)), JSON.stringify(a));
    }
  }
  const a = resolveAccess(parse("/admin/billing"), "admin");
  expect("platform admin opening a legacy hospital-admin page lands on a platform page", !a.ok && a.to.path.startsWith("/super-admin/"));
  const b = resolveAccess(parse("/admin/hospitals"), "admin");
  expect("old /admin/hospitals bookmark opens for the platform admin", b.ok === true, JSON.stringify(b));
  const c = resolveAccess(parse("/admin/hospitals"), "hospital_admin");
  expect("hospital admin cannot open platform pages", !c.ok && same(c.to, homeRoute("hospital_admin")));
}

sec("6. Redirects never loop and always land on an allowed page");
{
  const sample = [
    "/", "/login", "/login?tab=doctor&patientMode=login", "/hospital-admin/login", "/pharmacy/login", "/front-office/login",
    "/nurse/login", "/lab-admin/login", "/hospital-lab/login", "/pharmacy-owner/login", "/pharmacy-owner/register",
    "/terms", "/privacy", "/about", "/delete-account",
    "/patient/hospitals", "/patient/hospitals/h1", "/labs", "/labs/l1", "/labs/track/b1", "/pharmacies", "/pharmacies/p1", "/ambulance",
    "/patient/dashboard", "/patient/tokens", "/patient/admission", "/patient/prescriptions", "/patient/profile", "/patient/track/s1/3",
    "/doctor/dashboard", "/doctor/live-tokens", "/pharmacy/dashboard", "/front-office/dashboard", "/nurse/dashboard",
    "/hospital-lab/dashboard", "/lab-admin/dashboard", "/pharmacy-owner/dashboard",
    ...HOSPITAL_ADMIN_PATHS, ...SUPER_ADMIN_PATHS, "/some/unknown/url",
  ];
  let loops = 0, n = 0;
  for (const url of sample) {
    for (const role of [null, ...ROLES]) {
      n++;
      const r = parse(url);
      const a = resolveAccess(r, role);
      if (a.ok) continue;
      const again = resolveAccess(a.to, role);
      if (!again.ok) { loops++; console.log("  FAIL loop: " + url + " as " + role + " -> " + toUrl(a.to)); }
    }
  }
  failed += loops;
  console.log(`  ${n} URL x role combinations checked, ${loops} loops`);
  for (const role of ROLES) {
    expect(`${role}: own home is allowed (no redirect on refresh)`, resolveAccess(homeRoute(role), role).ok);
    expect(`${role}: login screen sends a signed-in user home`, same(resolveAccess(loginRouteFor(role), role).to, homeRoute(role)));
  }
  expect("unknown role string is never redirected (cannot loop)", resolveAccess({ path: "/" }, "mystery").ok && resolveAccess({ path: "/doctor" }, "mystery").ok);
  expect("information pages open for everyone", ROLES.every((r) => resolveAccess({ path: "/terms" }, r).ok) && resolveAccess({ path: "/about" }, null).ok);
  expect("staff do not browse the patient pages", ["doctor", "hospital_admin", "pharmacy"].every((r) => !resolveAccess({ path: "/patient/hospitals" }, r).ok));
  expect("visitors and patients can browse hospitals", resolveAccess({ path: "/patient/hospitals" }, null).ok && resolveAccess({ path: "/patient/hospitals" }, "patient").ok);
}

sec("7. Login screen for an expired session / cached page");
{
  expect("/doctor/profile -> doctor login", loginUrlForPath("/doctor/profile") === "/login?tab=doctor&patientMode=login");
  expect("/admin/billing -> hospital admin login", loginUrlForPath("/admin/billing") === "/hospital-admin/login");
  expect("/pharmacy/stock -> pharmacy login", loginUrlForPath("/pharmacy/stock") === "/pharmacy/login");
  expect("/front-office/dashboard -> front office login", loginUrlForPath("/front-office/dashboard") === "/front-office/login");
  expect("/patient/tokens -> patient login", loginUrlForPath("/patient/tokens") === "/login");
}

sec("8. After login the user returns to the page they asked for");
{
  clearNext();
  rememberNext(parse("/doctor/live-tokens"));
  expect("doctor gets /doctor/live-tokens back", same(takeNext("doctor"), { path: "/doctor", tab: "livetokens" }));
  expect("it is used once", takeNext("doctor") === null);
  rememberNext(parse("/admin/billing"));
  expect("another role cannot reuse it", takeNext("doctor") === null);
  rememberNext(parse("/login"));
  expect("login pages are never remembered", takeNext("patient") === null);
  rememberNext(parse("/patient/tokens"));
  expect("patient gets /patient/tokens back", same(takeNext("patient"), { path: "/patient/tokens" }));
}

console.log(failed ? `\n${failed} FAILED` : "\nAll routing checks passed");
process.exit(failed ? 1 : 0);
