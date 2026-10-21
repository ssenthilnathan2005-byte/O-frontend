import { useEffect, useRef } from "react";

// Runs `fn` every `ms` while the page is visible, and once more straight away when the
// tab / app comes back to the front. Never overlaps two runs, errors are swallowed.
export function useLiveRefresh(fn: () => void | Promise<unknown>, ms: number, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    const run = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try { await ref.current(); } catch { /* keep the last data */ }
      busy = false;
    };
    const t = setInterval(run, ms);
    const onShow = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [ms, enabled]);
}
