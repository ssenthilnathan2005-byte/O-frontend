import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Printer } from "lucide-react";
import { maternityApi } from "../../lib/maternityApi";
import MaternityChart from "./MaternityChart";
import { useStore } from "../../context/StoreContext";
import { printMaternityRecord } from "../../lib/maternityRecord";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RISKS: [string, string][] = [
  ["previous_cs", "Previous caesarean"], ["hypertension", "Hypertension / pre-eclampsia"],
  ["gdm", "Gestational diabetes"], ["anaemia", "Anaemia"], ["twins", "Twins / multiple"],
  ["preterm_history", "Preterm birth history"], ["rh_negative", "Rh negative"],
  ["bleeding", "Bleeding in pregnancy"], ["short_stature", "Short stature"],
  ["prev_stillbirth", "Previous stillbirth"], ["other", "Other"],
];
const inp = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white w-full";
const lbl = "text-xs font-medium text-gray-600 mb-1 block";

const EMPTY = {
  lmp: "", edd: "", gravida: "", para: "", abortions: "", living: "", previousCs: "0",
  bloodGroup: "", riskLevel: "low", riskFactors: [] as string[], bookingStatus: "booked",
  allergies: "", heightCm: "", prePregWeight: "", attendantName: "", attendantPhone: "",
  deliveryPlan: "", notes: "",
};

function gaText(lmp: string) {
  if (!lmp) return "";
  const d = Math.floor((Date.now() - new Date(lmp).getTime()) / 86400000);
  if (d < 0) return "LMP is in the future";
  return `${Math.floor(d / 7)} weeks ${d % 7} days`;
}
function eddFromLmp(lmp: string) {
  if (!lmp) return "";
  const d = new Date(lmp + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 280);
  return d.toISOString().slice(0, 10);
}

