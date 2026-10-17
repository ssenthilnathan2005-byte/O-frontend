// scripts/check-color-mask.mjs - regression checks for src/lib/colorMask.ts (synthetic images, no photos needed).
// Run:  node scripts/check-color-mask.mjs      (Node 22.18+/24 can import .ts directly; otherwise: npx tsx scripts/check-color-mask.mjs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cm = await import(pathToFileURL(path.join(here, "../src/lib/colorMask.ts")).href);
const {
  MASK_PROFILES, buildMask, buildAllMasks, cleanMask, maskStats, isUseful, toBinary, adaptiveMask,
  maskCandidates, rankMasks, hexToRgb, withOverrides, findNumberBlobs,
} = cm;
const byId = (id) => MASK_PROFILES.find((p) => p.id === id);

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); } };

// ---- tiny image toolkit ---------------------------------------------------------------------------------
const img = (w, h, bg = [18, 18, 18]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255; }
  return { data, width: w, height: h };
};
const px = (im, x, y, c, a = 255) => { if (x < 0 || y < 0 || x >= im.width || y >= im.height) return; const i = (y * im.width + x) * 4; im.data[i] = c[0]; im.data[i + 1] = c[1]; im.data[i + 2] = c[2]; im.data[i + 3] = a; };
const rect = (im, x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(im, xx, yy, c); };
const ring = (im, x, y, w, h, t, c) => { rect(im, x, y, w, h, c); rect(im, x + t, y + t, w - 2 * t, h - 2 * t, [18, 18, 18]); };
const line = (im, x0, y0, x1, y1, t, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n); rect(im, x, y, t, t, c); } };
const clone = (im) => ({ data: new Uint8ClampedArray(im.data), width: im.width, height: im.height });
const GREEN = [40, 225, 70], CYAN = [10, 225, 230], YELLOW = [240, 220, 10], WHITE = [250, 250, 250], RED = [230, 30, 30];

console.log("1) one mask per colour profile, independent of each other");
{
  const im = img(200, 40);
  const cols = [GREEN, CYAN, YELLOW, WHITE, RED];
  cols.forEach((c, i) => rect(im, 5 + i * 38, 8, 20, 20, c));
  const masks = buildAllMasks(im);
  const ids = ["green", "cyan", "yellow", "white", "red"];
  ids.forEach((id) => ok(id + " mask has exactly its own 400 pixels", masks[id].count === 400, "count=" + masks[id].count));
  let overlap = 0;
  for (let p = 0; p < im.width * im.height; p++) { let n = 0; for (const id of ids) n += masks[id].data[p]; if (n > 1) overlap++; }
  ok("no pixel belongs to two colour masks", overlap === 0, "overlap=" + overlap);
  ok("dark background is in no mask", ids.every((id) => masks[id].data[1] === 0));
  const lighter = img(40, 40); rect(lighter, 5, 5, 20, 20, [34, 204, 85]); // #22cc55, a slightly different green
  ok("a different shade of green still matches (white balance tolerance)", buildMask(lighter, byId("green")).count === 400);
}

console.log("2) configurable colours: HEX route, overrides");
{
  ok("hexToRgb #0f0", JSON.stringify(hexToRgb("#0f0")) === JSON.stringify({ r: 0, g: 255, b: 0 }));
  ok("hexToRgb #FF8800", JSON.stringify(hexToRgb("#FF8800")) === JSON.stringify({ r: 255, g: 136, b: 0 }));
  ok("hexToRgb rejects garbage", hexToRgb("nope") === null && hexToRgb("#12") === null);
  const orange = { id: "orange", label: "Orange", role: "candidate", hex: "#ff8800", maxDistance: 40, minSat: 2 }; // hue route disabled (sat can never reach 2)
  const im = img(30, 10); rect(im, 0, 0, 10, 10, [250, 140, 10]); rect(im, 20, 0, 10, 10, GREEN);
  ok("HEX + distance matches only the near colour", buildMask(im, orange).count === 100);
  const tuned = withOverrides(MASK_PROFILES, { green: { minSat: 0.99 } });
  ok("override changes one profile only", tuned.find((p) => p.id === "green").minSat === 0.99 && tuned.find((p) => p.id === "cyan").minSat === byId("cyan").minSat);
  ok("override does not modify the defaults", byId("green").minSat !== 0.99);
}

