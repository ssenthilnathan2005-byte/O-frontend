import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import * as api from "../api";
import type { LabBooking } from "../api";

type S = LabBooking["status"];

const FLOW: S[] = ["booked", "technician_assigned", "sample_collected", "processing", "report_ready"];

const STATUS_LABEL: Record<S, string> = {
  booked: "Booked",
  technician_assigned: "Technician Assigned",
  sample_collected: "Sample Collected",
  processing: "Processing",
  report_ready: "Report Ready",
  cancelled: "Cancelled",
};

const ACTION_LABEL: Partial<Record<S, string>> = {
  technician_assigned: "Assign technician",
  sample_collected: "Sample collected",
  processing: "Start processing",
  report_ready: "Report ready",
};

const BADGE: Record<S, string> = {
  booked: "bg-gray-100 text-gray-700",
  technician_assigned: "bg-blue-100 text-blue-700",
  sample_collected: "bg-indigo-100 text-indigo-700",
  processing: "bg-amber-100 text-amber-700",
  report_ready: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

// Mirrors the server rules: one step forward, walk-in skips technician,
// cancel only before the sample is collected, report_ready/cancelled are final.
function nextStatuses(b: Pick<LabBooking, "status" | "collection_type">): S[] {
  const i = FLOW.indexOf(b.status);
  if (i === -1 || b.status === "report_ready") return [];
  let next = FLOW[i + 1];
  if (next === "technician_assigned" && b.collection_type !== "home") next = FLOW[i + 2];
  const out: S[] = [next];
  if (i <= 1) out.push("cancelled");
  return out;
}

export default function LabStatusControl({
  booking, onChanged,
}: { booking: LabBooking; onChanged: (updated: LabBooking) => void }) {
  const [busy, setBusy] = useState(false);
  const [reportUrl, setReportUrl] = useState("");

  const options = nextStatuses(booking);
  const next = options.find((o) => o !== "cancelled");
  const canCancel = options.includes("cancelled");

  async function move(status: S) {
    if (status === "cancelled" && !window.confirm("Cancel this booking? This cannot be undone.")) return;
    const link = reportUrl.trim();
    if (status === "report_ready" && link && !/^https?:\/\//i.test(link)) {
      toast.error("Report link must start with http:// or https://");
      return;
    }
    setBusy(true);
    try {
      const updated = await api.labs.updateStatus(booking.id, {
        status,
        reportUrl: status === "report_ready" && link ? link : undefined,
      });
      toast.success(`Status: ${STATUS_LABEL[status]}`);
      onChanged(updated);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 min-w-[150px]">
      <span className={`inline-block text-xs font-semibold rounded-full px-2.5 py-1 ${BADGE[booking.status]}`}>
        {STATUS_LABEL[booking.status]}
      </span>

      {!next && !canCancel ? (
        <>
          <p className="flex items-center gap-1 text-[11px] text-gray-400">
            <Lock className="w-3 h-3" /> {booking.status === "cancelled" ? "Cancelled" : "Completed"} · locked
          </p>
          {booking.report_url && (
            <a href={booking.report_url} target="_blank" rel="noreferrer" className="block text-[11px] text-teal-600 hover:underline">
              View report
            </a>
          )}
        </>
      ) : (
        <>
          {next === "report_ready" && (
            <input
              type="url"
              value={reportUrl}
              onChange={(e) => setReportUrl(e.target.value)}
              placeholder="Report link (optional)"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          )}
          {next && (
            <button
              type="button"
              disabled={busy}
              onClick={() => move(next)}
              className="w-full flex items-center justify-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-60"
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              {ACTION_LABEL[next]} →
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => move("cancelled")}
              className="block text-[11px] text-red-500 hover:underline disabled:opacity-60"
            >
              Cancel booking
            </button>
          )}
        </>
      )}
    </div>
  );
}
