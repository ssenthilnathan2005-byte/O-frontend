import { useRef, useState } from "react";
import { REGION_FIELDS, normalizeFrac } from "@/lib/scanRegions";
import type { Frac, Layout, RegionField, Regions } from "@/lib/scanRegions";

/**
 * Draw where each vital is printed on THIS monitor model. Boxes are saved as fractions of the screen area, so they
 * keep working when the phone is a little closer or further away. Nothing here reads a value: the scanner reads
 * only these boxes on later scans, and every value still has to be checked by a nurse before it is used.
 */
type Props = {
  imgUrl: string;
  natW: number;
  natH: number;
  /** The screen area (crop box) as fractions of the photo. Regions are drawn relative to it. */
  crop: Frac | null;
  /** The layout being edited, if any. */
  initial?: Layout;
  onSave: (name: string, regions: Regions) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
};

const COLORS: Record<RegionField, string> = {
  pulse: "#16a34a",
  spo2: "#0891b2",
  respRate: "#ca8a04",
  temperature: "#9333ea",
  bp: "#dc2626",
};

export default function ScanRegionEditor({ imgUrl, natW, natH, crop, initial, onSave, onDelete, onCancel }: Props) {
  const area: Frac = crop ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  const bw = Math.max(0.01, area.x1 - area.x0), bh = Math.max(0.01, area.y1 - area.y0);
  const aspect = Math.max(0.1, (Math.max(1, natW) * bw) / (Math.max(1, natH) * bh));

  const [regions, setRegions] = useState<Regions>(initial?.regions ?? {});
  const [active, setActive] = useState<RegionField>("pulse");
  const [name, setName] = useState(initial?.name ?? "");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const at = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = at(e);
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const p = at(e);
    // while dragging, show the raw rectangle (kept even if tiny); it is validated on release
    setRegions((prev) => ({ ...prev, [active]: { x0: Math.min(s.x, p.x), y0: Math.min(s.y, p.y), x1: Math.max(s.x, p.x), y1: Math.max(s.y, p.y) } }));
  };
  const onUp = () => {
    start.current = null;
    setRegions((prev) => {
      const ok = normalizeFrac(prev[active]);
      const next = { ...prev };
      if (ok) next[active] = ok; else delete next[active];
      return next;
    });
  };

  const count = Object.keys(regions).length;
  const canSave = name.trim().length > 0 && count > 0;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600">
        Pick a vital, then drag a box around the number for it on the screen photo. Draw only the digits, not the label or the small alarm limits.
        Do this once per monitor model.
      </p>

      <div className="flex flex-wrap gap-1">
        {REGION_FIELDS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActive(f.id)}
            className={"rounded-full border px-2 py-1 text-xs " + (active === f.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300")}
            style={regions[f.id] ? { borderColor: COLORS[f.id], borderWidth: 2 } : undefined}
          >
            {f.label}{regions[f.id] ? " \u2713" : ""}
          </button>
        ))}
      </div>

      <div
        ref={boxRef}
        className="relative select-none rounded-lg overflow-hidden bg-black w-full"
        style={{ touchAction: "none", aspectRatio: String(aspect) }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img
          src={imgUrl}
          alt="Monitor screen"
          draggable={false}
          className="absolute pointer-events-none max-w-none"
          style={{ left: (-area.x0 / bw) * 100 + "%", top: (-area.y0 / bh) * 100 + "%", width: 100 / bw + "%", height: 100 / bh + "%" }}
        />
        {REGION_FIELDS.map((f) => {
          const r = regions[f.id];
          if (!r) return null;
          return (
            <div
              key={f.id}
              className="absolute pointer-events-none"
              style={{ left: r.x0 * 100 + "%", top: r.y0 * 100 + "%", width: (r.x1 - r.x0) * 100 + "%", height: (r.y1 - r.y0) * 100 + "%", border: "2px solid " + COLORS[f.id], background: COLORS[f.id] + "22" }}
            >
              <span className="absolute -top-0.5 left-0 text-[10px] leading-none px-1 text-white" style={{ background: COLORS[f.id] }}>{f.label}</span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRegions((prev) => { const n = { ...prev }; delete n[active]; return n; })}
          disabled={!regions[active]}
          className="rounded-lg border border-gray-300 text-xs text-gray-700 px-2 py-1 disabled:opacity-40"
        >
          Clear this box
        </button>
        <span className="text-xs text-gray-500 self-center">{count} of {REGION_FIELDS.length} boxes drawn</span>
      </div>

      <label className="block text-xs text-gray-600">
        Name for this monitor model
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. ICU Mindray bed monitor"
          className="mt-1 w-full h-10 rounded-md border border-gray-200 bg-white px-2 text-sm"
        />
      </label>

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-gray-300 text-sm text-gray-700 py-2">Cancel</button>
        {initial && onDelete && (
          <button type="button" onClick={() => onDelete(initial.id)} className="flex-1 rounded-lg border border-red-300 text-sm text-red-700 py-2">Delete</button>
        )}
        <button
          type="button"
          onClick={() => onSave(name.trim(), regions)}
          disabled={!canSave}
          className="flex-1 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-semibold py-2"
        >
          Save layout
        </button>
      </div>
      <p className="text-[11px] text-gray-500">Saved on this device only. Values read from a saved box still have to be checked against the monitor.</p>
    </div>
  );
}
