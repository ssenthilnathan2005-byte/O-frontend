import { Thermometer, HeartPulse, Droplets, Scale, Activity } from "lucide-react";
import type { Vitals } from "@/lib/vitals";

type Level = "ok" | "warn" | "high";
type Flag = { level: Level; text: string };

const box: Record<Level, string> = {
  ok: "bg-white border-emerald-100 text-gray-900",
  warn: "bg-amber-50 border-amber-300 text-amber-900",
  high: "bg-red-50 border-red-300 text-red-800",
};
const chip: Record<Level, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-700",
};

function tempFlag(v: Vitals): Flag {
  const f = v.tempUnit === "C" ? (v.temperature as number) * 9 / 5 + 32 : (v.temperature as number);
  if (f >= 103) return { level: "high", text: "High fever" };
  if (f >= 100.4) return { level: "warn", text: "Fever" };
  if (f < 95) return { level: "high", text: "Low" };
  return { level: "ok", text: "Normal" };
}
function pulseFlag(p: number): Flag {
  if (p < 50 || p > 120) return { level: "high", text: p < 50 ? "Very low" : "Very high" };
  if (p < 60) return { level: "warn", text: "Low" };
  if (p > 100) return { level: "warn", text: "High" };
  return { level: "ok", text: "Normal" };
}
function spo2Flag(o: number): Flag {
  if (o < 90) return { level: "high", text: "Low" };
  if (o < 95) return { level: "warn", text: "Low" };
  return { level: "ok", text: "Normal" };
}
function bpFlag(s: number, d: number): Flag {
  if (s >= 180 || d >= 120) return { level: "high", text: "Very high" };
  if (s >= 140 || d >= 90) return { level: "warn", text: "High" };
  if (s < 90 || d < 60) return { level: "warn", text: "Low" };
  return { level: "ok", text: "Normal" };
}

function Tile({ icon: Icon, label, value, unit, flag }: { icon: any; label: string; value: string; unit: string; flag?: Flag }) {
  const level = flag ? flag.level : "ok";
  return (
    <div className={"rounded-lg border px-3 py-2 " + box[level]}>
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-70">
          <Icon className="w-3 h-3" />{label}
        </span>
        {flag && <span className={"text-[10px] font-semibold rounded-full px-1.5 py-0.5 " + chip[level]}>{flag.text}</span>}
      </div>
      <p className="mt-0.5 leading-tight">
        <span className="text-xl font-bold">{value}</span>
        <span className="text-xs ml-1 opacity-70">{unit}</span>
      </p>
    </div>
  );
}

export default function VitalsPanel({ vitals }: { vitals: Vitals }) {
  const v = vitals;
  const hasBp = v.bpSystolic != null && v.bpDiastolic != null;
  const any = v.temperature != null || hasBp || v.pulse != null || v.spo2 != null || v.weight != null;
  if (!any && !v.notes) return <p className="text-sm text-gray-400 italic">No vitals recorded</p>;
  return (
    <div className="space-y-2">
      {any && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {v.temperature != null && <Tile icon={Thermometer} label="Temperature" value={String(v.temperature)} unit={"\u00b0" + (v.tempUnit || "F")} flag={tempFlag(v)} />}
          {hasBp && <Tile icon={Activity} label="Blood pressure" value={v.bpSystolic + "/" + v.bpDiastolic} unit="mmHg" flag={bpFlag(v.bpSystolic as number, v.bpDiastolic as number)} />}
          {v.pulse != null && <Tile icon={HeartPulse} label="Pulse" value={String(v.pulse)} unit="bpm" flag={pulseFlag(v.pulse)} />}
          {v.spo2 != null && <Tile icon={Droplets} label="SpO2" value={String(v.spo2)} unit="%" flag={spo2Flag(v.spo2)} />}
          {v.weight != null && <Tile icon={Scale} label="Weight" value={String(v.weight)} unit="kg" />}
        </div>
      )}
      {v.notes && (
        <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-2">Note</span>{v.notes}
        </p>
      )}
    </div>
  );
}
