import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";
import { getToken } from "@/api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

let audioCtx: AudioContext | null = null;
function getCtx() {
  audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}

function beep() {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.2;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch {}
}

export default function PrescriptionAlert({ enabled }: { enabled: boolean }) {
  const { user } = useStore();
  const { route, navigate } = useRouter();
  const seen = useRef<Set<string> | null>(null);
  const routeRef = useRef(route);
  routeRef.current = route;

  // unlock audio on first tap (browsers block sound until then)
  useEffect(() => {
    const unlock = () => { try { getCtx().resume(); } catch {} };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!enabled || !user) return;
    seen.current = null;
    let stopped = false;

    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`${BASE}/prescriptions/my`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (stopped || !Array.isArray(data)) return;
        const ids: string[] = data.map((p: { id: string }) => String(p.id));

        if (seen.current === null) { seen.current = new Set(ids); return; } // baseline
        const fresh = ids.filter((id) => !seen.current!.has(id));
        ids.forEach((id) => seen.current!.add(id));

        if (fresh.length > 0) {
          beep();
          toast.success(fresh.length === 1 ? "New prescription received" : `${fresh.length} new prescriptions received`);
          if ((routeRef.current as { path?: string })?.path !== "/patient/prescriptions") {
            navigate({ path: "/patient/prescriptions" });
          }
        }
      } catch {}
    };

    check();
    const WS_BASE = BASE.replace(/^http/, "ws").replace(/\/api$/, "");
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${WS_BASE}/ws?session=patient_${user.id}`);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "prescription_update") check();
        } catch {}
      };
    } catch {}
    const timer = setInterval(check, 60000);
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      try { ws?.close(); } catch {}
    };
  }, [enabled, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
