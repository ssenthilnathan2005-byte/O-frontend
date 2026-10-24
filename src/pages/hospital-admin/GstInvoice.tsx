import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getToken } from "@/api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
const r2 = (n: number) => Math.round(n * 100) / 100;
const plain = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number) => "\u20B9" + plain(n);
const ymd = (d: Date) => { const p = (n: number) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
const fmtDate = (s: string | null) => (s ? s.split("-").reverse().join("/") : "-");
const hsnCell = (r: { hsn: string | null; gstPercent: number | null }) => (r.hsn ? r.hsn + " / " + (r.gstPercent == null ? "?" : r.gstPercent + "%") : "MISSING");

async function pm<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + "/pharmacy-module" + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken(), ...(init?.headers || {}) },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

type Row = { billNos: number[]; supplier: string | null; purchasedOn: string | null; purchaseRate: number; name: string; batchNo: string | null; expiryDate: string | null; unit: string; qty: number; mrp: number; gross: number; discount: number; taxable: number; hsn: string | null; gstPercent: number | null };
type CalcRow = Row & { cgAmt: number; sgAmt: number; total: number };
type Profile = { name: string; address: string; phone: string; gstin: string; drugLicence: string; defaultHsn: string; gstType: string; companyName?: string };
type Report = { from: string; to: string; bills: number; billNoFrom: number | null; billNoTo: number | null; profile: Profile; rows: Row[] };

