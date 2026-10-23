import { CalendarClock } from "lucide-react";
import { useSyncExternalStore } from "react";
import * as api from "../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

let count = 0;
let inflight = false;
let timer: ReturnType<typeof setInterval> | null = null;
const subs = new Set<() => void>();

function load() {
  if (inflight) return;
  const token = api.getToken();
  if (!token) {
    if (count !== 0) { count = 0; subs.forEach((f) => f()); }
    return;
  }
  inflight = true;
  fetch(`${BASE}/bookings/follow-ups/mine`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => {
      const n = Array.isArray(d) ? d.length : 0;
      if (n !== count) { count = n; subs.forEach((f) => f()); }
    })
    .catch(() => {})
    .finally(() => { inflight = false; });
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (subs.size === 1) {
    load();
    timer = setInterval(load, 60000);
    window.addEventListener("followups:changed", load);
    window.addEventListener("focus", load);
  }
  return () => {
    subs.delete(cb);
    if (subs.size === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      window.removeEventListener("followups:changed", load);
      window.removeEventListener("focus", load);
    }
  };
}

export default function FollowUpNavIcon({ className = "absolute -top-1.5 -right-2" }: { className?: string }) {
  const n = useSyncExternalStore(subscribe, () => count);
  if (n <= 0) return null;
  return (
    <span
      title="Follow-up pending"
      aria-label="Follow-up pending"
      className={`${className} w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white pointer-events-none`}
    >
      <CalendarClock className="w-2.5 h-2.5" />
    </span>
  );
}