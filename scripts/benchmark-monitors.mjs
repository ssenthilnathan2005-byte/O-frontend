// Run:  node scripts/benchmark-monitors.mjs [folder]      (default folder: monitor-tests)
//
// Scores the scanner against REAL scans of real monitors. For each device make a folder:
//   monitor-tests/<brand-model-condition>/
//       scan.json      <- in the app: Scan All Vitals > Read screen > "What the scanner saw" > "Copy scan data for testing"
//       expected.json  <- the true values you can read on the monitor screen (see format below)
//
// expected.json
//   {
//     "device": "Mindray uMEC 10",
//     "condition": "tube-light glare, straight on",
//     "source": "live-camera",            // or "stock-photo". Only live-camera counts as field testing.
//     "expected": {
//       "pulse": "72", "spo2": "98", "bpSystolic": "118", "bpDiastolic": "78",
//       "respRate": "16", "temperatureC": "36.8",      // or "temperatureF"
//       "bpSystolic": null                              // null = must stay BLANK (for example an invasive ART value)
//     }
//   }
// A field that is not listed is "not on the screen": if the scanner fills it anyway, that counts as WRONG.
//
// Pass rule: ZERO wrong readings. Blank fields are acceptable (staff type them); a wrong value is not.
import fs from "node:fs";
import path from "node:path";
import { matchMonitorReadings, resolveTemplate, FIELD_LABEL } from "../src/lib/monitorMatch.ts";

const root = process.argv[2] || "monitor-tests";
const FIELDS = ["pulse", "spo2", "bpSystolic", "bpDiastolic", "respRate", "temperature"];
const NOTE_KEY = { pulse: "Pulse", spo2: "SpO2", bpSystolic: "BP", bpDiastolic: "BP", respRate: "Resp rate", temperature: "Temperature" };

if (!fs.existsSync(root)) {
  console.log(`Folder "${root}" does not exist. Create it and add one sub-folder per monitor photo (see the top of this file).`);
  process.exit(2);
}

const expectedFor = (e, f) => {
  if (f === "temperature") {
    if ("temperatureF" in e) return e.temperatureF === null ? null : String(e.temperatureF);
    if ("temperatureC" in e) return e.temperatureC === null ? null : (Number(e.temperatureC) * 9 / 5 + 32).toFixed(1);
    return undefined;
  }
  return f in e ? (e[f] === null ? null : String(e[f])) : undefined;
};

const rows = [];
const skipped = [];
for (const d of fs.readdirSync(root, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const sp = path.join(root, d.name, "scan.json"), ep = path.join(root, d.name, "expected.json");
  if (!fs.existsSync(sp) || !fs.existsSync(ep)) { skipped.push(d.name); continue; }
  const scan = JSON.parse(fs.readFileSync(sp, "utf8"));
  const meta = JSON.parse(fs.readFileSync(ep, "utf8"));
  const exp = meta.expected || {};
  const { template } = resolveTemplate(meta.template || scan.tplId || "auto", scan.words);
  const out = matchMonitorReadings(scan.words, { template, width: scan.width, height: scan.height });
  for (const f of FIELDS) {
    const want = expectedFor(exp, f);
    const got = out.values[f]?.text;
    const sug = out.suggestions[f]?.text;
    const noted = out.notes.some((n) => n.startsWith(FIELD_LABEL[f]) || (NOTE_KEY[f] === "BP" && (n.includes("BP") || n.includes("invasive"))));
    let result;
    if (got !== undefined) result = want !== undefined && want !== null && got === want ? "CORRECT" : "WRONG";
    else if (want === undefined || want === null) result = "BLANK (ok)";
    else result = sug !== undefined || noted ? "REJECTED" : "MISSING";
    rows.push({ device: meta.device || d.name, cond: meta.condition || "", source: meta.source || "unspecified", template: template?.id || "generic", f, want, got, result, conf: out.values[f]?.conf });
  }
}

if (!rows.length) {
  console.log(`No scored devices found in "${root}". Each sub-folder needs scan.json and expected.json.`);
  if (skipped.length) console.log("Incomplete folders: " + skipped.join(", "));
  process.exit(2);
}

const pad = (s, n) => String(s ?? "-").padEnd(n);
console.log("\nPER DEVICE");
console.log(pad("device", 28) + pad("layout", 12) + pad("vital", 13) + pad("expected", 9) + pad("got", 9) + pad("conf", 6) + "result");
for (const r of rows) console.log(pad(r.device.slice(0, 27), 28) + pad(r.template, 12) + pad(r.f, 13) + pad(r.want === undefined ? "(n/a)" : r.want === null ? "(blank)" : r.want, 9) + pad(r.got, 9) + pad(r.conf !== undefined ? r.conf + "%" : "-", 6) + r.result);

console.log("\nPER VITAL (all devices)");
console.log(pad("vital", 13) + pad("correct", 9) + pad("wrong", 7) + pad("rejected", 10) + pad("missing", 9) + "blank-ok");
let wrong = 0;
for (const f of FIELDS) {
  const rs = rows.filter((r) => r.f === f);
  const c = (k) => rs.filter((r) => r.result === k).length;
  wrong += c("WRONG");
  console.log(pad(f, 13) + pad(c("CORRECT"), 9) + pad(c("WRONG"), 7) + pad(c("REJECTED"), 10) + pad(c("MISSING"), 9) + c("BLANK (ok)"));
}

const confOf = (k) => rows.filter((r) => r.result === k && r.conf !== undefined).map((r) => r.conf);
const range = (a) => (a.length ? `${Math.min(...a)}-${Math.max(...a)}%` : "none");
console.log(`\nCONFIDENCE  correct reads: ${range(confOf("CORRECT"))}   wrong reads: ${range(confOf("WRONG"))}`);

const devices = [...new Set(rows.map((r) => r.device))];
const live = [...new Set(rows.filter((r) => r.source === "live-camera").map((r) => r.device))];
console.log(`\nCOVERAGE  ${devices.length} device scan(s) scored, ${live.length} from live camera photos.`);
if (skipped.length) console.log("Not scored (missing scan.json or expected.json): " + skipped.join(", "));
console.log("Universal compatibility is NOT claimed. Only the devices listed above have been tested.");
if (live.length < 5) console.log("Fewer than 5 live-camera devices: treat every other monitor as 'generic mode, verify carefully'.");

console.log(wrong ? `\nFAIL: ${wrong} wrong reading(s).` : "\nPASS: no wrong readings (blanks are allowed).");
process.exit(wrong ? 1 : 0);