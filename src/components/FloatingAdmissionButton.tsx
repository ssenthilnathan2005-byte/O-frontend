import { useCallback, useEffect, useRef, useState } from "react";
import { BedDouble, Receipt } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";
import { bedBookings } from "../api";

const KEY = "db_bed_fab_pos";
const SIZE = 52;           // button is a SIZE x SIZE rounded square
const MARGIN = 8;          // gap kept from every screen edge
const BOTTOM_SAFE = 88;    // keeps it above the bottom navigation bar

type BedState = "none" | "admitted" | "requested";

function readPos(): { x: number; y: number } | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null");
    return p && typeof p.x === "number" && typeof p.y === "number" ? p : null;
  } catch { return null; }
}

// Floating "Bed bookings & receipts" button for the patient app (phones only). Draggable.
//  - grey            : no bed booking right now (tap still opens the page: shows previous stays + receipts)
//  - teal + green dot: currently admitted to a bed
//  - teal + amber dot: bed requested / reserved, waiting for admission
export default function FloatingAdmissionButton() {
  const { user } = useStore() as any;
  const { route, navigate } = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [state, setState] = useState<BedState>("none");

  const isPatient = !!user && user.role === "patient";

  // phone view only (Tailwind md breakpoint = 768px)
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setIsPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // bed status: refresh on login, on every page change, and every 60s
  useEffect(() => {
    if (!isPatient) { setState("none"); return; }
    let stop = false;
    const check = async () => {
      try {
        const [s, r] = await Promise.all([bedBookings.myStays(), bedBookings.mine()]);
        if (stop) return;
        if (s.some((x: any) => x.status === "admitted")) setState("admitted");
        else if (r.some((x: any) => x.status === "requested" || x.status === "confirmed")) setState("requested");
        else setState("none");
      } catch { /* keep the last known state if the check fails */ }
    };
    check();
    const t = setInterval(check, 15000);
    return () => { stop = true; clearInterval(t); };
  }, [isPatient, user, route.path]);

  const clamp = useCallback((x: number, y: number) => ({
    x: Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - SIZE - MARGIN)),
    y: Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - SIZE - BOTTOM_SAFE)),
  }), []);

  // initial position: saved spot, otherwise right edge above the chat button
  useEffect(() => {
    const saved = readPos();
    const start = saved || { x: window.innerWidth - SIZE - 14, y: window.innerHeight - 192 };
    setPos(clamp(start.x, start.y));
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const path = String(route.path);
  const visible =
    isPhone &&
    (!user || user.role === "patient") &&
    path !== "/login" && !path.endsWith("/login") &&
    path !== "/patient/admission";
  if (!visible) return null;

  function onDown(e: React.PointerEvent) {
    if (!pos) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
    if (d.moved) setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
  }
  function onUp() {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (d.moved) {
      // settle against the nearest side edge so it never sits half-hidden
      setPos((p) => {
        if (!p) return p;
        const side = p.x + SIZE / 2 < window.innerWidth / 2 ? MARGIN : window.innerWidth - SIZE - MARGIN;
        const q = clamp(side, p.y);
        try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* ignore */ }
        return q;
      });
      return;
    }
    // plain tap: guests go to login, patients open Bed Bookings & Receipts
    if (!user) navigate({ path: "/login", tab: "patient", patientMode: "login" } as any);
    else navigate({ path: "/patient/admission" } as any);
  }

  const active = state !== "none";
  const label =
    state === "admitted" ? "Bed bookings and receipts. You are currently admitted."
    : state === "requested" ? "Bed bookings and receipts. Bed request pending."
    : "Bed bookings and receipts. No bed bookings right now.";

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => { drag.current = null; }}
      style={{ left: pos?.x ?? -999, top: pos?.y ?? -999, width: SIZE, height: SIZE, touchAction: "none" }}
      className={
        "fixed z-40 flex items-center justify-center rounded-2xl shadow-lg active:scale-95 select-none transition-colors " +
        (active ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-400")
      }
    >
      <BedDouble className="w-6 h-6" strokeWidth={2} />

      {/* receipts marker */}
      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center">
        <Receipt className={"w-3 h-3 " + (active ? "text-teal-600" : "text-gray-400")} strokeWidth={2.5} />
      </span>

      {/* status circle on top: green = admitted, amber = bed requested */}
      {active && (
        <span className="absolute -top-1 -right-1 w-4 h-4">
          <span className={"absolute inset-0 rounded-full animate-ping opacity-70 " + (state === "admitted" ? "bg-green-400" : "bg-amber-400")} />
          <span className={"relative block w-4 h-4 rounded-full border-2 border-white " + (state === "admitted" ? "bg-green-500" : "bg-amber-500")} />
        </span>
      )}
    </button>
  );
}
