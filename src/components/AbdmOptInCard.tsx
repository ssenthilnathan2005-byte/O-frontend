import { useCallback, useEffect, useState } from "react";

import { getToken } from "../api";

// Same base address logic as src/api.ts (it already ends in /api)
const BASE: string = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Status = { enabled: boolean; enabledAt?: string | null; hospital?: string };

async function call(path: string, method: "GET" | "POST", body?: unknown) {
  const res = await fetch(`${BASE}/abdm${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken() ?? ""}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data;
}

export default function AbdmOptInCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setError(""); setStatus(await call("/status", "GET")); }
    catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const change = async (enable: boolean) => {
    setBusy(true); setError("");
    try {
      await call(enable ? "/enable" : "/disable", "POST", enable ? { confirm: true } : undefined);
      setAgree(false);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const box: React.CSSProperties = {
    border: "1px solid #d9dee5", borderRadius: 12, padding: 16, background: "#fff", maxWidth: 520,
  };

  return (
    <section style={box} aria-label="ABDM opt-in">
      <h3 style={{ margin: "0 0 4px" }}>ABDM (ABHA) health records</h3>
      <p style={{ margin: "0 0 12px", color: "#556", fontSize: 14 }}>
        Allow this hospital to share patient records through India&apos;s Ayushman Bharat Digital Mission.
        Off by default.
      </p>

      {!status && !error && <p>Loading…</p>}
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}

      {status && (
        <>
          <p style={{ margin: "0 0 12px" }}>
            Status: <strong>{status.enabled ? "Enabled" : "Not enabled"}</strong>
            {status.enabled && status.enabledAt
              ? ` since ${new Date(status.enabledAt).toLocaleDateString()}` : ""}
          </p>

          {!status.enabled ? (
            <>
              <label style={{ display: "flex", gap: 8, fontSize: 14, marginBottom: 12 }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I am authorised to enable ABDM for this hospital and confirm patient consent will be collected.</span>
              </label>
              <button disabled={!agree || busy} onClick={() => change(true)}>
                {busy ? "Enabling…" : "Enable ABDM"}
              </button>
            </>
          ) : (
            <button disabled={busy} onClick={() => change(false)}>
              {busy ? "Disabling…" : "Disable ABDM"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
