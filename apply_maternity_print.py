import sys

def rd(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()

def wr(p, s):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

LIB = r"""import { Capacitor } from "@capacitor/core";
import { downloadFile } from "./downloadFile";
import { maternityApi } from "./maternityApi";

const esc = (x: any) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");
const dOnly = (s?: string | null) => {
  if (!s) return "-";
  const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
  return isNaN(d.getTime()) ? esc(s) : d.toLocaleDateString("en-IN", { dateStyle: "medium" });
};
const val = (x: any, suffix = "") => (x === null || x === undefined || x === "" ? "-" : esc(x) + suffix);

const LABEL: Record<string, string> = {
  normal: "Normal", reduced: "Reduced", absent: "Absent", na: "Not assessed",
  cephalic: "Cephalic", breech: "Breech", transverse: "Transverse", unknown: "Not known",
  intact: "Intact", ruptured: "Ruptured", clear: "Clear", meconium: "Meconium-stained",
  blood_stained: "Blood-stained", not_seen: "Not seen", none: "None", spotting: "Spotting",
  heavy: "Heavy", neg: "Negative", trace: "Trace", mild: "Mild", marked: "Marked",
  low: "Low", moderate: "Moderate", high: "High",
};
const lab = (x: any) => (x === null || x === undefined || x === "" ? "-" : esc(LABEL[String(x)] ?? x));
const RISK_LABEL: Record<string, string> = {
  previous_cs: "Previous caesarean", hypertension: "Hypertension / pre-eclampsia", gdm: "Gestational diabetes",
  anaemia: "Anaemia", twins: "Twins / multiple", preterm_history: "Preterm birth history", rh_negative: "Rh negative",
  bleeding: "Bleeding in pregnancy", short_stature: "Short stature", prev_stillbirth: "Previous stillbirth", other: "Other",
};

export function maternityRecordHtml(d: any): string {
  const p = d.patient || {};
  const m = d.profile;
  const obs: any[] = d.observations || [];
  const vitals: any[] = d.vitals || [];
  const notes: any[] = d.notes || [];

  const profileHtml = m
    ? `<table class="kv">
<tr><td>LMP</td><td>${dOnly(m.lmp)}</td><td>EDD</td><td>${dOnly(m.edd)}</td><td>Blood group</td><td>${val(m.blood_group)}</td></tr>
<tr><td>Gravida</td><td>${val(m.gravida)}</td><td>Para</td><td>${val(m.para)}</td><td>Abortions</td><td>${val(m.abortions)}</td></tr>
<tr><td>Living children</td><td>${val(m.living)}</td><td>Previous caesareans</td><td>${val(m.previous_cs)}</td><td>Antenatal booking</td><td>${val(m.booking_status)}</td></tr>
<tr><td>Height</td><td>${val(m.height_cm, " cm")}</td><td>Pre-pregnancy weight</td><td>${val(m.pre_preg_weight, " kg")}</td><td>Allergies</td><td>${val(m.allergies)}</td></tr>
<tr><td>Overall risk</td><td><b>${lab(m.risk_level)}</b></td><td>Planned delivery</td><td colspan="3">${val(m.delivery_plan)}</td></tr>
<tr><td>Risk factors</td><td colspan="5">${(m.risk_factors || []).length ? (m.risk_factors as string[]).map((k) => esc(RISK_LABEL[k] ?? k)).join(", ") : "None recorded"}</td></tr>
<tr><td>Attendant</td><td>${val(m.attendant_name)}</td><td>Attendant phone</td><td colspan="3">${val(m.attendant_phone)}</td></tr>
<tr><td>Notes</td><td colspan="5">${val(m.notes)}</td></tr>
</table>
<div class="s">Profile last updated ${esc(dt(m.updated_at))}${m.updated_by ? " by " + esc(m.updated_by) : ""}</div>`
    : `<p class="s">No maternity profile has been filled in.</p>`;

  const station = (n: any) => (n === null || n === undefined ? "-" : Number(n) > 0 ? "+" + n : String(n));
  const obsRows = obs.map((o) => `<tr>
<td class="nw">${esc(dt(o.recorded_at))}<div class="s">${esc(o.recorded_by || "")}</div></td>
<td>${val(o.fhr)}</td><td>${lab(o.fetal_movement)}</td><td>${val(o.fundal_height)}</td><td>${lab(o.presentation)}</td>
<td>${val(o.contractions)}${o.contraction_secs ? " x " + esc(o.contraction_secs) + "s" : ""}</td>
<td>${val(o.dilation)}</td><td>${val(o.effacement)}</td><td>${station(o.station)}</td>
<td>${lab(o.membranes)}</td><td>${lab(o.liquor)}</td><td>${lab(o.bleeding)}</td>
<td>${lab(o.urine_protein)} / ${lab(o.urine_glucose)}</td><td>${lab(o.oedema)}</td><td>${val(o.pain_score)}</td>
<td>${(o.alerts || []).length ? (o.alerts as any[]).map((a) => `<div class="${a.level === "critical" ? "crit" : "warn"}">${esc(a.message)}</div>`).join("") : "ok"}${o.notes ? `<div class="s"><i>${esc(o.notes)}</i></div>` : ""}</td>
</tr>`).join("");
  const obsHtml = obs.length
    ? `<table class="grid"><thead><tr><th>Time / by</th><th>FHR</th><th>Fetal mvmt</th><th>Fundal ht</th><th>Presentation</th><th>Contractions /10 min</th><th>Dilation cm</th><th>Effacement %</th><th>Station</th><th>Membranes</th><th>Liquor</th><th>Bleeding</th><th>Urine prot / gluc</th><th>Oedema</th><th>Pain</th><th>Alerts / notes</th></tr></thead><tbody>${obsRows}</tbody></table>`
    : `<p class="s">No observations recorded.</p>`;

  const vitalRows = vitals.map((x) => `<tr><td class="nw">${esc(dt(x.recorded_at))}</td>
<td>${x.bp_systolic != null ? esc(x.bp_systolic) + "/" + esc(x.bp_diastolic) : "-"}</td><td>${val(x.pulse)}</td><td>${val(x.temperature)}</td><td>${val(x.spo2)}</td><td>${val(x.resp_rate)}</td><td>${val(x.weight)}</td><td>${val(x.blood_glucose)}</td><td>${val(x.recorded_by)}</td></tr>`).join("");
  const vitalsHtml = vitals.length
    ? `<table class="grid"><thead><tr><th>Time</th><th>BP</th><th>Pulse</th><th>Temp</th><th>SpO2 %</th><th>Resp rate</th><th>Weight</th><th>Glucose</th><th>Recorded by</th></tr></thead><tbody>${vitalRows}</tbody></table>`
    : `<p class="s">No vitals recorded.</p>`;

  const noteRows = notes.map((n) => `<tr><td class="nw">${esc(dt(n.recorded_at))}<div class="s">${esc(n.shift || "")} shift</div></td><td>${esc(n.note)}</td><td>${val(n.recorded_by)}</td></tr>`).join("");
  const notesHtml = notes.length
    ? `<table class="grid"><thead><tr><th>Time</th><th>Note</th><th>Recorded by</th></tr></thead><tbody>${noteRows}</tbody></table>`
    : `<p class="s">No nursing notes.</p>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Maternity record - ${esc(p.patient_name || "patient")}</title>
<style>
@page{size:A4 landscape;margin:10mm}
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:20px;font-size:12px}
h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #0d9488;padding-bottom:3px}
.top{display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:10px}
.s{font-size:10px;color:#666}.r{text-align:right}.nw{white-space:nowrap}
table{width:100%;border-collapse:collapse}td,th{padding:4px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
.kv td:nth-child(odd){color:#555;width:14%}
.grid th{background:#f3f4f6;font-size:10px}.grid td{font-size:11px}
.crit{color:#b91c1c;font-weight:bold}.warn{color:#b45309}
tr{page-break-inside:avoid}
</style></head><body>
<div class="top"><div><h1>${esc(d.hospitalName || "Hospital")}</h1><div class="s">Maternity record</div></div>
<div class="r"><b>${esc(p.patient_name || "-")}</b>${p.age ? ", " + esc(p.age) + "y" : ""}<div class="s">${p.phone ? esc(p.phone) + " | " : ""}Ward: ${esc(p.ward || "-")} / Bed ${esc(p.bed_number || "-")}</div><div class="s">Admitted ${esc(dt(p.admitted_at))}${p.discharged_at ? " | Discharged " + esc(dt(p.discharged_at)) : " | Currently admitted"}</div><div class="s">Doctor: ${esc(p.admitting_doctor_name || "-")}${p.diagnosis ? " | Diagnosis: " + esc(p.diagnosis) : ""}</div></div></div>
<h2>Maternity profile</h2>${profileHtml}
<h2>Observations (fetal monitoring and labour)</h2>${obsHtml}
<h2>Vitals</h2>${vitalsHtml}
<h2>Nursing notes</h2>${notesHtml}
<p class="s" style="margin-top:18px">Alerts are automatic prompts to help staff notice problems. They are not a diagnosis; the doctor decides. Printed ${esc(dt(new Date().toISOString()))}.</p>
</body></html>`;
}

export async function printMaternityRecord(inwardId: string) {
  const d = await maternityApi.record(inwardId);
  const html = maternityRecordHtml(d);
  const name = `maternity_record_${String(d?.patient?.patient_name || "patient").replace(/\W+/g, "_")}.html`;
  if (Capacitor.isNativePlatform()) { await downloadFile(new Blob([html], { type: "text/html" }), name); return; }
  const w = window.open("", "_blank");
  if (!w) { await downloadFile(new Blob([html], { type: "text/html" }), name); return; }
  w.document.open(); w.document.write(html); w.document.close();
  w.focus(); setTimeout(() => w.print(), 300);
}
"""

def nlof(s):
    return "\r\n" if "\r\n" in s else "\n"

def patch(path, edits):
    s = rd(path)
    nl = nlof(s)
    for old, new in edits:
        n = s.count(old)
        if n != 1:
            print(f"ABORT: {path}: expected 1 match, found {n} for:\n  {old[:90]}")
            sys.exit(1)
        s = s.replace(old, new.replace("\n", nl))
    return s

api_old = 'obsDelete: (id: string) => call<any>("DELETE", `/maternity-obs/entry/${id}`),'
api_new = api_old + '\n  record: (inwardId: string) => call<any>("GET", `/maternity-record/${inwardId}`),'
api_out = patch("src/lib/maternityApi.ts", [(api_old, api_new)])

modal_edits = [
    ('import { X } from "lucide-react";', 'import { X, Printer } from "lucide-react";'),
    ('import MaternityChart from "./MaternityChart";',
     'import MaternityChart from "./MaternityChart";\nimport { useStore } from "../../context/StoreContext";\nimport { printMaternityRecord } from "../../lib/maternityRecord";'),
    ('const [err, setErr] = useState("");',
     'const [err, setErr] = useState("");\n  const { user } = useStore() as any;\n  const isAdmin = user?.role === "hospital_admin" || user?.role === "admin";\n  const [printing, setPrinting] = useState(false);\n  async function printRecord() {\n    setPrinting(true);\n    try { await printMaternityRecord(inwardId); }\n    catch (e: any) { toast.error(e.message || "Could not open the record"); }\n    setPrinting(false);\n  }'),
    ('<button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>',
     '<div className="flex items-center gap-1">\n            {isAdmin && (\n              <button onClick={printRecord} disabled={printing} title="Print full maternity record" className="px-2.5 py-1.5 text-xs rounded-lg border hover:bg-muted flex items-center gap-1.5 disabled:opacity-50"><Printer className="w-3.5 h-3.5" />{printing ? "Preparing..." : "Print record"}</button>\n            )}\n            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>\n          </div>'),
]
modal_out = patch("src/pages/hospital-admin/MaternityModal.tsx", modal_edits)

wr("src/lib/maternityRecord.ts", LIB)
wr("src/lib/maternityApi.ts", api_out)
wr("src/pages/hospital-admin/MaternityModal.tsx", modal_out)
print("DONE: created src/lib/maternityRecord.ts, patched maternityApi.ts and MaternityModal.tsx")
