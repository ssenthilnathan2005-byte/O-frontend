import { useCallback, useEffect, useState } from "react";
import { getToken } from "../api";

const BASE: string = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Row = { id: string; name: string; enabled: boolean; enabledAt?: string | null };

async function call(path: string, method: "GET" | "POST") {
  const res = await fetch(`${BASE}/abdm${path}`, {
    method,
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data;
}

export default function AbdmAdminPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setError(""); setRows(await call("/admin/hospitals", "GET")); }
    catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const change = async (r: Row) => {
    if (!r.enabled && !window.confirm(`Enable ABDM for ${r.name}? Confirm patient consent will be collected.`)) return;
    setBusyId(r.id); setError("");
    try {
      await call(`/admin/${r.id}/${r.enabled ? "disable" : "enable"}`, "POST");
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusyId(""); }
  };

  return (
    <section style={{ border: "1px solid #d9dee5", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 4px" }}>ABDM (ABHA) access per hospital</h3>
      <p style={{ margin: "0 0 12px", color: "#556", fontSize: 14 }}>Off by default. Only you can switch it on or off.</p>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px solid #eef1f4" }}>
          <span>
            {r.name} <strong style={{ marginLeft: 8 }}>{r.enabled ? "Enabled" : "Off"}</strong>
            {r.enabled && r.enabledAt ? ` since ${new Date(r.enabledAt).toLocaleDateString()}` : ""}
          </span>
          <button disabled={busyId === r.id} onClick={() => change(r)}>
            {r.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      ))}
    </section>
  );
}
