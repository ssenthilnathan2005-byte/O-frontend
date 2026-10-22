// scripts/check-label-pass.mjs - regression checks for the label / unit pass in src/lib/vitalsMerge.ts.
// Run:  node scripts/check-label-pass.mjs        (vitalsMerge.ts imports nothing, so plain Node is enough)
// Layouts and numbers are modelled on real monitor photos (a PUAO PDJ-5000 with a "PR TOO LOW" alarm banner, two
// temperature channels and a thin leading "1" that OCR drops from "120").
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { mergeVitals } = await import(pathToFileURL(path.join(here, "../src/lib/vitalsMerge.ts")).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); } };
const W = (text, x, y, w, h, conf = 95) => ({ text, conf, x0: x, y0: y, x1: x + w, y1: y + h });
const run = (words, imgW = 1600) => mergeVitals(words, imgW);
// only a STRONG read counts: the result object also carries weak position guesses ("suggested"), which the merge layer ignores
const rd = (x) => (x.status === "read" ? x.value : null);
const vals = (r) => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([, v]) => v.status === "read").map(([k, v]) => [k, Math.round(v.value * 100) / 100])));

console.log("1) an alarm banner is not a label");
{
  const banner = [W("PR", 999, 19, 40, 24), W("TOO", 1045, 19, 45, 24), W("LOW", 1100, 19, 45, 24), W("20", 1153, 339, 84, 64, 90)];
  ok('"PR TOO LOW" does not claim a number as the pulse', rd(run(banner).pulse) === null, vals(run(banner)));
  const real = [W("PR", 999, 19, 40, 24), W("98", 1060, 70, 80, 60)];
  ok("the same PR with no alarm word after it is still a normal label (control)", rd(run(real).pulse) === 98);
  ok("SPO2 LEAD OFF is a banner too", run([W("SPO2", 400, 30, 60, 24), W("LEAD", 470, 30, 50, 24), W("OFF", 530, 30, 40, 24), W("97", 420, 80, 80, 60)]).spo2.status !== "read");
}

console.log("2) a label only claims a number that is plausibly close");
{
  ok("a number 6 digit-heights away is not claimed", run([W("HR", 100, 100, 40, 24), W("72", 900, 600, 80, 60)]).pulse.status !== "read");
  ok("a number right below the label is claimed", rd(run([W("HR", 100, 100, 40, 24), W("72", 110, 130, 80, 60)]).pulse) === 72);
}

console.log("3) fail closed when two different numbers are about equally close");
{
  ok("two equally close numbers: the label claims neither", run([W("SpO2", 100, 100, 70, 24), W("98", 200, 130, 80, 60), W("96", 200, 135, 80, 60)]).spo2.status !== "read");
  const hrAbove = [W("HR", 100, 40, 40, 24), W("78", 110, 70, 80, 60), W("SpO2", 100, 150, 70, 24), W("98", 110, 180, 80, 60)];
  ok("HR sitting right above the SpO2 label is not mistaken for SpO2", rd(run(hrAbove).spo2) === 98 && rd(run(hrAbove).pulse) === 78, vals(run(hrAbove)));
}

console.log("4) two temperature channels (T1 37.7 / T2 37.2) are a conflict, never a pick");
{
  const two = [W("TEMP", 1128, 955, 70, 22), W("37.7", 1223, 991, 109, 41), W("37.2", 1223, 1069, 110, 41)];
  const r = run(two);
  ok("both channels are reported as a conflict", r.temp.status === "conflict" && rd(r.temp) === null, r.temp.status);
  ok("both values are offered", [...new Set(r.temp.candidates.map((c) => Math.round(c.value * 10) / 10))].sort().join() === "37.2,37.7", JSON.stringify(r.temp.candidates));
  ok("a single channel is read normally", rd(run([W("TEMP", 1128, 955, 70, 22), W("37.2", 1223, 1069, 110, 41)]).temp) === 37.2);
}

console.log("5) two labels for one vital that disagree (HR 154 vs Pulse 153)");
{
  const r = run([W("HR", 100, 100, 40, 24), W("154", 110, 130, 90, 60), W("Pulse", 500, 100, 70, 24), W("153", 510, 130, 90, 60)]);
  ok("pulse is a conflict with both candidates", r.pulse.status === "conflict" && r.pulse.candidates.length >= 2, r.pulse.status);
  ok("two labels that agree are just one reading", rd(run([W("HR", 100, 100, 40, 24), W("72", 110, 130, 80, 60), W("PR", 500, 100, 40, 24), W("72", 510, 130, 80, 60)]).pulse) === 72);
}

console.log("6) temperature digits: degC, degF, lost decimal point, decimal comma, and NOT a bare 98");
{
  const t = (num, w = 100) => rd(run([W("TEMP", 100, 100, 70, 22), W(num, 110, 135, w, 40)]).temp);
  ok("37.5 degC", Math.abs(t("37.5") - 37.5) < 0.01);
  ok("98.6 degF is converted", Math.abs(t("98.6") - 37) < 0.01);
  ok("368 (point lost) is 36.8", Math.abs(t("368") - 36.8) < 0.01);
  ok("36,8 (decimal comma) is 36.8", Math.abs(t("36,8") - 36.8) < 0.01);
  ok("a bare 98 near the label is NOT a temperature (that is SpO2)", t("98") === null);
  ok("a bare 37 is not taken either", t("37") === null);
}

console.log("7) one printed number serves one vital");
{
  const r = run([W("SpO2", 100, 100, 70, 24), W("RESP", 400, 100, 70, 24), W("20", 250, 130, 80, 60)]);
  const n = [rd(r.spo2), rd(r.rr)].filter((v) => v === 20).length;
  ok("a single 20 between two labels is claimed at most once", n <= 1, vals(r));
}

console.log("8) blood pressure from text");
{
  ok("120 /80 is read as 120 over 80", run([W("120", 1111, 340, 130, 61), W("/80", 1250, 340, 140, 61)]).sys.value === 120 && run([W("120", 1111, 340, 130, 61), W("/80", 1250, 340, 140, 61)]).sys.status === "read");
  ok("20 /80 (the leading 1 was lost) is NOT read as a pressure", run([W("20", 1153, 339, 84, 64), W("/80", 1271, 337, 123, 66)]).sys.status !== "read");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
