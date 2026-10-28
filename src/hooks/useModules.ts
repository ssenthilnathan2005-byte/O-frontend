import { useEffect, useState, useCallback } from "react";
import { getToken } from "@/api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
let cached: string[] | null = null;

// Returns enabled module keys, or null if unknown (callers treat null as "all on").
export async function fetchModules(): Promise<string[] | null> {
  try {
    const t = getToken();
    if (!t) return null;
    const res = await fetch(`${BASE}/my-modules`, { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) return null;
    const d = await res.json();
    return Array.isArray(d.modules) ? d.modules : null;
  } catch { return null; }
}

export default function useModules() {
  const [modules, setModules] = useState<string[] | null>(cached);
  const refresh = useCallback(async () => {
    const m = await fetchModules();
    cached = m;
    setModules(m);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("modules-changed", refresh);
    return () => window.removeEventListener("modules-changed", refresh);
  }, [refresh]);
  const has = useCallback((k?: string) => !k || modules === null || modules.includes(k), [modules]);
  return { modules, has, refresh };
}
