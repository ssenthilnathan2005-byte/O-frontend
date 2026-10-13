import { useEffect, useState } from "react";
import { getToken } from "@/api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
const CATS = ["Tablet", "Capsule", "Syrup/Tonic", "Injection", "Oil", "Ointment/Cream", "Drops", "Powder", "Others"];
const UNITS = ["", "box", "strip", "bottle", "vial", "tube", "sachet", "inhaler", "piece", "pack", "tablet", "capsule"];

type Row = {
  name: string; medCategory: string; quantity: string; quantityUnit: string; tabletsPerStrip: string; stripsPerBox: string; batchNo: string;
  expiryDate: string; purchasePrice: string; sellingPrice: string; gstPercent: string; supplier: string;
  allowNoBatchExpiry: boolean; warnings: string[];
};
type Issue = { level: "blocked" | "held" | "warn"; code: string; msg: string };
type Check = { status: "ready" | "attention" | "held" | "blocked"; issues: Issue[]; preview: { stock: string; cost: string }; existing: boolean };

const STATUS_UI: Record<Check["status"], [string, string]> = {
  ready: ["Ready", "bg-emerald-50 text-emerald-700"],
  attention: ["Check", "bg-amber-50 text-amber-700"],
  held: ["Needs details", "bg-orange-50 text-orange-700"],
  blocked: ["Fix", "bg-red-50 text-red-700"],
};
const ISSUE_CLS: Record<Issue["level"], string> = { blocked: "text-red-600", held: "text-orange-600", warn: "text-amber-600" };

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

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
  const [checks, setChecks] = useState<Check[]>([]);
  const [dup, setDup] = useState<{ importedAt: string } | null>(null);
  const [confirmDup, setConfirmDup] = useState(false);
  const [partial, setPartial] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [result, setResult] = useState<any>(null);

  const close = () => {
    setOpen(false); setFile(null); setBusy(false); setErr("");
    setRows([]); setChecks([]); setDup(null); setConfirmDup(false); setPartial(false);
    setSupplier(""); setInvoiceNo(""); setResult(null);
  };

  const upload = async () => {
    if (!file) { setErr("Choose a file first"); return; }
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await call("/parse", { method: "POST", body: fd });
      setRows((d.rows || []).map((r: any): Row => ({
        name: s(r.name), medCategory: s(r.medCategory), quantity: s(r.quantity), quantityUnit: s(r.quantityUnit),
        tabletsPerStrip: s(r.tabletsPerStrip), stripsPerBox: s(r.stripsPerBox),
        batchNo: s(r.batchNo), expiryDate: s(r.expiryDate), purchasePrice: s(r.purchasePrice), sellingPrice: s(r.sellingPrice),
        gstPercent: s(r.gstPercent), supplier: s(r.supplier), allowNoBatchExpiry: false, warnings: r.warnings || [],
      })));
      setChecks([]); setDup(null); setConfirmDup(false); setPartial(false);
      const sup = (d.rows || []).find((r: any) => r.supplier); if (d.invoiceNo) setInvoiceNo(s(d.invoiceNo));
      if (sup) setSupplier(s(sup.supplier));
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const upd = (i: number, k: keyof Row, v: string | boolean) =>
    setRows(p => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  // Re-check the rows with the server shortly after every edit.
  useEffect(() => {
    if (!open || result || !rows.length) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const d = await call("/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplier, invoiceNo, rows: rows.map(({ warnings, ...r }) => r) }),
        });
        if (!cancelled) { setChecks(d.rows || []); setDup(d.duplicate || null); }
      } catch (e: any) { if (!cancelled) setErr(e.message); }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, rows, supplier, invoiceNo, result]);

  const savable = (c?: Check) => !!c && (c.status === "ready" || c.status === "attention");
  const okCount = rows.filter((_, i) => savable(checks[i])).length;
  const fixCount = rows.length - okCount;
  const needsDupTick = !!dup && !partial && !confirmDup;

  const save = async () => {
    if (!rows.length) { setErr("No rows to save"); return; }
    if (needsDupTick) { setErr("This invoice number was already imported. Tick \"Import again\" to continue."); return; }
    setBusy(true); setErr("");
    try {
      const d = await call("/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier, invoiceNo, confirmDuplicate: confirmDup || partial, rows: rows.map(({ warnings, ...r }) => r) }),
      });
      setResult(d);
      window.dispatchEvent(new CustomEvent("pharmacy-updated"));
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  // After a partial save, go back to the table with only the rows that were not saved.
  const fixUnsaved = () => {
    const keep = new Set<number>([
      ...(result?.skipped || []).map((x: any) => x.row - 1),
      ...(result?.errors || []).map((x: any) => x.row - 1),
    ]);
    setRows(p => p.filter((_, i) => keep.has(i)));
    setChecks([]); setResult(null); setErr(""); setPartial(true);
  };

  const unsaved = (result?.skipped?.length || 0) + (result?.errors?.length || 0);

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
                {result.skipped?.length > 0 && (
                  <div className="text-sm text-orange-700">
                    <p>{result.skipped.length} row(s) were not saved because they need details:</p>
                    <ul className="list-disc ml-5">
                      {result.skipped.map((e: any, i: number) => <li key={i}>Row {e.row} {e.name}: {(e.reasons || []).join(" ")}</li>)}
                    </ul>
                  </div>
                )}
                {result.errors?.length > 0 && (
                  <div className="text-sm text-red-600">
                    <p>{result.errors.length} row(s) could not be saved:</p>
                    <ul className="list-disc ml-5">
                      {result.errors.map((e: any, i: number) => <li key={i}>Row {e.row} {e.name}: {e.error}</li>)}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2">
                  {unsaved > 0 && (
                    <button type="button" onClick={fixUnsaved} className="px-3 py-1.5 text-sm rounded-md border border-teal-600 text-teal-700">
                      Fix the {unsaved} unsaved row(s)
                    </button>
                  )}
                  <button type="button" onClick={close} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white">Done</button>
                </div>
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
                {dup && !partial && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
                    <p>This invoice number was already imported on {s(dup.importedAt).slice(0, 10)}. Adding it again will add the stock a second time.</p>
                    <label className="flex items-center gap-2 mt-1">
                      <input type="checkbox" checked={confirmDup} onChange={e => setConfirmDup(e.target.checked)} />
                      Import again
                    </label>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Qty and prices are for the unit in the Unit column (strips, bottles or packs if it is empty). Boxes are converted using Strips/box, and stock stays in packs.
                  Rows marked "Needs details" or "Fix" are not saved until you complete them. Medicines already in stock are restocked; new ones are created.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500">
                        {["", "Medicine", "Category", "Qty", "Unit", "Tabs/strip", "Strips/box", "Batch", "Expiry", "Purchase price", "MRP", "GST %", ""].map((h, k) => <th key={k} className="px-1 py-1 font-medium">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const c = checks[i];
                        const showOverride = !!c && c.issues.some(x => x.code === "no_batch_expiry" || x.code === "no_batch_expiry_override");
                        return (
                          <tr key={i} className="border-t border-gray-100 align-top">
                            <td className="px-1 py-1 w-24">
                              {c ? <span className={"px-2 py-0.5 rounded-full font-medium whitespace-nowrap " + STATUS_UI[c.status][1]}>{STATUS_UI[c.status][0]}</span> : <span className="text-gray-400">Checking...</span>}
                            </td>
                            <td className="px-1 py-1 min-w-[220px]">
                              <input value={r.name} onChange={e => upd(i, "name", e.target.value)} className={inp} />
                              {r.warnings.map((w, k) => <p key={k} className="text-amber-600">{w}</p>)}
                              {c && c.preview.stock && <p className="text-gray-600">{c.preview.stock}</p>}
                              {c && c.preview.cost && <p className="text-gray-500">{c.preview.cost}</p>}
                              {c && c.issues.map((x, k) => <p key={k} className={ISSUE_CLS[x.level]}>{x.msg}</p>)}
                              {showOverride && (
                                <label className="flex items-center gap-1 text-gray-600">
                                  <input type="checkbox" checked={r.allowNoBatchExpiry} onChange={e => upd(i, "allowNoBatchExpiry", e.target.checked)} />
                                  Save without batch/expiry
                                </label>
                              )}
                            </td>
                            <td className="px-1 py-1 min-w-[110px]">
                              <select value={r.medCategory} onChange={e => upd(i, "medCategory", e.target.value)} className={inp}>
                                <option value="">-</option>
                                {r.medCategory && !CATS.includes(r.medCategory) && <option value={r.medCategory}>{r.medCategory}</option>}
                                {CATS.map(x => <option key={x} value={x}>{x}</option>)}
                              </select>
                            </td>
                            <td className="px-1 py-1 w-16"><input value={r.quantity} onChange={e => upd(i, "quantity", e.target.value)} className={inp} inputMode="decimal" /></td>
                            <td className="px-1 py-1 w-24">
                              <select value={r.quantityUnit} onChange={e => upd(i, "quantityUnit", e.target.value)} className={inp}>
                                {r.quantityUnit && !UNITS.includes(r.quantityUnit.toLowerCase()) && <option value={r.quantityUnit}>{r.quantityUnit}</option>}
                                {UNITS.map(x => <option key={x} value={x}>{x || "(default)"}</option>)}
                              </select>
                            </td>
                            <td className="px-1 py-1 w-16"><input value={r.tabletsPerStrip} onChange={e => upd(i, "tabletsPerStrip", e.target.value)} className={inp} inputMode="numeric" /></td>
                            <td className="px-1 py-1 w-16"><input value={r.stripsPerBox} onChange={e => upd(i, "stripsPerBox", e.target.value)} className={inp} inputMode="numeric" /></td>
                            <td className="px-1 py-1 w-24"><input value={r.batchNo} onChange={e => upd(i, "batchNo", e.target.value)} className={inp + (r.batchNo ? "" : " border-amber-300")} /></td>
                            <td className="px-1 py-1 w-32"><input type="date" value={r.expiryDate} onChange={e => upd(i, "expiryDate", e.target.value)} className={inp + (r.expiryDate ? "" : " border-amber-300")} /></td>
                            <td className="px-1 py-1 w-20"><input value={r.purchasePrice} onChange={e => upd(i, "purchasePrice", e.target.value)} className={inp} inputMode="decimal" /></td>
                            <td className="px-1 py-1 w-20"><input value={r.sellingPrice} onChange={e => upd(i, "sellingPrice", e.target.value)} className={inp} inputMode="decimal" /></td>
                            <td className="px-1 py-1 w-14"><input value={r.gstPercent} onChange={e => upd(i, "gstPercent", e.target.value)} className={inp} inputMode="decimal" /></td>
                            <td className="px-1 py-1">
                              <button type="button" onClick={() => { setRows(p => p.filter((_, j) => j !== i)); setChecks(p => p.filter((_, j) => j !== i)); }} className="text-red-600">Remove</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {err && <p className="text-sm text-red-600">{err}</p>}
                {checks.length > 0 && fixCount > 0 && (
                  <p className="text-xs text-orange-700">{fixCount} row(s) still need details and will not be saved yet.</p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setRows([]); setChecks([]); setErr(""); setPartial(false); }} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Back</button>
                  <button type="button" disabled={busy || okCount === 0 || needsDupTick} onClick={save} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white disabled:opacity-50">
                    {busy ? "Saving..." : "Add " + okCount + " row(s) to stock"}
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
