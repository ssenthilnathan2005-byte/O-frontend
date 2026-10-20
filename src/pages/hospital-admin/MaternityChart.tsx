import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { maternityApi } from "../../lib/maternityApi";
import { useStore } from "../../context/StoreContext";

const inp = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white w-full";
const lbl = "text-xs font-medium text-gray-600 mb-1 block";
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "-");

const EMPTY = {
  fhr: "", fetalMovement: "", fundalHeight: "", presentation: "",
  contractions: "", contractionSecs: "", dilation: "", effacement: "", station: "",
  membranes: "", liquor: "", urineProtein: "", urineGlucose: "", bleeding: "", oedema: "",
  painScore: "", notes: "",
};

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div><label className={lbl}>{label}</label>
      <select className={inp} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">--</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select></div>
  );
}
function Num({ label, value, onChange, step }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div><label className={lbl}>{label}</label>
      <input type="number" step={step} className={inp} value={value} onChange={(e) => onChange(e.target.value)} /></div>
  );
}

const PROTEIN: [string, string][] = [["neg", "Negative"], ["trace", "Trace"], ["1+", "1+"], ["2+", "2+"], ["3+", "3+"]];

export default function MaternityChart({ inwardId }: { inwardId: string }) {
  const { user } = useStore() as any;
  const isAdmin = user?.role === "hospital_admin" || user?.role === "admin";
  const [data, setData] = useState<any>(null);
  const [f, setF] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setData(await maternityApi.obsList(inwardId)); setErr(""); }
    catch (e: any) { setErr(e.message || "Could not load"); }
  }, [inwardId]);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true); setErr("");
    try {
      const saved = await maternityApi.obsAdd(inwardId, f);
      setF({ ...EMPTY });
      if (saved.alerts?.length) toast.warning(`${saved.alerts.length} alert(s) - tell the doctor`);
      else toast.success("Observation saved");
      await load();
    } catch (e: any) { setErr(e.message || "Could not save"); }
    setBusy(false);
  }
  async function del(id: string) {
    if (!confirm("Delete this observation? This cannot be undone.")) return;
    try { await maternityApi.obsDelete(id); await load(); } catch (e: any) { setErr(e.message); }
  }

  const active: any[] = data?.activeAlerts || [];
  const v = data?.latestVitals;

  return (
    <div className="p-5 space-y-5">
      {active.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Needs attention</p>
          {active.map((a, i) => (
            <p key={i} className={`text-sm ${a.level === "critical" ? "text-red-700 font-medium" : "text-amber-700"}`}>
              {a.level === "critical" ? "CRITICAL: " : "Warning: "}{a.message}
            </p>
          ))}
          <p className="text-[11px] text-gray-500 pt-1">Automatic flags to help staff notice problems. Not a diagnosis - the doctor decides.</p>
        </div>
      )}

      <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <span className="text-gray-500">Latest vitals: </span>
        {v ? `BP ${v.bp_systolic ?? "-"}/${v.bp_diastolic ?? "-"} - Pulse ${v.pulse ?? "-"} - Temp ${v.temperature ?? "-"} - SpO2 ${v.spo2 ?? "-"}% (${fmt(v.recorded_at)})`
           : "none recorded yet (record them from the nurse Vitals section)"}
      </div>

      <section>
        <h4 className="text-sm font-semibold mb-2">Fetal</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Num label="Fetal heart rate (bpm)" value={f.fhr} onChange={(x) => set("fhr", x)} />
          <Sel label="Fetal movements" value={f.fetalMovement} onChange={(x) => set("fetalMovement", x)}
            options={[["normal", "Normal"], ["reduced", "Reduced"], ["absent", "Absent"], ["na", "Not assessed"]]} />
          <Num label="Fundal height (cm)" value={f.fundalHeight} step="0.5" onChange={(x) => set("fundalHeight", x)} />
          <Sel label="Presentation" value={f.presentation} onChange={(x) => set("presentation", x)}
            options={[["cephalic", "Cephalic (head down)"], ["breech", "Breech"], ["transverse", "Transverse"], ["unknown", "Not known"]]} />
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold mb-2">Labour</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Num label="Contractions / 10 min" value={f.contractions} onChange={(x) => set("contractions", x)} />
          <Num label="Each lasting (sec)" value={f.contractionSecs} onChange={(x) => set("contractionSecs", x)} />
          <Num label="Cervix dilation (cm)" value={f.dilation} step="0.5" onChange={(x) => set("dilation", x)} />
          <Num label="Effacement (%)" value={f.effacement} onChange={(x) => set("effacement", x)} />
          <Sel label="Station" value={f.station} onChange={(x) => set("station", x)}
            options={[["-3", "-3"], ["-2", "-2"], ["-1", "-1"], ["0", "0"], ["1", "+1"], ["2", "+2"], ["3", "+3"]]} />
          <Sel label="Membranes" value={f.membranes} onChange={(x) => set("membranes", x)}
            options={[["intact", "Intact"], ["ruptured", "Ruptured"], ["unknown", "Not known"]]} />
          <Sel label="Liquor" value={f.liquor} onChange={(x) => set("liquor", x)}
            options={[["clear", "Clear"], ["meconium", "Meconium-stained"], ["blood_stained", "Blood-stained"], ["not_seen", "Not seen"]]} />
          <Sel label="Vaginal bleeding" value={f.bleeding} onChange={(x) => set("bleeding", x)}
            options={[["none", "None"], ["spotting", "Spotting"], ["heavy", "Heavy"]]} />
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold mb-2">Mother</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Sel label="Urine protein" value={f.urineProtein} onChange={(x) => set("urineProtein", x)} options={PROTEIN} />
          <Sel label="Urine glucose" value={f.urineGlucose} onChange={(x) => set("urineGlucose", x)} options={PROTEIN} />
          <Sel label="Oedema" value={f.oedema} onChange={(x) => set("oedema", x)}
            options={[["none", "None"], ["mild", "Mild"], ["marked", "Marked"]]} />
          <Num label="Pain score (0-10)" value={f.painScore} onChange={(x) => set("painScore", x)} />
        </div>
        <div className="mt-3"><label className={lbl}>Notes</label>
          <textarea rows={2} className={inp} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      </section>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex justify-end">
        <button onClick={save} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
          {busy ? "Saving..." : "Save observation"}
        </button>
      </div>

      <section>
        <h4 className="text-sm font-semibold mb-2">History</h4>
        {!data ? <p className="text-sm text-muted-foreground">Loading...</p>
          : data.observations.length === 0 ? <p className="text-sm text-muted-foreground">No observations yet.</p>
          : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left"><tr>
                  {["Time", "FHR", "Contr.", "Cervix", "Liquor", "Urine prot.", "Alerts", ""].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {data.observations.map((o: any) => (
                    <tr key={o.id} className="border-t align-top">
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmt(o.recorded_at)}<div className="text-[10px] text-gray-400">{o.recorded_by}</div></td>
                      <td className="px-2 py-1.5">{o.fhr ?? "-"}</td>
                      <td className="px-2 py-1.5">{o.contractions != null ? `${o.contractions}/10` : "-"}{o.contraction_secs ? ` x${o.contraction_secs}s` : ""}</td>
                      <td className="px-2 py-1.5">{o.dilation != null ? `${o.dilation}cm` : "-"}{o.effacement != null ? ` / ${o.effacement}%` : ""}{o.station != null ? ` / St ${o.station}` : ""}</td>
                      <td className="px-2 py-1.5">{o.liquor || "-"}</td>
                      <td className="px-2 py-1.5">{o.urine_protein || "-"}</td>
                      <td className="px-2 py-1.5">
                        {o.alerts.length === 0 ? <span className="text-green-600">ok</span> : o.alerts.map((a: any, i: number) => (
                          <div key={i} className={a.level === "critical" ? "text-red-600 font-medium" : "text-amber-600"}>{a.message}</div>
                        ))}
                        {o.notes && <div className="text-gray-500 italic">{o.notes}</div>}
                      </td>
                      <td className="px-2 py-1.5">{isAdmin && <button onClick={() => del(o.id)} title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );
}
