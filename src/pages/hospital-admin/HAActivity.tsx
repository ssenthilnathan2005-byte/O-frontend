import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowRight, IndianRupee, Loader2, RefreshCw, Search, Settings, ShieldCheck, Users } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
const SEEN_KEY = (hid: string) => "db_activity_seen_" + hid;

/** Called when the admin opens the Activity Monitor: clears the "new" badge. */
export function markActivitySeen(hid: string) {
  try { localStorage.setItem(SEEN_KEY(hid), new Date().toISOString()); } catch { /* ignore */ }
  window.dispatchEvent(new Event("db-activity-seen"));
}

/** Number of important changes made by others since the admin last opened the Activity Monitor. */
export function useActivityUnread(): number {
  const { user } = useStore();
  const hid = user && user.role === "hospital_admin" ? user.hospitalId : "";
  const [n, setN] = useState(0);
  const load = useCallback(async () => {
    if (!hid) return;
    let since = "";
    try { since = localStorage.getItem(SEEN_KEY(hid)) || ""; } catch { /* ignore */ }
    try {
      const r = await fetch(BASE + "/activity/unread" + (since ? "?since=" + encodeURIComponent(since) : ""), {
        headers: { Authorization: "Bearer " + getToken() },
      });
      if (!r.ok) return;
      const d = await r.json();
      setN(Number(d.count) || 0);
    } catch { /* ignore */ }
  }, [hid]);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    window.addEventListener("db-activity-seen", load);
    return () => { clearInterval(t); window.removeEventListener("db-activity-seen", load); };
  }, [load]);

  // Live updates: the server sends a tiny "activity" ping whenever an important change is saved.
  useEffect(() => {
    if (!hid) return;
    const wsBase = BASE.replace(/^http/, "ws").replace(/\/api\/?$/, "");
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dead = false;
    let backoff = 2000;
    const connect = () => {
      if (dead) return;
      try {
        ws = new WebSocket(wsBase + "/ws?session=" + encodeURIComponent("activity_" + hid));
        ws.onopen = () => { backoff = 2000; window.dispatchEvent(new CustomEvent("db-activity-socket", { detail: true })); };
        ws.onmessage = (e) => {
          try {
            if (JSON.parse(e.data).type === "activity") {
              load();
              window.dispatchEvent(new Event("db-activity-live"));
            }
          } catch { /* ignore */ }
        };
        ws.onclose = () => {
          window.dispatchEvent(new CustomEvent("db-activity-socket", { detail: false }));
          if (!dead) { timer = setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 30000); }
        };
        ws.onerror = () => ws?.close();
      } catch { if (!dead) timer = setTimeout(connect, backoff); }
    };
    connect();
    return () => { dead = true; if (timer) clearTimeout(timer); try { ws?.close(); } catch { /* ignore */ } };
  }, [hid, load]);
  return n;
}

type Change = { field: string; label: string; from: string | null; to: string };
type Item = {
  id: string; at: string; actor_id: string | null; actor_role: string | null; actor_name: string | null;
  category: string; action: string; group: string | null; entity_type: string | null; entity_id: string | null; entity_name: string | null;
  summary: string; changes: Change[] | null;
};

const GROUPS: { key: string; label: string; icon: typeof Activity; cls: string }[] = [
  { key: "", label: "All important", icon: Activity, cls: "bg-gray-100 text-gray-600" },
  { key: "pricing", label: "Pricing and billing", icon: IndianRupee, cls: "bg-amber-50 text-amber-600" },
  { key: "access", label: "Permissions and passwords", icon: ShieldCheck, cls: "bg-rose-50 text-rose-600" },
  { key: "staff", label: "Staff and logins", icon: Users, cls: "bg-emerald-50 text-emerald-600" },
  { key: "config", label: "Configuration", icon: Settings, cls: "bg-indigo-50 text-indigo-600" },
];
const ROLE_LABEL: Record<string, string> = {
  doctor: "Doctor", nurse: "Nurse", front_office: "Front office", pharmacy: "Pharmacy", pharmacy_staff: "Pharmacy",
  hospital_lab: "Lab", hospital_admin: "Hospital admin", admin: "Platform admin",
};
const ENTITY_LABEL: Record<string, string> = {
  patient: "Patient", doctor: "Doctor", nurse: "Nurse", ward: "Ward", bed: "Bed", inventory_item: "Item", staff: "Staff",
  medicine: "Medicine", lab_test: "Lab test", role: "Role", login: "Login", hospital: "Hospital", preset: "Preset",
  prescription: "Prescription", front_office: "Front office login", pharmacy_staff: "Pharmacy login", lab_staff: "Lab login",
};

