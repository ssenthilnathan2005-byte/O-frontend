import io, re, sys

PATHS = {
  "ham": "src/pages/hospital-admin/HAInward.tsx",
  "api": "src/api.ts",
  "mod": "src/pages/hospital-admin/IPDBillModal.tsx",
  "inv": "src/lib/ipdInvoice.ts",
  "pb":  "src/pages/patient/PatientBill.tsx",
  "pi":  "src/pages/patient/PatientInvoice.tsx",
}

def stop(m):
    print("STOP - " + m + " - nothing written"); sys.exit(1)

def load(p):
    raw = io.open(p, encoding="utf-8", newline="").read()
    return ("\r\n" in raw), raw.replace("\r\n", "\n")

def once(t, old, new, label):
    n = t.count(old)
    if n != 1: stop("%s not found once (count=%d)" % (label, n))
    return t.replace(old, new)

def rx(t, pat, fn, label):
    m = list(re.finditer(pat, t))
    if len(m) != 1: stop("%s not found once (count=%d)" % (label, len(m)))
    m = m[0]
    return t[:m.start()] + fn(m) + t[m.end():]

F = {k: load(v) for k, v in PATHS.items()}
T = {k: v[1] for k, v in F.items()}

if "doTransfer" in T["ham"]:
    print("ALREADY PATCHED - stop"); sys.exit(0)

# ---------- api.ts
T["api"] = rx(T["api"], r'[ \t]*discharge:[^\n]*/discharge[^\n]*\n',
  lambda m: m.group(0) + "  transfer:  (id: string, data: any) => post<any>(`/inward/${id}/transfer`, data),\n", "api discharge line")

# ---------- HAInward.tsx
t = T["ham"]
t = once(t, 'Baby } from "lucide-react";', 'Baby, ArrowRightLeft } from "lucide-react";', "lucide import")
t = once(t, '  const [origAdmittedAt, setOrigAdmittedAt] = useState("");\n',
'''  const [origAdmittedAt, setOrigAdmittedAt] = useState("");
  const [trId, setTrId] = useState<string | null>(null);
  const [trBed, setTrBed] = useState("");
  const [trRate, setTrRate] = useState("");
  const [trReason, setTrReason] = useState("");
  const [trBusy, setTrBusy] = useState(false);
  const [trErr, setTrErr] = useState("");
''', "state anchor")
t = once(t, "  function openAdmit() {",
'''  function openTransfer(p: InwardPatient) {
    setTrId(p.id); setTrBed(""); setTrRate(""); setTrReason(""); setTrErr(""); setFreeBeds([]);
    api.bedBookings.freeBeds()
      .then((r) => setFreeBeds(Array.isArray(r) ? r : []))
      .catch(() => setTrErr("Could not load the free beds. Close and try again."));
  }
  async function doTransfer() {
    if (!trId) return;
    if (!trBed) { setTrErr("Choose the bed to move the patient to."); return; }
    setTrBusy(true); setTrErr("");
    try {
      const body: any = { bedId: trBed, reason: trReason };
      if (trRate.trim() !== "") body.rate = Number(trRate);
      await api.inward.transfer(trId, body);
      setTrId(null); await load();
    } catch (e: any) {
      setTrErr(e?.message || "Could not move the patient. Please try again.");
    } finally { setTrBusy(false); }
  }

  function openAdmit() {''', "openAdmit anchor")
t = once(t, "To move the patient to another bed, use the transfer option (coming next).",
            "To move the patient, use the transfer button (arrows icon) in the list.", "coming-next note")
