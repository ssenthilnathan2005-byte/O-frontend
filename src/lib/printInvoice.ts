export type InvoiceData = {
  invoiceNo?: string; billNo?: number | null; hospitalName: string; patientId: string; patientName: string; doctorName: string; issuedAt: string | null;
  paymentMode: string | null; lines: { name: string; tablets: number; unitPrice: number; amount: number; note?: string }[]; total: number | null; status: string;
};
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);
const inr = (n: number | null | undefined) => "\u20b9" + (Number(n) || 0).toFixed(2);

const packMl = (name: string): number => {
  if (!/bottle|vial|syrup|tonic|suspension|elixir|drops|liquid/i.test(name || "")) return 1;
  const m = /(\d+(?:\.\d+)?)\s*ml\b/i.exec(name || "");
  return m ? (Number(m[1]) || 1) : 1;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

const SLOTS = ["Morning", "Afternoon", "Evening", "Night"];
function intakeHtml(note: string | undefined): string {
  if (!note) return "";
  const parts = note.split(/\s*(?:\u00b7|,|;|\|)\s*/).map(s => s.trim()).filter(Boolean);
  const slots = new Set<string>();
  let food = "", duration = "";
  const dose: string[] = [];
  for (const part of parts) {
    const slot = SLOTS.find(s => s.toLowerCase() === part.toLowerCase());
    if (slot) { slots.add(slot); continue; }
    if (/(before|after|with|without)\s+(food|meals?)|empty stomach/i.test(part)) { food = part; continue; }
    if (/^\d+(\.\d+)?\s*(day|week|month)s?$/i.test(part)) { duration = part; continue; }
    dose.push(part);
  }
  const head = SLOTS.map(s => `<th class="c">${s}</th>`).join("");
  const body = SLOTS.map(s => slots.has(s) ? '<td class="c"><b>\u2713</b></td>' : '<td class="c"><span class="off">\u2013</span></td>').join("");
  return `<table class="ik"><colgroup><col style="width:17%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:21%"><col style="width:18%"></colgroup><tr><th class="l">Dose</th>${head}<th class="l">Food</th><th class="l">Duration</th></tr><tr><td class="l">${esc(dose.join(" ") || "-")}</td>${body}<td class="l">${esc(food || "-")}</td><td class="l">${esc(duration || "-")}</td></tr></table>`;
}

export function printInvoice(inv: InvoiceData): boolean {
  const w = window.open("", "_blank", "width=760,height=900");
  if (!w) return false;
  const rows = inv.lines.map(l => {
      const pk = packMl(l.name);
      const qty = pk > 1 ? r2(l.tablets / pk) + " bottle(s)" : String(l.tablets);
      const price = pk > 1 ? inr(l.unitPrice * pk) + " / bottle" : inr(l.unitPrice);
      const detail = intakeHtml(l.note);
      const cls = detail ? ' class="m"' : "";
      return `<tr${cls}><td>${esc(l.name)}</td><td class="r">${esc(qty)}</td><td class="r">${price}</td><td class="r">${inr(l.amount)}</td></tr>` + (detail ? `<tr class="d"><td colspan="4">${detail}</td></tr>` : "");
    }).join("");
  const when = inv.issuedAt ? new Date(inv.issuedAt).toLocaleString() : "";
  const billLabel = inv.billNo != null ? String(inv.billNo) : "-";
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Bill No ${esc(billLabel)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:28px;max-width:680px}
h1{font-size:20px;margin:0}.muted{color:#666;font-size:12px}.billno{font-size:20px;font-weight:bold;margin:10px 0 2px}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px}
th{text-align:left;border-bottom:2px solid #111;padding:6px 4px;font-size:12px}
td{border-bottom:1px solid #ddd;padding:6px 4px}.r{text-align:right}.note{color:#555;font-size:12px;margin-top:2px}
tr.m td{border-bottom:none;padding-bottom:2px}
tr.d td{padding:0 0 8px 0}
table.ik{width:100%;margin:0;table-layout:fixed;border-collapse:collapse;font-size:12px;border:1px solid #bbb}
table.ik th{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#444;background:#f1f1f1;border:1px solid #ccc;padding:3px 6px;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table.ik td{border:1px solid #ccc;padding:4px 6px;text-align:center}
table.ik .l{text-align:left}
table.ik .off{color:#aaa}
table.ik b{font-size:14px}
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