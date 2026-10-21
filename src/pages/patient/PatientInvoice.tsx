import { useEffect, useState } from "react";
import { FileText, X, Loader2 } from "lucide-react";
import { ipdBilling } from "../../api";

const RS = "\u20B9";
const rupee = (n: number) => RS + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "-";
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "-";
const KIND: Record<string, string> = { advance: "Advance", payment: "Payment", refund: "Refund" };
const MODE: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank: "Bank", insurance: "Insurance", other: "Other" };

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #ipd-invoice, #ipd-invoice * { visibility: visible !important; }
  #ipd-invoice { position: absolute !important; left: 0; top: 0; width: 100%; padding: 0 !important; }
  .no-print { display: none !important; }
}`;

// Shows an "Invoice" button on a stay once the hospital has issued the invoice (i.e. after discharge).
// While the patient is still admitted, or if no invoice exists yet, it renders nothing.
export default function PatientInvoice({ inwardId }: { inwardId: string }) {
  const [bill, setBill] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    ipdBilling.mine(inwardId)
      .then((b) => { if (alive) setBill(b); })
      .catch(() => { /* no invoice available */ })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [inwardId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (busy) return <Loader2 className="w-4 h-4 animate-spin text-gray-300" />;
  if (!bill || !bill.invoiceNo || bill.status !== "discharged") return null;

  const items: any[] = bill.items || [];
  const payments: any[] = bill.payments || [];
  const due = Number(bill.balance || 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-teal-600 px-3 py-2 text-sm font-semibold text-teal-700 active:bg-teal-50"
      >
        <FileText className="w-4 h-4" /> View invoice
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-gray-100">
          <style>{PRINT_CSS}</style>
          <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-white px-4 py-3 shadow-sm">
            <button type="button" onClick={() => setOpen(false)} className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
              <X className="w-5 h-5" /> Close
            </button>
          </div>

          <div id="ipd-invoice" className="mx-auto my-4 max-w-2xl bg-white p-5 text-gray-900 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b pb-4">
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold leading-tight">{bill.hospitalName || "Hospital"}</h1>
                {bill.hospitalAddress && <p className="mt-0.5 text-xs text-gray-600">{bill.hospitalAddress}</p>}
                {bill.hospitalPhone && <p className="text-xs text-gray-600">Phone: {bill.hospitalPhone}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Invoice</p>
                <p className="text-sm font-bold">{bill.invoiceNo}</p>
                <p className="text-xs text-gray-600">Date: {fmtDate(bill.dischargedAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-1 border-b py-4 text-sm sm:grid-cols-2">
              <p><span className="text-gray-500">Patient: </span><span className="font-semibold">{bill.patientName || "-"}</span></p>
              {bill.phone && <p><span className="text-gray-500">Phone: </span>{bill.phone}</p>}
              <p><span className="text-gray-500">Ward / Bed: </span>{bill.ward || "-"}{bill.bedNumber ? " / " + bill.bedNumber : ""}</p>
              {bill.doctor && <p><span className="text-gray-500">Doctor: </span>Dr. {String(bill.doctor).replace(/^Dr\.?\s*/i, "")}</p>}
              <p><span className="text-gray-500">Admitted: </span>{fmtDateTime(bill.admittedAt)}</p>
              <p><span className="text-gray-500">Discharged: </span>{fmtDateTime(bill.dischargedAt)}</p>
            </div>

            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 font-semibold">Description</th>
                  <th className="py-2 text-right font-semibold">Qty x Rate</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.segments && bill.segments.length > 1 ? bill.segments.map((s: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 pr-2">Bed charge ({s.ward})</td>
                    <td className="py-2 text-right text-gray-600">{s.days} day{s.days === 1 ? "" : "s"} x {rupee(s.rate)}</td>
                    <td className="py-2 text-right">{rupee(s.amount)}</td>
                  </tr>
                )) : (
                <tr className="border-b">
                  <td className="py-2 pr-2">Bed charge ({bill.ward || "Ward"})</td>
                  <td className="py-2 text-right text-gray-600">{bill.days} day{bill.days === 1 ? "" : "s"} x {rupee(bill.bedRate)}</td>
                  <td className="py-2 text-right">{rupee(bill.bedCharge)}</td>
                </tr>
                )}
                {items.map((i) => (
                  <tr key={i.id} className="border-b">
                    <td className="py-2 pr-2">{i.description}</td>
                    <td className="py-2 text-right text-gray-600">{i.qty} x {rupee(i.unit_price)}</td>
                    <td className="py-2 text-right">{rupee(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{rupee(bill.subtotal)}</span></div>
              {Number(bill.discount) > 0 && (
                <div className="flex justify-between"><span className="text-gray-600">Discount{bill.discountType === "percent" ? " (" + bill.discountValue + "%)" : ""}</span><span>- {rupee(bill.discount)}</span></div>
              )}
              {(Number(bill.cgstRate) > 0 || Number(bill.sgstRate) > 0) && (
                <div className="flex justify-between"><span className="text-gray-600">Amount after discount</span><span>{rupee(bill.taxable)}</span></div>
              )}
              {Number(bill.cgstRate) > 0 && (
                <div className="flex justify-between"><span className="text-gray-600">CGST ({bill.cgstRate}%)</span><span>{rupee(bill.cgst)}</span></div>
              )}
              {Number(bill.sgstRate) > 0 && (
                <div className="flex justify-between"><span className="text-gray-600">SGST ({bill.sgstRate}%)</span><span>{rupee(bill.sgst)}</span></div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span>{rupee(bill.total)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Paid</span><span>{rupee(bill.paid)}</span></div>
              <div className={"flex justify-between border-t pt-1 text-base font-bold " + (due > 0 ? "text-red-600" : "text-green-700")}>
                <span>{due > 0 ? "Remaining balance" : "Paid in full"}</span>
                <span>{rupee(Math.max(due, 0))}</span>
              </div>
            </div>

            {payments.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Payments received</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="py-1.5 pr-2">{fmtDate(p.created_at)}</td>
                        <td className="py-1.5 pr-2 text-gray-600">{KIND[p.kind] || p.kind} ({MODE[p.mode] || p.mode})</td>
                        <td className="py-1.5 text-right">{p.kind === "refund" ? "- " : ""}{rupee(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-8 border-t pt-3 text-center text-[11px] text-gray-500">
              This is a computer-generated invoice issued by {bill.hospitalName || "the hospital"}.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
