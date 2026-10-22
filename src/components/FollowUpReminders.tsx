import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import { useStore } from "../context/StoreContext";
import BookingDialog from "./booking/BookingDialog";

type Item = {
  bookingId: string; doctorId: string; doctorName: string; hospitalId?: string; hospitalName: string;
  patientName: string; visitDate: string; followUpDays: number; followUpDate: string;
  state: "due_today" | "overdue"; daysOverdue: number;
};

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

function fmt(d: string) {
  const dt = new Date(`${d.slice(0, 10)}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function FollowUpReminders() {
  const { doctors, hospitals } = useStore() as any;
  const [items, setItems] = useState<Item[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ doctor: any; hospital: any } | null>(null);

  const load = useCallback(() => {
    fetch(`${BASE}/bookings/follow-ups/mine`, { headers: { Authorization: `Bearer ${api.getToken()}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  if (items.length === 0 && !booking) return null;

  return (
    <section className="space-y-3">
      {items.map((it) => {
        const open = openId === it.bookingId;
        const doctor = (doctors || []).find((d: any) => d.id === it.doctorId);
        const hospital = (hospitals || []).find((h: any) => h.id === (it.hospitalId || doctor?.hospitalId));
        const status = it.state === "due_today" ? "Follow-up due today" : `Follow-up overdue by ${it.daysOverdue} day(s)`;
        return (
          <div key={it.bookingId} className="rounded-2xl border border-emerald-200 bg-emerald-50 overflow-hidden" data-ocid="tokens.followup.card">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : it.bookingId)}
              aria-expanded={open}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-emerald-900 truncate">{it.doctorName}</p>
                <p className="text-xs text-emerald-700">{status}</p>
              </div>
              <ChevronDown className={`w-5 h-5 text-emerald-600 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="px-4 pb-4 border-t border-emerald-200 pt-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-emerald-900">{status}</p>
                  <Button
                    size="sm"
                    disabled={!doctor || !hospital}
                    className="bg-teal-500 hover:bg-teal-600 text-white rounded-full text-xs px-4 shrink-0"
                    onClick={() => setBooking({ doctor, hospital })}
                    data-ocid="tokens.followup.book_again"
                  >
                    Book Again
                  </Button>
                </div>
                <div className="text-xs text-emerald-800 space-y-1">
                  <p className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Last visit: {fmt(it.visitDate)}</p>
                  <p>Asked to return by: {fmt(it.followUpDate)} ({it.followUpDays} day(s) after the visit)</p>
                  <p>{it.hospitalName}{it.patientName ? ` · ${it.patientName}` : ""}</p>
                  {(!doctor || !hospital) && <p className="text-amber-700">This doctor is not available for booking right now.</p>}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {booking && (
        <BookingDialog
          doctor={booking.doctor}
          hospital={booking.hospital}
          open
          onClose={() => { setBooking(null); load(); }}
        />
      )}
    </section>
  );
}