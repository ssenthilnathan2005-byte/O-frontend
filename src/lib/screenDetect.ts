/**
 * Monitor-display detection and photo-quality checks.
 *
 * Pure functions over RGBA pixel data (no DOM), so they can be unit tested in Node.
 * Nothing here changes pixels that go to the OCR: detection only proposes a crop rectangle,
 * and quality checks only produce advisory warnings. The nurse can always override both.
 */

export type Rgba = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };
export type Frac = { x0: number; y0: number; x1: number; y1: number };

export type DisplayDetection = {
  frac: Frac;
  /** area of the dark blob / area of its bounding box. A tilted screen scores lower. */
  fill: number;
  /** share of the photo the display covers */
  coverage: number;
};

export type QualityIssue = {
  code: "blur" | "moire" | "glare" | "dark" | "bright" | "angle" | "small" | "no_display";
  message: string;
  value?: number;
};

export type QualityReport = { issues: QualityIssue[]; metrics: Record<string, number> };

// ---------- helpers ----------

function gray(img: Rgba, step = 1, mode: "luma" | "max" = "luma"): { g: Float32Array; w: number; h: number } {
  const w = Math.floor(img.width / step), h = Math.floor(img.height / step);
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // box average over step x step block (acts as a low-pass before decimation)
      let s = 0, n = 0;
      for (let dy = 0; dy < step; dy++) {
        for (let dx = 0; dx < step; dx++) {
          const i = ((y * step + dy) * img.width + (x * step + dx)) * 4;
          s += mode === "max"
            ? Math.max(img.data[i], img.data[i + 1], img.data[i + 2])
            : 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
          n++;
        }
      }
      g[y * w + x] = s / n;
    }
  }
  return { g, w, h };
}

function otsuF(g: Float32Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < g.length; i++) hist[Math.max(0, Math.min(255, Math.round(g[i])))]++;
  const total = g.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = -1, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const b = wB * wF * (mB - mF) * (mB - mF);
    if (b > best) { best = b; thr = t; }
  }
  return thr;
}

// ---------- 1. display detection ----------

/**
 * Finds the largest dark, roughly rectangular blob (a monitor display is a dark panel inside a lighter
 * housing). Returns null when nothing plausible is found, in which case the caller keeps the manual crop.
 * Limitation: light-background displays are not detected (they fall back to manual crop).
 */
export function detectDisplay(img: Rgba): DisplayDetection | null {
  // A display's darkness depends on exposure and colour cast, so several cut-offs are tried and the most
  // rectangular, reasonably large blob wins.
  let best: DisplayDetection | null = null;
  for (const cap of [150, 120, 90]) {
    const d = detectAt(img, cap);
    if (d && d.coverage >= 0.08 && (!best || d.fill > best.fill + 0.02)) best = d;
  }
  return best;
}

