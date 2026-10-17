// scripts/check-scan-vote.mjs - regression checks for the vote / merge layer in src/lib/scanCombine.ts.
// Run:  npx tsx scripts/check-scan-vote.mjs
// Uses synthetic traces shaped like the real ones (numbers measured on a real monitor photo), so no image is needed.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mod = await import(pathToFileURL(path.join(here, "../src/lib/scanCombine.ts")).href);
const { combineMatches, pickDeepTargets, pickBlobTargets } = { ...mod, ...(mod.default || {}) };

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); } };

const T = (text, conf, seen, x, y, w, h, status = "confirmed", recheck = "", raw = "") => ({ text, raw, conf, seen, x, y, w, h, status, recheck });
const L = (text, x, y) => T(text, 92, "N I C", x, y, 0, 0, "label");
const D = (a, method = "normal", conf = 90) => a.map((text) => ({ text, conf, method }));
const R = (field, deep, x = 100, y = 100, w = 200, h = 120) => ({ regionField: field, text: "", raw: "", conf: 0, seen: "", x, y, w, h, status: "saved region", deep });
const run = (traces, W = 1095, H = 870) => combineMatches([], W, H, 85, traces).output;
const txt = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.text])));
const blob = (x, y, w, h, deep) => ({ blobBox: true, text: "", raw: "", conf: 0, seen: "", x, y, w, h, status: "found by brightness", deep });

console.log("1) the vote: agreement across DIFFERENT methods, not Tesseract's confidence");
{
  // measured on a real photo: the correct 154 came back at 0% three times; the wrong 14 / 194 also scored ~0%
  const hr = [
    { text: "154", conf: 0, method: "normal" }, { text: "14", conf: 0, method: "normal" },
    { text: "154", conf: 0, method: "mask:bright/psm7" }, { text: "154", conf: 0, method: "mask:bright/psm8" },
    { text: "154", conf: 0, method: "mask:bright85/psm7" }, { text: "194", conf: 13, method: "adaptive/psm7" },
  ];
  let o = run([blob(720, 140, 108, 66, hr)]);
  ok("154 read at 0% by 3 different methods is accepted, as amber", o.suggestions.pulse?.text === "154" && !o.values.pulse, txt(o.suggestions));
  o = run([blob(720, 140, 108, 66, D(["154", "154", "154"], "normal"))]);
  ok("three reads from ONE method are not enough", !o.suggestions.pulse);
  o = run([blob(720, 140, 108, 66, D(["154", "154", "154", "154"], "normal"))]);
  ok("four reads from one method (e.g. four frames) are enough", o.suggestions.pulse?.text === "154");
  o = run([blob(720, 140, 108, 66, [...D(["154", "154", "154"], "normal"), ...D(["194", "194", "194"], "mask:bright")])]);
  ok("a 3 vs 3 tie fills nothing", !o.suggestions.pulse);
  o = run([blob(720, 140, 108, 66, [...D(["154", "154", "154"], "mask:red"), ...D(["154"], "normal")])]);
  ok("reads from the red (ART / IBP) mask never vote", !o.suggestions.pulse);
  ok("a value outside the plausible range is rejected", !run([blob(720, 140, 108, 66, [...D(["999", "999"], "normal"), ...D(["999"], "mask:bright")])]).suggestions.pulse);
}

console.log("2) finding targets from brightness blobs");
{
  const B = (x0, y0, x1, y1, blobs) => ({ x0, y0, x1, y1, blobs });
  const blobs = [B(720, 140, 828, 206, 3), B(718, 232, 793, 300, 2), B(714, 327, 791, 393, 2), B(136, 317, 140, 371, 1), B(53, 663, 122, 737, 1)];
  const t = pickBlobTargets([], blobs);
  ok("the three number-like boxes are kept and the thin line is dropped", t.length === 4 && !t.some((x) => x.trace.w < 10), String(t.length));
  ok("targets come back top to bottom", t.every((x, i) => i === 0 || t[i - 1].trace.y <= x.trace.y));
  ok("each target is a pseudo-trace marked as found by brightness, with a box to re-read", t.every((x) => x.trace.blobBox === true && x.trace.text === "" && Array.isArray(x.trace.deep) && x.box.x1 > x.box.x0));
  const covered = pickBlobTargets([T("154", 90, "N I C", 722, 142, 104, 62)], blobs);
  ok("a box on top of an already-confirmed number is not re-read", !covered.some((x) => Math.abs(x.trace.x - 720) < 5 && Math.abs(x.trace.y - 140) < 5));
  const dup = pickBlobTargets([], [B(100, 100, 200, 170, 3), B(102, 102, 198, 168, 2)]);
  ok("near-duplicate boxes are merged", dup.length === 1);
  ok("at most 4 targets", pickBlobTargets([], Array.from({ length: 9 }, (_, i) => B(100 + i * 150, 100, 200 + i * 150, 180, 2))).length === 4);
  ok("empty / missing input is handled", pickBlobTargets([], []).length === 0 && pickBlobTargets(null, null).length === 0);
}

