import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Camera-based vital signs scanner (free, on-device OCR - nothing is uploaded).
 *
 * SAFETY RULES BUILT IN
 *  - The scanner NEVER saves anything. It only pre-fills the parent form.
 *  - A value is auto-filled only when OCR confidence is high AND the layout is unambiguous.
 *  - Anything unclear stays EMPTY and is highlighted: the nurse must type it or tap a detected number.
 *  - Every value must be confirmed against the device before it can be applied.
 *  - Out-of-range values are blocked (also re-checked by the parent before saving).
 */

export type ScannedVitals = {
  temperature: string;
  pulse: string;
  bpSystolic: string;
  bpDiastolic: string;
  spo2: string;
  weight: string;
  bloodGlucose: string;
};
type FieldKey = keyof ScannedVitals;
type DeviceKey = "bp" | "spo2" | "temp" | "glucose" | "weight";
type Rect = { x: number; y: number; w: number; h: number };
export type DetectedNumber = { text: string; value: number; conf: number; hasDot: boolean };

const DEG = "\u00B0";

const RANGE: Record<FieldKey, [number, number, string]> = {
  temperature: [85, 110, DEG + "F"],
  pulse: [20, 250, "bpm"],
  bpSystolic: [50, 280, "mmHg"],
  bpDiastolic: [20, 180, "mmHg"],
  spo2: [50, 100, "%"],
  weight: [1, 300, "kg"],
  bloodGlucose: [20, 600, "mg/dL"],
};
const LABEL: Record<FieldKey, string> = {
  temperature: "Temperature",
  pulse: "Pulse",
  bpSystolic: "BP systolic",
  bpDiastolic: "BP diastolic",
  spo2: "SpO2",
  weight: "Weight",
  bloodGlucose: "Blood glucose",
};
const DEVICES: { key: DeviceKey; label: string; fields: FieldKey[] }[] = [
  { key: "bp", label: "BP monitor", fields: ["bpSystolic", "bpDiastolic", "pulse"] },
  { key: "spo2", label: "Pulse oximeter", fields: ["spo2", "pulse"] },
  { key: "temp", label: "Thermometer", fields: ["temperature"] },
  { key: "glucose", label: "Glucometer", fields: ["bloodGlucose"] },
  { key: "weight", label: "Weighing scale", fields: ["weight"] },
];

const MIN_CONF = 85; // OCR confidence (0-100) required before auto-filling

/** Shared range check. Returns an error message, or null when everything is plausible. */
export function validateVitals(v: Record<string, string | undefined>): string | null {
  for (const k of Object.keys(RANGE) as FieldKey[]) {
    const raw = v[k];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = Number(raw);
    const [lo, hi, unit] = RANGE[k];
    if (!Number.isFinite(n) || n < lo || n > hi) {
      return `${LABEL[k]} "${raw}" is outside the plausible range (${lo}-${hi} ${unit}). Please re-check the device and correct it.`;
    }
  }
  const hasS = !!v.bpSystolic;
  const hasD = !!v.bpDiastolic;
  if (hasS !== hasD) return "Enter both BP systolic and BP diastolic.";
  if (hasS && hasD && Number(v.bpSystolic) <= Number(v.bpDiastolic)) {
    return "BP systolic must be higher than BP diastolic. Please re-check.";
  }
  return null;
}