function detectAt(img: Rgba, cap: number): DisplayDetection | null {
  const step = Math.max(1, Math.round(Math.max(img.width, img.height) / 220));
  // Brightest channel (not luminance): a blue colour cast makes blue backgrounds look dark in greyscale,
  // but a real display is near-black in every channel.
  const { g, w, h } = gray(img, step, "max");
  const thr = Math.min(otsuF(g), cap);
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < g.length; i++) dark[i] = g[i] < thr ? 1 : 0;

  // Morphological close (dilate then erode, radius 2) so bright digits/waveforms inside the panel do not split it.
  const close = (src: Uint8Array, r: number): Uint8Array => {
    const dil = new Uint8Array(w * h), out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0;
      for (let dy = -r; dy <= r && !v; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx]) { v = 1; break; }
      }
      dil[y * w + x] = v;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 1;
      for (let dy = -r; dy <= r && v; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || !dil[yy * w + xx]) { v = 0; break; }
      }
      out[y * w + x] = v;
    }
    return out;
  };
  const mask = close(dark, 4);

  // Connected components (4-neighbour), keep the best scoring one.
  const seen = new Uint8Array(w * h);
  let best: { score: number; d: DisplayDetection } | null = null;
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || seen[s]) continue;
    let minx = w, miny = h, maxx = 0, maxy = 0, area = 0;
    stack.length = 0; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w, y = (p - x) / w;
      area++;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    const bw = maxx - minx + 1, bh = maxy - miny + 1;
    const coverage = (bw * bh) / (w * h);
    const fill = area / (bw * bh);
    const aspect = bw / bh;
    if (coverage < 0.04 || fill < 0.55 || aspect < 0.7 || aspect > 3) continue;
    // Prefer big, solid blobs. Touching the photo edge on 3+ sides means "dark background", not a display.
    const edges = (minx <= 1 ? 1 : 0) + (miny <= 1 ? 1 : 0) + (maxx >= w - 2 ? 1 : 0) + (maxy >= h - 2 ? 1 : 0);
    if (edges >= 3) continue;
    const score = coverage * fill;
    if (!best || score > best.score) {
      const pad = 0.02; // small margin so edge digits are not clipped
      best = {
        score,
        d: {
          frac: {
            x0: Math.max(0, minx / w - pad), y0: Math.max(0, miny / h - pad),
            x1: Math.min(1, (maxx + 1) / w + pad), y1: Math.min(1, (maxy + 1) / h + pad),
          },
          fill, coverage,
        },
      };
    }
  }
  return best ? best.d : null;
}

// ---------- 2. quality checks ----------

function fft1d(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/**
 * Periodic-pattern score. Photographing another screen records its pixel grid, which shows up as a sharp,
 * isolated spectral peak (often on a frequency axis). Text and waveform edges give broad streaks, not isolated
 * peaks, so each local maximum is compared with the average of its own neighbourhood. Returns the strongest
 * such ratio. Advisory only: threshold is provisional (calibrated on very few photos).
 */
export function moireScore(g: Float32Array, w: number, h: number, n = 128): number {
  if (w < n || h < n) return 0;
  const x0 = Math.floor((w - n) / 2), y0 = Math.floor((h - n) / 2);
  let mean = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) mean += g[(y0 + y) * w + x0 + x];
  mean /= n * n;
  const re: Float64Array[] = [], im: Float64Array[] = [];
  for (let y = 0; y < n; y++) {
    const r = new Float64Array(n), i = new Float64Array(n);
    const wy = 0.5 - 0.5 * Math.cos((2 * Math.PI * y) / (n - 1));
    for (let x = 0; x < n; x++) {
      const wx = 0.5 - 0.5 * Math.cos((2 * Math.PI * x) / (n - 1));
      r[x] = (g[(y0 + y) * w + x0 + x] - mean) * wx * wy;
    }
    fft1d(r, i); re.push(r); im.push(i);
  }
  // F is the centred magnitude spectrum: F[y*n+x], DC at (n/2, n/2).
  const F = new Float64Array(n * n), c = n / 2;
  for (let x = 0; x < n; x++) {
    const cr = new Float64Array(n), ci = new Float64Array(n);
    for (let y = 0; y < n; y++) { cr[y] = re[y][x]; ci[y] = im[y][x]; }
    fft1d(cr, ci);
    for (let y = 0; y < n; y++) F[((y + c) % n) * n + ((x + c) % n)] = Math.hypot(cr[y], ci[y]);
  }
  const m = 8; // margin from the array edge
  let best = 0;
  for (let y = m; y < n - m; y++) for (let x = m; x < n - m; x++) {
    const rad = Math.hypot(y - c, x - c);
    if (rad < 14 * (n / 256) || rad > n / 2 - m) continue;
    const v = F[y * n + x];
    let isMax = true;
    for (let dy = -1; dy <= 1 && isMax; dy++) for (let dx = -1; dx <= 1; dx++) if (F[(y + dy) * n + x + dx] > v) { isMax = false; break; }
    if (!isMax) continue;
    let sum = 0, cnt = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      if (Math.abs(dy) <= 2 && Math.abs(dx) <= 2) continue;
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || xx < 0 || yy >= n || xx >= n) continue;
      sum += F[yy * n + xx]; cnt++;
    }
    const ratio = v / (sum / cnt || 1e-9);
    if (ratio > best) best = ratio;
  }
  return best;
}

