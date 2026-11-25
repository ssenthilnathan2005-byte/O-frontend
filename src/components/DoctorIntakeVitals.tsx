import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getToken } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
async function call(path: string, method = "GET", body?: any) {
  const r = await fetch(BASE + "/doctor-vitals" + path, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
const SRC: Record<string, string> = { doctor: "Your custom list", department: "Department template", hospital: "Hospital default" };

/** Doctor Login > Intake Vitals: which vitals the nurse must collect for THIS doctor's patients. */
export default function DoctorIntakeVitals() {
  const [cfg, setCfg] = useState<any>(null);
  const [on, setOn] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  async function load() {
    try { const d = await call("/config"); setCfg(d); setOn(d.keys || []); }
    catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); }, []);
  const toggle = (k: string) => setOn((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  async function save(reset = false) {
    if (!reset && !on.length) return toast.error("Keep at least one vital on");
    setSaving(true);
    try { const d = await call("/config", "PUT", { fields: reset ? null : on }); toast.success(reset ? "Back to defaults" : "Intake vitals saved"); setCfg((c: any) => ({ ...c, ...d })); setOn(d.keys || []); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }
  if (!cfg) return <p className="text-sm text-gray-400 p-4">Loading...</p>;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Intake Vitals <span className="ml-2 text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">{SRC[cfg.source] || cfg.source}</span></CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-500">The nurse will automatically see these vitals for every patient booked with you{cfg.department ? " (" + cfg.department + ")" : ""}. Other doctors are not affected.</p>
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">Load a department template</p>
          <div className="flex flex-wrap gap-1.5">
            {(cfg.departments || []).map((d: any) => (
              <button key={d.key} type="button" onClick={() => setOn(d.fields)} className={"text-xs rounded-full border px-2.5 py-1 " + (cfg.departmentTemplate?.key === d.key ? "border-teal-400 bg-teal-50 text-teal-800" : "border-gray-200 text-gray-600 hover:bg-gray-50")}>{d.label}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {(cfg.allFields || []).map((f: any) => (
            <label key={f.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={on.includes(f.key)} onChange={() => toggle(f.key)} />
              {f.label}{f.unit ? <span className="text-gray-400 text-xs">({f.unit})</span> : null}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => save(false)} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button variant="outline" onClick={() => save(true)} disabled={saving}>Reset to department default</Button>
        </div>
      </CardContent>
    </Card>
  );
}
