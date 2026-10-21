import { useState } from "react";
import { Receipt, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { ipdBilling } from "../../api";

const rupee = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function PatientBill({ inwardId }: { inwardId: string }) {
  const [open, setOpen] = useState(false);
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function toggle() {
    const next = !open; setOpen(next);
    if (next) {
      setLoading(true);
      try { setBill(await ipdBilling.mine(inwardId)); setErr(""); }
      catch (e: any) { setErr(e.message || "Could not load the bill"); }
      finally { setLoading(false); }
    }
  }

  return (
    <div className="border-t pt-2">
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between text-sm font-medium text-teal-700">
        <span className="flex items-center gap-1.5"><Receipt className="w-4 h-4" />View bill</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && loading && <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-teal-600" /></div>}
      {open && err && <p className="text-xs text-red-600 pt-2">{err}</p>}
      {open && bill && (
        <div className="pt-2 space-y-2 text-sm">
          {bill.invoiceNo && <p className="text-xs text-gray-500">Invoice {bill.invoiceNo}</p>}
          {bill.segments && bill.segments.length > 1 ? bill.segments.map((s: any, i: number) => (
            <div key={i} className="flex justify-between"><span className="text-gray-600">Bed - {s.ward} ({s.days} day{s.days === 1 ? "" : "s"} &times; {rupee(s.rate)})</span><span>{rupee(s.amount)}</span></div>
          )) : (
            <div className="flex justify-between"><span className="text-gray-600">Bed ({bill.days} day{bill.days === 1 ? "" : "s"} × {rupee(bill.bedRate)})</span><span>{rupee(bill.bedCharge)}</span></div>
          )}
          {bill.items.map((i: any) => (
            <div key={i.id} className="flex justify-between gap-2"><span className="text-gray-600">{i.description}{i.qty !== 1 ? " × " + i.qty : ""}</span><span>{rupee(i.amount)}</span></div>
          ))}
          {bill.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount{bill.discountType === "percent" ? " (" + bill.discountValue + "%)" : ""}</span><span>-{rupee(bill.discount)}</span></div>}
          {(Number(bill.cgstRate) > 0 || Number(bill.sgstRate) > 0) && <div className="flex justify-between"><span className="text-gray-600">Amount after discount</span><span>{rupee(bill.taxable)}</span></div>}
          {Number(bill.cgstRate) > 0 && <div className="flex justify-between"><span className="text-gray-600">CGST ({bill.cgstRate}%)</span><span>{rupee(bill.cgst)}</span></div>}
          {Number(bill.sgstRate) > 0 && <div className="flex justify-between"><span className="text-gray-600">SGST ({bill.sgstRate}%)</span><span>{rupee(bill.sgst)}</span></div>}
          <div className="flex justify-between font-semibold border-t pt-1.5"><span>Total</span><span>{rupee(bill.total)}</span></div>
          <div className="flex justify-between text-green-700"><span>Paid</span><span>{rupee(bill.paid)}</span></div>
          <div className={"flex justify-between font-bold " + (bill.balance > 0 ? "text-red-600" : "text-teal-700")}>
            <span>{bill.balance < 0 ? "Refund due" : "Remaining balance"}</span><span>{rupee(Math.abs(bill.balance))}</span>
          </div>
          {bill.status === "admitted" && <p className="text-[11px] text-gray-400">Running bill. The final amount is fixed at discharge.</p>}
        </div>
      )}
    </div>
  );
}
