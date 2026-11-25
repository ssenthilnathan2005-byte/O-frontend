import { useEffect, useState } from "react";
import { getToken } from "@/api";
import { vitalsText } from "@/lib/vitals";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

/** Doctor consultation: who recorded the vitals and when, plus corrections (audit trail). `stamp` refreshes it when vitals change. */
export default function VitalsRecordedBy({ bookingId, stamp }: { bookingId: string; stamp?: string }) {
  const [d, setD] = useState<any>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let off = false;
    fetch(BASE + "/doctor-vitals/booking/" + bookingId, { headers: { Authorization: "Bearer " + getToken() } })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (!off) setD(j); }).catch(() => {});
    return () => { off = true; };
  }, [bookingId, stamp]);
  const cur = d?.current;
  if (!cur) return null;
  const corrections = (d.history || []).filter((h: any) => h.action === "correct").length;
  return (
    <div className="mt-1.5 text-[11px] text-gray-500">
      Recorded {fmt(cur.recorded_at)}{cur.recorded_by_name ? " by " + cur.recorded_by_name + (cur.recorded_by_role === "nurse" ? " (Nurse)" : cur.recorded_by_role === "front_office" ? " (Front desk)" : "") : ""}
      {corrections > 0 && <button type="button" className="ml-2 underline" onClick={() => setOpen(!open)}>{corrections} correction{corrections > 1 ? "s" : ""}</button>}
      {open && (
        <div className="mt-1 space-y-0.5">
          {d.history.map((h: any) => (
            <p key={h.version} className="bg-white rounded px-1.5 py-0.5 border border-gray-100">v{h.version} &middot; {fmt(h.recorded_at)} &middot; {h.recorded_by_name || "-"}{h.action === "correct" ? " (corrected: " + (h.reason || "") + ")" : ""} &mdash; {vitalsText(h.vitals)}</p>
          ))}
        </div>
      )}
    </div>
  );
}