/** Decide which detected numbers can be assigned WITHOUT guessing. Exported for testing. */
export function assignReadings(device: DeviceKey, nums: DetectedNumber[]) {
  const values: Partial<ScannedVitals> = {};
  const notes: string[] = [];
  const inR = (f: FieldKey, v: number) => v >= RANGE[f][0] && v <= RANGE[f][1];

  if (nums.length === 0) {
    notes.push("No numbers were detected. Retake the photo or enter the values manually.");
    return { values, notes };
  }
  const clear = nums.filter((n) => n.conf >= MIN_CONF);
  const allClear = clear.length === nums.length;
  if (!allClear) {
    notes.push(`${nums.length - clear.length} detected number(s) were too unclear to trust.`);
  }

  if (device === "bp") {
    if (allClear && nums.length === 3 && nums.every((n) => !n.hasDot)) {
      const [s, d, p] = nums;
      if (inR("bpSystolic", s.value) && inR("bpDiastolic", d.value) && inR("pulse", p.value) && s.value > d.value) {
        values.bpSystolic = String(s.value);
        values.bpDiastolic = String(d.value);
        values.pulse = String(p.value);
        notes.push("Assigned by position: top = systolic, middle = diastolic, bottom = pulse. Check this matches your device.");
      } else {
        notes.push("The numbers do not look like a valid BP reading, so nothing was filled.");
      }
    } else {
      notes.push("Expected exactly 3 clear whole numbers (systolic, diastolic, pulse). Nothing was filled.");
    }
  } else if (device === "spo2") {
    if (allClear && nums.length === 2 && nums.every((n) => !n.hasDot)) {
      const [a, b] = nums;
      const aS = a.value >= 70 && a.value <= 100;
      const bS = b.value >= 70 && b.value <= 100;
      if (aS !== bS) {
        const s = aS ? a : b;
        const p = aS ? b : a;
        if (inR("spo2", s.value) && inR("pulse", p.value)) {
          values.spo2 = String(s.value);
          values.pulse = String(p.value);
        }
      } else {
        notes.push("Cannot tell which number is SpO2 and which is pulse. Tap the correct number under each field.");
      }
    } else {
      notes.push("Expected exactly 2 clear whole numbers (SpO2 and pulse). Nothing was filled.");
    }
  } else if (device === "temp") {
    if (allClear && nums.length === 1 && nums[0].hasDot && inR("temperature", nums[0].value)) {
      values.temperature = nums[0].text;
    } else {
      notes.push("Need one clear temperature with a decimal point (for example 98.6). Nothing was filled.");
    }
  } else if (device === "glucose") {
    if (allClear && nums.length === 1 && !nums[0].hasDot && inR("bloodGlucose", nums[0].value)) {
      values.bloodGlucose = nums[0].text;
    } else {
      notes.push("Need one clear whole number for blood glucose. Nothing was filled.");
    }
  } else if (device === "weight") {
    if (allClear && nums.length === 1 && nums[0].hasDot && inR("weight", nums[0].value)) {
      values.weight = nums[0].text;
    } else {
      notes.push("Need one clear weight with a decimal point (for example 72.4). Nothing was filled.");
    }
  }
  return { values, notes };
}

