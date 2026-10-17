// colorMask.ts - colour masks and binary thresholding for patient-monitor digits.
//
// Pure pixel functions (no React, no Tesseract). The canvas helpers at the bottom are the only DOM code.
//
// What this module does and does NOT do:
//  * It only CLEANS the picture before OCR (digits black on white). It never reads a value, never decides which
//    vital a number is, and never touches an OCR confidence. Colour is a recognition clue, not an identity.
//  * Every profile is configurable (hue range, saturation, brightness, optional exact HEX + distance).
//  * Red is marked role "excluded": it is generated so the diagnostics can show it, but it is never fed into
//    the cuff-BP fields (ART / IBP must not populate NIBP).

export type Rgb = { r: number; g: number; b: number };
export type PixelBuf = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };
export type Mask = { width: number; height: number; data: Uint8Array; count: number };

export type ColorProfile = {
  id: string;
  label: string;
  /** "excluded" masks are produced for diagnostics but never used to fill the cuff BP fields. */
  role: "candidate" | "excluded";
  /** Hue range in degrees. If lo > hi the range wraps through 0 (red). */
  hue?: [number, number];
  minSat?: number; // 0..1
  maxSat?: number; // 0..1
  minVal?: number; // 0..1 (brightness)
  /** Optional second route: a pixel also matches when it is within `maxDistance` (RGB distance) of this HEX colour. */
  hex?: string;
  maxDistance?: number;
};

/**
 * Default profiles. These are tuning starting points, NOT a claim that a colour means a vital sign:
 * monitors differ (HR is green on most, but SpO2 can be cyan or green, resp can be yellow or white).
 * Which vital a number is comes from labels, saved boxes and position, never from its colour.
 */
export const MASK_PROFILES: ColorProfile[] = [
  // Brightness first. Measured on a real monitor photo: the digits are washed-out pale colours (HR pale green with
  // saturation 0.24, SpO2 pale blue 0.29), so narrow hue + high-saturation rules matched almost nothing (0 of 9
  // correct reads), while "the brightest pixels on a dark screen" read 9 of 9. Hue profiles stay as extra clues.
  { id: "bright85", label: "Bright (strict)", role: "candidate", minVal: 0.85 },
  { id: "bright", label: "Bright", role: "candidate", minVal: 0.72 },
  { id: "green", label: "Green", role: "candidate", hue: [75, 175], minSat: 0.12, minVal: 0.6 },
  { id: "cyan", label: "Cyan / light blue", role: "candidate", hue: [175, 235], minSat: 0.2, minVal: 0.6 },
  { id: "yellow", label: "Yellow", role: "candidate", hue: [48, 72], minSat: 0.3, minVal: 0.6 },
  { id: "white", label: "High-luminance white", role: "candidate", maxSat: 0.2, minVal: 0.8 },
  { id: "red", label: "Red (ART / IBP clue)", role: "excluded", hue: [345, 15], minSat: 0.4, minVal: 0.45 },
];

/** Override any profile field by id, e.g. withOverrides(MASK_PROFILES, { green: { minSat: 0.3 } }). Adds unknown ids as new profiles. */
export function withOverrides(base: ColorProfile[], overrides: Record<string, Partial<ColorProfile>>): ColorProfile[] {
  const out = base.map((p) => ({ ...p, ...(overrides[p.id] || {}), id: p.id }));
  for (const [id, o] of Object.entries(overrides)) {
    if (!out.some((p) => p.id === id) && o.label && o.role) out.push({ id, ...o } as ColorProfile);
  }
  return out;
}

// ---- colour maths ----------------------------------------------------------------------------------------

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

const inHue = (h: number, [lo, hi]: [number, number]) => (lo <= hi ? h >= lo && h <= hi : h >= lo || h <= hi);

function matches(r: number, g: number, b: number, p: ColorProfile, hexRgb: Rgb | null): boolean {
  const { h, s, v } = rgbToHsv(r, g, b);
  const hueOk = p.hue ? inHue(h, p.hue) : true;
  const hsvOk = hueOk && s >= (p.minSat ?? 0) && s <= (p.maxSat ?? 1) && v >= (p.minVal ?? 0);
  if (hsvOk) return true;
  if (hexRgb && p.maxDistance !== undefined) {
    const dr = r - hexRgb.r, dg = g - hexRgb.g, db = b - hexRgb.b;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= p.maxDistance;
  }
  return false;
}