console.log("3) binary output: black foreground, white elsewhere, original image untouched");
{
  const im = img(40, 20); rect(im, 5, 5, 10, 10, GREEN);
  const before = clone(im);
  const m = buildMask(im, byId("green"));
  const bin = toBinary(m, 4);
  const at = (x, y) => { const i = (y * bin.width + x) * 4; return [bin.data[i], bin.data[i + 1], bin.data[i + 2], bin.data[i + 3]].join(","); };
  ok("foreground pixel is #000000 opaque", at(4 + 6, 4 + 6) === "0,0,0,255");
  ok("background pixel is #FFFFFF opaque", at(4 + 30, 4 + 2) === "255,255,255,255");
  ok("white margin was added", at(0, 0) === "255,255,255,255" && bin.width === 48 && bin.height === 28);
  ok("original image data was not modified", Buffer.compare(Buffer.from(im.data), Buffer.from(before.data)) === 0);
  let black = 0; for (let i = 0; i < bin.data.length; i += 4) if (bin.data[i] === 0) black++;
  ok("black pixel count equals mask count", black === m.count, black + " vs " + m.count);
}

console.log("4) decimal points, slashes and segmented numerals survive; waveform and dust are removed");
{
  const im = img(200, 80);
  ring(im, 10, 10, 14, 30, 4, GREEN);   // digit 3 (stand-in)
  ring(im, 30, 10, 14, 30, 4, GREEN);   // digit 6
  rect(im, 50, 36, 4, 4, GREEN);        // decimal point
  ring(im, 60, 10, 14, 30, 4, GREEN);   // digit 8
  line(im, 100, 40, 110, 10, 3, GREEN); // slash
  // a segmented numeral: separate bars that touch nothing
  rect(im, 130, 10, 14, 4, GREEN); rect(im, 130, 24, 14, 4, GREEN); rect(im, 130, 38, 14, 4, GREEN);
  rect(im, 126, 14, 4, 10, GREEN); rect(im, 146, 14, 4, 10, GREEN);
  // an ECG-like waveform across the whole width, same colour
  for (let x = 0; x < 200; x++) rect(im, x, 60 + Math.round(5 * Math.sin(x / 6)), 1, 2, GREEN);
  // dust far away from every digit
  [[190, 5], [195, 20], [185, 50], [3, 75], [100, 75]].forEach(([x, y]) => px(im, x, y, GREEN));
  const raw = buildMask(im, byId("green"));
  const { mask, stats } = cleanMask(raw);
  const has = (x, y) => mask.data[y * mask.width + x] === 1;
  ok("decimal point kept", has(51, 37));
  ok("slash kept", has(105, 25));
  ok("digit outlines kept", has(10, 10) && has(30, 10) && has(60, 10));
  ok("all five bars of the segmented numeral kept", has(135, 11) && has(135, 25) && has(135, 39) && has(127, 18) && has(147, 18));
  ok("waveform removed", !has(50, 60) && !has(150, 62) && stats.removedWide >= 1, JSON.stringify(stats));
  ok("isolated dust removed", !has(190, 5) && !has(195, 20) && !has(185, 50) && !has(3, 75) && !has(100, 75) && stats.removedSpeckle >= 4, JSON.stringify(stats));
  ok("cleaned mask still looks like digits", isUseful(mask) && maskStats(mask).digitLike >= 3);
}

console.log("5) poor images, empty masks and processing errors never throw");
{
  const black = img(60, 30, [0, 0, 0]);
  ok("all-black image gives an empty mask", buildMask(black, byId("green")).count === 0);
  ok("empty mask is not useful", !isUseful(buildMask(black, byId("green"))));
  ok("no useful candidates on a black image", maskCandidates(black).items.length === 0);
  let threw = false;
  try {
    buildMask(null, byId("green")); buildMask(undefined, byId("green"));
    buildMask({ data: new Uint8ClampedArray(3), width: 10, height: 10 }, byId("green"));
    buildMask({ data: new Uint8ClampedArray(0), width: 0, height: 0 }, byId("green"));
    cleanMask(null); maskStats(null); toBinary(null); adaptiveMask(null); rankMasks({ data: null, width: 5, height: 5 }); maskCandidates(null);
  } catch (e) { threw = true; console.log("     threw: " + e); }
  ok("null / truncated / zero-size input is handled", !threw);
  const clear = img(20, 20); rect(clear, 0, 0, 20, 20, GREEN); for (let i = 3; i < clear.data.length; i += 4) clear.data[i] = 0;
  ok("fully transparent pixels are ignored", buildMask(clear, byId("green")).count === 0);
  const huge = { data: new Uint8ClampedArray(1600 * 1400 * 4), width: 1600, height: 1400 };
  ok("oversized regions are skipped (no UI freeze)", maskCandidates(huge).items.length === 0);
}

