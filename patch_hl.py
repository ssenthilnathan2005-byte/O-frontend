import sys, io

P = sys.argv[1] if len(sys.argv) > 1 else r"src\pages\HospitalLabDashboard.tsx"
raw = open(P, "r", encoding="utf-8", newline="").read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

if "function TokenBoard" in s:
    print("Already patched, nothing to do.")
    sys.exit(0)

def rep(old, new):
    global s
    assert s.count(old) == 1, "Anchor not found exactly once: " + old[:60]
    s = s.replace(old, new)

# 1. imports
rep('import { useEffect, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";')
rep('import { CheckCircle, FlaskConical, LogOut, X, XCircle } from "lucide-react";',
    'import { CheckCircle, FlaskConical, LogOut, Phone, X, XCircle } from "lucide-react";')

# 2. tab state
rep('  const [busy, setBusy] = useState(false);\n\n  async function call(',
    '  const [busy, setBusy] = useState(false);\n  const [tab, setTab] = useState<"board" | "orders">("board");\n\n  async function call(')

# 3. header + tabs (same look as the independent lab dashboard)
old_header_start = '  return (\n    <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">\n'
i = s.index(old_header_start)
j = s.index('      <div className="flex flex-wrap gap-2">\n        {FILTERS.map')
new_header = '''  const tabCls = (on: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-colors ${on ? "bg-teal-500 text-white" : "bg-white text-gray-600 border border-gray-200"}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 text-sm truncate">{user?.hospitalName || "Hospital Lab"}</h1>
            <p className="text-xs text-gray-400">Lab Staff Dashboard</p>
          </div>
          {pendingCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{pendingCount} pending</span>}
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-50">
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("board")} className={tabCls(tab === "board")}>Token Board</button>
        <button type="button" onClick={() => setTab("orders")} className={tabCls(tab === "orders")}>Bookings</button>
      </div>

      {tab === "board" && <TokenBoard orders={orders} busy={busy} update={update} onResult={(o) => { setResultFor(o); setResultValue(o.result_value || ""); }} />}

      {tab === "orders" && (<>
'''
s = s[:i] + new_header + s[j:]

# 4. close the orders tab fragment before the result modal
rep('      )}\n\n      {resultFor && (', '      )}\n      </>)}\n\n      {resultFor && (')

# 5. close the extra wrapper div at the end of the component
rep('      )}\n    </div>\n  );\n}', '      )}\n      </div>\n    </div>\n  );\n}')

