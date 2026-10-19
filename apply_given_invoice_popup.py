import os, shutil, sys

DASH = os.path.join("src", "pages", "PharmacyDashboard.tsx")
INV = os.path.join("src", "lib", "printInvoice.ts")
failed = False


def load(p):
    with open(p, "r", encoding="utf-8", newline="") as f:
        raw = f.read()
    return raw.replace("\r\n", "\n"), ("\r\n" in raw)


def save(p, t, crlf):
    if crlf:
        t = t.replace("\n", "\r\n")
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(t)


def ok(m): print("  [OK]   " + m)
def skip(m): print("  [SKIP] " + m)
def fail(m):
    global failed
    print("  [FAIL] " + m)
    failed = True


for p in (DASH, INV):
    if not os.path.exists(p):
        print("Cannot find " + p + " - run this from F:\\O-frontend")
        sys.exit(1)

POPUP_FN = '''

// Popup shown right after medicines are marked as given: invoice preview + Print button
export function showInvoicePopup(inv: InvoiceData): void {
  const old = document.getElementById("invoice-popup-root");
  if (old) old.remove();
  const rows = inv.lines.map(l => {
    const pk = packMl(l.name);
    const qty = pk > 1 ? r2(l.tablets / pk) + " bottle(s)" : String(l.tablets);
    const price = pk > 1 ? inr(l.unitPrice * pk) + " / bottle" : inr(l.unitPrice);
    return `<tr><td style="padding:6px 4px;border-bottom:1px solid #eee">${esc(l.name)}</td><td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right">${esc(qty)}</td><td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right">${price}</td><td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right">${inr(l.amount)}</td></tr>`;
  }).join("");
  const when = inv.issuedAt ? new Date(inv.issuedAt).toLocaleString() : "";
  const billLabel = inv.billNo != null ? String(inv.billNo) : "-";
  const root = document.createElement("div");
  root.id = "invoice-popup-root";
  root.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:12px;font-family:Arial,Helvetica,sans-serif";
  root.innerHTML = `<div style="background:#fff;color:#111;border-radius:14px;width:100%;max-width:460px;max-height:92vh;overflow:auto;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.3)">
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
<div><div style="font-size:12px;color:#0d9488;font-weight:bold">Marked as given</div>
<div style="font-size:17px;font-weight:bold">${esc(inv.hospitalName)} - Pharmacy Invoice</div></div>
<button id="inv-x" style="border:none;background:none;font-size:22px;cursor:pointer;color:#666;line-height:1">&times;</button></div>
<div style="margin-top:10px;font-size:13px;line-height:1.6">
<div><b>Bill No:</b> ${esc(billLabel)}</div>
<div><b>Date:</b> ${esc(when)}</div>
<div><b>Patient:</b> ${esc(inv.patientName)}</div>
<div><b>Prescribed by:</b> Dr. ${esc(inv.doctorName)}</div>
<div><b>Payment:</b> ${esc((inv.paymentMode || "cash").toUpperCase())}</div></div>
<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
<thead><tr style="border-bottom:2px solid #111"><th style="text-align:left;padding:6px 4px;font-size:11px">Medicine</th><th style="text-align:right;padding:6px 4px;font-size:11px">Qty</th><th style="text-align:right;padding:6px 4px;font-size:11px">Unit price</th><th style="text-align:right;padding:6px 4px;font-size:11px">Amount</th></tr></thead>
<tbody>${rows}</tbody></table>
<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;border-top:2px solid #111;margin-top:10px;padding-top:8px"><span>Total</span><span>${inr(inv.total)}</span></div>
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
'''

# ------------------------------------------------------------ printInvoice.ts
print("Patching " + INV)
s, crlf = load(INV)
if "export function showInvoicePopup" in s:
    skip("popup function already there")
else:
    shutil.copyfile(INV, INV + ".bak")
    s = s.rstrip("\n") + "\n" + POPUP_FN
    save(INV, s, crlf)
    ok("added showInvoicePopup()")

# --------------------------------------------------------- PharmacyDashboard
print("Patching " + DASH)
s, crlf = load(DASH)
shutil.copyfile(DASH, DASH + ".bak")


def rep(old, new, label, count=1):
    global s
    if new in s and old not in s:
        skip(label + " (already done)")
    elif old in s:
        s = s.replace(old, new) if count == 0 else s.replace(old, new, count)
        ok(label)
    else:
        fail(label + " - text not found")


rep('import { printInvoice } from "@/lib/printInvoice";',
    'import { printInvoice, showInvoicePopup } from "@/lib/printInvoice";',
    "import showInvoicePopup")

rep("async function printInvoiceFor(id: string) {",
    "async function printInvoiceFor(id: string, preview = false) {",
    "printInvoiceFor accepts preview flag")

rep('if (!printInvoice(inv)) toast.error("Allow pop-ups to print the invoice");',
    'if (preview) showInvoicePopup(inv); else if (!printInvoice(inv)) toast.error("Allow pop-ups to print the invoice");',
    "invoice popup hook")

rep('toast.success("Marked as packed. Patient notified");',
    'toast.success("Marked as given. Patient notified");\n      await printInvoiceFor(p.id, true);',
    "open invoice popup after marking given")

rep("Yes, mark as packed", "Yes, mark as given", "confirm button text")
rep("Mark as Packed", "Mark as Given", "main button text", count=0)

save(DASH, s, crlf)

print()
if failed:
    print("Some steps FAILED. Backups are saved as .bak. Paste this output to Claude.")
else:
    print("Done. Mark a prescription as given and the invoice popup should appear.")
