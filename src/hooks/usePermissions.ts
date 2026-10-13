import { useCallback, useEffect, useState } from "react";
import { getToken } from "../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

export default function usePermissions() {
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(BASE + "/permissions/me", { headers: { Authorization: "Bearer " + getToken() } });
      if (!res.ok) return;
      const d = await res.json();
      if (Array.isArray(d.modules)) setModules(d.modules);
    } catch { /* keep last known permissions */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  const can = useCallback((key: string) => modules.includes(key), [modules]);
  return { modules, can, loading, reload: load };
}
