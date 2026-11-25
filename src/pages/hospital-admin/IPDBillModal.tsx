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
const chip = (on: boolean) => "px-2.5 py-1 rounded-full text-xs border " + (on ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-700 hover:bg-gray-50");

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
  const [showGst, setShowGst] = useState(false);
  const [rateEdit, setRateEdit] = useState(false);
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

  const gstOpen = showGst || cgstNum > 0 || sgstNum > 0;
  const lineTotal = round2((Number(item.qty) || 0) * (Number(item.unitPrice) || 0));
  const paidSoFar = Number(bill?.paid || 0);
  const payStatus = liveBalance < 0
    ? { label: "Refund due", box: "bg-amber-50", text: "text-amber-700" }
    : liveBalance === 0 && liveTotal > 0
      ? { label: "Fully paid", box: "bg-teal-50", text: "text-teal-700" }
      : paidSoFar > 0
        ? { label: "Balance (part paid)", box: "bg-amber-50", text: "text-amber-700" }
        : { label: "Balance (unpaid)", box: "bg-red-50", text: "text-red-600" };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h2 className="font-semibold text-gray-900">IPD Bill{bill ? " · " + bill.patientName : ""}</h2>
            {bill && <p className="text-xs text-gray-500">{bill.ward || "-"}{bill.bedNumber ? " / Bed " + bill.bedNumber : ""} · Admitted {fmt(bill.admittedAt)}{bill.dischargedAt ? " · Discharged " + fmt(bill.dischargedAt) : ""}</p>}
          </div>
          <div className="flex items-center gap-1">
            {bill && <button onClick={() => printIpdInvoice(bill)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border hover:bg-gray-50"><Printer className="w-3.5 h-3.5" />{bill.status === "discharged" ? "Invoice" : "Print bill"}</button>}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
        </div>
        {bill && (
          <div className="grid grid-cols-3 gap-2 text-center px-4 pb-3">
            <div className="rounded-lg bg-gray-50 p-2"><p className="text-[11px] text-gray-500">Final total</p><p className="font-semibold">{inr(liveTotal)}</p></div>
            <div className="rounded-lg bg-green-50 p-2"><p className="text-[11px] text-green-700">Paid</p><p className="font-semibold text-green-700">{inr(bill.paid)}</p></div>
            <div className={"rounded-lg p-2 " + payStatus.box}><p className={"text-[11px] " + payStatus.text}>{payStatus.label}</p><p className={"font-semibold " + payStatus.text}>{inr(Math.abs(liveBalance))}</p></div>
          </div>
        )}
        </div>

        {err && <p className="p-4 text-sm text-red-600">{err}</p>}
        {!bill && !err && <p className="p-6 text-sm text-gray-400 text-center">Loading...</p>}

        {bill && (
          <div className="p-4 space-y-4">
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

            {/* 1. Charges */}
            <div className="border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">1. Charges</p>
                <p className="text-xs text-gray-500">Subtotal <span className="font-semibold text-gray-800">{inr(bill.subtotal)}</span></p>
              </div>

              <div className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p>Bed charge</p>
                  {bill.segments && bill.segments.length > 1 ? (
                    <div className="text-[11px] text-gray-500">
                      {bill.segments.map((sg: any, i: number) => (
                        <p key={i}>{sg.ward}: {sg.days} day{sg.days === 1 ? "" : "s"} &times; {inr(sg.rate)} = {inr(sg.amount)}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500">{bill.days} day{bill.days === 1 ? "" : "s"} &times; {inr(bill.bedRate)} per day (calendar days)</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium">{inr(bill.bedCharge)}</span>
                  <button type="button" onClick={() => setRateEdit(!rateEdit)} className="text-xs text-teal-700 hover:underline">{rateEdit ? "Cancel" : "Edit rate"}</button>
                </div>
              </div>
              {rateEdit && (
                <div className="flex items-end gap-2 bg-gray-50 rounded-lg p-2">
                  <div className="flex-1"><label className="text-[11px] text-gray-500">Bed rate per day ({"\u20B9"}){bill.segments && bill.segments.length > 1 ? " - current ward" : ""}</label>
                    <input className={inp} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
                  <button disabled={busy} onClick={() => { const a = askReason(closed); if (a.ok) run(() => ipdBilling.settings(inwardId, { bedRate: Number(rate), reason: a.reason }), "Bed rate updated", () => setRateEdit(false)); }}
                    className="px-3 py-1.5 rounded-lg text-sm bg-teal-600 text-white disabled:opacity-50">Save</button>
                </div>
              )}

              {bill.items.length === 0 && <p className="text-xs text-gray-400 border-t pt-2">No extra charges yet.</p>}
              {bill.items.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-sm border-t pt-1.5">
                  <div className="min-w-0">
                    <p className="truncate">{i.description}</p>
                    <p className="text-[11px] text-gray-500 capitalize">{i.category.replace("_", " ")} &middot; {i.qty} &times; {inr(i.unit_price)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium">{inr(i.amount)}</span>
                    <button disabled={busy} onClick={() => { if (!confirm("Remove this charge?")) return; const a = askReason(closed); if (a.ok) run(() => ipdBilling.removeItem(inwardId, i.id, a.reason), "Charge removed"); }}
                      className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                </div>
              ))}

              {Number(bill.pharmacyTotal) > 0 && (
                <div className="flex items-center justify-between text-sm border-t pt-1.5">
                  <span>Pharmacy (GST included)</span>
                  <span className="font-medium">{inr(bill.pharmacyTotal)}</span>
                </div>
              )}

              <div className="pt-2 border-t space-y-2">
                <p className="text-[11px] text-gray-500">Add a charge</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATS.map(([k, l]) => <button key={k} type="button" onClick={() => setItem({ ...item, category: k })} className={chip(item.category === k)}>{l}</button>)}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  <input className={inp + " col-span-6 sm:col-span-3"} placeholder="Description" value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} />
                  <input className={inp + " col-span-2 sm:col-span-1"} inputMode="decimal" placeholder="Qty" value={item.qty} onChange={(e) => setItem({ ...item, qty: e.target.value })} />
                  <input className={inp + " col-span-4 sm:col-span-2"} inputMode="decimal" placeholder={"Price (\u20B9)"} value={item.unitPrice} onChange={(e) => setItem({ ...item, unitPrice: e.target.value })} />
                </div>
                <button disabled={busy || !item.description.trim() || item.unitPrice === ""}
                  onClick={() => { const a = askReason(closed); if (a.ok) run(() => ipdBilling.addItem(inwardId, { ...item, qty: Number(item.qty || 1), unitPrice: Number(item.unitPrice), reason: a.reason }), "Charge added", () => setItem({ ...item, description: "", qty: "1", unitPrice: "" })); }}
                  className="w-full flex items-center justify-center gap-1 rounded-lg bg-teal-600 text-white text-sm py-2 disabled:opacity-50"><Plus className="w-4 h-4" />Add charge{lineTotal > 0 ? " - " + inr(lineTotal) : ""}</button>
              </div>
            </div>

            {/* 2. Discount and GST */}
            <div className="border rounded-xl p-3 space-y-2">
              <p className="font-medium text-sm">2. Discount &amp; GST</p>
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
              {!gstOpen ? (
                <button type="button" onClick={() => setShowGst(true)} className="text-xs text-teal-700 hover:underline">+ Add GST</button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[11px] text-gray-500">CGST (%)</label>
                    <input className={inp} inputMode="decimal" value={cgst} onChange={(e) => setCgst(e.target.value)} /></div>
                  <div><label className="text-[11px] text-gray-500">SGST (%)</label>
                    <input className={inp} inputMode="decimal" value={sgst} onChange={(e) => setSgst(e.target.value)} /></div>
                </div>
              )}
              {live && (
                <div className="text-sm space-y-0.5 border-t pt-2">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{inr(bill.subtotal)}</span></div>
                  {live.discount > 0 && <div className="flex justify-between text-gray-600"><span>Discount{shownDiscType === "percent" ? " (" + shownDiscValue + "%)" : ""}</span><span>-{inr(live.discount)}</span></div>}
                  {(shownCgstRate > 0 || shownSgstRate > 0) && <div className="flex justify-between text-gray-600"><span>Amount after discount</span><span>{inr(live.taxable)}</span></div>}
                  {shownCgstRate > 0 && <div className="flex justify-between text-gray-600"><span>CGST ({shownCgstRate}%)</span><span>{inr(live.cgst)}</span></div>}
                  {shownSgstRate > 0 && <div className="flex justify-between text-gray-600"><span>SGST ({shownSgstRate}%)</span><span>{inr(live.sgst)}</span></div>}
                  {Number(bill.pharmacyTotal) > 0 && <div className="flex justify-between text-gray-600"><span>Pharmacy (GST included)</span><span>{inr(bill.pharmacyTotal)}</span></div>}
                  <div className="flex justify-between font-semibold text-base border-t pt-1 mt-1"><span>Final total</span><span>{inr(live.total)}</span></div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-amber-600">{dirty ? "Preview only - press Save to apply" : ""}</p>
                <button disabled={busy || !dirty} onClick={saveAdjustments} className="px-4 py-1.5 rounded-lg text-sm bg-teal-600 text-white disabled:bg-gray-100 disabled:text-gray-400">{dirty ? "Save changes" : "Saved"}</button>
              </div>
            </div>

            {/* 3. Payments */}
            <div className="border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">3. Payments</p>
                <p className="text-xs text-gray-500">Paid {inr(bill.paid)} of {inr(liveTotal)}</p>
              </div>
              {bill.payments.length === 0 && <p className="text-xs text-gray-400">No payments yet.</p>}
              {bill.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-t pt-1.5 first:border-0 first:pt-0">
                  <div className="min-w-0">
                    <p className="capitalize">{p.kind} &middot; {p.mode}{p.note ? " \u00b7 " + p.note : ""}</p>
                    <p className="text-[11px] text-gray-500">{fmt(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={"font-medium " + (p.kind === "refund" ? "text-red-600" : "text-green-700")}>{p.kind === "refund" ? "-" : ""}{inr(p.amount)}</span>
                    {isAdmin && <button disabled={busy} onClick={() => { if (!confirm("Remove this payment entry?")) return; const a = askReason(true); if (a.ok) run(() => ipdBilling.removePayment(inwardId, p.id, a.reason), "Payment removed"); }}
                      className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t space-y-2">
                <p className="text-[11px] text-gray-500">Record a payment</p>
                <div className="flex flex-wrap gap-1.5">
                  {[["advance", "Advance"], ["payment", "Payment"], ["refund", "Refund"]].map(([k, l]) => <button key={k} type="button" onClick={() => setPay({ ...pay, kind: k })} className={chip(pay.kind === k)}>{l}</button>)}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MODES.map((m) => <button key={m} type="button" onClick={() => setPay({ ...pay, mode: m })} className={chip(pay.mode === m)}>{m.toUpperCase()}</button>)}
                </div>
                <div className="flex items-center gap-2">
                  <input className={inp} inputMode="decimal" placeholder={"Amount (\u20B9)"} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                  <button type="button" disabled={liveBalance === 0}
                    onClick={() => liveBalance < 0 ? setPay({ ...pay, kind: "refund", amount: String(Math.abs(liveBalance)) }) : setPay({ ...pay, kind: pay.kind === "refund" ? "payment" : pay.kind, amount: String(liveBalance) })}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs border text-teal-700 hover:bg-teal-50 disabled:opacity-40">Full balance</button>
                </div>
                <input className={inp} placeholder="Note (optional)" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
                {payAmt > 0 && <p className="text-xs text-teal-700">After this {pay.kind}, balance will be {inr(Math.abs(afterPay))}{afterPay < 0 ? " (refund due)" : ""}</p>}
                <button disabled={busy || !(Number(pay.amount) > 0)}
                  onClick={() => { const a = askReason(closed && pay.kind === "refund"); if (a.ok) run(() => ipdBilling.addPayment(inwardId, { ...pay, amount: Number(pay.amount), reason: a.reason }), "Payment recorded", () => setPay({ ...pay, amount: "", note: "" })); }}
                  className="w-full flex items-center justify-center gap-1 rounded-lg bg-teal-600 text-white text-sm py-2 disabled:opacity-50"><Plus className="w-4 h-4" />{pay.kind === "refund" ? "Record refund" : pay.kind === "advance" ? "Record advance" : "Record payment"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
