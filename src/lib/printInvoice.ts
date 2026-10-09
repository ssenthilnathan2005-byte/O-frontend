export type InvoiceData = {
  invoiceNo?: string; billNo?: number | null; hospitalName: string; patientId: string; patientName: string; doctorName: string; issuedAt: string | null;
  paymentMode: string | null; lines: { name: string; tablets: number; unitPrice: number; amount: number }[]; total: number | null; status: string;
};
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);
const inr = (n: number | null | undefined) => "\u20b9" + (Number(n) || 0).toFixed(2);

export function printInvoice(inv: InvoiceData): boolean {
  const w = window.open("", "_blank", "width=760,height=900");
  if (!w) return false;
  const rows = inv.lines.map(l =>
    `<tr><td>${esc(l.name)}</td><td class="r">${esc(l.tablets)}</td><td class="r">${inr(l.unitPrice)}</td><td class="r">${inr(l.amount)}</td></tr>`).join("");
  const when = inv.issuedAt ? new Date(inv.issuedAt).toLocaleString() : "";
  const billLabel = inv.billNo != null ? String(inv.billNo) : "-";
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Bill No ${esc(billLabel)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:28px;max-width:680px}
h1{font-size:20px;margin:0}.muted{color:#666;font-size:12px}.billno{font-size:20px;font-weight:bold;margin:10px 0 2px}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px}
th{text-align:left;border-bottom:2px solid #111;padding:6px 4px;font-size:12px}
td{border-bottom:1px solid #ddd;padding:6px 4px}.r{text-align:right}
.total{display:flex;justify-content:space-between;font-size:16px;font-weight:bold;border-top:2px solid #111;margin-top:10px;padding-top:8px}
</style></head><body>
<h1>${esc(inv.hospitalName)} - Pharmacy Invoice</h1>
<p class="billno">Bill No: ${esc(billLabel)}</p>
<p class="muted">${esc(when)}</p>
<p>Patient: <b>${esc(inv.patientName)}</b><br>Prescribed by: Dr. ${esc(inv.doctorName)}</p>
<table><thead><tr><th>Medicine</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="total"><span>Amount payable (${esc(inv.paymentMode || "cash")})</span><span>${inr(inv.total)}</span></div>
<p class="muted">Only the quantity purchased is billed. Thank you.</p>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}