console.log("6) safe fallback when colour masking does not help");
{
  const grey = img(120, 50, [40, 40, 40]);
  ring(grey, 10, 8, 20, 34, 5, [170, 170, 170]); ring(grey, 40, 8, 20, 34, 5, [170, 170, 170]); // pale, unsaturated digits
  const cand = maskCandidates(grey);
  ok("no colour mask is useful for grey digits", !cand.items.some((c) => c.method.startsWith("mask:")), cand.items.map((c) => c.method).join(","));
  ok("adaptive threshold is offered instead", cand.items.some((c) => c.method === "adaptive"));
  const ad = adaptiveMask(grey);
  ok("adaptive mask finds the digit outlines", ad.count > 100 && maskStats(ad).digitLike >= 2, "count=" + ad.count);
  const dark = img(120, 50, [235, 235, 235]); ring(dark, 10, 8, 20, 34, 5, [30, 30, 30]);
  ok("adaptive threshold also handles dark digits on a light screen", adaptiveMask(dark).count > 100);
}

console.log("7) coloured digits get a colour mask; red stays out of the candidates");
{
  const im = img(120, 50);
  ring(im, 10, 8, 20, 34, 5, GREEN); ring(im, 40, 8, 20, 34, 5, GREEN);
  const c = maskCandidates(im);
  ok("green digits -> a colour mask comes first (brightness or green)", c.items[0] && ["mask:bright85", "mask:bright", "mask:green"].includes(c.items[0].method), c.items.map((x) => x.method).join(","));
  ok("adaptive fallback is still offered after the colour mask", c.items.some((x) => x.method === "adaptive"));
  const red = img(120, 50); ring(red, 10, 8, 20, 34, 5, RED); ring(red, 40, 8, 20, 34, 5, RED);
  const r = maskCandidates(red);
  ok("the red profile is never used as a candidate mask (ART / IBP clue only; which BP is which is decided by labels and boxes)", !r.items.some((x) => x.method === "mask:red"), r.items.map((x) => x.method).join(","));
  ok("red is reported as generated-but-excluded", r.excluded.includes("red"));
  ok("repeat calls reuse the cached masks (same object)", rankMasks(im) === rankMasks(im));
}


console.log("8) real monitor colours: pale, washed-out digits (measured on a real photo)");
{
  // Measured: HR digits ~ rgb(175,229,188) (sat 0.24), SpO2 ~ rgb(169,208,237) (sat 0.29), RR ~ rgb(199,215,239) (sat 0.17).
  const PALE = { hr: [175, 229, 188], spo2: [169, 208, 237], rr: [199, 215, 239] };
  const im = img(120, 30, [12, 14, 20]);
  rect(im, 5, 5, 20, 20, PALE.hr); rect(im, 45, 5, 20, 20, PALE.spo2); rect(im, 85, 5, 20, 20, PALE.rr);
  const oldGreen = { id: "oldGreen", label: "old", role: "candidate", hue: [80, 165], minSat: 0.4, minVal: 0.4 };
  const oldCyan = { id: "oldCyan", label: "old", role: "candidate", hue: [166, 205], minSat: 0.4, minVal: 0.4 };
  ok("the OLD saturated-colour rules match none of the pale digits (why they failed on the real photo)", buildMask(im, oldGreen).count === 0 && buildMask(im, oldCyan).count === 0);
  ok("the strict brightness mask isolates all three pale numbers", buildMask(im, byId("bright85")).count === 1200, String(buildMask(im, byId("bright85")).count));
  ok("the retuned green profile matches the pale green HR digits (and only those)", buildMask(im, byId("green")).count === 400);
  ok("the retuned cyan profile matches the pale blue SpO2 digits", buildMask(im, byId("cyan")).count >= 400);
  ok("a dark background is in none of the brightness masks", buildMask(im, byId("bright")).data[0] === 0 && buildMask(im, byId("bright85")).data[0] === 0);
  const light = img(60, 40, [235, 235, 235]); ring(light, 10, 8, 14, 24, 4, [30, 30, 30]); ring(light, 30, 8, 14, 24, 4, [30, 30, 30]);
  const lc = maskCandidates(light);
  ok("on a LIGHT screen the brightness mask is not used (it would pick the background)", !lc.items.some((x) => x.method === "mask:bright85" || x.method === "mask:bright"), lc.items.map((x) => x.method).join(","));
  ok("...the adaptive fallback handles it instead", lc.items.some((x) => x.method === "adaptive"));
}