/** Blur: share of strong edges. Sharp digits give many pixels with a large gradient; blur removes them. */
export function sharpness(g: Float32Array, w: number, h: number): number {
  let strong = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const gx = g[y * w + x + 1] - g[y * w + x - 1], gy = g[(y + 1) * w + x] - g[(y - 1) * w + x];
    if (Math.hypot(gx, gy) > 60) strong++;
    n++;
  }
  return n ? strong / n : 0;
}

/**
 * `display`: the detection result for this photo, `null` when detection ran and found nothing, or `undefined`
 * when the nurse adjusted the crop by hand (display/angle checks are then skipped).
 */
export function assessQuality(img: Rgba, display: DisplayDetection | null | undefined, fr: Frac): QualityReport {
  const issues: QualityIssue[] = [];
  const metrics: Record<string, number> = {};
  // Work on the area that will be read.
  const sx = Math.floor(fr.x0 * img.width), sy = Math.floor(fr.y0 * img.height);
  const sw = Math.max(1, Math.floor((fr.x1 - fr.x0) * img.width)), sh = Math.max(1, Math.floor((fr.y1 - fr.y0) * img.height));
  const sub = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const si = ((sy + y) * img.width + sx + x) * 4, di = (y * sw + x) * 4;
    sub[di] = img.data[si]; sub[di + 1] = img.data[si + 1]; sub[di + 2] = img.data[si + 2]; sub[di + 3] = 255;
  }
  const { g, w, h } = gray({ data: sub, width: sw, height: sh }, 1);
  metrics.cropW = sw; metrics.cropH = sh;

  if (Math.min(sw, sh) < 200) issues.push({ code: "small", message: "The display area is small in the photo. Move closer so the screen fills the frame.", value: Math.min(sw, sh) });

  let mean = 0; for (let i = 0; i < g.length; i++) mean += g[i]; mean /= g.length;
  metrics.meanLuma = mean;
  const sorted = Float32Array.from(g).sort();
  const p99 = sorted[Math.floor(sorted.length * 0.99)], p1 = sorted[Math.floor(sorted.length * 0.01)];
  metrics.contrast = p99 - p1;
  if (p99 - p1 < 70) issues.push({ code: "dark", message: "The screen looks washed out or too dim. Avoid glare and retake with the screen filling the frame.", value: p99 - p1 });

  // Glare: a large near-white blob that is not a bright digit (digits are thin; glare is a wide patch).
  let sat = 0; for (let i = 0; i < sw * sh; i++) { const j = i * 4; if (sub[j] > 245 && sub[j + 1] > 245 && sub[j + 2] > 245) sat++; }
  metrics.saturatedShare = sat / (sw * sh);
  if (metrics.saturatedShare > 0.12) issues.push({ code: "glare", message: "There is glare or a reflection on the screen. Tilt the phone slightly to remove it.", value: metrics.saturatedShare });

  const sharp = sharpness(g, w, h);
  metrics.sharpness = sharp;
  if (sharp < 0.012) issues.push({ code: "blur", message: "The photo looks blurred. Hold the phone steady, let it focus, and retake.", value: sharp });

  const moire = moireScore(g, w, h);
  metrics.moire = moire;
  if (moire > 12) issues.push({ code: "moire", message: "Wavy interference lines (moiré) are visible. This happens when photographing another screen. Retake straight-on from a slightly different distance or angle. You can still read it if the digits look clear.", value: moire });

  if (display === null) issues.push({ code: "no_display", message: "The display could not be found automatically. Drag a box around the screen." });
  else if (display && display.fill < 0.8) issues.push({ code: "angle", message: "The screen looks tilted. Hold the phone straight in front of the monitor for a more reliable read.", value: display.fill });
  if (display) metrics.displayFill = display.fill;
  return { issues, metrics };
}
