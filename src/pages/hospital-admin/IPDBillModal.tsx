import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Trash2, Plus, Printer } from "lucide-react";
import { printIpdInvoice } from "../../lib/ipdInvoice";
import { ipdBilling } from "../../api";
import { useStore } from "../../context/StoreContext";

const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");
const CATS: [string, string][] = [["procedure", "Procedure"], ["test", "Test"], ["medicine", "Medicine"], ["doctor_visit", "Doctor visit"], ["room_service", "Room service"], ["other", "Other"]];
const MODES = ["cash", "upi", "card", "bank", "insurance", "other"];
const inp = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white w-full";

export default function IPDBillModal({ inwardId, onClose }: { inwardId: string; onClose: () => void }) {
  const { user } = useStore() as any;
  const isAdmin = user?.role === "hospital_admin" || user?.role === "admin";
  const [bill, setBill] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [item, setItem] = useState({ category: "procedure", description: "", qty: "1", unitPrice: "" });
  const [pay, setPay] = useState({ kind: "payment", mode: "cash", amount: "", note: "" });
  const [rate, setRate] = useState("");
  const [disc, setDisc] = useState("");
  const [discType, setDiscType] = useState("amount");
  const [cgst, setCgst] = useState("0");
  const [sgst, setSgst] = useState("0");
  const closed = bill?.status === "discharged";

  const applyBill = useCallback((b: any) => {
    setBill(b); setRate(String(b.bedRate));
    setDisc(String(b.discountValue ?? b.discount ?? 0));
    setDiscType(b.discountType === "percent" ? "percent" : "amount");
    setCgst(String(b.cgstRate ?? 0)); setSgst(String(b.sgstRate ?? 0));
  }, []);

  const load = useCallback(async () => {
    try {
      const b = await ipdBilling.get(inwardId);
      applyBill(b); setErr("");
    } catch (e: any) { setErr(e.message || "Could not load bill"); }
  }, [inwardId, applyBill]);
  useEffect(() => { load(); }, [load]);

  // Changing a closed (discharged) bill needs a reason; the server logs it. Removing a payment always needs one.
  function askReason(need: boolean): { ok: boolean; reason?: string } {
    if (!need) return { ok: true };
    const r = (window.prompt("Reason for this change (required, will be logged):") || "").trim();
    if (r.length < 3) { toast.error("A reason is required for this change"); return { ok: false }; }
    return { ok: true, reason: r };
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const calcTotals = (subtotal: number, type: string, dv: number, cr: number, sr: number) => {
    const v = Math.max(0, dv || 0);
    const discount = type === "percent" ? round2(Math.min(subtotal, (subtotal * Math.min(v, 100)) / 100)) : Math.min(round2(v), subtotal);
    const taxable = round2(subtotal - discount);
    const cgstAmt = round2((taxable * Math.min(Math.max(0, cr || 0), 100)) / 100);
    const sgstAmt = round2((taxable * Math.min(Math.max(0, sr || 0), 100)) / 100);
    return { discount, taxable, cgst: cgstAmt, sgst: sgstAmt, total: round2(taxable + cgstAmt + sgstAmt) };
  };
  const cgstNum = Number(cgst) || 0;
  const sgstNum = Number(sgst) || 0;
  const dirty = !!bill && (discType !== (bill.discountType || "amount") || Number(disc || 0) !== Number(bill.discountValue ?? bill.discount ?? 0) || cgstNum !== Number(bill.cgstRate || 0) || sgstNum !== Number(bill.sgstRate || 0));
  const live = bill
    ? (dirty
        ? (() => { const c = calcTotals(Number(bill.subtotal || 0), discType, Number(disc) || 0, cgstNum, sgstNum); return { ...c, total: round2(c.total + Number(bill.pharmacyTotal || 0)) }; })()
        : { discount: Number(bill.discount || 0), taxable: Number(bill.taxable ?? round2(Number(bill.subtotal || 0) - Number(bill.discount || 0))), cgst: Number(bill.cgst || 0), sgst: Number(bill.sgst || 0), total: Number(bill.total || 0) })
    : null;
  const liveTotal = live ? live.total : 0;
  const liveBalance = bill ? round2(liveTotal - Number(bill.paid || 0)) : 0;
  const shownCgstRate = dirty ? cgstNum : Number(bill?.cgstRate || 0);
  const shownSgstRate = dirty ? sgstNum : Number(bill?.sgstRate || 0);
  const shownDiscType = dirty ? discType : (bill?.discountType || "amount");
  const shownDiscValue = dirty ? Number(disc) || 0 : Number(bill?.discountValue ?? bill?.discount ?? 0);
  const payAmt = Number(pay.amount) || 0;
  const afterPay = round2(pay.kind === "refund" ? liveBalance + payAmt : liveBalance - payAmt);

  function saveAdjustments() {
    const d = Number(disc || 0), c = Number(cgst || 0), s = Number(sgst || 0);
    if (!(d >= 0)) { toast.error("Enter a valid discount"); return; }
    if (discType === "percent" && d > 100) { toast.error("Discount cannot be more than 100%"); return; }
    if (!(c >= 0 && c <= 100) || !(s >= 0 && s <= 100)) { toast.error("Tax rates must be between 0 and 100"); return; }
    const a = askReason(closed);
    if (!a.ok) return;
    const body: any = { discount: d, discountType: discType, cgstRate: c, sgstRate: s, reason: a.reason };
    run(() => ipdBilling.settings(inwardId, body), "Discount and tax saved");
  }

  async function run(fn: () => Promise<any>, ok: string, after?: () => void) {
    setBusy(true);
    try { const b = await fn(); toast.success(ok); if (b) applyBill(b); after?.(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-900">IPD Bill{bill ? " · " + bill.patientName : ""}</h2>
            {bill && <p className="text-xs text-gray-500">{bill.ward || "-"}{bill.bedNumber ? " / Bed " + bill.bedNumber : ""} · Admitted {fmt(bill.admittedAt)}{bill.dischargedAt ? " · Discharged " + fmt(bill.dischargedAt) : ""}</p>}
          </div>
          <div className="flex items-center gap-1">
            {bill && <button onClick={() => printIpdInvoice(bill)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border hover:bg-gray-50"><Printer className="w-3.5 h-3.5" />{bill.status === "discharged" ? "Invoice" : "Print bill"}</button>}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {err && <p className="p-4 text-sm text-red-600">{err}</p>}
        {!bill && !err && <p className="p-6 text-sm text-gray-400 text-center">Loading...</p>}

        {bill && (
          <div className="p-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-gray-50 p-2"><p className="text-[11px] text-gray-500">Final total</p><p className="font-semibold">{inr(liveTotal)}</p></div>
              <div className="rounded-lg bg-green-50 p-2"><p className="text-[11px] text-green-700">Paid</p><p className="font-semibold text-green-700">{inr(bill.paid)}</p></div>
              <div className={"rounded-lg p-2 " + (liveBalance > 0 ? "bg-red-50" : "bg-teal-50")}>
                <p className={"text-[11px] " + (liveBalance > 0 ? "text-red-600" : "text-teal-700")}>{liveBalance < 0 ? "Refund due" : "Remaining balance"}</p>
                <p className={"font-semibold " + (liveBalance > 0 ? "text-red-600" : "text-teal-700")}>{inr(Math.abs(liveBalance))}</p>
              </div>
            </div>

            {/* Bed charge */}
            <div className="border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Bed charge</span>
                <span className="font-semibold">{inr(bill.bedCharge)}</span>
              </div>
              {bill.segments && bill.segments.length > 1 ? (
                <div className="text-xs text-gray-500 space-y-0.5">
                  {bill.segments.map((s: any, i: number) => (
                    <p key={i}>{s.ward}: {s.days} day{s.days === 1 ? "" : "s"} &times; {inr(s.rate)} = {inr(s.amount)}</p>
                  ))}
                  <p>Calendar days. The rate box below changes the current ward rate.</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">{bill.days} day{bill.days === 1 ? "" : "s"} × {inr(bill.bedRate)} per day (calendar days)</p>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1"><label className="text-[11px] text-gray-500">Bed rate per day (₹)</label>
                  <input className={inp} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
                <button disabled={busy} onClick={() => { const a = askReason(closed); if (a.ok) run(() => ipdBilling.settings(inwardId, { bedRate: Number(rate), reason: a.reason }), "Bed rate updated"); }}
                  className="px-3 py-1.5 rounded-lg text-sm border hover:bg-gray-50 disabled:opacity-50">Save</button>
              </div>
            </div>

            {/* Lab tests (from the hospital lab) */}
            {bill.labTests && bill.labTests.length > 0 && (
              <div className="border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Lab tests</span>
                  <span className="font-semibold">{inr(bill.labTotal)}</span>
                </div>
                {bill.labTests.map((t: any) => (
                  <div key={t.id} className="flex items-start justify-between gap-2 text-sm border-t pt-1.5 first:border-0 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate">{t.testName}</p>
                      <p className="text-[11px] text-gray-500 capitalize">{String(t.status).replace("_", " ")}{t.result ? " \u00b7 Result: " + t.result : ""}</p>
                    </div>
                    <span className="font-medium shrink-0">{inr(t.amount)}</span>
                  </div>
                ))}
                <p className="text-[11px] text-gray-400">These amounts are already included in the charges below.</p>
              </div>
            )}

            {/* Items */}
            <div className="border rounded-xl p-3 space-y-2">
              <p className="font-medium text-sm">Charges</p>
              {bill.items.length === 0 && <p className="text-xs text-gray-400">No extra charges yet.</p>}
              {bill.items.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-sm border-t pt-1.5 first:border-0 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate">{i.description}</p>
                    <p className="text-[11px] text-gray-500 capitalize">{i.category.replace("_", " ")} · {i.qty} × {inr(i.unit_price)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium">{inr(i.amount)}</span>
                    <button disabled={busy} onClick={() => { if (!confirm("Remove this charge?")) return; const a = askReason(closed); if (a.ok) run(() => ipdBilling.removeItem(inwardId, i.id, a.reason), "Charge removed"); }}
                      className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-6 gap-2 pt-2 border-t">
                <select className={inp + " col-span-3"} value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value })}>
                  {CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <input className={inp + " col-span-3"} placeholder="Description" value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} />
                <input className={inp + " col-span-2"} inputMode="decimal" placeholder="Qty" value={item.qty} onChange={(e) => setItem({ ...item, qty: e.target.value })} />
                <input className={inp + " col-span-3"} inputMode="decimal" placeholder="Price (₹)" value={item.unitPrice} onChange={(e) => setItem({ ...item, unitPrice: e.target.value })} />
                <button disabled={busy || !item.description.trim() || item.unitPrice === ""}
                  onClick={() => { const a = askReason(closed); if (a.ok) run(() => ipdBilling.addItem(inwardId, { ...item, qty: Number(item.qty || 1), unitPrice: Number(item.unitPrice), reason: a.reason }), "Charge added", () => setItem({ ...item, description: "", qty: "1", unitPrice: "" })); }}
                  className="col-span-1 flex items-center justify-center rounded-lg bg-teal-600 text-white disabled:opacity-50"><Plus className="w-4 h-4" /></button>
              </div>
            </div>

            {Number(bill.pharmacyTotal) > 0 && (
              <div className="border rounded-xl p-3 flex items-center justify-between text-sm">
                <span className="font-medium">Pharmacy (GST included)</span>
                <span className="font-semibold">{inr(bill.pharmacyTotal)}</span>
              </div>
            )}

              {/* Discount & tax */}
            <div className="border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-sm"><span>Subtotal</span><span>{inr(bill.subtotal)}</span></div>
              <div>
                <label className="text-[11px] text-gray-500">Discount</label>
                <div className="flex items-center gap-2">
                  <input className={inp} inputMode="decimal" value={disc} onChange={(e) => setDisc(e.target.value)} />
                  <div className="flex shrink-0 rounded-lg border overflow-hidden text-sm">
                    <button type="button" onClick={() => setDiscType("amount")} className={"px-3 py-1.5 " + (discType === "amount" ? "bg-teal-600 text-white" : "bg-white hover:bg-gray-50")}>{"\u20B9"}</button>
                    <button type="button" onClick={() => setDiscType("percent")} className={"px-3 py-1.5 border-l " + (discType === "percent" ? "bg-teal-600 text-white" : "bg-white hover:bg-gray-50")}>%</button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[11px] text-gray-500">CGST (%)</label>
                  <input className={inp} inputMode="decimal" value={cgst} onChange={(e) => setCgst(e.target.value)} /></div>
                <div><label className="text-[11px] text-gray-500">SGST (%)</label>
                  <input className={inp} inputMode="decimal" value={sgst} onChange={(e) => setSgst(e.target.value)} /></div>
              </div>
              {live && (
                <div className="text-sm space-y-0.5 border-t pt-2">
                  {live.discount > 0 && <div className="flex justify-between"><span>Discount{shownDiscType === "percent" ? " (" + shownDiscValue + "%)" : ""}</span><span>-{inr(live.discount)}</span></div>}
                  {(shownCgstRate > 0 || shownSgstRate > 0) && <div className="flex justify-between"><span>Amount after discount</span><span>{inr(live.taxable)}</span></div>}
                  {shownCgstRate > 0 && <div className="flex justify-between"><span>CGST ({shownCgstRate}%)</span><span>{inr(live.cgst)}</span></div>}
                  {shownSgstRate > 0 && <div className="flex justify-between"><span>SGST ({shownSgstRate}%)</span><span>{inr(live.sgst)}</span></div>}
                  <div className="flex justify-between font-semibold"><span>Final total</span><span>{inr(live.total)}</span></div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-amber-600">{dirty ? "Preview only - press Save to apply" : ""}</p>
                <button disabled={busy || !dirty} onClick={saveAdjustments} className="px-3 py-1.5 rounded-lg text-sm border hover:bg-gray-50 disabled:opacity-50">Save</button>
              </div>
            </div>

            {/* Payments */}
            <div className="border rounded-xl p-3 space-y-2">
              <p className="font-medium text-sm">Payments</p>
              <p className="text-xs text-gray-500">Remaining balance = Final total {inr(liveTotal)} - Paid {inr(bill.paid)} = <span className={"font-semibold " + (liveBalance > 0 ? "text-red-600" : "text-teal-700")}>{inr(Math.abs(liveBalance))}{liveBalance < 0 ? " (refund due)" : ""}</span></p>
              {bill.payments.length === 0 && <p className="text-xs text-gray-400">No payments yet.</p>}
              {bill.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-t pt-1.5 first:border-0 first:pt-0">
                  <div className="min-w-0">
                    <p className="capitalize">{p.kind} · {p.mode}{p.note ? " · " + p.note : ""}</p>
                    <p className="text-[11px] text-gray-500">{fmt(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={"font-medium " + (p.kind === "refund" ? "text-red-600" : "text-green-700")}>{p.kind === "refund" ? "-" : ""}{inr(p.amount)}</span>
                    {isAdmin && <button disabled={busy} onClick={() => { if (!confirm("Remove this payment entry?")) return; const a = askReason(true); if (a.ok) run(() => ipdBilling.removePayment(inwardId, p.id, a.reason), "Payment removed"); }}
                      className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-6 gap-2 pt-2 border-t">
                <select className={inp + " col-span-3"} value={pay.kind} onChange={(e) => setPay({ ...pay, kind: e.target.value })}>
                  <option value="advance">Advance</option><option value="payment">Payment</option><option value="refund">Refund</option>
                </select>
                <select className={inp + " col-span-3"} value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>
                  {MODES.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
                {payAmt > 0 && <p className="col-span-6 text-xs text-teal-700">After this {pay.kind}, remaining balance will be {inr(Math.abs(afterPay))}{afterPay < 0 ? " (refund due)" : ""}</p>}
                <input className={inp + " col-span-2"} inputMode="decimal" placeholder="Amount (₹)" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                <input className={inp + " col-span-3"} placeholder="Note (optional)" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
                <button disabled={busy || !(Number(pay.amount) > 0)}
                  onClick={() => { const a = askReason(closed && pay.kind === "refund"); if (a.ok) run(() => ipdBilling.addPayment(inwardId, { ...pay, amount: Number(pay.amount), reason: a.reason }), "Payment recorded", () => setPay({ ...pay, amount: "", note: "" })); }}
                  className="col-span-1 flex items-center justify-center rounded-lg bg-teal-600 text-white disabled:opacity-50"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
