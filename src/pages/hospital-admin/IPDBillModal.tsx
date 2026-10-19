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
  const closed = bill?.status === "discharged";

  const load = useCallback(async () => {
    try {
      const b = await ipdBilling.get(inwardId);
      setBill(b); setRate(String(b.bedRate)); setDisc(String(b.discount)); setErr("");
    } catch (e: any) { setErr(e.message || "Could not load bill"); }
  }, [inwardId]);
  useEffect(() => { load(); }, [load]);

  // Changing a closed (discharged) bill needs a reason; the server logs it. Removing a payment always needs one.
  function askReason(need: boolean): { ok: boolean; reason?: string } {
    if (!need) return { ok: true };
    const r = (window.prompt("Reason for this change (required, will be logged):") || "").trim();
    if (r.length < 3) { toast.error("A reason is required for this change"); return { ok: false }; }
    return { ok: true, reason: r };
  }

  async function run(fn: () => Promise<any>, ok: string, after?: () => void) {
    setBusy(true);
    try { const b = await fn(); toast.success(ok); if (b) { setBill(b); setRate(String(b.bedRate)); setDisc(String(b.discount)); } after?.(); }
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
              <div className="rounded-lg bg-gray-50 p-2"><p className="text-[11px] text-gray-500">Total</p><p className="font-semibold">{inr(bill.total)}</p></div>
              <div className="rounded-lg bg-green-50 p-2"><p className="text-[11px] text-green-700">Paid</p><p className="font-semibold text-green-700">{inr(bill.paid)}</p></div>
              <div className={"rounded-lg p-2 " + (bill.balance > 0 ? "bg-red-50" : "bg-teal-50")}>
                <p className={"text-[11px] " + (bill.balance > 0 ? "text-red-600" : "text-teal-700")}>{bill.balance < 0 ? "Refund due" : "Balance due"}</p>
                <p className={"font-semibold " + (bill.balance > 0 ? "text-red-600" : "text-teal-700")}>{inr(Math.abs(bill.balance))}</p>
              </div>
            </div>

            {/* Bed charge */}
            <div className="border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Bed charge</span>
                <span className="font-semibold">{inr(bill.bedCharge)}</span>
              </div>
              <p className="text-xs text-gray-500">{bill.days} day{bill.days === 1 ? "" : "s"} × {inr(bill.bedRate)} per day (calendar days)</p>
              <div className="flex items-end gap-2">
                <div className="flex-1"><label className="text-[11px] text-gray-500">Bed rate per day (₹)</label>
                  <input className={inp} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
                <button disabled={busy} onClick={() => { const a = askReason(closed); if (a.ok) run(() => ipdBilling.settings(inwardId, { bedRate: Number(rate), reason: a.reason }), "Bed rate updated"); }}
                  className="px-3 py-1.5 rounded-lg text-sm border hover:bg-gray-50 disabled:opacity-50">Save</button>
              </div>
            </div>

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

            {/* Discount */}
            <div className="border rounded-xl p-3">
              <div className="flex items-center justify-between text-sm mb-1"><span>Subtotal</span><span>{inr(bill.subtotal)}</span></div>
              <div className="flex items-end gap-2">
                <div className="flex-1"><label className="text-[11px] text-gray-500">Discount (₹)</label>
                  <input className={inp} inputMode="decimal" value={disc} onChange={(e) => setDisc(e.target.value)} /></div>
                <button disabled={busy} onClick={() => { const a = askReason(closed); if (a.ok) run(() => ipdBilling.settings(inwardId, { discount: Number(disc || 0), reason: a.reason }), "Discount saved"); }}
                  className="px-3 py-1.5 rounded-lg text-sm border hover:bg-gray-50 disabled:opacity-50">Save</button>
              </div>
            </div>

            {/* Payments */}
            <div className="border rounded-xl p-3 space-y-2">
              <p className="font-medium text-sm">Payments</p>
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
