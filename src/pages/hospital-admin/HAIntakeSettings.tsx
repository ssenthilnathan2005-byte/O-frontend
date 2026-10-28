import { useState, useEffect } from "react";
import { useStore } from "../../context/StoreContext";
import { getToken } from "@/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

interface Field { key: string; label: string; unit?: string }
interface TypeDef { key: string; label: string; fields: string[] }

export default function HAIntakeSettings({ hideType = false }: { hideType?: boolean } = {}) {
  const { user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? user.hospitalId : "";
  const [types, setTypes] = useState<TypeDef[]>([]);
  const [allFields, setAllFields] = useState<Field[]>([]);
  const [type, setType] = useState("general");
  const [on, setOn] = useState<string[]>([]);
  const [customised, setCustomised] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/hospitals/${hospitalId}/intake-config`, { headers });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load");
      setTypes(d.types || []);
      setAllFields(d.allFields || []);
      setType(d.type);
      setOn((d.fields || []).map((f: Field) => f.key));
      setCustomised(!!d.customised);
    } catch (e: any) { toast.error(e.message || "Failed to load front desk settings"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  function changeType(t: string) {
    setType(t);
    const def = types.find((x) => x.key === t);
    if (def) setOn(def.fields);
    setCustomised(false);
  }
  function toggle(k: string) {
    setOn((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
    setCustomised(true);
  }
  async function save(reset = false) {
    if (!reset && on.length === 0) return toast.error("Keep at least one field on");
    setSaving(true);
    try {
      const def = types.find((x) => x.key === type);
      const sameAsDefault = def && on.length === def.fields.length && def.fields.every((k) => on.includes(k));
      const body: any = { hospitalType: type, fields: reset || sameAsDefault ? null : on };
      const res = await fetch(`${BASE}/hospitals/${hospitalId}/intake-config`, { method: "PATCH", headers, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save");
      setOn((d.fields || []).map((f: Field) => f.key));
      setCustomised(!!d.customised);
      toast.success("Front desk settings saved");
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  if (!hospitalId) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Front desk intake</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-gray-400">Loading...</p> : (
          <>
            <div className={"space-y-1" + (hideType ? " hidden" : "")}>
              <label className="text-sm font-medium text-gray-700">Hospital type</label>
              <select className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm" value={type} onChange={(e) => changeType(e.target.value)}>
                {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <p className="text-xs text-gray-500">Choosing a type loads its standard fields. You can then switch individual fields on or off.</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Fields the front desk collects {customised && <span className="ml-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">Customised</span>}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {allFields.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={on.includes(f.key)} onChange={() => toggle(f.key)} />
                    {f.label}{f.unit ? <span className="text-gray-400 text-xs">({f.unit})</span> : null}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => save(false)} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              <Button variant="outline" onClick={() => { const def = types.find((x) => x.key === type); if (def) setOn(def.fields); setCustomised(false); save(true); }} disabled={saving}>Reset to type defaults</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
