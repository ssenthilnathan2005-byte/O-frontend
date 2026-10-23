import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import { getToken } from "@/api";
import { toast } from "sonner";

const OPTIONS = [
  { days: 1, label: "1 Day" },
  { days: 2, label: "2 Days" },
  { days: 3, label: "3 Days" },
  { days: 0, label: "No Follow-Up" },
];

function returnDate(base: string | undefined, n: number) {
  const b = base && /^\d{4}-\d{2}-\d{2}/.test(base) ? base.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [y, m, d] = b.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toLocaleDateString("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export default function AssignFollowUpDialog({
  open, bookingId, bookingDate, patientName, onDone,
}: {
  open: boolean; bookingId: string; bookingDate?: string; patientName?: string; onDone: () => void;
}) {
  const [days, setDays] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setDays(null); setSaving(false); } }, [open]);

  async function confirm() {
    if (days === null || saving) return;
    if (days === 0) { onDone(); return; }
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/doctor/follow-up/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ days }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error((e as any).error ?? "Could not save follow-up");
        setSaving(false);
        return;
      }
      toast.success(`Follow-up set for ${returnDate(bookingDate, days)}`);
    } catch {
      toast.error("Network error saving follow-up");
      setSaving(false);
      return;
    }
    setSaving(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-teal-600" /> Assign Follow-Up
          </DialogTitle>
        </DialogHeader>
        {patientName && <p className="text-sm text-gray-600 -mt-1">{patientName}</p>}
        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.days}
              type="button"
              onClick={() => setDays(o.days)}
              className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                days === o.days
                  ? o.days === 0 ? "bg-gray-700 text-white border-gray-700" : "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-gray-800 border-gray-200 hover:border-teal-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {days !== null && days > 0 && (
          <p className="text-sm font-semibold text-teal-800">Return by {returnDate(bookingDate, days)}</p>
        )}
        <DialogFooter>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={confirm} disabled={days === null || saving}>
            {saving ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}