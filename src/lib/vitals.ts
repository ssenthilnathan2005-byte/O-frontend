export interface Vitals {
  temperature?: number; tempUnit?: "C" | "F"; bpSystolic?: number; bpDiastolic?: number;
  pulse?: number; spo2?: number; weight?: number; notes?: string; [key: string]: any;
}
const VITAL_LABELS: Record<string, string> = {
  visualAcuityR: "VA R", visualAcuityL: "VA L", iop: "IOP", usesGlasses: "Glasses", dmBpHistory: "DM/BP history",
  affectedSide: "Side", affectedPart: "Area", lmp: "LMP", edd: "EDD", pregnancyNo: "Pregnancy no.",
  injurySite: "Injury", injuryDate: "Injury date", skinDuration: "Duration", ecgDone: "ECG done",
  rbs: "RBS", hba1c: "HbA1c", height: "Ht", headCirc: "Head circ", immunization: "Immunization",
  painScore: "Pain", allergies: "Allergies", bloodThinner: "Blood thinner",
};
export function vitalsText(v: Vitals): string {
  const p: string[] = [];
  if (v.temperature != null) p.push("Temp " + v.temperature + "\u00b0" + (v.tempUnit || "F"));
  if (v.bpSystolic != null && v.bpDiastolic != null) p.push("BP " + v.bpSystolic + "/" + v.bpDiastolic);
  if (v.pulse != null) p.push("Pulse " + v.pulse);
  if (v.spo2 != null) p.push("SpO2 " + v.spo2 + "%");
  if (v.weight != null) p.push("Wt " + v.weight + " kg");
  const SKIP = ["temperature", "tempUnit", "bpSystolic", "bpDiastolic", "pulse", "spo2", "weight", "notes"];
  for (const k of Object.keys(v)) {
    if (SKIP.includes(k) || v[k] == null || v[k] === "") continue;
    p.push((VITAL_LABELS[k] || k) + " " + (v[k] === true ? "Yes" : v[k] === false ? "No" : String(v[k])));
  }
  if (v.notes) p.push(v.notes);
  return p.join(" | ");
}
