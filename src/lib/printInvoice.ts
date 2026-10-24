export type InvoiceData = {
  subtotal?: number | null; discountPct?: number; discountAmount?: number; cgstPct?: number; sgstPct?: number; cgstAmount?: number; sgstAmount?: number; invoiceNo?: string; gstType?: string; taxInvoiceNo?: string | null; seller?: { name: string; address: string; gstin: string; drugLicence: string }; billNo?: number | null; hospitalName: string; patientId: string; patientName: string; doctorName: string; issuedAt: string | null;
  paymentMode: string | null; lines: { name: string; tablets: number; unitPrice: number; amount: number; note?: string; manual?: boolean; hsn?: string | null; gstPercent?: number | null; adjustment?: boolean }[]; total: number | null; status: string;
};
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);
const inr = (n: number | null | undefined) => "\u20b9" + (Number(n) || 0).toFixed(2);

const packMl = (name: string): number => {
  if (!/bottle|vial|syrup|tonic|suspension|elixir|drops|liquid|\b(ointment|cream|gel|lotion)\b/i.test(name || "")) return 1;
  const m = /(\d+(?:\.\d+)?)\s*(?:ml|gm|g)\b/i.exec(name || "");
  return m ? (Number(m[1]) || 1) : 1;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const packWordOf = (name: string): string => /\b(ointment|cream|gel|lotion)\b/i.test(name || "") ? "tube" : /\b(vial|injection)\b/i.test(name || "") ? "vial" : "bottle";

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

export function invoiceSummary(inv: Partial<InvoiceData>): { label: string; amount: string }[] {
  const out: { label: string; amount: string }[] = [];
  const disc = Number(inv.discountPct) || 0;
  const cg = Number(inv.cgstPct) || 0, sg = Number(inv.sgstPct) || 0;
  if (!(disc > 0 || cg > 0 || sg > 0)) return out;
  out.push({ label: "Subtotal", amount: inr(inv.subtotal) });
  if (disc > 0) out.push({ label: "Discount (" + disc + "%)", amount: "-" + inr(inv.discountAmount) });
  if (cg > 0) out.push({ label: "CGST (" + cg + "%)", amount: inr(inv.cgstAmount) });
  if (sg > 0) out.push({ label: "SGST (" + sg + "%)", amount: inr(inv.sgstAmount) });
  return out;
}

const STATES: Record<string, string> = { "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh" };
const placeOf = (g: string) => { const c = String(g || "").trim().slice(0, 2); return STATES[c] ? STATES[c] + " (" + c + ")" : "-"; };
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const qtyOf = (l: { name: string; tablets: number; manual?: boolean }) => { const pk = l.manual ? 1 : packMl(l.name); return pk > 1 ? r2(l.tablets / pk) + " " + packWordOf(l.name) + "(s)" : String(l.tablets); };

// Red notice on a normal bill when it cannot be issued as a tax invoice yet.
function taxWarn(inv: InvoiceData): string {
  if (inv.gstType !== "registered" || inv.taxInvoiceNo || inv.status !== "Billed") return "";
  if ((Number(inv.cgstPct) || 0) + (Number(inv.sgstPct) || 0) > 0) return "";
  const bad = inv.lines.filter(l => !l.adjustment && (!l.hsn || l.gstPercent == null)).map(l => l.name);
  const msg = !(inv.seller && inv.seller.gstin) ? "GSTIN is not saved (GST Invoice page > Pharmacy details)" : bad.length ? "HSN code / GST % missing for: " + bad.join(", ") + ". Add them in Pharmacy > Inventory Management" : "";
  return msg ? '<p style="color:#b91c1c;font-size:12px;font-weight:bold">Not a tax invoice - ' + esc(msg) + ", then print again.</p>" : "";
}

function taxView(inv: InvoiceData) {
  if (inv.gstType !== "registered" || !inv.taxInvoiceNo) return null;
  if ((Number(inv.cgstPct) || 0) + (Number(inv.sgstPct) || 0) > 0) return null;
  const sum = inv.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const total = Number(inv.total) || 0;
  const k = sum > 0 ? total / sum : 1;
  const lines = inv.lines.map(l => {
    const rate = l.adjustment ? 0 : Number(l.gstPercent) || 0;
    const gross = r2((Number(l.amount) || 0) * k);
    const gst = gross * rate / (100 + rate);
    const cg = r2(gst / 2), sg = r2(gst / 2);
    return { ...l, rate, gross, cg, sg, taxable: r2(gross - cg - sg) };
  });
  const sumOf = (f: (x: typeof lines[number]) => number) => r2(lines.reduce((s, x) => s + f(x), 0));
  const grossSum = sumOf(x => x.gross);
  const hsn: Record<string, { hsn: string; rate: number; taxable: number; cg: number; sg: number; gross: number }> = {};
  lines.forEach(l => {
    const key = (l.hsn || "-") + "|" + l.rate;
    const e = hsn[key] || (hsn[key] = { hsn: l.hsn || "-", rate: l.rate, taxable: 0, cg: 0, sg: 0, gross: 0 });
    e.taxable += l.taxable; e.cg += l.cg; e.sg += l.sg; e.gross += l.gross;
  });
  return { lines, taxable: sumOf(x => x.taxable), cg: sumOf(x => x.cg), sg: sumOf(x => x.sg), roundOff: r2(total - grossSum), total, hsn: Object.values(hsn) };
}

function taxHtml(inv: InvoiceData, tv: NonNullable<ReturnType<typeof taxView>>): string {
  const s = inv.seller || { name: inv.hospitalName, address: "", gstin: "", drugLicence: "" };
  const date = inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString("en-IN") : "";
  const rows = tv.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td>${esc(l.hsn || "-")}</td><td class="r">${esc(qtyOf(l))}</td><td class="r">${l.rate}%</td><td class="r">${money(l.taxable)}</td><td class="r">${money(l.cg)}</td><td class="r">${money(l.sg)}</td><td class="r">${money(l.gross)}</td></tr>`).join("");
  const hsnRows = tv.hsn.map(e => `<tr><td>${esc(e.hsn)}</td><td class="r">${e.rate}%</td><td class="r">${money(e.taxable)}</td><td class="r">${money(e.cg)}</td><td class="r">${money(e.sg)}</td><td class="r">${money(e.gross)}</td></tr>`).join("");
  const dirs = tv.lines.filter(l => l.note).map(l => '<div class="dir"><b>' + esc(l.name) + "</b>" + intakeHtml(l.note) + "</div>").join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Tax Invoice ${esc(inv.taxInvoiceNo)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;max-width:720px;font-size:13px}
h1{font-size:18px;margin:0}h2{font-size:15px;margin:0;text-align:right}.muted{color:#555;font-size:12px;margin:2px 0}
.top{display:flex;justify-content:space-between;gap:12px}
table{width:100%;border-collapse:collapse;margin-top:12px}
th{text-align:left;border-bottom:2px solid #111;padding:5px 3px;font-size:11px}
td{border-bottom:1px solid #ddd;padding:5px 3px;font-size:12px}.r{text-align:right}th.r{text-align:right}
.sum{display:flex;justify-content:space-between;font-size:13px;margin-top:5px}
.total{display:flex;justify-content:space-between;font-size:16px;font-weight:bold;border-top:2px solid #111;margin-top:8px;padding-top:6px}
.dir{margin-top:8px}
table.ik{width:100%;margin:2px 0 0 0;table-layout:fixed;border-collapse:collapse;font-size:11px;border:1px solid #bbb}
table.ik th{font-size:9px;text-transform:uppercase;color:#444;background:#f1f1f1;border:1px solid #ccc;padding:3px 5px;text-align:center}
table.ik td{border:1px solid #ccc;padding:3px 5px;text-align:center}table.ik .l{text-align:left}table.ik .off{color:#aaa}
</style></head><body>
<div class="top"><div><h1>${esc(s.name || inv.hospitalName)}</h1><p class="muted">${esc(s.address)}</p><p class="muted">GSTIN: <b>${esc(s.gstin)}</b>${s.drugLicence ? " &nbsp; Drug Licence: " + esc(s.drugLicence) : ""}</p></div>
<div><h2>TAX INVOICE</h2><p class="muted" style="text-align:right">Invoice No: <b>${esc(inv.taxInvoiceNo)}</b><br>Date: ${esc(date)}<br>Bill No: ${esc(inv.billNo != null ? String(inv.billNo) : "-")}</p></div></div>
<p class="muted">Place of Supply: ${esc(placeOf(s.gstin))} &nbsp; | &nbsp; Reverse Charge: No</p>
<p style="margin:8px 0 0">Patient: <b>${esc(inv.patientName)}</b> &nbsp; Prescribed by: Dr. ${esc(inv.doctorName)}</p>
<table><thead><tr><th>#</th><th>Medicine</th><th>HSN</th><th class="r">Qty</th><th class="r">GST %</th><th class="r">Taxable</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sum"><span>Taxable value</span><span>${inr(tv.taxable)}</span></div>
<div class="sum"><span>CGST</span><span>${inr(tv.cg)}</span></div>
<div class="sum"><span>SGST</span><span>${inr(tv.sg)}</span></div>
${Math.abs(tv.roundOff) >= 0.005 ? `<div class="sum"><span>Round off / discount adjustment</span><span>${inr(tv.roundOff)}</span></div>` : ""}
<div class="total"><span>Amount payable (${esc(inv.paymentMode || "cash")})</span><span>${inr(tv.total)}</span></div>
<table><thead><tr><th>HSN</th><th class="r">GST %</th><th class="r">Taxable</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Total</th></tr></thead><tbody>${hsnRows}</tbody></table>
<p class="muted" style="margin-top:8px">Amounts are inclusive of GST. Taxable value = amount paid less GST. Only the quantity purchased is billed.</p>
${dirs}
<p style="text-align:right;margin-top:28px">For ${esc(s.name || inv.hospitalName)}<br><br><br>Authorised signatory</p>
</body></html>`;
}

export function printInvoice(inv: InvoiceData): boolean {
  const w = window.open("", "_blank", "width=760,height=900");
  if (!w) return false;
  const tv = taxView(inv);
  if (tv) { w.document.write(taxHtml(inv, tv)); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); return true; }
  const rows = inv.lines.map(l => {
      const pk = l.manual ? 1 : packMl(l.name);
      const qty = pk > 1 ? r2(l.tablets / pk) + " " + packWordOf(l.name) + "(s)" : String(l.tablets);
      const price = pk > 1 ? inr(l.unitPrice * pk) + " / " + packWordOf(l.name) : inr(l.unitPrice);
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
.sum{display:flex;justify-content:space-between;font-size:14px;margin-top:6px}
.total{display:flex;justify-content:space-between;font-size:16px;font-weight:bold;border-top:2px solid #111;margin-top:10px;padding-top:8px}
</style></head><body>
<h1>${esc(inv.hospitalName)} - Pharmacy Invoice</h1>
<p class="billno">Bill No: ${esc(billLabel)}</p>
<p class="muted">${esc(when)}</p>
${taxWarn(inv)}
<p>Patient: <b>${esc(inv.patientName)}</b><br>Prescribed by: Dr. ${esc(inv.doctorName)}</p>
<table><thead><tr><th>Medicine</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
${invoiceSummary(inv).map(r => `<div class="sum"><span>${esc(r.label)}</span><span>${r.amount}</span></div>`).join("")}<div class="total"><span>Amount payable (${esc(inv.paymentMode || "cash")})</span><span>${inr(inv.total)}</span></div>
<p class="muted">Only the quantity purchased is billed. Thank you.</p>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}


// Popup shown right after medicines are marked as given: invoice preview + Print button
export function showInvoicePopup(inv: InvoiceData, opts?: { heading?: string }): void {
  const old = document.getElementById("invoice-popup-root");
  if (old) old.remove();
  const rows = inv.lines.map(l => {
    const pk = l.manual ? 1 : packMl(l.name);
    const qty = pk > 1 ? r2(l.tablets / pk) + " " + packWordOf(l.name) + "(s)" : String(l.tablets);
    const price = pk > 1 ? inr(l.unitPrice * pk) + " / " + packWordOf(l.name) : inr(l.unitPrice);
    return `<tr><td style="padding:6px 4px;border-bottom:1px solid #eee">${esc(l.name)}${l.note ? '<div style="font-size:11px;color:#666;margin-top:2px">' + esc(l.note) + '</div>' : ""}</td><td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right">${esc(qty)}</td><td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right">${price}</td><td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right">${inr(l.amount)}</td></tr>`;
  }).join("");
  const when = inv.issuedAt ? new Date(inv.issuedAt).toLocaleString() : "";
  const billLabel = inv.billNo != null ? String(inv.billNo) : "-";
  const root = document.createElement("div");
  root.id = "invoice-popup-root";
  root.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:12px;font-family:Arial,Helvetica,sans-serif";
  root.innerHTML = `<div style="background:#fff;color:#111;border-radius:14px;width:100%;max-width:460px;max-height:92vh;overflow:auto;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.3)">
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
<div><div style="font-size:12px;color:#0d9488;font-weight:bold">${esc(opts?.heading ?? "Marked as given")}</div>
<div style="font-size:17px;font-weight:bold">${esc(inv.hospitalName)} - Pharmacy Invoice</div></div>
<button id="inv-x" style="border:none;background:none;font-size:22px;cursor:pointer;color:#666;line-height:1">&times;</button></div>
<div style="margin-top:10px;font-size:13px;line-height:1.6">
<div><b>Bill No:</b> ${esc(billLabel)}</div>
${inv.taxInvoiceNo ? "<div><b>Tax Invoice No:</b> " + esc(inv.taxInvoiceNo) + "</div>" : ""}${taxWarn(inv)}
<div><b>Date:</b> ${esc(when)}</div>
<div><b>Patient:</b> ${esc(inv.patientName)}</div>
<div><b>Prescribed by:</b> Dr. ${esc(inv.doctorName)}</div>
<div><b>Payment:</b> ${esc((inv.paymentMode || "cash").toUpperCase())}</div></div>
<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
<thead><tr style="border-bottom:2px solid #111"><th style="text-align:left;padding:6px 4px;font-size:11px">Medicine</th><th style="text-align:right;padding:6px 4px;font-size:11px">Qty</th><th style="text-align:right;padding:6px 4px;font-size:11px">Unit price</th><th style="text-align:right;padding:6px 4px;font-size:11px">Amount</th></tr></thead>
<tbody>${rows}</tbody></table>
${invoiceSummary(inv).map(r => `<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px"><span>${esc(r.label)}</span><span>${r.amount}</span></div>`).join("")}<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;border-top:2px solid #111;margin-top:10px;padding-top:8px"><span>Total</span><span>${inr(inv.total)}</span></div>
<div style="display:flex;gap:8px;margin-top:16px">
<button id="inv-close" style="flex:1;padding:10px;border:1px solid #ddd;background:#fff;border-radius:8px;cursor:pointer;font-size:14px">Close</button>
<button id="inv-print" style="flex:2;padding:10px;border:none;background:#0d9488;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold">Print Invoice</button></div>
</div>`;
  document.body.appendChild(root);
  const close = () => root.remove();
  root.addEventListener("click", e => { if (e.target === root) close(); });
  root.querySelector("#inv-x")?.addEventListener("click", close);
  root.querySelector("#inv-close")?.addEventListener("click", close);
  root.querySelector("#inv-print")?.addEventListener("click", () => {
    if (!printInvoice(inv)) alert("Allow pop-ups to print the invoice");
  });
}