const STATES: Record<string, string> = { "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh" };
const placeOf = (g: string) => { const c = String(g || "").trim().slice(0, 2); return STATES[c] ? STATES[c] + " (" + c + ")" : "-"; };
export default function GstInvoice() {
  const today = ymd(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  
  
  const [profile, setProfile] = useState<Profile>({ name: "", address: "", phone: "", gstin: "", drugLicence: "", defaultHsn: "3004", gstType: "loading" });
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => { pm<Profile>("/gst-profile").then(setProfile).catch(() => setProfile(p => ({ ...p, gstType: "" }))); }, []);
  const [pickType, setPickType] = useState(false);
  async function setGstType(t: "registered" | "none") {
    try {
      const p = await pm<Profile>("/gst-type", { method: "PUT", body: JSON.stringify({ gstType: t }) });
      setProfile(prev => ({ ...prev, gstType: p.gstType }));
      setPickType(false);
    } catch (e: any) { toast.error(e.message); }
  }

  
  
  

  const calc = useMemo(() => {
    const rows: CalcRow[] = (report?.rows || []).map(r => {
      const rate = r.gstPercent ?? 0;
      const gstAmt = r.taxable * rate / (100 + rate);
      const cgAmt = r2(gstAmt / 2);
      const sgAmt = r2(gstAmt / 2);
      return { ...r, taxable: r2(r.taxable - cgAmt - sgAmt), cgAmt, sgAmt, total: r2(r.taxable) };
    });
    const sum = (f: (x: CalcRow) => number) => r2(rows.reduce((s, x) => s + f(x), 0));
    return { rows, discount: sum(x => x.discount), taxable: sum(x => x.taxable), cgst: sum(x => x.cgAmt), sgst: sum(x => x.sgAmt), total: sum(x => x.total) };
  }, [report]);

  const invNo = report ? "GST-" + report.from.replace(/-/g, "") + (report.to !== report.from ? "-" + report.to.replace(/-/g, "") : "") : "";
  const period = report ? (report.from === report.to ? fmtDate(report.from) : fmtDate(report.from) + " to " + fmtDate(report.to)) : "";
  const billRange = report && report.billNoFrom != null ? (report.billNoFrom === report.billNoTo ? "Bill No " + report.billNoFrom : "Bill Nos " + report.billNoFrom + " to " + report.billNoTo) : "";

  function preset(k: "today" | "week" | "month") {
    const d = new Date();
    const t = ymd(d);
    if (k === "today") { setFrom(t); setTo(t); }
    else if (k === "week") { const s = new Date(d); s.setDate(s.getDate() - 6); setFrom(ymd(s)); setTo(t); }
    else { setFrom(ymd(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(t); }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const p = await pm<Profile>("/gst-profile", { method: "PUT", body: JSON.stringify(profile) });
      setProfile(p);
      toast.success("Pharmacy details saved");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function generate() {
    if (from > to) return toast.error("The From date must not be after the To date");
    
    setLoading(true);
    try {
      const r = await pm<Report>("/gst-report?from=" + from + "&to=" + to);
      setReport(r);
      if (!r.rows.length) toast.info("No sales found in this date range");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  function needHsn(): boolean {
    const bad = calc.rows.filter(r => !r.hsn || r.gstPercent == null);
    if (bad.length) { toast.error(bad.length + " medicine line(s) have no HSN code or GST %. Add them in Pharmacy > Inventory Management (Edit) or by importing the vendor bill."); return true; }
    return false;
  }
  function needGstin(): boolean {
    if (!profile.gstin.trim()) { toast.error("Enter your GSTIN in Pharmacy details first"); return true; }
    return false;
  }

  const detailHead = ["#", "Medicine", "Batch", "Sold in Bill No", "Qty sold", "Supplier", "Purchased on", "Last purchase rate (Rs./unit)", "MRP (Rs./unit)"];
  const billsText = (a: number[]) => (a.length > 8 ? a.slice(0, 8).join(", ") + " +" + (a.length - 8) + " more" : a.join(", "));
  const detailBody = () => calc.rows.map((r, i) => [String(i + 1), r.name, r.batchNo || "-", billsText(r.billNos || []) || "-", r.qty + " " + r.unit, r.supplier || "-", fmtDate(r.purchasedOn), r.purchaseRate > 0 ? plain(r.purchaseRate) : "-", plain(r.mrp)]);
  const heads = ["#", "Medicine", "HSN / GST %", "Batch", "Expiry", "Qty", "MRP", "Discount", "Taxable value", "CGST", "SGST", "Total"];

  async function issueNo(): Promise<string> {
    if (!report) return "";
    try {
      const r = await pm<{ invoiceNo: string }>("/gst-invoice-no", { method: "POST", body: JSON.stringify({ from: report.from, to: report.to, total: calc.total, bills: report.bills }) });
      return r.invoiceNo;
    } catch (e: any) { toast.error(e.message || "Could not issue the invoice number"); return ""; }
  }

  async function downloadPdf() {
    if (!report || needGstin() || needHsn()) return;
    const invNo = await issueNo(); if (!invNo) return;
    setBusy("pdf");
    try {
      const { default: JsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      doc.setFontSize(15); doc.text(profile.name || "Pharmacy", 14, 14);
      doc.setFontSize(9);
      const addr = doc.splitTextToSize(profile.address || "", 150);
      doc.text(addr, 14, 19);
      const y = 19 + addr.length * 4 + 1;
      doc.text("GSTIN: " + profile.gstin + (profile.drugLicence ? "    Drug Licence: " + profile.drugLicence : ""), 14, y);
      doc.text("Invoice Date: " + fmtDate(ymd(new Date())) + "    Place of Supply: " + placeOf(profile.gstin) + "    Reverse Charge: No", 14, y + 5);
      doc.setFontSize(14); doc.text("TAX INVOICE", W - 14, 14, { align: "right" });
      doc.setFontSize(9);
      doc.text("Invoice No: " + invNo, W - 14, 20, { align: "right" });
      doc.text("Period: " + period, W - 14, 25, { align: "right" });
      if (billRange) doc.text(billRange + " (" + report.bills + " bills)", W - 14, 30, { align: "right" });
      const body = calc.rows.map((r, i) => [String(i + 1), r.name, hsnCell(r), r.batchNo || "-", fmtDate(r.expiryDate), r.qty + " " + r.unit, plain(r.mrp), plain(r.discount), plain(r.taxable), plain(r.cgAmt), plain(r.sgAmt), plain(r.total)]);
      const right = { halign: "right" as const };
      autoTable(doc, {
        startY: Math.max(y + 10, 36),
        head: [heads.map((h, i) => (i >= 6 ? h + " (Rs.)" : h))],
        body,
        foot: [["", "Total", "", "", "", "", "", plain(calc.discount), plain(calc.taxable), plain(calc.cgst), plain(calc.sgst), plain(calc.total)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [13, 148, 136] },
        footStyles: { fillColor: [240, 240, 240], textColor: 20 },
        columnStyles: { 6: right, 7: right, 8: right, 9: right, 10: right, 11: right },
      });
      let fy = (doc as any).lastAutoTable.finalY + 8;
      if (fy > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); fy = 20; }
      const line = (label: string, val: string, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.text(label, W - 80, fy); doc.text(val, W - 14, fy, { align: "right" }); fy += 6;
      };
      doc.setFontSize(10);
      line("Taxable value", "Rs. " + plain(calc.taxable));
      line("CGST", "Rs. " + plain(calc.cgst));
      line("SGST", "Rs. " + plain(calc.sgst));
      line("Total GST", "Rs. " + plain(r2(calc.cgst + calc.sgst)));
      line("Invoice total", "Rs. " + plain(calc.total), true);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text("Amounts are inclusive of GST. Taxable value = amount paid less GST. CGST and SGST are half of the GST each.", 14, fy + 4);
      const hsnSum: Record<string, { hsn: string; rate: string; taxable: number; cg: number; sg: number; total: number }> = {};
      calc.rows.forEach(r => {
        const k = (r.hsn || "-") + "|" + (r.gstPercent == null ? "-" : r.gstPercent);
        const e = hsnSum[k] || (hsnSum[k] = { hsn: r.hsn || "-", rate: r.gstPercent == null ? "-" : String(r.gstPercent), taxable: 0, cg: 0, sg: 0, total: 0 });
        e.taxable += r.taxable; e.cg += r.cgAmt; e.sg += r.sgAmt; e.total += r.total;
      });
      autoTable(doc, {
        startY: fy + 8,
        head: [["HSN", "GST %", "Taxable value (Rs.)", "CGST (Rs.)", "SGST (Rs.)", "Total (Rs.)"]],
        body: Object.values(hsnSum).map(e => [e.hsn, e.rate, plain(r2(e.taxable)), plain(r2(e.cg)), plain(r2(e.sg)), plain(r2(e.total))]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [13, 148, 136] },
        columnStyles: { 2: right, 3: right, 4: right, 5: right },
      });
      let sy = (doc as any).lastAutoTable.finalY + 14;
      if (sy > doc.internal.pageSize.getHeight() - 25) { doc.addPage(); sy = 30; }
      doc.setFontSize(9);
      doc.text("For " + (profile.name || "Pharmacy"), W - 14, sy, { align: "right" });
      doc.text("Authorised signatory", W - 14, sy + 14, { align: "right" });
      doc.addPage();
      doc.setFontSize(12); doc.text("Sales and purchase detail (from pharmacy inventory)", 14, 14);
      autoTable(doc, { startY: 18, head: [detailHead], body: detailBody(), styles: { fontSize: 8 }, headStyles: { fillColor: [13, 148, 136] }, columnStyles: { 7: { halign: "right" }, 8: { halign: "right" } } });
      doc.save(invNo.replace(/\//g, "-") + ".pdf");
    } catch (e: any) { toast.error("Could not create the PDF: " + (e?.message || "error")); } finally { setBusy(""); }
  }

  async function downloadExcel() {
    if (!report || needGstin() || needHsn()) return;
    const invNo = await issueNo(); if (!invNo) return;
    setBusy("xlsx");
    try {
      const ExcelJS: any = await import("exceljs");
      const wb = new (ExcelJS.default || ExcelJS).Workbook();
      const ws = wb.addWorksheet("GST Invoice");
      ws.addRow([profile.name || "Pharmacy"]).font = { bold: true, size: 14 };
      ws.addRow([profile.address]);
      ws.addRow(["GSTIN: " + profile.gstin, profile.drugLicence ? "Drug Licence: " + profile.drugLicence : ""]);
      ws.addRow(["TAX INVOICE"]).font = { bold: true };
      ws.addRow(["Invoice Date", fmtDate(ymd(new Date()))]);
      ws.addRow(["Place of Supply", placeOf(profile.gstin)]);
      ws.addRow(["Reverse Charge", "No"]);
      ws.addRow(["Invoice No", invNo]);
      ws.addRow(["Period", period]);
      if (billRange) ws.addRow([billRange, report.bills + " bills"]);
      ws.addRow([]);
      const head = ws.addRow(["#", "Medicine", "HSN / GST %", "Batch", "Expiry", "Qty", "Unit", "MRP", "Discount", "Taxable value", "CGST", "SGST", "Total"]);
      head.font = { bold: true };
      calc.rows.forEach((r, i) => ws.addRow([i + 1, r.name, hsnCell(r), r.batchNo || "", r.expiryDate ? fmtDate(r.expiryDate) : "", r.qty, r.unit, r.mrp, r.discount, r.taxable, r.cgAmt, r.sgAmt, r.total]));
      ws.addRow(["", "Total", "", "", "", "", "", "", calc.discount, calc.taxable, calc.cgst, calc.sgst, calc.total]).font = { bold: true };
      ws.addRow([]);
      ws.addRow(["", "Taxable value", "", "", "", "", "", "", "", calc.taxable]);
      ws.addRow(["", "CGST", "", "", "", "", "", "", "", calc.cgst]);
      ws.addRow(["", "SGST", "", "", "", "", "", "", "", calc.sgst]);
      ws.addRow(["", "Total GST", "", "", "", "", "", "", "", r2(calc.cgst + calc.sgst)]);
      const hsnRows: Record<string, { hsn: string; rate: number; taxable: number; cg: number; sg: number; total: number }> = {};
      const rateRows: Record<string, { rate: number; taxable: number; cg: number; sg: number; total: number }> = {};
      calc.rows.forEach(r => {
        const rate = r.gstPercent ?? 0;
        const hk = (r.hsn || "-") + "|" + rate;
        const h = hsnRows[hk] || (hsnRows[hk] = { hsn: r.hsn || "-", rate, taxable: 0, cg: 0, sg: 0, total: 0 });
        h.taxable += r.taxable; h.cg += r.cgAmt; h.sg += r.sgAmt; h.total += r.total;
        const g = rateRows[String(rate)] || (rateRows[String(rate)] = { rate, taxable: 0, cg: 0, sg: 0, total: 0 });
        g.taxable += r.taxable; g.cg += r.cgAmt; g.sg += r.sgAmt; g.total += r.total;
      });
      const wsH = wb.addWorksheet("HSN Summary");
      wsH.addRow(["HSN", "GST %", "Taxable value", "CGST", "SGST", "Total"]).font = { bold: true };
      Object.values(hsnRows).forEach(e => wsH.addRow([e.hsn, e.rate, r2(e.taxable), r2(e.cg), r2(e.sg), r2(e.total)]));
      wsH.addRow(["Total", "", calc.taxable, calc.cgst, calc.sgst, calc.total]).font = { bold: true };
      wsH.columns.forEach((c: any) => { c.width = 16; });
      const wsG = wb.addWorksheet("GSTR-1");
      wsG.addRow(["GSTR-1 working sheet (check the layout against the current GST portal with your CA before uploading)"]).font = { bold: true };
      wsG.addRow(["GSTIN", profile.gstin]);
      wsG.addRow(["Period", period]);
      wsG.addRow([]);
      wsG.addRow(["B2C (small) - rate-wise totals for sales to unregistered buyers"]).font = { bold: true };
      wsG.addRow(["Place of Supply", "GST %", "Taxable value", "CGST", "SGST", "Cess"]).font = { bold: true };
      Object.values(rateRows).forEach(e => wsG.addRow([placeOf(profile.gstin), e.rate, r2(e.taxable), r2(e.cg), r2(e.sg), 0]));
      wsG.addRow(["Total", "", calc.taxable, calc.cgst, calc.sgst, 0]).font = { bold: true };
      wsG.addRow([]);
      wsG.addRow(["Documents issued"]).font = { bold: true };
      wsG.addRow(["Nature of document", "From (Sr. No.)", "To (Sr. No.)", "Total number", "Cancelled"]).font = { bold: true };
      wsG.addRow(["Invoices for outward supply", invNo, invNo, 1, 0]);
      wsG.addRow(["Note: this is one summary invoice for the period. Confirm with your CA whether bills must be reported individually."]);
      wsG.columns.forEach((c: any) => { c.width = 20; });
      ws.addRow(["", "Invoice total", "", "", "", "", "", "", "", calc.total]).font = { bold: true };
      [8, 9, 10, 11, 12, 13].forEach(c => { ws.getColumn(c).numFmt = "#,##0.00"; });
      ws.getColumn(2).width = 34; [4, 5, 7].forEach(c => { ws.getColumn(c).width = 14; }); [8, 9, 10, 11, 12, 13].forEach(c => { ws.getColumn(c).width = 15; });
      const ws2 = wb.addWorksheet("Sales and Purchase");
      ws2.addRow(detailHead).font = { bold: true };
      detailBody().forEach(r => ws2.addRow(r));
      for (let c = 1; c <= 9; c++) ws2.getColumn(c).width = 18;
      ws2.getColumn(2).width = 34;
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = invNo.replace(/\//g, "-") + ".xlsx"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e: any) { toast.error("Could not create the Excel file: " + (e?.message || "error")); } finally { setBusy(""); }
  }

  const inp = "mt-0.5 w-full border border-gray-200 rounded-md text-sm px-2 py-1.5 bg-white text-gray-900";
  const th = "px-2 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm text-gray-800 whitespace-nowrap";

  if (profile.gstType === "loading") return <p className="text-sm text-gray-500">Loading...</p>;
  if (profile.gstType !== "registered" || pickType) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">GST Invoice</h1>
        <p className="text-sm text-gray-600">Choose how this pharmacy deals with GST. You can change it later.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setGstType("registered")} className={"text-left border rounded-lg p-4 bg-white hover:border-teal-500 " + (profile.gstType === "registered" ? "border-teal-500" : "border-gray-200")}>
            <p className="font-semibold text-gray-900">GST registered (regular)</p>
            <p className="text-xs text-gray-500 mt-1">The pharmacy has a GSTIN and issues tax invoices. GST is taken out of the MRP, never added on top.</p>
          </button>
          <button type="button" onClick={() => setGstType("none")} className={"text-left border rounded-lg p-4 bg-white hover:border-teal-500 " + (profile.gstType === "none" ? "border-teal-500" : "border-gray-200")}>
            <p className="font-semibold text-gray-900">Not charging GST</p>
            <p className="text-xs text-gray-500 mt-1">Composition scheme or not registered. No GST invoice is needed; bills show the total only.</p>
          </button>
        </div>
        {profile.gstType === "none" && !pickType && <p className="text-sm text-gray-700">GST invoices are turned off for this pharmacy.</p>}
        {pickType && <button type="button" onClick={() => setPickType(false)} className="text-xs text-gray-500 underline">Back</button>}
      </div>
    );
  }
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">GST Invoice</h1>
  <button type="button" onClick={() => setPickType(true)} className="text-xs text-gray-500 underline">Change GST type</button>
        <p className="text-sm text-gray-500">Pick a date range, generate the invoice for all sales in that period, then download it.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <p className="font-semibold text-gray-900 text-sm">Pharmacy details (printed on the invoice)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-gray-600 md:col-span-2">Company name
            <input className={inp} value={profile.companyName ?? ""} maxLength={120} placeholder="Name as on your GST registration" onChange={e => setProfile({ ...profile, companyName: e.target.value })} /></label>
          <label className="text-xs text-gray-600">GSTIN
            <input className={inp} value={profile.gstin} maxLength={15} placeholder="15-character GSTIN" onChange={e => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })} /></label>
          <label className="text-xs text-gray-600">Drug licence no.
            <input className={inp} value={profile.drugLicence} onChange={e => setProfile({ ...profile, drugLicence: e.target.value })} /></label>
          <label className="text-xs text-gray-600 md:col-span-2">Address
            <input className={inp} value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} /></label>
        </div>
        <button type="button" onClick={saveProfile} disabled={saving} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white disabled:opacity-60">{saving ? "Saving..." : "Save details"}</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {([["today", "Today"], ["week", "Last 7 days"], ["month", "This month"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => preset(k)} className="px-3 py-1.5 rounded-full text-sm border bg-white text-gray-700 border-gray-200 hover:bg-gray-50">{l}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-xs text-gray-600">From<input type="date" className={inp} value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="text-xs text-gray-600">To<input type="date" className={inp} value={to} onChange={e => setTo(e.target.value)} /></label>
        </div>
        <button type="button" onClick={generate} disabled={loading} className="px-4 py-2 text-sm rounded-md bg-teal-600 text-white font-medium disabled:opacity-60">{loading ? "Generating..." : "Generate GST Invoice"}</button>
      </div>

      {report && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="font-bold text-gray-900">{profile.name || "Pharmacy"}</p>
              <p className="text-xs text-gray-600 max-w-md">{profile.address}</p>
              <p className="text-xs text-gray-600">GSTIN: {profile.gstin || "-"}{profile.drugLicence ? "   Drug Licence: " + profile.drugLicence : ""}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-teal-700">GST INVOICE</p>
              <p className="text-xs text-gray-600">Invoice No: issued on download</p>
              <p className="text-xs text-gray-600">Period: {period}</p>
              {billRange && <p className="text-xs text-gray-600">{billRange} ({report.bills} bills)</p>}
            </div>
          </div>
          {calc.rows.some(r => !r.hsn || r.gstPercent == null) && <p className="text-xs text-red-600 font-medium">Some medicines have no HSN code or GST %. Add them in Pharmacy, Inventory Management (Edit) or by importing the vendor bill, then generate again. Downloads are blocked until then.</p>}
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50"><tr>{heads.map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {calc.rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className={td}>{i + 1}</td><td className={td + " font-medium"}>{r.name}</td><td className={td + (r.hsn && r.gstPercent != null ? "" : " text-red-600 font-semibold")}>{hsnCell(r)}</td>
                    <td className={td}>{r.batchNo || "-"}</td><td className={td}>{fmtDate(r.expiryDate)}</td><td className={td}>{r.qty} {r.unit}</td>
                    <td className={td}>{money(r.mrp)}</td><td className={td}>{money(r.discount)}</td><td className={td}>{money(r.taxable)}</td>
                    <td className={td}>{money(r.cgAmt)}</td><td className={td}>{money(r.sgAmt)}</td><td className={td + " font-semibold"}>{money(r.total)}</td>
                  </tr>
                ))}
                {calc.rows.length === 0 && <tr><td colSpan={12} className="px-3 py-8 text-center text-sm text-gray-400">No sales in this period</td></tr>}
              </tbody>
            </table>
          </div>
          {calc.rows.length > 0 && (
            <div className="ml-auto w-full max-w-xs space-y-1 text-sm text-gray-800">
              <div className="flex justify-between"><span>Taxable value</span><span>{money(calc.taxable)}</span></div>
              <div className="flex justify-between"><span>CGST</span><span>{money(calc.cgst)}</span></div>
              <div className="flex justify-between"><span>SGST</span><span>{money(calc.sgst)}</span></div>
              <div className="flex justify-between"><span>Total GST</span><span>{money(r2(calc.cgst + calc.sgst))}</span></div>
              <div className="flex justify-between border-t border-gray-300 pt-1 text-base font-bold"><span>Invoice total</span><span>{money(calc.total)}</span></div>
            </div>
          )}
          {calc.rows.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={downloadPdf} disabled={busy !== ""} className="px-3 py-1.5 text-sm rounded-md bg-teal-600 text-white disabled:opacity-60">{busy === "pdf" ? "Preparing..." : "Download PDF"}</button>
              <button type="button" onClick={downloadExcel} disabled={busy !== ""} className="px-3 py-1.5 text-sm rounded-md border border-teal-600 text-teal-700 disabled:opacity-60">{busy === "xlsx" ? "Preparing..." : "Download Excel"}</button>
            </div>
          )}
        </div>
      )}
      {report && calc.rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
          <p className="font-semibold text-gray-900 text-sm">Sales and purchase detail</p>
          <p className="text-xs text-gray-500">Purchase details come from stock received in pharmacy inventory. The rate is the last purchase rate per unit, not per batch.</p>
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50"><tr>{detailHead.map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>{detailBody().map((r, i) => (<tr key={i} className="border-t border-gray-100">{r.map((c, j) => <td key={j} className={td}>{c}</td>)}</tr>))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
