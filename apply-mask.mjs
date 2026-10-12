// apply-mask.mjs - run from the project root:  node apply-mask.mjs
// Adds colour-mask + adaptive-threshold reads (PSM 7 and PSM 8) to the big-digit re-check in VitalsScanAll.tsx.
// Needs apply-deep.mjs to have been applied first. Makes a .bak first. If any anchor is missing, nothing is written.
import fs from "node:fs";

const FILE = process.argv[2] || "src/components/VitalsScanAll.tsx";
const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("maskCandidates")) { console.log("Already patched. Nothing to do."); process.exit(0); }
if (!s.includes("pickDeepTargets")) { console.error("NOT PATCHED: run  node apply-deep.mjs  first (the big-digit re-check is not in this file yet)."); process.exit(1); }

const problems = [];
function once(name, find, replacement) {
  const n = s.split(find).length - 1;
  if (n !== 1) { problems.push(`${name}: expected 1 match, found ${n}`); return; }
  s = s.replace(find, () => replacement);
}

once("import",
  'import { combineMatches, pickDeepTargets } from "@/lib/scanCombine";',
  'import { combineMatches, pickDeepTargets } from "@/lib/scanCombine";\nimport { colorCrop, canvasToPixels, pixelsToCanvas, maskCandidates } from "@/lib/colorMask";');

once("read type",
  'const reads: { text: string; conf: number }[] = [];',
  'const reads: { text: string; conf: number; method?: string }[] = [];');

once("normal read tag",
  'if (text) reads.push({ text, conf: Number(data?.confidence ?? 0) });',
  'if (text) reads.push({ text, conf: Number(data?.confidence ?? 0), method: "normal" });');

once("mask reads",
  '              trace.deep = reads;',
  '              // Colour-mask and adaptive-threshold reads (sharpest frame only). The mask only cleans the picture before OCR:\n' +
  '              // the confidence stored is exactly what Tesseract reported, and colour never decides which vital a number is.\n' +
  '              try {\n' +
  '                const crop = colorCrop(imgEl, base.sx + box.x0 / base.scale, base.sy + box.y0 / base.scale, base.sx + box.x1 / base.scale, base.sy + box.y1 / base.scale, 110);\n' +
  '                const pixels = crop ? canvasToPixels(crop) : null;\n' +
  '                const cands = pixels ? maskCandidates(pixels) : { items: [] as { method: string; image: any }[], excluded: [] as string[] };\n' +
  '                let firstMask = true;\n' +
  '                for (const it of cands.items) {\n' +
  '                  const mc = pixelsToCanvas(it.image);\n' +
  '                  if (!mc) continue;\n' +
  '                  // PSM 7 (single line) for every mask, plus PSM 8 (single word) for the best one\n' +
  '                  for (const psm of firstMask ? [PSM.SINGLE_LINE, PSM.SINGLE_WORD] : [PSM.SINGLE_LINE]) {\n' +
  '                    await worker.setParameters({ tessedit_pageseg_mode: psm } as any);\n' +
  '                    const { data } = await worker.recognize(mc);\n' +
  '                    const text = String(data?.text || "").replace(/\\s+/g, "");\n' +
  '                    if (text) reads.push({ text, conf: Number(data?.confidence ?? 0), method: it.method + (psm === PSM.SINGLE_WORD ? "/psm8" : "/psm7") });\n' +
  '                  }\n' +
  '                  firstMask = false;\n' +
  '                }\n' +
  '                await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE } as any);\n' +
  '              } catch { /* masks are optional: the normal reads above still count */ }\n' +
  '              trace.deep = reads;');

if (problems.length) {
  console.error("NOT PATCHED. Nothing was changed:\n - " + problems.join("\n - "));
  process.exit(1);
}
fs.writeFileSync(FILE + ".bak", raw);
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Patched " + FILE + " (backup: " + FILE + ".bak)");
