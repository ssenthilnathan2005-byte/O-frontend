import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { validateVitals } from "@/components/VitalsScanner";
import type { ScannedVitals } from "@/components/VitalsScanner";
import { matchMonitorReadings, MONITOR_TEMPLATES, FIELD_LABEL, FIELD_RANGE } from "@/lib/monitorMatch";
import type { MatchOutput, OcrWord, ScanField } from "@/lib/monitorMatch";

/**
 * "Scan All Vitals" - one photo of a multiparameter monitor fills every reading it can read.
 *
 * SAFETY RULES
 *  - Nothing is saved here. Applying only pre-fills the parent form; the nurse still taps Save Vitals.
 *  - Values the scanner is not sure about stay EMPTY (never guessed). Low-confidence reads are offered as
 *    "use 98?" suggestions that staff must tap.
 *  - Staff must tick "I checked these against the monitor" before the values can be applied.
 *  - OCR runs on this device with locally hosted tesseract files (public/tesseract). No image is uploaded.
 */

export type ScanAllApply = Partial<ScannedVitals> & { respRate?: string; tempUnit?: "F" };

type Props = {
  onApply: (v: ScanAllApply) => void;
  /** Fields this form has. Default: all six. */
  include?: ScanField[];
  label?: string;
};

type Frac = { x0: number; y0: number; x1: number; y1: number };
const ALL_FIELDS: ScanField[] = ["bpSystolic", "bpDiastolic", "pulse", "spo2", "respRate", "temperature"];
const DEG = "\u00B0";

// ---- offline OCR worker (cached between scans) -----------------------------------------------------------
let workerPromise: Promise<any> | null = null;
let progressCb: (p: number) => void = () => {};

function getWorker(): Promise<any> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const base = (((import.meta as any).env?.BASE_URL as string) || "/").replace(/\/?$/, "/");
      const dir = base + "tesseract/";
      const w = await createWorker("eng", 1, {
        workerPath: dir + "worker.min.js",
        corePath: dir,
        langPath: dir + "lang",
        gzip: false,
        logger: (m: any) => {
          if (m && m.status === "recognizing text") progressCb(m.progress || 0);
        },
      } as any);
      await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" } as any);
      return w;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Crop, upscale and (optionally) grayscale + contrast-stretch + auto-invert so digits are dark on light. */
