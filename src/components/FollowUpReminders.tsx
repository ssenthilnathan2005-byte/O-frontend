import { CalendarClock, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import { useStore } from "../context/StoreContext";
import BookingDialog from "./booking/BookingDialog";

type Item = {
  bookingId: string; doctorId: string; doctorName: string; hospitalId?: string; hospitalName: string;
  followUpDate: string; state: "due_today" | "upcoming"; daysLeft: number;
};

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

function daysText(n: number) {
  return n <= 0 ? "Today" : n === 1 ? "1 day left" : `${n} days left`;
}

export default function FollowUpReminders() {
  const { doctors, hospitals } = useStore() as any;
  const [items, setItems] = useState<Item[]>([]);
  const [booking, setBooking] = useState<{ doctor: any; hospital: any; followUpDate: string } | null>(null);

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
        const doctor = (doctors || []).find((d: any) => d.id === it.doctorId);
        const hospital = (hospitals || []).find((h: any) => h.id === (it.hospitalId || doctor?.hospitalId));
        const ready = !!doctor && !!hospital;
        return (
          <button
            key={it.bookingId}
            type="button"
            disabled={!ready}
            onClick={() => setBooking({ doctor, hospital, followUpDate: it.followUpDate })}
            className="w-full flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:border-emerald-300 disabled:opacity-60"
            data-ocid="tokens.followup.card"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-emerald-900 truncate">{it.doctorName}</p>
              <p className="text-xs text-emerald-700 truncate">Follow-up · {it.hospitalName}</p>
            </div>
            <span className="text-sm font-bold text-emerald-800 shrink-0">{daysText(it.daysLeft)}</span>
            <ChevronRight className="w-4 h-4 text-emerald-600 shrink-0" />
          </button>
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