async function fetchActivity(params: Record<string, string>) {
  const r = await fetch(BASE + "/activity?" + new URLSearchParams(params).toString(), {
    headers: { Authorization: "Bearer " + getToken() },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || "Could not load activity");
  return d as { items: Item[]; hasMore: boolean };
}

function dayKey(iso: string) { return new Date(iso).toLocaleDateString("en-CA"); }
function dayLabel(key: string) {
  const today = new Date().toLocaleDateString("en-CA");
  const yest = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
  if (key === today) return "Today";
  if (key === yest) return "Yesterday";
  return new Date(key + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}
function exactLabel(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}
function agoLabel(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + " min ago";
  return "";
}

export default function HAActivity() {
  const { user } = useStore();
  const hid = user && user.role === "hospital_admin" ? user.hospitalId : "";
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [group, setGroup] = useState("");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [extraPages, setExtraPages] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const params = useCallback((before?: string) => {
    const p: Record<string, string> = { limit: "50" };
    if (group) p.group = group;
    if (dq) p.q = dq;
    if (before) p.before = before;
    return p;
  }, [group, dq]);

  const loadFirst = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const d = await fetchActivity(params());
      setItems(d.items); setHasMore(d.hasMore); setExtraPages(false); setError("");
      if (hid) markActivitySeen(hid);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load activity"); }
    finally { setLoading(false); }
  }, [params, hid]);

  const [live, setLive] = useState(false);
  useEffect(() => { loadFirst(true); }, [loadFirst]);
  useEffect(() => {
    // Safety net: refresh every 15 seconds even if the live connection is down.
    const t = setInterval(() => { if (!extraPages) loadFirst(false); }, 15000);
    return () => clearInterval(t);
  }, [loadFirst, extraPages]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onLive = () => { if (extraPages) return; if (timer) clearTimeout(timer); timer = setTimeout(() => loadFirst(false), 300); };
    const onSocket = (e: Event) => setLive(Boolean((e as CustomEvent).detail));
    window.addEventListener("db-activity-live", onLive);
    window.addEventListener("db-activity-socket", onSocket);
    return () => { if (timer) clearTimeout(timer); window.removeEventListener("db-activity-live", onLive); window.removeEventListener("db-activity-socket", onSocket); };
  }, [loadFirst, extraPages]);

  async function loadMore() {
    if (!items.length) return;
    setLoadingMore(true);
    try {
      const d = await fetchActivity(params(items[items.length - 1].at));
      setItems((prev) => prev.concat(d.items)); setHasMore(d.hasMore); setExtraPages(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load more"); }
    finally { setLoadingMore(false); }
  }

  const groups: { key: string; items: Item[] }[] = [];
  for (const it of items) {
    const k = dayKey(it.at);
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.items.push(it); else groups.push({ key: k, items: [it] });
  }

  return (
    <div className="w-full space-y-4 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><Activity className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Activity Monitor</h1>
            <p className="text-sm text-gray-500">Important administrative changes only: pricing and bed rates, permissions and passwords, staff logins and critical settings. Routine daily work is not shown here.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={"flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " + (live ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500")} title={live ? "New changes appear automatically" : "Reconnecting, refreshing every 15 seconds"}>
            <span className={"h-2 w-2 rounded-full " + (live ? "animate-pulse bg-emerald-500" : "bg-gray-400")} /> {live ? "Live" : "Updating"}
          </span>
          <button type="button" onClick={() => loadFirst(true)} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {GROUPS.map((c) => (
          <button key={c.key || "all"} type="button" onClick={() => setGroup(c.key)}
            className={"rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " + (group === c.key ? "border-teal-500 bg-teal-500 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50")}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by person, ward, role or change"
          className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-400" />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center">
          <Activity className="mx-auto mb-3 h-10 w-10 text-gray-200" />
          <p className="font-semibold text-gray-900">No important changes</p>
          <p className="mt-1 text-sm text-gray-500">Rate and price changes, permission changes, login changes and critical settings will show up here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.key} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{dayLabel(g.key)}</h2>
              {g.items.map((it) => {
                const meta = GROUPS.find((c) => c.key === it.group) || GROUPS[0];
                const Icon = meta.icon;
                const role = it.actor_role ? ROLE_LABEL[it.actor_role] || it.actor_role : "";
                return (
                  <div key={it.id} className="flex gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg " + meta.cls}><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-gray-900">{it.actor_name || "Staff"}</span>
                        {role && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{role}</span>}
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-50 text-gray-500">{meta.label}</span>
                        <span className="ml-auto text-right text-xs text-gray-400" title={exactLabel(it.at)}>
                          {exactLabel(it.at)}{agoLabel(it.at) ? <span className="ml-1 text-teal-600">({agoLabel(it.at)})</span> : null}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-600">{it.summary}</p>
                      {it.entity_name && (
                        <p className="mt-1 text-xs text-gray-500">
                          <span className="font-medium text-gray-600">{(it.entity_type && ENTITY_LABEL[it.entity_type]) || "Record"}:</span> {it.entity_name}
                        </p>
                      )}
                      {it.changes && it.changes.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {it.changes.map((c, i) => (
                            <li key={c.field + i} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-medium text-gray-700">{c.label}</span>
                              {c.from === null || c.from === undefined ? (
                                <span className="rounded bg-gray-50 px-1.5 py-0.5 text-gray-700">{c.to}</span>
                              ) : (
                                <>
                                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through">{c.from}</span>
                                  <ArrowRight className="h-3 w-3 text-gray-400" />
                                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{c.to}</span>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
          {hasMore && (
            <div className="text-center">
              <button type="button" disabled={loadingMore} onClick={loadMore} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {loadingMore ? "Loading..." : "Show older"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