# 6. token board component (appended)
s = s.rstrip("\n") + '''

// ── Token board (same idea as the independent lab's Token Control) ───────────
function localDate(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
}
const TOKEN_CLS: Record<string, string> = {
  ordered: "bg-red-50 text-red-600 border-red-300",
  sample_collected: "bg-orange-500 text-white border-orange-600",
  processing: "bg-orange-500 text-white border-orange-600",
  report_ready: "bg-green-100 text-green-700 border-green-400",
  cancelled: "bg-gray-100 text-gray-400 border-gray-300 line-through",
};
const TOKEN_LEGEND: [string, string][] = [
  ["ordered", "Waiting"], ["sample_collected", "In progress"], ["report_ready", "Report ready"], ["cancelled", "Cancelled"],
];
const SESSIONS: [string, string][] = [["morning", "Morning"], ["afternoon", "Afternoon"]];

function TokenBoard({ orders, busy, update, onResult }: {
  orders: Order[]; busy: boolean;
  update: (o: Order, status?: string, resultValue?: string) => Promise<void>;
  onResult: (o: Order) => void;
}) {
  const dates = useMemo(() => [0, 1, 2, 3, 4].map(localDate), []);
  const [date, setDate] = useState(dates[0]);
  const [session, setSession] = useState(new Date().getHours() < 12 ? "morning" : "afternoon");
  const [testName, setTestName] = useState("");
  const [selId, setSelId] = useState<string | null>(null);

  const tokened = orders.filter((o) => o.token_number != null && o.slot_date);
  const tests = Array.from(new Set(tokened.map((o) => o.test_name)));
  const activeTest = tests.includes(testName) ? testName : tests[0] || "";
  const sess = (o: Order) => String(o.slot_time || "").toLowerCase();

  const forDate = tokened.filter((o) => o.test_name === activeTest && o.slot_date === date);
  const inSession = forDate.filter((o) => sess(o) === session).sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
  const testCount = (t: string) => tokened.filter((o) => o.test_name === t && o.slot_date === date && o.status !== "cancelled").length;
  const sessionCount = (k: string) => forDate.filter((o) => sess(o) === k && o.status !== "cancelled").length;
  const countOf = (f: (o: Order) => boolean) => inSession.filter(f).length;
  const sel = selId ? orders.find((o) => o.id === selId) || null : null;
  const next = sel ? NEXT[sel.status] : undefined;
  const open = sel ? sel.status !== "report_ready" && sel.status !== "cancelled" : false;

  const pill = (on: boolean) =>
    `shrink-0 px-3 py-2 rounded-xl border text-sm font-medium ${on ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 bg-white text-gray-600"}`;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">Token Board</h2>
        <p className="text-xs text-gray-500 mt-0.5">Every test has its own tokens for each date and session.</p>
      </div>

      {tests.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No bookings yet. Tokens appear here as patients book.</div>
      ) : (
        <>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Test</p>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {tests.map((t) => (
              <button key={t} type="button" onClick={() => setTestName(t)} className={pill(activeTest === t)}>
                {t} <span className="ml-1 text-xs opacity-70">({testCount(t)})</span>
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Date</p>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {dates.map((d, i) => (
              <button key={d} type="button" onClick={() => setDate(d)} className={pill(date === d)}>
                {i === 0 ? "Today" : new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Session</p>
          <div className="flex gap-2 mb-5">
            {SESSIONS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setSession(k)} className={pill(session === k)}>
                {l} <span className="ml-1 text-xs opacity-70">({sessionCount(k)})</span>
              </button>
            ))}
          </div>

          {inSession.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-gray-400 text-sm">
              No bookings for this test in the {session} session on this date.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex gap-4 mb-4 pb-3 border-b border-gray-100 text-xs text-gray-500">
                <span>Waiting <b className="text-gray-800">{countOf((o) => o.status === "ordered")}</b></span>
                <span>In progress <b className="text-gray-800">{countOf((o) => o.status === "sample_collected" || o.status === "processing")}</b></span>
                <span>Report ready <b className="text-gray-800">{countOf((o) => o.status === "report_ready")}</b></span>
                <span>Total <b className="text-gray-800">{inSession.length}</b></span>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tokens · tap to manage</p>
              <div className="flex flex-wrap gap-2">
                {inSession.map((o) => (
                  <button key={o.id} type="button" onClick={() => setSelId(o.id)} title={o.patient_name}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 text-sm font-semibold transition-all hover:scale-105 ${TOKEN_CLS[o.status] || TOKEN_CLS.ordered}`}>
                    {o.token_number}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4">
                {TOKEN_LEGEND.map(([k, label]) => (
                  <span key={k} className="flex items-center gap-1 text-[11px] text-gray-500">
                    <span className={`w-2.5 h-2.5 rounded-sm border ${TOKEN_CLS[k]}`} /> {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold">Token #{sel.token_number}</h2>
              <button onClick={() => setSelId(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm">
              <p className="font-semibold text-gray-900">{sel.patient_name}</p>
              {sel.phone && <p className="flex items-center gap-1.5 text-gray-600"><Phone className="w-3.5 h-3.5" /> {sel.phone}</p>}
              <p className="text-gray-500">{sel.test_name}</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(BADGE[sel.status] || BADGE.cancelled).cls}`}>
                {(BADGE[sel.status] || { label: sel.status }).label}
              </span>
              {sel.result_value && <p className="text-xs text-green-700 font-medium">Result: {sel.result_value}</p>}
              {sel.status === "cancelled" && <p className="text-xs font-semibold text-red-600">This booking was cancelled.</p>}
            </div>
            <div className="px-5 py-3 border-t flex flex-wrap gap-2 justify-end">
              {open && next && (
                <button disabled={busy} onClick={() => update(sel, next.to)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-60">{next.label} →</button>
              )}
              {sel.status !== "cancelled" && (
                <button disabled={busy} onClick={() => { onResult(sel); setSelId(null); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-teal-50 text-teal-700 hover:bg-teal-100">
                  {sel.status === "report_ready" ? "Edit result" : "Add result"}
                </button>
              )}
              {open && (
                <button disabled={busy} onClick={() => { if (confirm(`Cancel ${sel.test_name} for ${sel.patient_name}?`)) update(sel, "cancelled"); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">Cancel booking</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'''

out = s.replace("\n", "\r\n") if crlf else s
open(P, "w", encoding="utf-8", newline="").write(out)
print("Patched", P)