export default function MaternityModal({ inwardId, onClose, defaultTab = "profile" }: { inwardId: string; onClose: () => void; defaultTab?: "profile" | "chart" }) {
  const [tab, setTab] = useState<"profile" | "chart">(defaultTab);
  const [patient, setPatient] = useState<any>(null);
  const [f, setF] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { user } = useStore() as any;
  const isAdmin = user?.role === "hospital_admin" || user?.role === "admin";
  const [printing, setPrinting] = useState(false);
  async function printRecord() {
    setPrinting(true);
    try { await printMaternityRecord(inwardId); }
    catch (e: any) { toast.error(e.message || "Could not open the record"); }
    setPrinting(false);
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await maternityApi.get(inwardId);
        setPatient(r.patient);
        if (r.profile) {
          const p = r.profile;
          setF({
            lmp: p.lmp || "", edd: p.edd || "",
            gravida: p.gravida ?? "", para: p.para ?? "", abortions: p.abortions ?? "", living: p.living ?? "",
            previousCs: String(p.previous_cs ?? 0), bloodGroup: p.blood_group || "",
            riskLevel: p.risk_level || "low", riskFactors: Array.isArray(p.risk_factors) ? p.risk_factors : [],
            bookingStatus: p.booking_status || "booked", allergies: p.allergies || "",
            heightCm: p.height_cm ?? "", prePregWeight: p.pre_preg_weight ?? "",
            attendantName: p.attendant_name || "", attendantPhone: p.attendant_phone || "",
            deliveryPlan: p.delivery_plan || "", notes: p.notes || "",
          } as any);
        }
      } catch (e: any) { setErr(e.message || "Could not load"); }
      setLoading(false);
    })();
  }, [inwardId]);

  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  const toggleRisk = (k: string) =>
    setF((s) => ({ ...s, riskFactors: s.riskFactors.includes(k) ? s.riskFactors.filter((x) => x !== k) : [...s.riskFactors, k] }));

  async function save() {
    setBusy(true); setErr("");
    try {
      await maternityApi.save(inwardId, { ...f, previousCs: Number(f.previousCs) || 0 });
      toast.success("Maternity profile saved");
      onClose();
    } catch (e: any) { setErr(e.message || "Could not save"); }
    setBusy(false);
  }

  const riskColor = f.riskLevel === "high" ? "text-red-600" : f.riskLevel === "moderate" ? "text-amber-600" : "text-green-600";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-background">
          <div>
            <h3 className="font-semibold">Maternity profile</h3>
            {patient && <p className="text-xs text-muted-foreground">{patient.patient_name}{patient.age ? ` - ${patient.age}y` : ""}{patient.ward ? ` - ${patient.ward}` : ""}{patient.bed_number ? ` / Bed ${patient.bed_number}` : ""}</p>}
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <button onClick={printRecord} disabled={printing} title="Print full maternity record" className="px-2.5 py-1.5 text-xs rounded-lg border hover:bg-muted flex items-center gap-1.5 disabled:opacity-50"><Printer className="w-3.5 h-3.5" />{printing ? "Preparing..." : "Print record"}</button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex gap-1 px-5 pt-3 border-b">
          {([["profile", "Profile"], ["chart", "Observations"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 text-sm rounded-t-lg border-b-2 ${tab === k ? "border-teal-600 text-teal-700 font-medium" : "border-transparent text-gray-500"}`}>{l}</button>
          ))}
        </div>
        {tab === "chart" && <MaternityChart inwardId={inwardId} />}

        {tab === "profile" && (loading ? <p className="p-6 text-sm text-muted-foreground">Loading...</p> : (
          <div className="p-5 space-y-5">
            <section>
              <h4 className="text-sm font-semibold mb-2">Pregnancy dates</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className={lbl}>LMP (last menstrual period)</label>
                  <input type="date" className={inp} value={f.lmp} max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => { set("lmp", e.target.value); set("edd", eddFromLmp(e.target.value)); }} /></div>
                <div><label className={lbl}>EDD (expected delivery)</label>
                  <input type="date" className={inp} value={f.edd} onChange={(e) => set("edd", e.target.value)} /></div>
                <div><label className={lbl}>Gestational age today</label>
                  <div className="px-2 py-1.5 text-sm rounded-lg bg-muted/40 min-h-[34px]">{gaText(f.lmp) || "--"}</div></div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold mb-2">Obstetric history</h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[["gravida", "Gravida (G)"], ["para", "Para (P)"], ["abortions", "Abortions (A)"], ["living", "Living (L)"], ["previousCs", "Previous C-sections"]].map(([k, l]) => (
                  <div key={k}><label className={lbl}>{l}</label>
                    <input type="number" min={0} className={inp} value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} /></div>
                ))}
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold mb-2">Blood group and body measures</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className={lbl}>Blood group</label>
                  <select className={inp} value={f.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>
                    <option value="">Not known</option>{BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
                  </select></div>
                <div><label className={lbl}>Height (cm)</label>
                  <input type="number" className={inp} value={f.heightCm} onChange={(e) => set("heightCm", e.target.value)} /></div>
                <div><label className={lbl}>Pre-pregnancy weight (kg)</label>
                  <input type="number" className={inp} value={f.prePregWeight} onChange={(e) => set("prePregWeight", e.target.value)} /></div>
                <div><label className={lbl}>Antenatal booking</label>
                  <select className={inp} value={f.bookingStatus} onChange={(e) => set("bookingStatus", e.target.value)}>
                    <option value="booked">Booked here</option><option value="unbooked">Unbooked</option><option value="referred">Referred in</option>
                  </select></div>
              </div>
              <div className="mt-3"><label className={lbl}>Known allergies</label>
                <input className={inp} value={f.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="e.g. penicillin, or None" /></div>
            </section>

            <section>
              <h4 className="text-sm font-semibold mb-2">Risk assessment</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                {RISKS.map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.riskFactors.includes(k)} onChange={() => toggleRisk(k)} />{l}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={lbl}>Overall risk (doctor decides)</label>
                  <select className={`${inp} font-medium ${riskColor}`} value={f.riskLevel} onChange={(e) => set("riskLevel", e.target.value)}>
                    <option value="low">Low risk</option><option value="moderate">Moderate risk</option><option value="high">High risk</option>
                  </select></div>
                <div><label className={lbl}>Planned mode of delivery</label>
                  <input className={inp} value={f.deliveryPlan} onChange={(e) => set("deliveryPlan", e.target.value)} placeholder="e.g. Normal, planned C-section" /></div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold mb-2">Attendant and notes</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={lbl}>Attendant name</label>
                  <input className={inp} value={f.attendantName} onChange={(e) => set("attendantName", e.target.value)} /></div>
                <div><label className={lbl}>Attendant phone</label>
                  <input className={inp} value={f.attendantPhone} onChange={(e) => set("attendantPhone", e.target.value)} /></div>
              </div>
              <div className="mt-3"><label className={lbl}>Notes</label>
                <textarea rows={2} className={inp} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
            </section>

            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">Cancel</button>
              <button onClick={save} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
                {busy ? "Saving..." : "Save profile"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
