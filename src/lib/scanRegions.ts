// scanRegions.ts - saved screen layouts ("regions") per monitor model.
//
// A nurse draws a box around where each vital is printed, once per monitor model. Later scans read only those
// boxes, so alarm limits, labels and waveforms are outside the picture. Boxes are stored as FRACTIONS of the
// screen area (the crop box), so they still work when the phone is a little closer or further away.
//
// Storage is local to this device (localStorage). Everything here is defensive: private mode, a full disk or
// corrupted JSON must never break scanning.

export type RegionField = "pulse" | "spo2" | "respRate" | "temperature" | "bp";
export type Frac = { x0: number; y0: number; x1: number; y1: number };
export type Regions = Partial<Record<RegionField, Frac>>;
export type Layout = { id: string; name: string; regions: Regions; savedAt: string };

export const REGION_FIELDS: { id: RegionField; label: string }[] = [
  { id: "pulse", label: "Pulse / HR" },
  { id: "spo2", label: "SpO\u2082" },
  { id: "respRate", label: "Resp rate" },
  { id: "temperature", label: "Temperature" },
  { id: "bp", label: "BP (cuff, e.g. 120/80)" },
];

const KEY = "doctorbook.scanLayouts.v1";
const MAX_LAYOUTS = 20;
const MIN_SIDE = 0.02; // a region smaller than 2% of the screen is a stray tap, not a box

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Clamp to the screen and put the corners in order. Returns null for a stray tap or invalid input. */
export function normalizeFrac(f: Partial<Frac> | null | undefined): Frac | null {
  if (!f || !isNum(f.x0) || !isNum(f.y0) || !isNum(f.x1) || !isNum(f.y1)) return null;
  const x0 = clamp01(Math.min(f.x0, f.x1)), x1 = clamp01(Math.max(f.x0, f.x1));
  const y0 = clamp01(Math.min(f.y0, f.y1)), y1 = clamp01(Math.max(f.y0, f.y1));
  if (x1 - x0 < MIN_SIDE || y1 - y0 < MIN_SIDE) return null;
  return { x0, y0, x1, y1 };
}

/** Pixel box of a region inside an image of w x h pixels. */
export function regionToBox(region: Frac, w: number, h: number): Frac {
  return { x0: region.x0 * w, y0: region.y0 * h, x1: region.x1 * w, y1: region.y1 * h };
}

const fieldIds = new Set<string>(REGION_FIELDS.map((r) => r.id));

/** Keep only known fields with valid boxes. */
export function cleanRegions(r: unknown): Regions {
  const out: Regions = {};
  if (!r || typeof r !== "object") return out;
  for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
    if (!fieldIds.has(k)) continue;
    const f = normalizeFrac(v as Partial<Frac>);
    if (f) out[k as RegionField] = f;
  }
  return out;
}

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // some browsers throw just for touching localStorage
  }
}

/** All saved layouts. Corrupted or unknown entries are dropped, never thrown. */
export function loadLayouts(): Layout[] {
  try {
    const s = store();
    const raw = s?.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Layout[] = [];
    for (const l of parsed) {
      if (!l || typeof l.id !== "string" || typeof l.name !== "string") continue;
      const regions = cleanRegions(l.regions);
      if (!Object.keys(regions).length) continue;
      out.push({ id: l.id, name: l.name.slice(0, 60), regions, savedAt: typeof l.savedAt === "string" ? l.savedAt : "" });
    }
    return out;
  } catch {
    return [];
  }
}

function write(list: Layout[]): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(KEY, JSON.stringify(list.slice(0, MAX_LAYOUTS)));
    return true;
  } catch {
    return false; // quota exceeded / private mode
  }
}

const newId = () => "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Save (or replace the layout with the same name). Returns the layout, or null if it could not be stored. */
export function saveLayout(name: string, regions: Regions): Layout | null {
  const clean = cleanRegions(regions);
  const nm = String(name ?? "").trim().slice(0, 60);
  if (!nm || !Object.keys(clean).length) return null;
  const list = loadLayouts();
  const existing = list.find((l) => l.name.toLowerCase() === nm.toLowerCase());
  const layout: Layout = { id: existing?.id ?? newId(), name: nm, regions: clean, savedAt: new Date().toISOString() };
  const next = existing ? list.map((l) => (l.id === existing.id ? layout : l)) : [layout, ...list];
  return write(next) ? layout : null;
}

export function deleteLayout(id: string): boolean {
  return write(loadLayouts().filter((l) => l.id !== id));
}
