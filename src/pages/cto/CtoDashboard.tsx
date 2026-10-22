import { Cloud, Database, RefreshCw, Rocket, Server } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cto, enquiries } from "../../api";
import { Inbox, Phone, MessageCircle, Mail } from "lucide-react";


function fmtBytes(n: number) {
  if (!Number.isFinite(n)) return "-";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return n.toFixed(i === 0 ? 0 : 1) + " " + u[i];
}
function fmtDur(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return (d ? d + "d " : "") + h + "h " + m + "m";
}
function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-800">{icon}{title}</h2>
      {children}
    </section>
  );
}

type Enquiry = {
  id: string; hospitalName: string; contactName: string; designation?: string | null; phone: string;
  email?: string | null; city?: string | null; hospitalSize?: string | null; message?: string | null;
  status: "new" | "contacted" | "closed"; notes?: string | null; createdAt: string;
};
const ENQ_BADGE: Record<string, string> = {
  new: "bg-teal-100 text-teal-800", contacted: "bg-amber-100 text-amber-800", closed: "bg-gray-200 text-gray-700",
};
function waLink(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  return "https://wa.me/" + d;
}

function EnquiryCard({ e, onChange }: { e: Enquiry; onChange: () => void }) {
  const [notes, setNotes] = useState(e.notes || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save(b: { status?: string; notes?: string }) {
    setBusy(true); setErr("");
    try { await enquiries.update(e.id, b); onChange(); }
    catch (x: any) { setErr(x?.message || "Could not save"); }
    finally { setBusy(false); }
  }
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-gray-900">{e.hospitalName}</div>
          <div className="text-sm text-gray-600">
            {e.contactName}{e.designation ? " (" + e.designation + ")" : ""}
          </div>
        </div>
        <div className="text-right">
          <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize " + ENQ_BADGE[e.status]}>{e.status}</span>
          <div className="mt-1 text-xs text-gray-400">{new Date(e.createdAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <a href={"tel:" + e.phone} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 font-medium text-white hover:bg-teal-700">
          <Phone className="h-4 w-4" /> {e.phone}
        </a>
        <a href={waLink(e.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        {e.email && (
          <a href={"mailto:" + e.email} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">
            <Mail className="h-4 w-4" /> {e.email}
          </a>
        )}
      </div>

      {(e.city || e.hospitalSize) && (
        <div className="mt-3 text-sm text-gray-600">
          {[e.city, e.hospitalSize].filter(Boolean).join(" | ")}
        </div>
      )}
      {e.message && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{e.message}</p>}

      <textarea
        value={notes} onChange={(x) => setNotes(x.target.value)} rows={2} maxLength={1500}
        placeholder="Private notes (only you can see this)"
        className="mt-3 w-full rounded-lg border border-gray-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {notes !== (e.notes || "") && (
          <button disabled={busy} onClick={() => save({ notes })} className="rounded-lg border px-3 py-1 hover:bg-gray-50">Save note</button>
        )}
        {(["new", "contacted", "closed"] as const).filter((s) => s !== e.status).map((s) => (
          <button key={s} disabled={busy} onClick={() => save({ status: s })} className="rounded-lg border px-3 py-1 capitalize hover:bg-gray-50">
            Mark {s}
          </button>
        ))}
        {err && <span className="text-red-600">{err}</span>}
      </div>
    </div>
  );
}

function EnquiriesSection() {
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "closed">("new");
  const [list, setList] = useState<Enquiry[]>([]);
  const [counts, setCounts] = useState({ new: 0, contacted: 0, closed: 0 });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await enquiries.list(filter === "all" ? undefined : filter);
      setList(r.enquiries || []); setCounts(r.counts || { new: 0, contacted: 0, closed: 0 }); setErr("");
    } catch (x: any) { setErr(x?.message || "Could not load enquiries"); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    setLoading(true); load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const tabs: { key: typeof filter; label: string; n?: number }[] = [
    { key: "new", label: "New", n: counts.new },
    { key: "contacted", label: "Contacted", n: counts.contacted },
    { key: "closed", label: "Closed", n: counts.closed },
    { key: "all", label: "All", n: counts.new + counts.contacted + counts.closed },
  ];

  return (
    <Section icon={<Inbox className="h-5 w-5" />} title={"Hospital enquiries" + (counts.new ? " (" + counts.new + " new)" : "")}>
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={"rounded-full border px-3 py-1 text-sm " + (filter === t.key ? "border-teal-600 bg-teal-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50")}>
            {t.label} {t.n ? "(" + t.n + ")" : ""}
          </button>
        ))}
      </div>
      {err && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {loading ? <div className="text-sm text-gray-500">Loading...</div>
        : list.length === 0 ? <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-500">No enquiries here yet.</div>
        : <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{list.map((e) => <EnquiryCard key={e.id} e={e} onChange={load} />)}</div>}
    </Section>
  );
}

