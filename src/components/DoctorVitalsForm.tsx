import VitalsScanAll from "@/components/VitalsScanAll";
import { Input } from "@/components/ui/input";

export interface VField { key: string; label: string; kind: string; unit?: string; options?: string[] }
const sel = "h-10 w-full rounded-md border border-gray-200 bg-white px-2 text-sm";

/** Renders exactly the vitals a doctor asked for. Values live in the parent as strings (same keys the API expects). */
export default function DoctorVitalsForm({ fields, value, onChange, onSubmit }: {
  fields: VField[]; value: Record<string, string>; onChange: (v: Record<string, string>) => void; onSubmit?: () => void;
}) {
  const has = (k: string) => fields.some((f) => f.key === k);
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  const scanKeys = [has("temperature") && "temperature", has("bp") && "bpSystolic", has("bp") && "bpDiastolic", has("pulse") && "pulse", has("spo2") && "spo2"].filter(Boolean) as any[];
  const lab = (f: VField) => f.label + (f.unit ? " (" + f.unit + ")" : "");
  return (
    <div className="space-y-3" onKeyDown={(e) => {
      if (e.key !== "Enter") return;
      const t = e.target as HTMLElement;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
      e.preventDefault();
      const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("input, select")).filter((el: any) => !el.disabled && el.type !== "file" && el.type !== "hidden" && !el.dataset.skipEnter && el.offsetParent !== null);
      const i = els.indexOf(t);
      if (i >= 0 && i < els.length - 1) els[i + 1].focus(); else onSubmit?.();
    }}>
      {scanKeys.length > 0 && <VitalsScanAll include={scanKeys} onApply={(v: any) => onChange({ ...value, ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)])) })} />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {fields.map((f) => {
          const val = String(value[f.key] ?? "");
          if (f.key === "bp") return (
            <div key="bp" className="min-w-0 col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Blood pressure (mmHg)</label>
              <div className="flex gap-1"><Input className="min-w-0" inputMode="numeric" placeholder="High" value={value.bpSystolic || ""} onChange={(e) => set("bpSystolic", e.target.value)} /><Input className="min-w-0" inputMode="numeric" placeholder="Low" value={value.bpDiastolic || ""} onChange={(e) => set("bpDiastolic", e.target.value)} /></div>
            </div>
          );
          if (f.key === "temperature") return (
            <div key="temperature" className="min-w-0">
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Temperature</label>
              <div className="flex gap-1"><Input className="min-w-0" inputMode="decimal" value={val} onChange={(e) => set("temperature", e.target.value)} />
                <select data-skip-enter="1" className="h-10 rounded-md border border-gray-200 bg-white px-1 text-sm" value={value.tempUnit || "F"} onChange={(e) => set("tempUnit", e.target.value)}><option value="F">F</option><option value="C">C</option></select></div>
            </div>
          );
          return (
            <div key={f.key} className="min-w-0">
              <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">{lab(f)}</label>
              {f.kind === "bool" ? <select className={sel} value={val} onChange={(e) => set(f.key, e.target.value)}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select>
                : f.kind === "select" ? <select className={sel} value={val} onChange={(e) => set(f.key, e.target.value)}><option value="">-</option>{(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>
                : f.kind === "date" ? <Input type="date" value={val} onChange={(e) => set(f.key, e.target.value)} />
                : <Input inputMode={f.kind === "number" ? "decimal" : undefined} value={val} onChange={(e) => set(f.key, e.target.value)} />}
            </div>
          );
        })}
      </div>
      <Input placeholder="Note (optional)" value={value.notes || ""} onChange={(e) => set("notes", e.target.value)} />
    </div>
  );
}
