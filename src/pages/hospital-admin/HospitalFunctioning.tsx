import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getToken } from "@/api";
import { useStore } from "../../context/StoreContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import HAIntakeSettings from "./HAIntakeSettings";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

interface TypeDef { key: string; label: string }
interface Mod { key: string; label: string }

export default function HospitalFunctioning() {
  const { user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? user.hospitalId : "";
  const [types, setTypes] = useState<TypeDef[]>([]);
  const [catalog, setCatalog] = useState<Mod[]>([]);
  const [defaults, setDefaults] = useState<Record<string, string[]>>({});
  const [savedType, setSavedType] = useState("general");
  const [type, setType] = useState("general");
  const [on, setOn] = useState<string[]>([]);
  const [customised, setCustomised] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
  const defaultsFor = (t: string) => defaults[t] ?? catalog.map((m) => m.key);

  async function load() {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`${BASE}/hospitals/${hospitalId}/intake-config`, { headers }),
        fetch(`${BASE}/hospitals/${hospitalId}/modules`, { headers }),
      ]);
      const ia = await a.json();
      const mb = await b.json();
      if (!a.ok) throw new Error(ia.error || "Failed to load");
      if (!b.ok) throw new Error(mb.error || "Failed to load");
      setTypes(ia.types || []);
      setCatalog(mb.catalog || []);
      setDefaults(mb.defaults || {});
      setType(mb.type);
      setSavedType(mb.type);
      setOn(mb.modules || []);
      setCustomised(!!mb.customised);
    } catch (e: any) { toast.error(e.message || "Failed to load hospital functioning"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  function changeType(t: string) {
    setType(t);
    setOn(defaultsFor(t));
    setCustomised(false);
  }
  function toggle(k: string) {
    setOn((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
    setCustomised(true);
  }
  async function save() {
    if (type !== savedType && !window.confirm("Changing the hospital type also resets the front desk fields to that type's defaults. Continue?")) return;
    setSaving(true);
    try {
      if (type !== savedType) {
        const r1 = await fetch(`${BASE}/hospitals/${hospitalId}/intake-config`, { method: "PATCH", headers, body: JSON.stringify({ hospitalType: type }) });
        const d1 = await r1.json();
        if (!r1.ok) throw new Error(d1.error || "Failed to change type");
        setSavedType(type);
      }
      const def = defaultsFor(type);
      const same = on.length === def.length && def.every((k) => on.includes(k));
      const r2 = await fetch(`${BASE}/hospitals/${hospitalId}/modules`, { method: "PATCH", headers, body: JSON.stringify({ modules: customised && !same ? on : null }) });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.error || "Failed to save modules");
      setOn(d2.modules || []);
      setCustomised(!!d2.customised);
      window.dispatchEvent(new Event("modules-changed"));
      toast.success("Hospital functioning saved");
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  if (!hospitalId) return null;
  return (
    <div className="p-4 max-w-3xl space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Hospital functioning</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-gray-400">Loading...</p> : (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Hospital type</label>
                <select className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm" value={type} onChange={(e) => changeType(e.target.value)}>
                  {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <p className="text-xs text-gray-500">Choosing a type loads its standard modules. You can then switch individual modules on or off.</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">Modules {customised && <span className="ml-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">Customised</span>}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {catalog.map((m) => (
                    <label key={m.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={on.includes(m.key)} onChange={() => toggle(m.key)} />
                      {m.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Dashboard, revenue, doctors, HR, attendance, permissions, patients and front desk are always on.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                <Button variant="outline" onClick={() => { setOn(defaultsFor(type)); setCustomised(false); }} disabled={saving}>Reset to type defaults</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <HAIntakeSettings key={savedType} hideType />
    </div>
  );
}