export default function CtoDashboard() {

  const [ov, setOv] = useState<any>(null);
  const [sb, setSb] = useState<any>(null);
  const [vc, setVc] = useState<any>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.allSettled([cto.overview(), cto.supabase(), cto.vercel()]);
    const e: string[] = [];
    if (a.status === "fulfilled") setOv(a.value); else e.push("Overview: " + (a.reason?.message || "failed"));
    if (b.status === "fulfilled") setSb(b.value); else e.push("Supabase: " + (b.reason?.message || "failed"));
    if (c.status === "fulfilled") setVc(c.value); else e.push("Vercel: " + (c.reason?.message || "failed"));
    setErrs(e);
    setUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const db = ov?.db, sv = ov?.server;
  const maxTable = db?.tables?.length ? Math.max(...db.tables.map((t: any) => t.bytes), 1) : 1;
  const usedMem = sv ? sv.totalMem - sv.freeMem : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
        <div>
          <div className="text-lg font-semibold text-gray-900">Doctor Booked - CTO Console</div>
          <div className="text-xs text-gray-500">{updated ? "Updated " + updated.toLocaleTimeString() : "Loading..."}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        {errs.length > 0 && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errs.map((x) => <div key={x}>{x}</div>)}
          </div>
        )}

        <EnquiriesSection />

        <Section icon={<Server className="h-5 w-5" />} title="Backend server">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card title="Server uptime" value={sv ? fmtDur(sv.uptimeSec) : "-"} sub={sv ? "API process " + fmtDur(sv.processUptimeSec) : ""} />
            <Card title="CPU load (1/5/15m)" value={sv ? sv.loadAvg.map((x: number) => x.toFixed(2)).join(" / ") : "-"} sub={sv ? sv.cpus + " cores" : ""} />
            <Card title="Memory used" value={sv ? fmtBytes(usedMem) : "-"} sub={sv ? "of " + fmtBytes(sv.totalMem) + " | API " + fmtBytes(sv.rss) : ""} />
            <Card title="Node" value={sv ? sv.node : "-"} />
          </div>
        </Section>

        <Section icon={<Database className="h-5 w-5" />} title="Database (Supabase Postgres)">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card title="Database size" value={db ? fmtBytes(db.sizeBytes) : "-"} sub="Free plan limit: 500 MB" />
            <Card title="DB connections" value={db ? String(db.connections.reduce((a: number, c: any) => a + c.n, 0)) : "-"} sub={db ? "max " + db.maxConnections + " | " + db.connections.map((c: any) => c.state + ": " + c.n).join(", ") : ""} />
            <Card title="App pool" value={db ? db.pool.total + " open" : "-"} sub={db ? db.pool.idle + " idle, " + db.pool.waiting + " waiting" : ""} />
            <Card title="Tables" value={db ? String(db.tables.length) : "-"} sub="top 20 by size" />
          </div>
          {db?.tables?.length ? (
            <div className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
              <div className="mb-2 text-sm font-medium text-gray-700">Largest tables</div>
              {db.tables.map((t: any) => (
                <div key={t.name} className="mb-1.5 flex items-center gap-3 text-sm">
                  <div className="w-48 truncate text-gray-700">{t.name}</div>
                  <div className="h-2 flex-1 rounded bg-gray-100">
                    <div className="h-2 rounded bg-teal-500" style={{ width: Math.max(2, (t.bytes / maxTable) * 100) + "%" }} />
                  </div>
                  <div className="w-24 text-right text-gray-600">{fmtBytes(t.bytes)}</div>
                  <div className="w-24 text-right text-gray-400">{t.rows.toLocaleString()} rows</div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-2 text-sm font-medium text-gray-700">Slowest queries</div>
            {db && db.slowQueries === null ? (
              <div className="text-sm text-gray-500">pg_stat_statements is not available on this database.</div>
            ) : db?.slowQueries?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr className="text-gray-500"><th className="py-1 pr-3">Query</th><th className="pr-3">Calls</th><th className="pr-3">Mean ms</th><th>Total ms</th></tr></thead>
                  <tbody>
                    {db.slowQueries.map((q: any, i: number) => (
                      <tr key={i} className="border-t"><td className="max-w-md truncate py-1 pr-3 font-mono">{q.query}</td><td className="pr-3">{q.calls}</td><td className="pr-3">{q.mean_ms}</td><td>{q.total_ms}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-sm text-gray-500">No data.</div>}
          </div>
        </Section>

        <Section icon={<Rocket className="h-5 w-5" />} title="Vercel deployments">
          {!vc ? <div className="text-sm text-gray-500">Loading...</div> : vc.configured === false ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Not configured. Add VERCEL_TOKEN and VERCEL_PROJECT_ID to the server .env.
            </div>
          ) : vc.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{vc.error}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card title="Recent deployments" value={String(vc.summary.total)} />
                <Card title="Ready" value={String(vc.summary.ready)} />
                <Card title="Errors" value={String(vc.summary.errors)} />
                <Card title="Avg build time" value={vc.summary.avgBuildSec != null ? vc.summary.avgBuildSec + " s" : "-"} />
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border bg-white p-4 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead><tr className="text-gray-500"><th className="py-1 pr-3">When</th><th className="pr-3">State</th><th className="pr-3">Target</th><th className="pr-3">Build</th><th>Commit</th></tr></thead>
                  <tbody>
                    {vc.deployments.map((d: any) => (
                      <tr key={d.id} className="border-t">
                        <td className="py-1 pr-3 whitespace-nowrap">{new Date(d.createdAt).toLocaleString()}</td>
                        <td className={"pr-3 " + (d.state === "ERROR" ? "text-red-600" : d.state === "READY" ? "text-green-600" : "text-amber-600")}>{d.state}</td>
                        <td className="pr-3">{d.target}</td>
                        <td className="pr-3">{d.buildSec != null ? d.buildSec + " s" : "-"}</td>
                        <td className="max-w-md truncate">{d.message || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Section>

        <Section icon={<Cloud className="h-5 w-5" />} title="Supabase platform">
          {!sb ? <div className="text-sm text-gray-500">Loading...</div> : sb.configured === false ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Not configured. Add SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF to the server .env.
            </div>
          ) : (
            <div className="space-y-3">
              {Array.isArray(sb.health?.data) && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {sb.health.data.map((h: any) => (
                    <Card key={h.name} title={h.name} value={h.healthy ? "Healthy" : "Down"} sub={h.status} />
                  ))}
                </div>
              )}
              {["apiCounts", "requests"].map((k) => (
                <details key={k} className="rounded-xl border bg-white p-4 shadow-sm">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">
                    {k === "apiCounts" ? "API usage, last 7 days" : "API request count"}
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-auto text-xs text-gray-700">
                    {sb[k]?.error ? sb[k].error : JSON.stringify(sb[k]?.data, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}