// ---- masks -----------------------------------------------------------------------------------------------

const emptyMask = (width = 0, height = 0): Mask => ({ width, height, data: new Uint8Array(Math.max(0, width * height)), count: 0 });

const validBuf = (img: PixelBuf | null | undefined): img is PixelBuf =>
  !!img && !!img.data && img.width > 0 && img.height > 0 && img.data.length >= img.width * img.height * 4;

/** Foreground = pixels matching the profile. Transparent pixels (alpha < 128) never match. Never throws. */
export function buildMask(img: PixelBuf | null | undefined, profile: ColorProfile): Mask {
  try {
    if (!validBuf(img)) return emptyMask();
    const { width, height, data } = img;
    const out = new Uint8Array(width * height);
    const hexRgb = profile.hex ? hexToRgb(profile.hex) : null;
    let count = 0;
    for (let p = 0, i = 0; p < out.length; p++, i += 4) {
      if (data[i + 3] < 128) continue;
      if (matches(data[i], data[i + 1], data[i + 2], profile, hexRgb)) { out[p] = 1; count++; }
    }
    return { width, height, data: out, count };
  } catch {
    return emptyMask();
  }
}

/** One independent mask per profile (the source pixels are only read, never modified). */
export function buildAllMasks(img: PixelBuf | null | undefined, profiles: ColorProfile[] = MASK_PROFILES): Record<string, Mask> {
  const out: Record<string, Mask> = {};
  for (const p of profiles) out[p.id] = buildMask(img, p);
  return out;
}

// ---- connected components --------------------------------------------------------------------------------

type Comp = { id: number; x0: number; y0: number; x1: number; y1: number; area: number };

function components(mask: Mask): { comps: Comp[]; labels: Int32Array } {
  const { width: W, height: H, data } = mask;
  const labels = new Int32Array(W * H);
  const comps: Comp[] = [];
  const stack = new Int32Array(W * H);
  for (let start = 0; start < data.length; start++) {
    if (!data[start] || labels[start]) continue;
    const id = comps.length + 1;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = id;
    const c: Comp = { id, x0: W, y0: H, x1: 0, y1: 0, area: 0 };
    while (sp) {
      const p = stack[--sp];
      const x = p % W, y = (p / W) | 0;
      c.area++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (data[q] && !labels[q]) { labels[q] = id; stack[sp++] = q; }
        }
      }
    }
    comps.push(c);
  }
  return { comps, labels };
}

const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const bw = (c: Comp) => c.x1 - c.x0 + 1;
const bh = (c: Comp) => c.y1 - c.y0 + 1;

export type CleanOptions = {
  /** Remove a blob wider than this fraction of the image (an ECG trace spans many digits). */
  maxWidthFrac?: number;
  /** Remove a blob taller than this fraction of the image (grid / bezel edges). */
  maxHeightFrac?: number;
  /** A blob smaller than this fraction of the typical digit area counts as dust, unless it sits next to a digit. */
  speckleRatio?: number;
  /** "Next to a digit" = within this many typical digit heights. Keeps decimal points and colons. */
  nearFactor?: number;
};

export type CleanStats = { components: number; removedWide: number; removedSpeckle: number };

/**
 * Conservative clean-up. It only removes (a) very wide / very tall blobs (waveforms, grid) and (b) isolated dust.
 * Decimal points, slashes and the separate bars of segmented numerals are kept: bars are small but sit next to
 * each other, and nothing is removed for being "thin".
 */