console.log("9) finding number boxes by brightness blobs (no OCR, no labels)");
{
  const build = (k) => {                       // k = resolution factor, to prove the finder is not tied to pixel sizes
    const W = 400 * k, H = 300 * k, im = img(W, H, [12, 14, 20]);
    const num = (x, y, n) => { for (let i = 0; i < n; i++) ring(im, (x + i * 22) * k, y * k, 16 * k, 30 * k, 5 * k, PALE_GREEN); };
    num(260, 30, 3); num(260, 100, 2); num(260, 170, 2);                 // three big numbers on the right: 3, 2 and 2 digits
    for (let x = 0; x < W; x++) rect(im, x, (240 + Math.round(6 * Math.sin(x / (9 * k)))) * k, 1, 2 * k, PALE_GREEN); // a waveform
    rect(im, 40 * k, 60 * k, 2 * k, 90 * k, PALE_GREEN);                  // a thin vertical line (grid / bezel)
    [[10, 10], [380, 20], [20, 280], [200, 150]].forEach(([x, y]) => px(im, x * k, y * k, PALE_GREEN)); // dust
    return im;
  };
  const PALE_GREEN = [175, 229, 188];
  for (const k of [1, 2]) {
    const boxes = findNumberBlobs(build(k));
    const near = (b, x, y, n) => Math.abs(b.x0 - x * k) <= 3 * k && Math.abs(b.y0 - y * k) <= 3 * k && b.blobs === n;
    ok(`x${k}: the 3-digit, 2-digit and 2-digit numbers are found with the right digit counts`, boxes.some((b) => near(b, 260, 30, 3)) && boxes.some((b) => near(b, 260, 100, 2)) && boxes.some((b) => near(b, 260, 170, 2)), JSON.stringify(boxes));
    ok(`x${k}: the waveform, the thin line and the dust are not returned as numbers`, boxes.length === 3, "got " + boxes.length);
  }
  ok("an empty / black / null / oversized image gives no boxes and never throws", findNumberBlobs(img(100, 60, [0, 0, 0])).length === 0 && findNumberBlobs(null).length === 0 && findNumberBlobs({ data: new Uint8ClampedArray(4), width: 5000, height: 5000 }).length === 0);
}

console.log("10) source checks on src/components/VitalsScanAll.tsx (human verification, no duplicate fields, original confidence)");
{
  const file = path.join(here, "../src/components/VitalsScanAll.tsx");
  if (!fs.existsSync(file)) { fail++; console.log("  FAIL  component not found at " + file); }
  else {
    const s = fs.readFileSync(file, "utf8");
    ok("mandatory checkbox text is present", s.includes("I checked these values against the monitor."));
    ok("applying still requires the checkbox", /const canApply = step === "review" && verified && anyValue && !problem;/.test(s));
    ok("the Fill button is disabled without it", /onClick=\{apply\} disabled=\{!canApply\}/.test(s));
    ok("onApply is only called from apply()", (s.match(/onApply\(/g) || []).length === 1);
    ok("review fields still come from the de-duplicated list", /const shown = uniqueKeys\(/.test(s));
    ok("each field is rendered once (single shown.map)", (s.match(/shown\.map\(\(f\) =>/g) || []).length === 1);
    ok("nothing is saved by the scanner (no fetch / save calls)", !/\bfetch\(|localStorage|sessionStorage/.test(s));
    if (s.includes("maskCandidates")) {
      ok("mask reads keep Tesseract's own confidence", /method: it\.method[^\n]*\n?/.test(s) && s.includes("conf: Number(data?.confidence ?? 0), method:"));
      ok("confidence is never boosted by colour", !/conf\s*[*+]=|conf:\s*[^,\n]*\*\s*1\./.test(s));
      const sets = (s.match(/tessedit_char_whitelist: "0123456789\.\/"/g) || []).length, restores = (s.match(/tessedit_char_whitelist: ""/g) || []).length;
      ok("every time the digits-only whitelist is set, the label OCR setting is restored afterwards", sets >= 2 && sets === restores, "set " + sets + " times, restored " + restores + " times");
    } else console.log("  (mask integration not applied yet: skipping the 3 mask-specific source checks)");
  }
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
