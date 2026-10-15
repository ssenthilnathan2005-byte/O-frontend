import { useCallback, useEffect, useRef, useState } from "react";
import { LogIn } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";

const KEY = "db_login_fab_pos";
const MARGIN = 8;          // gap kept from every screen edge
const BOTTOM_SAFE = 88;    // keeps it above the bottom navigation bar

function readPos(): { x: number; y: number } | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null");
    return p && typeof p.x === "number" && typeof p.y === "number" ? p : null;
  } catch { return null; }
}

// Floating Login button for the patient app. Draggable, always kept inside the screen.
// Guest: opens the login page (staff / hospital login is at the bottom of that page).
// Logged-in patient: asks first, then logs out and opens the login page.
export default function FloatingLoginButton() {
  const { user, logout } = useStore() as any;
  const { route, navigate } = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const clamp = useCallback((x: number, y: number) => {
    const w = ref.current?.offsetWidth ?? 96;
    const h = ref.current?.offsetHeight ?? 40;
    return {
      x: Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
      y: Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - h - BOTTOM_SAFE)),
    };
  }, []);

  // initial position: saved spot, otherwise right edge above the chat button
  useEffect(() => {
    const saved = readPos();
    const w = ref.current?.offsetWidth ?? 96;
    const start = saved || { x: window.innerWidth - w - 16, y: window.innerHeight - 190 };
    setPos(clamp(start.x, start.y));
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const visible =
    (!user || user.role === "patient") &&
    route.path !== "/login" && !String(route.path).endsWith("/login");
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
        const w = ref.current?.offsetWidth ?? 96;
        const side = p.x + w / 2 < window.innerWidth / 2 ? MARGIN : window.innerWidth - w - MARGIN;
        const q = clamp(side, p.y);
        try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* ignore */ }
        return q;
      });
      return;
    }
    // plain tap
    if (!user) { navigate({ path: "/login", tab: "patient", patientMode: "login" } as any); return; }
    if (window.confirm("Log out and go to the login page? You can log in as a patient or choose Hospital login at the bottom.")) logout();
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-label="Login"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => { drag.current = null; }}
      style={{ left: pos?.x ?? -999, top: pos?.y ?? -999, touchAction: "none" }}
      className="fixed z-40 flex items-center gap-1.5 rounded-full bg-teal-600 text-white pl-3 pr-4 h-10 shadow-lg active:scale-95 select-none"
    >
      <LogIn className="w-4 h-4" />
      <span className="text-sm font-semibold">Login</span>
    </button>
  );
}
