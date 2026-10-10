export interface Vitals {
  temperature?: number; tempUnit?: "C" | "F"; bpSystolic?: number; bpDiastolic?: number;
  pulse?: number; spo2?: number; weight?: number; notes?: string;
}
export function vitalsText(v: Vitals): string {
  const p: string[] = [];
  if (v.temperature != null) p.push("Temp " + v.temperature + "\u00b0" + (v.tempUnit || "F"));
  if (v.bpSystolic != null && v.bpDiastolic != null) p.push("BP " + v.bpSystolic + "/" + v.bpDiastolic);
  if (v.pulse != null) p.push("Pulse " + v.pulse);
  if (v.spo2 != null) p.push("SpO2 " + v.spo2 + "%");
  if (v.weight != null) p.push("Wt " + v.weight + " kg");
  if (v.notes) p.push(v.notes);
  return p.join(" | ");
}