console.log("3) a screen with no readable labels (the real photo): numbers fill by position and range, amber only");
{
  const tr = [
    blob(720, 140, 108, 66, [...D(["154", "154"], "normal"), ...D(["154"], "mask:bright85/psm7"), ...D(["154"], "adaptive/psm7")]),
    blob(718, 232, 75, 68, [...D(["97", "97"], "normal"), ...D(["97"], "mask:bright85/psm7"), ...D(["97"], "adaptive/psm7")]),
    blob(714, 327, 77, 66, [...D(["48", "48"], "normal"), ...D(["48"], "mask:white/psm7"), ...D(["148"], "mask:cyan/psm7")]),
    blob(53, 663, 69, 74, D(["1"], "mask:bright85/psm8")),
  ];
  const o = run(tr);
  ok("pulse 154, SpO2 97, resp 48 (truth from the photo), as amber suggestions", txt(o.suggestions) === '{"pulse":"154","spo2":"97","respRate":"48"}', txt(o.suggestions));
  ok("none of them is green", Object.keys(o.values).length === 0);
  ok("the noise box (one stray read) was rejected, with the reason in the log", o.log.some((l) => /Unlabeled number.*REJECTED/.test(l)));
  ok("the log shows every extra read with its method and the decision", o.log.some((l) => /Big digits for Pulse/.test(l) && /154\u00D74/.test(l) && /ACCEPTED 154/.test(l)));
  const labelled = [L("HR", 700, 100), L("SpO2", 700, 200), ...tr];
  ok("with 2+ labels found, the position-only fill is NOT used for an unlabeled-style number", !run(labelled).suggestions.respRate);
}

console.log("4) saved screen regions");
{
  let o = run([R("pulse", [...D(["78", "78", "78", "78"]), ...D(["78", "78"], "mask:green"), ...D(["18"], "adaptive")])]);
  ok("a saved box fills its vital in amber", o.suggestions.pulse?.text === "78" && !o.values.pulse && o.suggestions.pulse.conf < 85);
  ok("...and the log names the box, the reads and the decision", o.log.some((l) => /Saved region for Pulse \[x=100, y=100, w=200, h=120\].*ACCEPTED 78/.test(l)));
  o = run([R("pulse", [...D(["78", "78", "78"]), ...D(["73", "73", "73"])])]);
  ok("a 3 vs 3 box is rejected", !o.suggestions.pulse && o.log.some((l) => /REJECTED/.test(l)));
  o = run([R("temperature", [...D(["37.5", "37.5", "37.5"]), ...D(["37.5", "37.5"], "mask:cyan"), ...D(["37.6"], "adaptive")])]);
  ok("a temperature box: 37.5 degC becomes 99.5 degF (amber)", o.suggestions.temperature?.text === "99.5", txt(o.suggestions));
  o = run([R("bp", [...D(["120/80", "120/80", "120/80", "120/80"]), ...D(["120/80"], "mask:white"), ...D(["120/60"], "adaptive")])]);
  ok("a BP box: systolic and diastolic together (amber)", o.suggestions.bpSystolic?.text === "120" && o.suggestions.bpDiastolic?.text === "80", txt(o.suggestions));
  ok("a BP box with systolic < diastolic is rejected", !run([R("bp", D(["80/120", "80/120", "80/120", "80/120"]))]).suggestions.bpSystolic);
}

console.log("5) NIBP (cuff) and ART / IBP stay separate");
{
  const bad = (text, conf = 62, status = "number and text mixed, not used") => T("120/80", conf, "N I C", 150, 150, 248, 108, status, "", "120/80 | 120/80 | \u201C120/80");
  ok("an ART-labelled 120/80 is not put into the cuff BP fields", !run([L("ART", 100, 100), bad()]).suggestions.bpSystolic);
  ok("the same numbers with no ART label are still rescued (amber)", run([bad()]).suggestions.bpSystolic?.text === "120");
}

console.log("6) warnings and temperature");
{
  const small = [T("98", 90, "N I C", 100, 100, 18, 30), T("72", 90, "N I C", 100, 200, 18, 30), T("16", 90, "N I C", 100, 300, 18, 30)];
  ok("digits ~3% of the image height give a 'move closer' note", run(small, 1600, 1000).notes.some((n) => /Move closer/.test(n)));
  ok("big digits give no such note", !run([T("98", 90, "N I C", 100, 100, 120, 200), T("72", 90, "N I C", 100, 400, 120, 200)], 1600, 1000).notes.some((n) => /Move closer/.test(n)));
  const big = [T("71", 90, "N I C", 1500, 200, 300, 200), T("73", 90, "N I C", 1500, 500, 300, 200)];
  ok("tiny alarm-limit decimals (39.0 / 35.0) are never re-read as targets", pickDeepTargets([...big, T("39.0", 90, "N I C", 900, 300, 40, 20), T("35.0", 90, "N I C", 900, 340, 40, 20)]).length === 0);
  ok("...but a decimal seen in only ONE image version is not rescued", !run([...big, T("36.8", 95, "- - C", 900, 300, 70, 28, "only one image version saw it")]).suggestions.temperature);
  const o = run([...big, T("36.8", 95, "N I C", 900, 300, 70, 28, "image versions agreed, no label")]);
  ok("a decimal in the temperature range seen in 2+ image versions is rescued as amber degF", o.suggestions.temperature?.text === "98.2", txt(o.suggestions));
}

console.log("7) inputs are never modified, and nothing is ever green from these steps");
{
  const tr = [blob(720, 140, 108, 66, [...D(["154", "154"], "normal"), ...D(["154"], "mask:bright85/psm7"), ...D(["154"], "adaptive/psm7")]), R("spo2", D(["97", "97", "97", "97"]), 100, 300, 80, 60)];
  const before = JSON.stringify(tr);
  const o = run(tr);
  ok("traces (reads, confidences, boxes) are unchanged after merging", JSON.stringify(tr) === before);
  ok("every value these steps produce is amber, never green", Object.keys(o.values).length === 0 && Object.keys(o.suggestions).length >= 1);
  ok("amber confidence stays below the 85% fill threshold", Object.values(o.suggestions).every((s) => s.conf < 85));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
