import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGrid, LogIn, LogOut, Pill, Ambulance, User } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";

const KEY = "db_login_fab_pos";
const SIZE = 48;           // button is a SIZE x SIZE rounded square
const MARGIN = 8;          // gap kept from every screen edge
const BOTTOM_SAFE = 88;    // keeps it above the bottom navigation bar
const MENU_W = 208;
const MENU_H = 188;        // estimated height, used only to decide where the menu opens
const GAP = 8;             // space between the button and its menu

function readPos(): { x: number; y: number } | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null");
    return p && typeof p.x === "number" && typeof p.y === "number" ? p : null;
  } catch { return null; }
}

// Floating menu button for the patient app. Draggable, always kept inside the screen.
// Tap: opens a dropdown with Profile, Pharmacy, Ambulance and Logout (Login when signed out).
export default function FloatingLoginButton() {
  const { user, logout } = useStore() as any;
  const { route, navigate } = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);

  // phone view only: hidden on tablet / laptop widths (Tailwind md breakpoint = 768px)
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => { setIsPhone(mq.matches); if (!mq.matches) setOpen(false); };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const clamp = useCallback((x: number, y: number) => ({
    x: Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - SIZE - MARGIN)),
    y: Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - SIZE - BOTTOM_SAFE)),
  }), []);

  // initial position: saved spot, otherwise right edge above the chat button
  useEffect(() => {
    const saved = readPos();
    const start = saved || { x: window.innerWidth - SIZE - 16, y: window.innerHeight - 190 };
    setPos(clamp(start.x, start.y));
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  // close the menu when the page changes
  useEffect(() => { setOpen(false); }, [route.path]);

  // close on outside tap or Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || ref.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible =
    isPhone &&
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
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) { d.moved = true; setOpen(false); }
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
    setOpen((o) => !o); // plain tap
  }

  function goLogin() { navigate({ path: "/login", tab: "patient", patientMode: "login" } as any); }

  function pick(action: "profile" | "pharmacy" | "ambulance" | "auth") {
    setOpen(false);
    if (action === "profile") { user ? navigate({ path: "/patient/profile" } as any) : goLogin(); return; }
    if (action === "pharmacy") { navigate({ path: "/pharmacies" } as any); return; }
    if (action === "ambulance") { navigate({ path: "/ambulance" } as any); return; }
    if (!user) { goLogin(); return; }
    if (window.confirm("Log out of your account?")) logout();
  }

  // menu placement: opens upward in the lower half of the screen, downward in the upper half,
  // and lines up with the button's side so it never runs off the screen
  let menuStyle: React.CSSProperties = { left: -999, top: -999 };
  if (pos) {
    const openUp = pos.y + SIZE / 2 > window.innerHeight / 2;
    const top = openUp ? pos.y - GAP - MENU_H : pos.y + SIZE + GAP;
    const alignRight = pos.x + SIZE / 2 > window.innerWidth / 2;
    const left = alignRight ? pos.x + SIZE - MENU_W : pos.x;
    menuStyle = {
      left: Math.min(Math.max(MARGIN, left), window.innerWidth - MENU_W - MARGIN),
      top: Math.min(Math.max(MARGIN, top), window.innerHeight - MENU_H - MARGIN),
      width: MENU_W,
      transformOrigin: `${alignRight ? "right" : "left"} ${openUp ? "bottom" : "top"}`,
    };
  }

  const item = "flex w-full items-center gap-3 px-4 h-11 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 text-left";

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="Open menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { drag.current = null; }}
        style={{ left: pos?.x ?? -999, top: pos?.y ?? -999, width: SIZE, height: SIZE, touchAction: "none" }}
        className="fixed z-40 flex items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg active:scale-95 select-none"
      >
        <LayoutGrid className="w-6 h-6" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={menuStyle}
          className="fixed z-50 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5 py-1"
        >
          <button role="menuitem" className={item} onClick={() => pick("profile")}>
            <User className="w-5 h-5 text-teal-600" /> Profile
          </button>
          <button role="menuitem" className={item} onClick={() => pick("pharmacy")}>
            <Pill className="w-5 h-5 text-teal-600" /> Pharmacy
          </button>
          <button role="menuitem" className={item} onClick={() => pick("ambulance")}>
            <Ambulance className="w-5 h-5 text-teal-600" /> Ambulance
          </button>
          <div className="my-1 h-px bg-slate-100" />
          {user ? (
            <button role="menuitem" className={item + " text-red-600 hover:bg-red-50"} onClick={() => pick("auth")}>
              <LogOut className="w-5 h-5" /> Logout
            </button>
          ) : (
            <button role="menuitem" className={item} onClick={() => pick("auth")}>
              <LogIn className="w-5 h-5 text-teal-600" /> Login
            </button>
          )}
        </div>
      )}
    </>
  );
}