export function cleanMask(mask: Mask, o: CleanOptions = {}): { mask: Mask; stats: CleanStats } {
  try {
    if (!mask || !mask.count) return { mask: mask ?? emptyMask(), stats: { components: 0, removedWide: 0, removedSpeckle: 0 } };
    const maxW = o.maxWidthFrac ?? 0.35, maxH = o.maxHeightFrac ?? 0.97;
    const speckle = o.speckleRatio ?? 0.01, near = o.nearFactor ?? 1.0;
    const { comps, labels } = components(mask);
    const { width: W, height: H } = mask;

    const drop = new Set<number>();
    let removedWide = 0, removedSpeckle = 0;
    for (const c of comps) {
      const boxArea = bw(c) * bh(c);
      const wide = bw(c) >= maxW * W || bh(c) >= maxH * H || (boxArea >= 0.2 * W * H && c.area / boxArea < 0.3);
      if (wide) { drop.add(c.id); removedWide++; }
    }
    const kept = comps.filter((c) => !drop.has(c.id));
    const top = [...kept].sort((a, b) => b.area - a.area).slice(0, 5);
    const refArea = median(top.map((c) => c.area));
    const refH = median(top.map(bh));
    const anchors = kept.filter((c) => c.area >= 0.2 * refArea);
    for (const c of kept) {
      if (c.area >= speckle * refArea) continue;
      const nearDigit = anchors.some((a) => a !== c && c.x1 >= a.x0 - near * refH && c.x0 <= a.x1 + near * refH && c.y1 >= a.y0 - near * refH && c.y0 <= a.y1 + near * refH);
      if (!nearDigit) { drop.add(c.id); removedSpeckle++; }
    }

    const out = new Uint8Array(mask.data.length);
    let count = 0;
    for (let p = 0; p < out.length; p++) {
      if (mask.data[p] && !drop.has(labels[p])) { out[p] = 1; count++; }
    }
    return { mask: { width: W, height: H, data: out, count }, stats: { components: comps.length, removedWide, removedSpeckle } };
  } catch {
    return { mask: mask ?? emptyMask(), stats: { components: 0, removedWide: 0, removedSpeckle: 0 } };
  }
}

export type MaskStats = { fgFraction: number; components: number; digitLike: number };

/** How much the mask looks like digits: foreground share and the number of blobs of digit height. */
export function maskStats(mask: Mask): MaskStats {
  try {
    if (!mask || !mask.count) return { fgFraction: 0, components: 0, digitLike: 0 };
    const { comps } = components(mask);
    const H = mask.height;
    const digitLike = comps.filter((c) => bh(c) >= 0.25 * H && bh(c) <= 0.97 * H && bw(c) <= 1.5 * bh(c)).length;
    return { fgFraction: mask.count / (mask.width * mask.height), components: comps.length, digitLike };
  } catch {
    return { fgFraction: 0, components: 0, digitLike: 0 };
  }
}

export function isUseful(mask: Mask, o: { minFg?: number; maxFg?: number; minDigitLike?: number } = {}): boolean {
  const s = maskStats(mask);
  return s.fgFraction >= (o.minFg ?? 0.004) && s.fgFraction <= (o.maxFg ?? 0.6) && s.digitLike >= (o.minDigitLike ?? 1);
}

/** Foreground black (#000000), everything else white (#FFFFFF), opaque, with a white margin (Tesseract likes one). */
export function toBinary(mask: Mask, pad = 8): PixelBuf {
  const w = Math.max(1, (mask?.width || 0) + 2 * pad), h = Math.max(1, (mask?.height || 0) + 2 * pad);
  const data = new Uint8ClampedArray(w * h * 4).fill(255); // white, alpha 255
  if (mask && mask.count) {
    for (let y = 0; y < mask.height; y++) {
      for (let x = 0; x < mask.width; x++) {
        if (!mask.data[y * mask.width + x]) continue;
        const i = ((y + pad) * w + (x + pad)) * 4;
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
      }
    }
  }
  return { data, width: w, height: h };
}

// ---- adaptive threshold (fallback when no colour mask is useful) --------------------------------------------

/**
 * Local-mean threshold on the luminance (integral image). Works for bright digits on a dark screen and for dark
 * digits on a light screen: the polarity whose foreground is the smaller, plausible share wins.
 */