t = rx(t, r'[ \t]*\{p\.status === "admitted" && \(\n[ \t]*<button onClick=\{\(\) => handleDischarge',
  lambda m: '''                    {p.status === "admitted" && (
                      <button onClick={() => openTransfer(p)} className="p-1.5 rounded hover:bg-blue-50 transition-colors" title="Transfer to another bed or ward">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                      </button>
                    )}
''' + m.group(0), "discharge button")
MODAL = '''      {trId && (() => { const cur = patients.find(x => x.id === trId); return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Transfer patient</h2>
              <button onClick={() => setTrId(null)} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm"><b>{cur?.patient_name}</b> is now in {cur?.ward || "-"} / {cur?.bed_number || "-"}</p>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Move to bed *</label>
                <select value={trBed} onChange={e => setTrBed(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="">{freeBeds.length ? "Select a free bed" : "No free beds available"}</option>
                  {Array.from(new Set(freeBeds.map((b: any) => b.ward_name))).map((w: any) => (
                    <optgroup key={w} label={w}>
                      {freeBeds.filter((b: any) => b.ward_name === w).map((b: any) => (
                        <option key={b.bed_id} value={b.bed_id}>{b.bed_number}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Special daily rate in the new ward (optional)</label>
                <Input placeholder="Leave empty to use the new ward rate" inputMode="decimal" value={trRate}
                  onChange={e => setTrRate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Reason (optional)</label>
                <Input placeholder="e.g. needs ICU care" value={trReason} onChange={e => setTrReason(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">The new ward rate is charged from today. Earlier days stay at the old ward rate. The old bed goes to cleaning.</p>
              {trErr && <p className="text-sm text-red-600">{trErr}</p>}
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setTrId(null)} className="px-4 py-2 rounded-lg text-sm border hover:bg-muted transition-colors">Cancel</button>
              <button onClick={doTransfer} disabled={trBusy}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                {trBusy ? "Moving..." : "Move patient"}
              </button>
            </div>
          </div>
        </div>
      ); })()}
'''
t = once(t, "      {billId && <IPDBillModal inwardId={billId}", MODAL + "      {billId && <IPDBillModal inwardId={billId}", "bill modal mount")
T["ham"] = t

# ---------- IPDBillModal.tsx
def f_mod(m):
    orig = m.group(0).strip()
    return '''              {bill.segments && bill.segments.length > 1 ? (
                <div className="text-xs text-gray-500 space-y-0.5">
                  {bill.segments.map((s: any, i: number) => (
                    <p key={i}>{s.ward}: {s.days} day{s.days === 1 ? "" : "s"} &times; {inr(s.rate)} = {inr(s.amount)}</p>
                  ))}
                  <p>Calendar days. The rate box below changes the current ward rate.</p>
                </div>
              ) : (
                ''' + orig + '''
              )}
'''
T["mod"] = rx(T["mod"], r'[ \t]*<p className="text-xs text-gray-500">\{bill\.days\} day\{bill\.days === 1 \? "" : "s"\}[^\n]*\n', f_mod, "bill modal days line")

# ---------- ipdInvoice.ts
def f_inv(m):
    orig = m.group(0).strip()
    return ('${b.segments && b.segments.length > 1 ? b.segments.map((s: any) => `<tr><td>Bed charge (${esc(s.ward)})<div class="s">${esc(s.days)} day(s), from ${esc(s.from)}</div></td><td class="r">${esc(s.days)}</td><td class="r">${inr(s.rate)}</td><td class="r">${inr(s.amount)}</td></tr>`).join("") : `'
            + orig + '`}\n')
T["inv"] = rx(T["inv"], r'[ \t]*<tr><td>Bed charge \(\$\{esc\(b\.ward \|\| "Ward"\)\}\)<div class="s">[^\n]*\n', f_inv, "invoice bed row")

# ---------- PatientBill.tsx
def f_pb(m):
    orig = m.group(0).strip()
    return '''          {bill.segments && bill.segments.length > 1 ? bill.segments.map((s: any, i: number) => (
            <div key={i} className="flex justify-between"><span className="text-gray-600">Bed - {s.ward} ({s.days} day{s.days === 1 ? "" : "s"} &times; {rupee(s.rate)})</span><span>{rupee(s.amount)}</span></div>
          )) : (
            ''' + orig + '''
          )}
'''
T["pb"] = rx(T["pb"], r'[ \t]*<div className="flex justify-between"><span className="text-gray-600">Bed \(\{bill\.days\}[^\n]*\n', f_pb, "patient bill bed row")

# ---------- PatientInvoice.tsx
def f_pi(m):
    orig = m.group(0).rstrip("\n")
    return '''                {bill.segments && bill.segments.length > 1 ? bill.segments.map((s: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 pr-2">Bed charge ({s.ward})</td>
                    <td className="py-2 text-right text-gray-600">{s.days} day{s.days === 1 ? "" : "s"} x {rupee(s.rate)}</td>
                    <td className="py-2 text-right">{rupee(s.amount)}</td>
                  </tr>
                )) : (
''' + orig + '''
                )}
'''
T["pi"] = rx(T["pi"], r'[ \t]*<tr className="border-b">\n[ \t]*<td className="py-2 pr-2">Bed charge \(\{bill\.ward \|\| "Ward"\}\)</td>\n[^\n]*\n[^\n]*\n[ \t]*</tr>\n', f_pi, "patient invoice bed row")

for k, p in PATHS.items():
    out = T[k].replace("\n", "\r\n") if F[k][0] else T[k]
    io.open(p, "w", encoding="utf-8", newline="").write(out)
    print("PATCHED " + p)
