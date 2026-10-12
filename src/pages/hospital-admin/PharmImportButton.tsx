import { useState } from "react";
import { getToken } from "@/api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
const CATS = ["Tablet", "Capsule", "Syrup/Tonic", "Injection", "Oil", "Ointment/Cream", "Drops", "Powder", "Others"];

type Row = {
  name: string; medCategory: string; quantity: string; tabletsPerStrip: string; batchNo: string;
  expiryDate: string; purchasePrice: string; sellingPrice: string; gstPercent: string; supplier: string; warnings: string[];
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const today = () => new Date().toISOString().slice(0, 10);
const perTab = (price: string, tabs: string) => { const p = Number(price), t = Number(tabs); return price !== "" && tabs !== "" && p >= 0 && t > 0 ? "\u20B9" + (p / t).toFixed(2) + "/tab" : ""; };

async function call(path: string, init: RequestInit) {
  const res = await fetch(BASE + "/pharmacy-import" + path, {
    ...init,
    headers: { Authorization: "Bearer " + getToken(), ...(init.headers || {}) },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

const inp = "border border-gray-200 rounded px-1.5 py-1 text-xs bg-white w-full";

export default function PharmImportButton() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [supplier, setSupplier] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [result, setResult] = useState<any>(null);

  const close = () => {
    setOpen(false); setFile(null); setBusy(false); setErr("");
    setRows([]); setSupplier(""); setInvoiceNo(""); setResult(null);
  };

  const upload = async () => {
    if (!file) { setErr("Choose a file first"); return; }
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await call("/parse", { method: "POST", body: fd });
      setRows((d.rows || []).map((r: any): Row => ({
        name: s(r.name), medCategory: s(r.medCategory), quantity: s(r.quantity), tabletsPerStrip: s(r.tabletsPerStrip),
        batchNo: s(r.batchNo), expiryDate: s(r.expiryDate), purchasePrice: s(r.purchasePrice), sellingPrice: s(r.sellingPrice),
        gstPercent: s(r.gstPercent), supplier: s(r.supplier), warnings: r.warnings || [],
      })));
      const sup = (d.rows || []).find((r: any) => r.supplier);
      if (sup) setSupplier(s(sup.supplier));
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const upd = (i: number, k: keyof Row, v: string) =>
    setRows(p => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = async () => {
    if (!rows.length) { setErr("No rows to save"); return; }
    if (rows.some(r => !r.name.trim())) { setErr("Every row needs a medicine name (or remove the row)"); return; }
    setBusy(true); setErr("");
    try {
      const d = await call("/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier, invoiceNo, rows: rows.map(({ warnings, ...r }) => r) }),
      });
      setResult(d);
      window.dispatchEvent(new CustomEvent("pharmacy-updated"));
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="px-3 py-2 rounded-md border border-teal-600 text-teal-700 text-sm">
        Import invoice
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
          <div className="bg-white rounded-lg w-full max-w-7xl max-h-[92vh] overflow-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Import supplier invoice / quotation</h3>
              <button type="button" onClick={close} className="text-gray-500 text-sm">Close</button>
            </div>

            {result ? (
              <div className="space-y-2">
                <p className="text-sm text-green-700">
                  Done: {result.created} new medicine(s) added, {result.updated} existing medicine(s) restocked.
                </p>
                {result.errors?.length > 0 && (
                  <div className="text-sm text-red-600">
                    <p>{result.errors.length} row(s) were not saved:</p>
                    <ul className="list-disc ml-5">
                      {result.errors.map((e: any, i: number) => <li key={i}>Row {e.row} {e.name}: {e.error}</li>)}
                    </ul>
                  </div>
                )}
                <button type="button" onClick={close} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white">Done</button>
              </div>
            ) : rows.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Upload a supplier invoice or quotation (Excel, CSV, PDF, JPG or PNG). You can review and edit everything before it is saved.</p>
                <input type="file" accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} className="text-sm" />
                {err && <p className="text-sm text-red-600">{err}</p>}
                <div>
                  <button type="button" disabled={busy || !file} onClick={upload} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white disabled:opacity-50">
                    {busy ? "Reading file..." : "Read file"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier (for all rows)" className="border border-gray-200 rounded px-2 py-1.5 text-sm w-64" />
                  <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="Invoice no." className="border border-gray-200 rounded px-2 py-1.5 text-sm w-44" />
                </div>
                <p className="text-xs text-gray-500">Qty = strips/units received, and stock stays in strips/units. Tabs/strip is only used to show the per-tablet price. Prices are per strip/unit. Medicines already in stock are restocked; new ones are created.</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500">
                        {["Medicine", "Category", "Qty (strips/units)", "Tabs/strip", "Batch", "Expiry", "Purchase / strip", "MRP / strip", "GST %", ""].map(h => <th key={h} className="px-1 py-1 font-medium">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const expired = r.expiryDate && r.expiryDate <= today();
                        return (
                          <tr key={i} className="border-t border-gray-100 align-top">
                            <td className="px-1 py-1 min-w-[200px]">
                              <input value={r.name} onChange={e => upd(i, "name", e.target.value)} className={inp} />
                              {r.warnings.map((w, k) => <p key={k} className="text-amber-600">{w}</p>)}
                              {expired && <p className="text-red-600">Expiry is in the past</p>}
                            </td>
                            <td className="px-1 py-1 min-w-[110px]">
                              <select value={r.medCategory} onChange={e => upd(i, "medCategory", e.target.value)} className={inp}>
                                <option value="">-</option>
                                {r.medCategory && !CATS.includes(r.medCategory) && <option value={r.medCategory}>{r.medCategory}</option>}
                                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="px-1 py-1 w-16"><input value={r.quantity} onChange={e => upd(i, "quantity", e.target.value)} className={inp} inputMode="decimal" /></td>
                            <td className="px-1 py-1 w-16"><input value={r.tabletsPerStrip} onChange={e => upd(i, "tabletsPerStrip", e.target.value)} className={inp} inputMode="numeric" /></td>
                            <td className="px-1 py-1 w-24"><input value={r.batchNo} onChange={e => upd(i, "batchNo", e.target.value)} className={inp + (r.batchNo ? "" : " border-amber-300")} /></td>
                            <td className="px-1 py-1 w-32"><input type="date" value={r.expiryDate} onChange={e => upd(i, "expiryDate", e.target.value)} className={inp + (r.expiryDate ? "" : " border-amber-300")} /></td>
                            <td className="px-1 py-1 w-20"><input value={r.purchasePrice} onChange={e => upd(i, "purchasePrice", e.target.value)} className={inp} inputMode="decimal" /><p className="text-gray-500">{perTab(r.purchasePrice, r.tabletsPerStrip)}</p></td>
                            <td className="px-1 py-1 w-20"><input value={r.sellingPrice} onChange={e => upd(i, "sellingPrice", e.target.value)} className={inp} inputMode="decimal" /><p className="text-gray-500">{perTab(r.sellingPrice, r.tabletsPerStrip)}</p></td>
                            <td className="px-1 py-1 w-14"><input value={r.gstPercent} onChange={e => upd(i, "gstPercent", e.target.value)} className={inp} inputMode="decimal" /></td>
                            <td className="px-1 py-1"><button type="button" onClick={() => setRows(p => p.filter((_, j) => j !== i))} className="text-red-600">Remove</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setRows([]); setErr(""); }} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Back</button>
                  <button type="button" disabled={busy} onClick={save} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white disabled:opacity-50">
                    {busy ? "Saving..." : "Add " + rows.length + " row(s) to stock"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}