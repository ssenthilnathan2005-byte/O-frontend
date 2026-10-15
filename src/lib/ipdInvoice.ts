import { Capacitor } from "@capacitor/core";
import { downloadFile } from "./downloadFile";

const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const inr = (n: number) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");

export function ipdInvoiceHtml(b: any): string {
  const final = b.status === "discharged";
  const itemRows = (b.items || []).map((i: any) =>
    `<tr><td>${esc(i.description)}<div class="s">${esc(String(i.category).replace("_", " "))}</div></td><td class="r">${esc(i.qty)}</td><td class="r">${inr(i.unit_price)}</td><td class="r">${inr(i.amount)}</td></tr>`).join("");
  const payRows = (b.payments || []).map((p: any) =>
    `<tr><td>${esc(p.kind)} (${esc(String(p.mode).toUpperCase())})${p.note ? " - " + esc(p.note) : ""}<div class="s">${esc(dt(p.created_at))}</div></td><td class="r" colspan="3">${p.kind === "refund" ? "-" : ""}${inr(p.amount)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(final ? "Invoice " + (b.invoiceNo || "") : "Provisional bill")}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:13px}
h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px}
.top{display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:10px}
.s{font-size:11px;color:#666}.r{text-align:right}
table{width:100%;border-collapse:collapse}td,th{padding:6px 4px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
th.r{text-align:right}.tot td{border:0;padding:3px 4px}.big td{font-weight:bold;font-size:15px;border-top:2px solid #111}
.tag{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;background:${final ? "#ccfbf1" : "#fef3c7"}}
@media print{body{margin:10mm}}
</style></head><body>
<div class="top"><div><h1>${esc(b.hospitalName || "Hospital")}</h1><div class="s">${esc(b.hospitalAddress || "")}${b.hospitalPhone ? " | " + esc(b.hospitalPhone) : ""}</div></div>
<div class="r"><b>${final ? "IPD INVOICE" : "PROVISIONAL BILL"}</b><div class="s">${final ? "No. " + esc(b.invoiceNo || "-") : "Stay not yet discharged"}</div><span class="tag">${final ? "Final" : "Running"}</span></div></div>
<h2>Patient</h2>
<table><tr><td><b>${esc(b.patientName)}</b>${b.phone ? "<div class='s'>" + esc(b.phone) + "</div>" : ""}</td>
<td>Ward: ${esc(b.ward || "-")}<br>Bed: ${esc(b.bedNumber || "-")}</td>
<td>Doctor: ${esc(b.doctor || "-")}<br>Admitted: ${esc(dt(b.admittedAt))}<br>${b.dischargedAt ? "Discharged: " + esc(dt(b.dischargedAt)) : ""}</td></tr></table>
<h2>Charges</h2>
<table><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>
<tr><td>Bed charge (${esc(b.ward || "Ward")})<div class="s">${esc(b.days)} day(s), calendar days</div></td><td class="r">${esc(b.days)}</td><td class="r">${inr(b.bedRate)}</td><td class="r">${inr(b.bedCharge)}</td></tr>
${itemRows}</table>
<table class="tot" style="margin-top:8px"><tr><td class="r">Subtotal</td><td class="r" style="width:130px">${inr(b.subtotal)}</td></tr>
${b.discount > 0 ? `<tr><td class="r">Discount</td><td class="r">-${inr(b.discount)}</td></tr>` : ""}
<tr class="big"><td class="r">Total</td><td class="r">${inr(b.total)}</td></tr></table>
<h2>Payments</h2>
<table>${payRows || "<tr><td class='s'>No payments recorded.</td></tr>"}</table>
<table class="tot" style="margin-top:8px"><tr><td class="r">Paid</td><td class="r" style="width:130px">${inr(b.paid)}</td></tr>
<tr class="big"><td class="r">${b.balance < 0 ? "Refund due" : "Balance due"}</td><td class="r">${inr(Math.abs(b.balance))}</td></tr></table>
<p class="s" style="margin-top:24px">This is a computer generated ${final ? "invoice" : "provisional bill"}.</p>
</body></html>`;
}

// Web: opens the invoice and the print dialog. Native app: saves/shares it as an .html file.
export async function printIpdInvoice(b: any) {
  const html = ipdInvoiceHtml(b);
  const name = `${b.status === "discharged" ? "invoice" : "bill"}_${String(b.patientName || "patient").replace(/\W+/g, "_")}.html`;
  if (Capacitor.isNativePlatform()) { await downloadFile(new Blob([html], { type: "text/html" }), name); return; }
  const w = window.open("", "_blank");
  if (!w) { await downloadFile(new Blob([html], { type: "text/html" }), name); return; }
  w.document.open(); w.document.write(html); w.document.close();
  w.focus(); setTimeout(() => w.print(), 300);
}