export function adaptiveMask(img: PixelBuf | null | undefined, o: { window?: number; ratio?: number; minContrast?: number } = {}): Mask {
  try {
    if (!validBuf(img)) return emptyMask();
    const { width: W, height: H, data } = img;
    const gray = new Float32Array(W * H);
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) gray[p] = data[i + 3] < 128 ? 0 : 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const S = W + 1;
    const integral = new Float64Array(S * (H + 1));
    for (let y = 0; y < H; y++) {
      let row = 0;
      for (let x = 0; x < W; x++) { row += gray[y * W + x]; integral[(y + 1) * S + (x + 1)] = integral[y * S + (x + 1)] + row; }
    }
    const half = Math.max(7, Math.round((o.window ?? Math.min(W, H) / 2) / 2));
    const ratio = o.ratio ?? 0.15, minC = o.minContrast ?? 14;
    const bright = new Uint8Array(W * H), dark = new Uint8Array(W * H);
    let nb = 0, nd = 0;
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - half), y1 = Math.min(H - 1, y + half);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - half), x1 = Math.min(W - 1, x + half);
        const n = (x1 - x0 + 1) * (y1 - y0 + 1);
        const sum = integral[(y1 + 1) * S + (x1 + 1)] - integral[y0 * S + (x1 + 1)] - integral[(y1 + 1) * S + x0] + integral[y0 * S + x0];
        const mean = sum / n, g = gray[y * W + x];
        if (g > mean * (1 + ratio) && g - mean >= minC) { bright[y * W + x] = 1; nb++; }
        else if (g < mean * (1 - ratio) && mean - g >= minC) { dark[y * W + x] = 1; nd++; }
      }
    }
    const plausible = (n: number) => n / (W * H) >= 0.003 && n / (W * H) <= 0.5;
    const useBright = plausible(nb) && (!plausible(nd) || nb <= nd);
    const useDark = !useBright && plausible(nd);
    if (!useBright && !useDark) return emptyMask(W, H);
    return { width: W, height: H, data: useBright ? bright : dark, count: useBright ? nb : nd };
  } catch {
    return emptyMask();
  }
}

// ---- putting it together ---------------------------------------------------------------------------------

export type RankedMask = { profile: ColorProfile; mask: Mask; stats: MaskStats; clean: CleanStats; useful: boolean };
const rankCache = new WeakMap<object, WeakMap<object, RankedMask[]>>();

/** Every profile's cleaned mask, best first. Results are cached per image + profile list (no repeated work). */
export function rankMasks(img: PixelBuf, profiles: ColorProfile[] = MASK_PROFILES): RankedMask[] {
  try {
    const byProfiles = rankCache.get(img) ?? new WeakMap<object, RankedMask[]>();
    const hit = byProfiles.get(profiles);
    if (hit) return hit;
    const raw = buildAllMasks(img, profiles);
    const ranked: RankedMask[] = profiles.map((p) => {
      const c = cleanMask(raw[p.id]);
      return { profile: p, mask: c.mask, stats: maskStats(c.mask), clean: c.stats, useful: isUseful(c.mask) };
    });
    ranked.sort((a, b) => Number(b.useful) - Number(a.useful) || b.stats.digitLike - a.stats.digitLike);
    byProfiles.set(profiles, ranked);
    rankCache.set(img, byProfiles);
    return ranked;
  } catch {
    return [];
  }
}

export type MaskCandidate = { method: string; image: PixelBuf };

/**
 * The binary pictures to hand to Tesseract for one region: up to `maxColour` useful colour masks (never the
 * "excluded" red one), then always the adaptive-threshold fallback. `excluded` lists masks that were generated but
 * deliberately not used. Large images are skipped so the phone never freezes.
 */
export function maskCandidates(img: PixelBuf, profiles: ColorProfile[] = MASK_PROFILES, maxColour = 2): { items: MaskCandidate[]; excluded: string[] } {
  const items: MaskCandidate[] = [], excluded: string[] = [];
  try {
    if (!validBuf(img) || img.width * img.height > 2_000_000) return { items, excluded };
    for (const r of rankMasks(img, profiles)) {
      if (!r.useful) continue;
      if (r.profile.role === "excluded") { excluded.push(r.profile.id); continue; }
      if (items.length < maxColour) items.push({ method: "mask:" + r.profile.id, image: toBinary(r.mask) });
    }
    const ad = adaptiveMask(img);
    if (isUseful(ad)) items.push({ method: "adaptive", image: toBinary(ad) });
  } catch { /* fall through with whatever was built */ }
  return { items, excluded };
}