function cropToCanvas(img: HTMLImageElement, f: Frac, process: boolean): HTMLCanvasElement {
  const sx = f.x0 * img.naturalWidth, sy = f.y0 * img.naturalHeight;
  const sw = Math.max(1, (f.x1 - f.x0) * img.naturalWidth), sh = Math.max(1, (f.y1 - f.y0) * img.naturalHeight);
  const scale = process ? Math.max(0.5, Math.min(3, 1600 / Math.max(sw, sh))) : Math.min(1, 480 / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  if (!process) return c;

  const im = ctx.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  const total = c.width * c.height;
  const gray = new Uint8ClampedArray(total);
  const hist = new Array(256).fill(0);
  for (let i = 0, p = 0; p < total; i += 4, p++) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    gray[p] = g;
    hist[g]++;
  }
  let acc = 0, lo = 0, hi = 255;
  for (let t = 0; t < 256; t++) { acc += hist[t]; if (acc >= total * 0.02) { lo = t; break; } }
  acc = 0;
  for (let t = 255; t >= 0; t--) { acc += hist[t]; if (acc >= total * 0.02) { hi = t; break; } }
  const span = Math.max(1, hi - lo);
  let sum = 0;
  for (let p = 0; p < total; p++) {
    const v = hi - lo < 10 ? gray[p] : Math.max(0, Math.min(255, ((gray[p] - lo) * 255) / span));
    gray[p] = v;
    sum += v;
  }
  const invert = sum / total < 110; // mostly dark screen => light digits on dark => flip
  for (let i = 0, p = 0; p < total; i += 4, p++) {
    const v = invert ? 255 - gray[p] : gray[p];
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

function extractWords(data: any): OcrWord[] {
  let raw: any[] = Array.isArray(data?.words) ? data.words : [];
  if (!raw.length && Array.isArray(data?.blocks)) {
    raw = data.blocks.flatMap((b: any) => (b.paragraphs || []).flatMap((p: any) => (p.lines || []).flatMap((l: any) => l.words || [])));
  }
  return raw
    .filter((w) => w && w.bbox && typeof w.text === "string")
    .map((w) => ({ text: w.text, conf: Number(w.confidence ?? w.conf ?? 0), x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }));
}

function checkValues(vals: Record<string, string>, shown: ScanField[]): string | null {
  const subset: Record<string, string> = {};
  for (const f of shown) subset[f] = (vals[f] || "").trim();
  const err = validateVitals(subset);
  if (err) return err;
  if (shown.includes("respRate") && subset.respRate) {
    const [lo, hi, unit] = FIELD_RANGE.respRate;
    const n = Number(subset.respRate);
    if (!Number.isFinite(n) || n < lo || n > hi) return `${FIELD_LABEL.respRate} "${subset.respRate}" is outside the plausible range (${lo}-${hi} ${unit}).`;
  }
  return null;
}

export default function VitalsScanAll({ onApply, include, label }: Props) {
  const shown = include && include.length ? ALL_FIELDS.filter((f) => include.includes(f)) : ALL_FIELDS;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"capture" | "crop" | "reading" | "review">("capture");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Frac | null>(null);
  const [tplId, setTplId] = useState(MONITOR_TEMPLATES[0].id);
  const [out, setOut] = useState<MatchOutput | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [thumb, setThumb] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  function resetAll() {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setStep("capture"); setImgUrl(null); setImgEl(null); setCrop(null); setOut(null);
    setVals({}); setTouched({}); setThumb(null); setVerified(false); setError(""); setProgress(0);
  }
  function openScanner() { resetAll(); setOpen(true); }
  function closeScanner() { resetAll(); setOpen(false); }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImgUrl(url); setImgEl(img); setCrop(null); setOut(null); setError(""); setStep("crop"); };
    img.onerror = () => { URL.revokeObjectURL(url); setError("That photo could not be opened. Try again."); };
    img.src = url;
  }

  // ---- crop box (drag on the photo) ----
  function fracAt(e: React.PointerEvent): { x: number; y: number } {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  }
  function onDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragStart.current = fracAt(e);
    setCrop(null);
  }
  function onMove(e: React.PointerEvent) {
    const s = dragStart.current;
    if (!s) return;
    const p = fracAt(e);
    setCrop({ x0: Math.min(s.x, p.x), y0: Math.min(s.y, p.y), x1: Math.max(s.x, p.x), y1: Math.max(s.y, p.y) });
  }
  function onUp() {
    dragStart.current = null;
    setCrop((c) => (c && (c.x1 - c.x0 < 0.08 || c.y1 - c.y0 < 0.08) ? null : c));
  }

  async function readScreen() {
    if (!imgEl) return;
    setStep("reading"); setProgress(0); setError("");
    try {
      const area: Frac = crop || { x0: 0, y0: 0, x1: 1, y1: 1 };
      const canvas = cropToCanvas(imgEl, area, true);
      setThumb(cropToCanvas(imgEl, area, false).toDataURL("image/jpeg", 0.75));
      progressCb = setProgress;
      const worker = await getWorker();
      const { data } = await worker.recognize(canvas);
      const tpl = MONITOR_TEMPLATES.find((t) => t.id === tplId);
      const result = matchMonitorReadings(extractWords(data), { template: tpl, width: canvas.width, height: canvas.height });
      const next: Record<string, string> = {};
      for (const f of shown) next[f] = result.values[f]?.text || "";
      setOut(result); setVals(next); setTouched({}); setVerified(false); setStep("review");
    } catch (e: any) {
      workerPromise = null;
      setError("Could not read the photo on this device. Check that the OCR files are installed (public/tesseract) or enter the values manually. " + (e?.message || ""));
      setStep("crop");
    }
  }

  function setField(f: ScanField, v: string) {
    setVals((p) => ({ ...p, [f]: v }));
    setTouched((p) => ({ ...p, [f]: true }));
    setVerified(false);
  }

  const problem = step === "review" ? checkValues(vals, shown) : null;
  const anyValue = shown.some((f) => (vals[f] || "").trim() !== "");
  const canApply = step === "review" && verified && anyValue && !problem;

  function apply() {
    if (!canApply) return;
    const payload: ScanAllApply = {};
    for (const f of shown) {
      const v = (vals[f] || "").trim();
      if (v) (payload as any)[f] = v;
    }
    if (payload.temperature) payload.tempUnit = "F";
    onApply(payload);
    closeScanner();
  }

  const tempShown = shown.includes("temperature");
  const tempNote = out?.temp && out.temp.unit === "C" && !touched.temperature && vals.temperature === out.temp.f
    ? `Read ${out.temp.raw} ${DEG}C on the monitor, converted to ${out.temp.f} ${DEG}F (the form uses ${DEG}F).`
    : "";

  return (
    <>
      <button
        type="button"
        onClick={openScanner}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5"
      >
        <Camera className="w-4 h-4" /> {label || "Scan All Vitals"}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={closeScanner}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Scan all vitals from monitor</h3>
              <button type="button" onClick={closeScanner} aria-label="Close" className="p-1 text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
            </div>

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            {step === "capture" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Take one photo of the monitor screen. Fill the frame with the display and avoid glare. Every reading it can read clearly will be filled; you review them before anything is saved.</p>
                <button type="button" onClick={() => cameraRef.current?.click()} className="w-full rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5">Open camera</button>
                <button type="button" onClick={() => galleryRef.current?.click()} className="w-full rounded-lg border border-gray-300 text-sm text-gray-700 py-2">Choose a photo instead</button>
                <button type="button" onClick={closeScanner} className="w-full text-sm text-gray-500 py-1">Enter values manually</button>
              </div>
            )}

            {step === "crop" && imgUrl && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Drag a box around the monitor screen so only the display is read. Skip this to read the whole photo.</p>
                <div
                  ref={boxRef}
                  className="relative select-none rounded-lg overflow-hidden bg-black"
                  style={{ touchAction: "none" }}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                >
                  <img src={imgUrl} alt="Monitor photo" className="w-full h-auto block pointer-events-none" draggable={false} />
                  {crop && (
                    <div
                      className="absolute border-2 border-teal-400 bg-teal-400/10 pointer-events-none"
                      style={{ left: crop.x0 * 100 + "%", top: crop.y0 * 100 + "%", width: (crop.x1 - crop.x0) * 100 + "%", height: (crop.y1 - crop.y0) * 100 + "%" }}
                    />
                  )}
                </div>
                {MONITOR_TEMPLATES.length > 1 && (
                  <label className="block text-xs text-gray-600">Monitor model
                    <select value={tplId} onChange={(e) => setTplId(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-gray-200 bg-white px-2 text-sm">
                      {MONITOR_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep("capture")} className="flex-1 rounded-lg border border-gray-300 text-sm text-gray-700 py-2">Retake</button>
                  <button type="button" onClick={readScreen} className="flex-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2">Read screen</button>
                </div>
              </div>
            )}

            {step === "reading" && (
              <div className="py-8 text-center space-y-2">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin text-teal-600" />
                <p className="text-sm text-gray-700">Reading the screen on this device{progress > 0 ? " (" + Math.round(progress * 100) + "%)" : "..."}</p>
                <p className="text-xs text-gray-500">The first scan can take a few seconds longer.</p>
              </div>
            )}

            {step === "review" && out && (
              <div className="space-y-3">
                {thumb && <img src={thumb} alt="Area that was read" className="w-full max-h-48 object-contain rounded-lg bg-gray-100" />}
                <p className="text-sm text-gray-700">Compare each value with the monitor. Correct anything that is wrong and fill in anything left empty.</p>

                <div className="space-y-2">
                  {shown.map((f) => {
                    const v = vals[f] || "";
                    const read = out.values[f];
                    const sug = out.suggestions[f];
                    const edited = !!touched[f];
                    const [lo, hi, unit] = FIELD_RANGE[f];
                    const unitText = f === "temperature" ? DEG + "F" : unit;
                    return (
                      <div key={f} className={"rounded-lg border px-3 py-2 " + (v ? (edited ? "border-blue-200 bg-blue-50" : "border-emerald-200 bg-emerald-50") : "border-amber-300 bg-amber-50")}>
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-sm font-medium text-gray-800" htmlFor={"scan-" + f}>{FIELD_LABEL[f]} <span className="text-xs font-normal text-gray-500">({unitText}, {lo}-{hi})</span></label>
                          <span className="text-[11px] text-gray-600">
                            {edited ? "Edited by you" : read && v ? "Read from monitor, " + read.conf + "% sure" : "Not read"}
                          </span>
                        </div>
                        <Input id={"scan-" + f} inputMode="decimal" value={v} placeholder="Type the value" onChange={(e) => setField(f, e.target.value)} className="mt-1" />
                        {!v && sug && (
                          <button type="button" onClick={() => setField(f, sug.text)} className="mt-1 text-xs text-teal-700 underline">
                            Unclear read: {sug.text}. Tap to use it only if it matches the monitor
                          </button>
                        )}
                        {f === "temperature" && tempNote && <p className="mt-1 text-xs text-gray-600">{tempNote}</p>}
                      </div>
                    );
                  })}
                </div>

                {out.notes.length > 0 && (
                  <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1 list-disc list-inside">
                    {out.notes.filter((n) => !n.startsWith("Temperature") || tempShown).map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                )}

                {problem && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{problem}</p>}

                <label className="flex items-start gap-2 text-sm text-gray-800">
                  <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-1" />
                  <span>I checked these values against the monitor.</span>
                </label>
                <p className="text-[11px] text-gray-500">Nothing is saved yet. Applying fills the form; you still tap Save Vitals.</p>

                <div className="flex gap-2">
                  <button type="button" onClick={() => { setOut(null); setStep("crop"); }} className="flex-1 rounded-lg border border-gray-300 text-sm text-gray-700 py-2">Rescan</button>
                  <button type="button" onClick={apply} disabled={!canApply} className="flex-1 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-semibold py-2">Fill the form</button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}