/** Crop, upscale, grayscale and threshold (Otsu) so digits are black on white. */
function preprocess(img: HTMLImageElement, rect: Rect | null): HTMLCanvasElement {
  const sx = rect ? rect.x : 0;
  const sy = rect ? rect.y : 0;
  const sw = rect ? rect.w : img.naturalWidth;
  const sh = rect ? rect.h : img.naturalHeight;
  const scale = Math.max(0.25, Math.min(4, 600 / sh, 2400 / sw));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
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
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = -1, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t; }
  }
  let dark = 0;
  for (let p = 0; p < total; p++) if (gray[p] <= thr) dark++;
  const invert = dark > total / 2; // mostly dark = light digits on dark background (LED)
  for (let i = 0, p = 0; p < total; i += 4, p++) {
    let v = gray[p] <= thr ? 0 : 255;
    if (invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

export default function VitalsScanner({ onApply }: { onApply: (v: Partial<ScannedVitals>) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"device" | "crop" | "reading" | "review">("device");
  const [device, setDevice] = useState<DeviceKey>("bp");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [nums, setNums] = useState<DetectedNumber[]>([]);
  const [vals, setVals] = useState<Partial<ScannedVitals>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  function resetAll() {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setStep("device"); setImgUrl(null); setImgEl(null); setCrop(null);
    setNums([]); setVals({}); setNotes([]); setConfirmed(false); setError(""); setProgress(0);
  }
  function openScanner() { resetAll(); setOpen(true); }
  function closeScanner() { resetAll(); setOpen(false); }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImgUrl(url); setImgEl(img); setCrop(null); setStep("crop"); };
    img.onerror = () => { setError("That photo could not be opened. Please try again."); };
    img.src = url;
  }

  // Draw the photo + selection box on the crop canvas.
  useEffect(() => {
    if (step !== "crop" || !imgEl || !canvasRef.current) return;
    const c = canvasRef.current;
    const s = Math.min(1, 900 / imgEl.naturalWidth);
    c.width = Math.round(imgEl.naturalWidth * s);
    c.height = Math.round(imgEl.naturalHeight * s);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(imgEl, 0, 0, c.width, c.height);
    if (crop && crop.w > 2 && crop.h > 2) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(imgEl, crop.x / s, crop.y / s, crop.w / s, crop.h / s, crop.x, crop.y, crop.w, crop.h);
      ctx.strokeStyle = "#14b8a6";
      ctx.lineWidth = Math.max(2, c.width / 300);
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
    }
  }, [step, imgEl, crop]);

  function pt(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(c.width, ((e.clientX - r.left) * c.width) / r.width)),
      y: Math.max(0, Math.min(c.height, ((e.clientY - r.top) * c.height) / r.height)),
    };
  }

  async function readDisplay() {
    if (!imgEl || !canvasRef.current) return;
    setStep("reading"); setError(""); setProgress(0);
    let worker: any = null;
    try {
      const f = imgEl.naturalWidth / canvasRef.current.width;
      const rect = crop && crop.w > 20 && crop.h > 20
        ? { x: crop.x * f, y: crop.y * f, w: crop.w * f, h: crop.h * f }
        : null;
      const processed = preprocess(imgEl, rect);
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        logger: (m: any) => { if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100)); },
      } as any);
      await worker.setParameters({ tessedit_char_whitelist: "0123456789.", tessedit_pageseg_mode: "6" } as any);
      const { data } = await worker.recognize(processed);
      const words = ((data as any).words || [])
        .map((w: any) => ({
          t: String(w.text || "").replace(/[^0-9.]/g, "").replace(/^\.+|\.+$/g, ""),
          conf: Number(w.confidence) || 0,
          y: (w.bbox.y0 + w.bbox.y1) / 2,
          x: w.bbox.x0,
        }))
        .filter((w: any) => /^\d+(\.\d+)?$/.test(w.t))
        .sort((a: any, b: any) => a.y - b.y || a.x - b.x);
      const found: DetectedNumber[] = words.map((w: any) => ({
        text: w.t, value: Number(w.t), conf: Math.round(w.conf), hasDot: w.t.includes("."),
      }));
      const r = assignReadings(device, found);
      if (!rect) r.notes.unshift("No display area was selected, so the whole photo was read. Selecting just the screen is more accurate.");
      setNums(found); setVals(r.values); setNotes(r.notes);
    } catch {
      setNums([]); setVals({}); setNotes([]);
      setError("The photo could not be read automatically. Please enter the values manually or retake the photo.");
    } finally {
      if (worker) { try { await worker.terminate(); } catch { /* ignore */ } }
      setConfirmed(false);
      setStep("review");
    }
  }

  const dev = DEVICES.find((d) => d.key === device)!;
  const validationError = validateVitals(vals as Record<string, string>);
  const anyValue = dev.fields.some((f) => (vals[f] ?? "") !== "");
  const canApply = confirmed && anyValue && !validationError;

  function setField(f: FieldKey, v: string) {
    setConfirmed(false);
    setVals((p) => ({ ...p, [f]: v }));
  }
  function chipsFor(f: FieldKey) {
    const out: { label: string; value: string }[] = [];
    const seen = new Set<string>();
    for (const n of nums) {
      if (f === "temperature" && n.hasDot && n.value >= 32 && n.value <= 43) {
        const fv = (n.value * 9 / 5 + 32).toFixed(1);
        out.push({ label: `${n.text}${DEG}C = ${fv}${DEG}F`, value: fv });
      } else if (n.value >= RANGE[f][0] && n.value <= RANGE[f][1] && !seen.has(n.text)) {
        seen.add(n.text);
        out.push({ label: n.conf < MIN_CONF ? `${n.text} (unclear)` : n.text, value: n.text });
      }
    }
    return out;
  }

  const btn = "px-3 py-1.5 rounded-md text-xs font-medium";

  const modal = (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-xl sm:rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Scan vitals from device</h3>
          <button type="button" onClick={closeScanner} aria-label="Close scanner"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {step === "device" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-600">1. Which device are you reading?</p>
            <div className="grid grid-cols-2 gap-2">
              {DEVICES.map((d) => (
                <button key={d.key} type="button" onClick={() => setDevice(d.key)}
                  className={`${btn} border ${device === d.key ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 border-gray-300"}`}>
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600">2. Take a clear, straight-on photo of the screen. Avoid glare and shadows.</p>
            <label className={`${btn} block text-center bg-teal-600 text-white cursor-pointer`}>
              Open camera
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        {step === "crop" && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">Drag a box around ONLY the display digits, then tap Read display.</p>
            <canvas ref={canvasRef} className="w-full rounded border touch-none cursor-crosshair"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dragStart.current = pt(e); setCrop(null); }}
              onPointerMove={(e) => {
                if (!dragStart.current) return;
                const p = pt(e); const a = dragStart.current;
                setCrop({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) });
              }}
              onPointerUp={() => { dragStart.current = null; }} />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setStep("device"); setImgEl(null); }} className={`${btn} border border-gray-300 text-gray-700`}>Retake</button>
              <button type="button" onClick={readDisplay} className={`${btn} flex-1 bg-teal-600 text-white`}>Read display</button>
            </div>
          </div>
        )}

        {step === "reading" && (
          <p className="text-xs text-gray-600 py-6 text-center">Reading the display... {progress}%</p>
        )}

        {step === "review" && (
          <div className="space-y-3">
            {imgUrl && <img src={imgUrl} alt="Captured device display" className="w-full max-h-48 object-contain rounded border bg-gray-50" />}
            {error && <p className="text-xs text-red-600">{error}</p>}
            {notes.map((n, i) => <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{n}</p>)}
            <p className="text-xs text-gray-600">Compare every value with the device. Red fields were not read clearly: type them in or tap a detected number.</p>
            {dev.fields.map((f) => {
              const raw = vals[f] ?? "";
              const empty = raw === "";
              const n = Number(raw);
              const out = !empty && (!Number.isFinite(n) || n < RANGE[f][0] || n > RANGE[f][1]);
              const chips = chipsFor(f);
              return (
                <div key={f} className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">{LABEL[f]} ({RANGE[f][2]})</label>
                  <Input type="number" step="any" value={raw} onChange={(e) => setField(f, e.target.value)}
                    className={empty || out ? "border-red-400 bg-red-50" : ""} placeholder="Enter manually" />
                  {empty && <p className="text-[11px] text-red-600">Not read clearly. Enter it manually.</p>}
                  {out && <p className="text-[11px] text-red-600">Outside the plausible range. Please re-check.</p>}
                  {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[11px] text-gray-500">Detected:</span>
                      {chips.map((c, i) => (
                        <button key={i} type="button" onClick={() => setField(f, c.value)}
                          className="text-[11px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100">{c.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {validationError && <p className="text-xs text-red-600">{validationError}</p>}
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
              I have checked every value above against the device display.
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep("device")} className={`${btn} border border-gray-300 text-gray-700`}>Scan again</button>
              <button type="button" disabled={!canApply}
                onClick={() => {
                  const clean: Partial<ScannedVitals> = {};
                  dev.fields.forEach((f) => { if ((vals[f] ?? "") !== "") clean[f] = String(vals[f]); });
                  onApply(clean);
                  closeScanner();
                }}
                className={`${btn} flex-1 bg-teal-600 text-white disabled:opacity-40`}>
                Use these values
              </button>
            </div>
            <p className="text-[11px] text-gray-500">Values are only filled into the vitals form. Nothing is saved until you tap Save Vitals.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={openScanner}
        className="text-xs text-teal-600 font-medium hover:underline flex items-center gap-1">
        <Camera className="w-3.5 h-3.5" /> Scan
      </button>
      {open && createPortal(modal, document.body)}
    </>
  );
}