// ---- Finding number boxes without labels ----------------------------------------------------------------------

export type NumberBox = { x0: number; y0: number; x1: number; y1: number; blobs: number };

/**
 * Groups of bright, digit-sized blobs that sit on one line: candidate numbers, found by brightness alone (no OCR,
 * no labels). On a real photo where the text finder returned nothing useful, this located all three big numbers
 * (154, 97, 48) plus a few noise boxes, which the OCR re-read then sorted out. Sizes are fractions of the image
 * height, so it works at any resolution. Returns [] for empty or oversized images.
 */
export function findNumberBlobs(img: PixelBuf | null | undefined, o: { minVal?: number; minHFrac?: number; maxHFrac?: number } = {}): NumberBox[] {
  try {
    if (!validBuf(img) || img.width * img.height > 4_000_000) return [];
    const H = img.height;
    const minH = (o.minHFrac ?? 0.04) * H, maxH = (o.maxHFrac ?? 0.27) * H;
    for (const minVal of [o.minVal ?? 0.85, 0.72]) { // strict first; relaxed only if nothing was found
      const { mask } = cleanMask(buildMask(img, { id: "bright", label: "Bright", role: "candidate", minVal }));
      const { comps } = components(mask);
      const digit = comps.filter((c) => bh(c) >= minH && bh(c) <= maxH && bw(c) <= 1.4 * bh(c)).sort((a, b) => a.x0 - b.x0);
      const groups: Comp[][] = [];
      for (const c of digit) {
        const h = bh(c);
        const hit = groups.find((g) => {
          const l = g[g.length - 1], lh = bh(l);
          const dyc = Math.abs((c.y0 + c.y1) / 2 - (l.y0 + l.y1) / 2), gap = c.x0 - l.x1, ratio = h / lh;
          return dyc < 0.45 * Math.max(h, lh) && gap <= 0.9 * Math.max(h, lh) && gap >= -4 && ratio > 0.6 && ratio < 1.7;
        });
        if (hit) hit.push(c); else groups.push([c]);
      }
      const boxes: NumberBox[] = groups
        .map((g) => ({ x0: Math.min(...g.map((c) => c.x0)), y0: Math.min(...g.map((c) => c.y0)), x1: Math.max(...g.map((c) => c.x1)) + 1, y1: Math.max(...g.map((c) => c.y1)) + 1, blobs: g.length }))
        .filter((b) => b.y1 - b.y0 >= minH);
      if (boxes.length) return boxes.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    }
    return [];
  } catch {
    return [];
  }
}

// ---- canvas helpers (the only DOM code) ---------------------------------------------------------------------

export function canvasToPixels(c: HTMLCanvasElement | null | undefined): PixelBuf | null {
  try {
    if (!c || !c.width || !c.height) return null;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const d = ctx.getImageData(0, 0, c.width, c.height);
    return { data: d.data, width: d.width, height: d.height };
  } catch {
    return null;
  }
}

export function pixelsToCanvas(p: PixelBuf | null | undefined): HTMLCanvasElement | null {
  try {
    if (!validBuf(p) || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = p.width; c.height = p.height;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
    return c;
  } catch {
    return null;
  }
}

/** Padded colour crop of a region of the ORIGINAL photo (or a video frame), scaled so it is `targetH` tall. */
export function colorCrop(src: HTMLImageElement | HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number, targetH = 110): HTMLCanvasElement | null {
  try {
    if (typeof document === "undefined") return null;
    const iw = (src as any).naturalWidth || (src as any).width, ih = (src as any).naturalHeight || (src as any).height;
    const h = Math.max(1, y1 - y0);
    const padX = Math.max(2, h * 0.2), padY = Math.max(2, h * 0.25);
    const sx = Math.max(0, x0 - padX), sy = Math.max(0, y0 - padY);
    const ex = Math.min(iw, x1 + padX), ey = Math.min(ih, y1 + padY);
    const sw = Math.max(1, ex - sx), sh = Math.max(1, ey - sy);
    const scale = Math.max(0.5, Math.min(6, targetH / sh));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale));
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  } catch {
    return null;
  }
}
