import os, sys, shutil, datetime
hook = "src/hooks/useModules.ts"
panel = "src/pages/hospital-admin/HospitalAdminPanel.tsx"
s = open(panel, encoding="utf-8").read()
if "useModules" in s or os.path.exists(hook):
    sys.exit("Already applied, nothing to do")
A1 = 'import GstInvoice from "./GstInvoice";\n'
A2 = '  const { user, logout } = useStore();\n'
A3 = '  function renderContent() {\n'
A4 = 'NAV_ITEMS.map('
A5 = 'const PHARMACY_SUB = ['
for a, n in ((A1,1),(A2,1),(A3,1),(A4,2),(A5,1)):
    if s.count(a) != n:
        sys.exit("ABORT: anchor %r found %d times (expected %d). Nothing written." % (a, s.count(a), n))
stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
shutil.copy(panel, panel + ".bak-mod-" + stamp)

open(hook, "w", encoding="utf-8").write(r"""import { useEffect, useState, useCallback } from "react";
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
""")

s = s.replace(A1, A1 + 'import useModules from "../../hooks/useModules";\n', 1)
s = s.replace(A5, 'const NAV_MODULE: Record<string, string | undefined> = {\n  "/hospital-admin/wards": "wards",\n  "/hospital-admin/ipd": "ipd",\n  "/hospital-admin/inventory": "inventory",\n  "/hospital-admin/lab": "lab",\n  "/hospital-admin/nurses": "nursing",\n  "/hospital-admin/pharmacy": "pharmacy",\n};\n\n' + A5, 1)
s = s.replace(A2, A2 + '  const { has } = useModules();\n', 1)
s = s.replace(A4, 'NAV_ITEMS.filter((n) => has(NAV_MODULE[n.path])).map(')
s = s.replace(A3, A3 + '    const need = route.path.startsWith("/hospital-admin/pharmacy") ? "pharmacy" : NAV_MODULE[route.path];\n    if (!has(need)) return <div className="p-6 text-sm text-gray-500">This module is not enabled for your hospital type.</div>;\n', 1)
open(panel, "w", encoding="utf-8").write(s)
print("OK. Backup: " + panel + ".bak-mod-" + stamp)
