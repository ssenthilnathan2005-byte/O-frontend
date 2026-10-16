// scripts/check-regions.mjs - regression checks for src/lib/scanRegions.ts (saved screen layouts).
// Run:  node scripts/check-regions.mjs      (or: npx tsx scripts/check-regions.mjs)
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); } };

// a tiny in-memory localStorage, with switches to simulate private mode / a full disk
const mem = new Map();
let mode = "ok";
globalThis.localStorage = {
  getItem: (k) => { if (mode === "throwAll") throw new Error("denied"); return mem.has(k) ? mem.get(k) : null; },
  setItem: (k, v) => { if (mode === "throwAll" || mode === "full") throw new Error("quota"); mem.set(k, String(v)); },
  removeItem: (k) => mem.delete(k),
};
const R = await import(pathToFileURL(path.join(here, "../src/lib/scanRegions.ts")).href);
const { normalizeFrac, regionToBox, cleanRegions, loadLayouts, saveLayout, deleteLayout, REGION_FIELDS } = R;
const box = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });

console.log("1) boxes are clamped, ordered and validated");
ok("corners are put in order", JSON.stringify(normalizeFrac(box(0.6, 0.7, 0.2, 0.1))) === JSON.stringify(box(0.2, 0.1, 0.6, 0.7)));
ok("values are clamped to the screen", JSON.stringify(normalizeFrac(box(-0.5, -1, 2, 3))) === JSON.stringify(box(0, 0, 1, 1)));
ok("a stray tap (tiny box) is rejected", normalizeFrac(box(0.5, 0.5, 0.505, 0.505)) === null);
ok("NaN / missing / wrong types are rejected", normalizeFrac(box(NaN, 0, 1, 1)) === null && normalizeFrac(null) === null && normalizeFrac({ x0: "a" }) === null);
const px = regionToBox(box(0.25, 0.5, 0.75, 1), 800, 400);
ok("fractions convert to pixels for any image size", JSON.stringify(px) === JSON.stringify(box(200, 200, 600, 400)));
ok("the five vitals are offered", REGION_FIELDS.map((f) => f.id).join() === "pulse,spo2,respRate,temperature,bp");
const cr = cleanRegions({ pulse: box(0.1, 0.1, 0.4, 0.4), bogus: box(0, 0, 1, 1), spo2: box(0.5, 0.5, 0.501, 0.9) });
ok("unknown fields and invalid boxes are dropped", Object.keys(cr).join() === "pulse");

console.log("2) saving, loading, replacing, deleting");
mem.clear(); mode = "ok";
const regs = { pulse: box(0.6, 0.1, 0.95, 0.35), spo2: box(0.6, 0.4, 0.95, 0.65) };
const a = saveLayout("ICU Mindray", regs);
ok("a layout saves and gets an id", a && typeof a.id === "string" && a.name === "ICU Mindray");
ok("it loads back identical", JSON.stringify(loadLayouts()[0].regions) === JSON.stringify(regs));
const b = saveLayout("  icu mindray ", { pulse: box(0.1, 0.1, 0.5, 0.5) });
ok("the same name (any case, extra spaces) replaces instead of duplicating", loadLayouts().length === 1 && b.id === a.id && Object.keys(loadLayouts()[0].regions).join() === "pulse");
saveLayout("Ward Dell", regs);
ok("a second model is stored separately, newest first", loadLayouts().length === 2 && loadLayouts()[0].name === "Ward Dell");
ok("delete removes only that layout", deleteLayout(a.id) && loadLayouts().length === 1 && loadLayouts()[0].name === "Ward Dell");
ok("an empty name or no boxes is not saved", saveLayout("", regs) === null && saveLayout("x", {}) === null && saveLayout("x", { pulse: box(0.1, 0.1, 0.1, 0.1) }) === null);
for (let i = 0; i < 30; i++) saveLayout("Model " + i, regs);
ok("the list is capped (no unbounded growth)", loadLayouts().length <= 20, String(loadLayouts().length));

console.log("3) damaged or unavailable storage never throws");
mem.set("doctorbook.scanLayouts.v1", "{not json");
ok("corrupted JSON loads as an empty list", Array.isArray(loadLayouts()) && loadLayouts().length === 0);
mem.set("doctorbook.scanLayouts.v1", JSON.stringify([{ id: "a", name: "ok", regions: { pulse: box(0.1, 0.1, 0.5, 0.5) } }, { id: 5 }, null, { id: "b", name: "empty", regions: {} }, "x"]));
ok("bad entries are skipped, good ones kept", loadLayouts().length === 1 && loadLayouts()[0].id === "a");
mem.set("doctorbook.scanLayouts.v1", JSON.stringify({ not: "an array" }));
ok("a wrong top-level shape loads as empty", loadLayouts().length === 0);
mode = "full"; ok("a full disk: save returns null instead of throwing", saveLayout("Full", regs) === null);
mode = "throwAll"; ok("private mode: load returns [] and save returns null", loadLayouts().length === 0 && saveLayout("P", regs) === null && deleteLayout("a") === false);
mode = "ok"; delete globalThis.localStorage;
ok("no localStorage at all (e.g. server render): handled", loadLayouts().length === 0 && saveLayout("N", regs) === null);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
