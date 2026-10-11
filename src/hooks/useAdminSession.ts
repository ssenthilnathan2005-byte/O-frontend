import { useEffect, useRef } from "react";

const IDLE_MS = 30 * 60 * 1000;
const FLAG = "ha_intro_shown";

function playIntro() {
  try {
    if (sessionStorage.getItem(FLAG)) return;
    sessionStorage.setItem(FLAG, "1");
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch { return; }
  const style = document.createElement("style");
  style.textContent =
    "@keyframes haHello{0%{opacity:0;transform:scale(.8)}100%{opacity:1;transform:scale(1)}}" +
    "@keyframes haBang{0%{opacity:0;transform:translateY(-40px)}60%{opacity:1;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}" +
    "@keyframes haOut{0%{opacity:1}100%{opacity:0}}";
  const el = document.createElement("div");
  el.setAttribute("style", "position:fixed;inset:0;z-index:99999;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;animation:haOut .8s cubic-bezier(.4,0,.2,1) 1.7s forwards;");
  el.innerHTML =
    '<div style="display:flex;align-items:baseline;font-family:system-ui,sans-serif;font-weight:700;font-size:clamp(56px,14vw,140px);color:#0d9488;">' +
    '<span style="animation:haHello .8s cubic-bezier(.22,1,.36,1) both;">Hello</span>' +
    '<span style="opacity:0;animation:haBang .6s cubic-bezier(.22,1,.36,1) .75s forwards;">!</span></div>';
  const done = () => { el.remove(); style.remove(); };
  el.addEventListener("click", done);
  document.head.appendChild(style);
  document.body.appendChild(el);
  setTimeout(done, 2550);
}

export default function useAdminSession(logout: () => void) {
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    playIntro();
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach(e => window.addEventListener(e, bump, { passive: true }));
    const check = () => { if (Date.now() - last >= IDLE_MS) logoutRef.current(); };
    const id = window.setInterval(check, 30000);
    document.addEventListener("visibilitychange", check);
    return () => {
      events.forEach(e => window.removeEventListener(e, bump));
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
      try { sessionStorage.removeItem(FLAG); } catch {}
    };
  }, []);
}