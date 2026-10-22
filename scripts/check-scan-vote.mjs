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
  // regression from a real photo: the relaxed brightness level adds big noise boxes, which must not push out the real numbers
  const mixed = [
    { x0: 214, y0: 127, x1: 447, y1: 211, blobs: 5, level: "relaxed" }, { x0: 496, y0: 127, x1: 596, y1: 201, blobs: 2, level: "relaxed" },
    { x0: 720, y0: 140, x1: 828, y1: 206, blobs: 3, level: "strict" }, { x0: 718, y0: 232, x1: 793, y1: 300, blobs: 2, level: "strict" },
    { x0: 714, y0: 327, x1: 791, y1: 393, blobs: 2, level: "strict" }, { x0: 53, y0: 663, x1: 122, y1: 737, blobs: 1, level: "strict" },
    { x0: 100, y0: 500, x1: 300, y1: 600, blobs: 4, level: "relaxed" },
  ];
  const kept = pickBlobTargets([], mixed, 4).map((x) => x.trace.x);
  ok("strictly-bright boxes (the real numbers) win the limited slots over bigger relaxed-level noise", [720, 718, 714].every((x) => kept.includes(x)), JSON.stringify(kept));
  ok("a relaxed-level box is still used when slots are free (the medium-green HR)", pickBlobTargets([], [mixed[2], { x0: 1195, y0: 139, x1: 1345, y1: 243, blobs: 2, level: "relaxed" }], 4).length === 2);
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


console.log("8) a real labelled screen (PUAO PDJ-5000 layout): banner, BP, pulse by elimination, two temperature channels");
{
  const banner = [L("PR", 999, 19), L("TOO", 1045, 19), L("LOW", 1100, 19)];                  // the yellow alarm banner "PR TOO LOW"
  const labels = [L("NIBP", 1121, 301), L("SP02", 1122, 521), L("RESP", 1121, 776), L("TEMP", 1128, 955)];
  const hr = blob(1195, 139, 150, 104, [...D(["60", "60"], "normal", 96), ...D(["60"], "adaptive/psm7", 0), ...D(["0"], "mask:bright/psm7", 0)]);
  const bp = blob(1111, 340, 281, 61, [...D(["420/80", "420/80"], "normal", 0), ...D(["420/80"], "adaptive/psm7", 0), ...D(["120/80"], "mask:bright85/psm7", 0), ...D(["120/80"], "mask:bright85/psm8", 75), ...D(["120/80"], "mask:bright/psm7", 0)]);
  const resp = blob(1203, 795, 145, 99, [...D(["20", "20"], "normal", 96), ...D(["20"], "adaptive/psm7", 96), ...D(["20"], "mask:bright85/psm7", 50)]);
  const spo2 = T("98", 90, "N I C", 1198, 577, 150, 102);
  const fragment = T("20", 90, "N I C", 1153, 339, 84, 64);                                      // the "120" with its thin leading 1 lost
  const t2 = T("37.2", 93, "N I C", 1223, 1069, 110, 41), t1 = T("377", 59, "- - C", 1222, 991, 109, 41, "disagreed, not used");
  const o = run([...banner, ...labels, hr, bp, resp, spo2, fragment, t1, t2], 1600, 1203);
  ok("BP: the impossible 420/80 cannot tie the vote, so 120/80 is offered (amber)", o.suggestions.bpSystolic?.text === "120" && o.suggestions.bpDiastolic?.text === "80", txt(o.suggestions));
  ok('pulse 60 is offered by elimination: the "PR TOO LOW" banner is not a heart-rate label', o.suggestions.pulse?.text === "60", txt(o.suggestions));
  ok("resp 20 comes from the box next to the RESP label", o.suggestions.respRate?.text === "20", txt(o.suggestions));
  ok("the log says the pulse came from elimination, with the box position", o.log.some((l) => /Pulse: ACCEPTED 60 by elimination.*x=1195, y=139/.test(l)));
  ok("two temperature channels (T1 37.7 / T2 37.2): none is filled, both are offered, T1 first", !o.suggestions.temperature && !o.values.temperature && JSON.stringify(o.choices.temperature) === '["99.9","99.0"]', JSON.stringify(o.choices));
  ok("no contradictory temperature note is left behind", !o.notes.some((n) => /^Temperature: a decimal/.test(n)) && o.notes.some((n) => /more than one temperature/.test(n)));
  ok("the screen was handled without any green value", Object.keys(o.values).length === 0);
  ok("without the banner trace, the same layout still reads the same pulse (the banner was never needed)", run([...labels, hr, bp, resp, spo2, fragment, t1, t2], 1600, 1203).suggestions.pulse?.text === "60");
}

console.log("9) a fragment of a longer number is not a reading");
{
  const bp = blob(1111, 340, 281, 61, [...D(["120/80", "120/80"], "normal", 90), ...D(["120/80"], "mask:bright85/psm7", 0), ...D(["120/80"], "adaptive/psm7", 0)]);
  const fragment = T("20", 90, "N I C", 1153, 339, 84, 64);
  let o = run([fragment, bp], 1600, 1203);
  ok('"20" sitting inside a box that votes 120/80 is dropped', !Object.values({ ...o.values, ...o.suggestions }).some((v) => v.text === "20"), txt({ ...o.values, ...o.suggestions }));
  ok("...and the box still gives the real pressure", o.suggestions.bpSystolic?.text === "120");
  ok("the drop is explained", o.log.some((l) => /20 dropped: it is a fragment of 120/.test(l)));
  const resp = blob(1203, 795, 145, 99, [...D(["20", "20"], "normal", 96), ...D(["20"], "adaptive/psm7", 96), ...D(["20"], "mask:bright85/psm7", 50)]);
  o = run([fragment, bp, resp], 1600, 1203);
  ok("but a 20 that ANOTHER box also reads (the real RESP number) is kept", Object.values({ ...o.values, ...o.suggestions }).some((v) => v.text === "20"), txt({ ...o.values, ...o.suggestions }));
}

console.log("10) temperature next to its label");
{
  const o = run([L("TEMP", 1128, 955), T("37.2", 93, "N I C", 1223, 1069, 110, 41)], 1600, 1203);
  ok("a single channel is offered in amber, converted to degF", o.suggestions.temperature?.text === "99.0", txt(o.suggestions));
  const lone = run([L("TEMP", 1128, 955), T("37.7", 93, "N I C", 1223, 991, 109, 41), T("37.5", 93, "N I C", 1223, 995, 109, 41)], 1600, 1203);
  ok("two readings of the SAME line (overlapping boxes) are one channel, not two", !lone.choices.temperature, JSON.stringify(lone.choices));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
