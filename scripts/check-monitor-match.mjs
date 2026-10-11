// Run:  node scripts/check-monitor-match.mjs
// Checks the monitor matcher against SAMPLE data (see src/lib/monitorSamples.ts). No camera needed.
import { matchMonitorReadings } from "../src/lib/monitorMatch.ts";
import { SAMPLE_BEDSIDE_MONITOR, SAMPLE_SPOT_CHECK_MONITOR } from "../src/lib/monitorSamples.ts";

let failed = 0;
const toWords = (s) => s.words.map(([text, conf, x0, y0, x1, y1]) => ({ text, conf, x0, y0, x1, y1 }));
const val = (o, f) => o.values[f]?.text;

function expect(name, cond, detail) {
  if (cond) console.log("  ok   " + name);
  else { failed++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
}

function run(title, words, opts, checks) {
  console.log("\n" + title);
  const out = matchMonitorReadings(words, opts);
  console.log("  values:", Object.fromEntries(Object.entries(out.values).map(([k, v]) => [k, v.text])));
  if (out.notes.length) console.log("  notes :", out.notes);
  checks(out);
}

run(SAMPLE_BEDSIDE_MONITOR.name, toWords(SAMPLE_BEDSIDE_MONITOR), { width: 736, height: 600 }, (o) => {
  expect("BP 120/80 from the slash pair", val(o, "bpSystolic") === "120" && val(o, "bpDiastolic") === "80");
  expect("SpO2 98", val(o, "spo2") === "98");
  expect("Resp 20", val(o, "respRate") === "20");
  expect("two temperatures (37.7 / 37.2) are NOT guessed", !o.values.temperature);
  expect("MAP (90) is never used as pulse", val(o, "pulse") !== "90");
});

run(SAMPLE_SPOT_CHECK_MONITOR.name, toWords(SAMPLE_SPOT_CHECK_MONITOR), { width: 1080, height: 820 }, (o) => {
  expect("SYS 180", val(o, "bpSystolic") === "180");
  expect("DIA 90", val(o, "bpDiastolic") === "90");
  expect("SpO2 99", val(o, "spo2") === "99");
  expect("Pulse 86", val(o, "pulse") === "86");
  expect("36.5 C converted to 97.7 F", val(o, "temperature") === "97.7" && o.temp?.unit === "C" && o.temp?.raw === "36.5");
});

// --- safety cases ---
const W = (text, conf, x0, y0, x1, y1) => ({ text, conf, x0, y0, x1, y1 });

run("Low confidence is a suggestion only", [W("SPO2", 90, 0, 0, 40, 12), W("98", 60, 50, 0, 100, 40)], {}, (o) => {
  expect("not filled", !o.values.spo2);
  expect("offered as suggestion", o.suggestions.spo2?.text === "98");
});

run("Out of range is rejected (SpO2 150)", [W("SPO2", 90, 0, 0, 40, 12), W("150", 95, 50, 0, 120, 40)], {}, (o) => {
  expect("not filled", !o.values.spo2 && !o.suggestions.spo2);
});

run("Dropped decimal is never guessed (TEMP 365)", [W("TEMP", 90, 0, 0, 40, 12), W("365", 95, 50, 0, 120, 40)], {}, (o) => {
  expect("not filled", !o.values.temperature);
});

run("Two numbers could be the pulse => blank", [W("PR", 90, 0, 26, 20, 44), W("72", 95, 30, 0, 70, 30), W("75", 95, 30, 40, 70, 70)], {}, (o) => {
  expect("not filled", !o.values.pulse);
});

run("Systolic lower than diastolic is rejected", [W("80/120", 95, 0, 0, 120, 40)], {}, (o) => {
  expect("BP not filled", !o.values.bpSystolic && !o.values.bpDiastolic);
});

run("Single 120/80 word", [W("120/80", 95, 0, 0, 150, 40)], {}, (o) => {
  expect("BP filled", val(o, "bpSystolic") === "120" && val(o, "bpDiastolic") === "80");
});

run("120 / 80 as three words", [W("120", 95, 0, 0, 60, 40), W("/", 90, 62, 0, 72, 40), W("80", 95, 74, 0, 120, 40)], {}, (o) => {
  expect("BP filled", val(o, "bpSystolic") === "120" && val(o, "bpDiastolic") === "80");
});

run("Nothing recognised", [W("hello", 90, 0, 0, 40, 12)], {}, (o) => {
  expect("nothing filled", Object.keys(o.values).length === 0);
  expect("tells the user what to do", o.notes.length > 0);
});

run("Template region reads a fixed area", [W("72", 95, 600, 100, 660, 150), W("9", 60, 10, 10, 20, 20)],
  { width: 1000, height: 500, template: { id: "t", name: "t", regions: { pulse: { x: 0.55, y: 0.1, w: 0.2, h: 0.3 } } } },
  (o) => { expect("pulse from region", val(o, "pulse") === "72"); });

console.log(failed ? "\n" + failed + " check(s) FAILED" : "\nAll checks passed");
process.exit(failed ? 1 : 0);