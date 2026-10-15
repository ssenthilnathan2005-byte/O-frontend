import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getToken } from "@/api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
const r2 = (n: number) => Math.round(n * 100) / 100;
const plain = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number) => "\u20B9" + plain(n);
const ymd = (d: Date) => { const p = (n: number) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
const fmtDate = (s: string | null) => (s ? s.split("-").reverse().join("/") : "-");

async function pm<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + "/pharmacy-module" + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken(), ...(init?.headers || {}) },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

type Row = { name: string; batchNo: string | null; expiryDate: string | null; unit: string; qty: number; mrp: number; gross: number; discount: number; taxable: number };
type CalcRow = Row & { cgAmt: number; sgAmt: number; total: number };
type Profile = { name: string; address: string; phone: string; gstin: string; drugLicence: string; defaultHsn: string };
type Report = { from: string; to: string; bills: number; billNoFrom: number | null; billNoTo: number | null; profile: Profile; rows: Row[] };

export default function GstInvoice() {
  const today = ymd(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [cgst, setCgst] = useState("9");
  const [sgst, setSgst] = useState("9");
  const [profile, setProfile] = useState<Profile>({ name: "", address: "", phone: "", gstin: "", drugLicence: "", defaultHsn: "3004" });
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => { pm<Profile>("/gst-profile").then(setProfile).catch(() => {}); }, []);

  const cg = Number(cgst) || 0;
  const sg = Number(sgst) || 0;
  const hsn = profile.defaultHsn || "3004";

  const calc = useMemo(() => {
    const rows: CalcRow[] = (report?.rows || []).map(r => {
      const cgAmt = r2(r.taxable * cg / 100);
      const sgAmt = r2(r.taxable * sg / 100);
      return { ...r, cgAmt, sgAmt, total: r2(r.taxable + cgAmt + sgAmt) };
    });
    const sum = (f: (x: CalcRow) => number) => r2(rows.reduce((s, x) => s + f(x), 0));
    return { rows, discount: sum(x => x.discount), taxable: sum(x => x.taxable), cgst: sum(x => x.cgAmt), sgst: sum(x => x.sgAmt), total: sum(x => x.total) };
  }, [report, cg, sg]);

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
    if (!(cg >= 0 && cg <= 100 && sg >= 0 && sg <= 100)) return toast.error("CGST and SGST must be between 0 and 100");
    setLoading(true);
    try {
      const r = await pm<Report>("/gst-report?from=" + from + "&to=" + to);
      setReport(r);
      if (!r.rows.length) toast.info("No sales found in this date range");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  function needGstin(): boolean {
    if (!profile.gstin.trim()) { toast.error("Enter your GSTIN in Pharmacy details first"); return true; }
    return false;
  }

  const heads = ["#", "Medicine", "HSN", "Batch", "Expiry", "Qty", "MRP", "Discount", "Taxable value", "CGST " + cg + "%", "SGST " + sg + "%", "Total"];

  async function downloadPdf() {
    if (!report || needGstin()) return;
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
      doc.setFontSize(14); doc.text("GST INVOICE", W - 14, 14, { align: "right" });
      doc.setFontSize(9);
      doc.text("Invoice No: " + invNo, W - 14, 20, { align: "right" });
      doc.text("Period: " + period, W - 14, 25, { align: "right" });
      if (billRange) doc.text(billRange + " (" + report.bills + " bills)", W - 14, 30, { align: "right" });
      const body = calc.rows.map((r, i) => [String(i + 1), r.name, hsn, r.batchNo || "-", fmtDate(r.expiryDate), r.qty + " " + r.unit, plain(r.mrp), plain(r.discount), plain(r.taxable), plain(r.cgAmt), plain(r.sgAmt), plain(r.total)]);
      const right = { halign: "right" as const };
      autoTable(doc, {
        startY: Math.max(y + 5, 36),
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
      line("CGST @ " + cg + "%", "Rs. " + plain(calc.cgst));
      line("SGST @ " + sg + "%", "Rs. " + plain(calc.sgst));
      line("Total GST", "Rs. " + plain(r2(calc.cgst + calc.sgst)));
      line("Invoice total", "Rs. " + plain(calc.total), true);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text("Prices are exclusive of GST. CGST and SGST are added on the taxable value (amount after discount).", 14, fy + 4);
      doc.save(invNo + ".pdf");
    } catch (e: any) { toast.error("Could not create the PDF: " + (e?.message || "error")); } finally { setBusy(""); }
  }

  async function downloadExcel() {
    if (!report || needGstin()) return;
    setBusy("xlsx");
    try {
      const ExcelJS: any = await import("exceljs");
      const wb = new (ExcelJS.default || ExcelJS).Workbook();
      const ws = wb.addWorksheet("GST Invoice");
      ws.addRow([profile.name || "Pharmacy"]).font = { bold: true, size: 14 };
      ws.addRow([profile.address]);
      ws.addRow(["GSTIN: " + profile.gstin, profile.drugLicence ? "Drug Licence: " + profile.drugLicence : ""]);
      ws.addRow(["GST INVOICE"]).font = { bold: true };
      ws.addRow(["Invoice No", invNo]);
      ws.addRow(["Period", period]);
      if (billRange) ws.addRow([billRange, report.bills + " bills"]);
      ws.addRow([]);
      const head = ws.addRow(["#", "Medicine", "HSN", "Batch", "Expiry", "Qty", "Unit", "MRP", "Discount", "Taxable value", "CGST " + cg + "%", "SGST " + sg + "%", "Total"]);
      head.font = { bold: true };
      calc.rows.forEach((r, i) => ws.addRow([i + 1, r.name, hsn, r.batchNo || "", r.expiryDate ? fmtDate(r.expiryDate) : "", r.qty, r.unit, r.mrp, r.discount, r.taxable, r.cgAmt, r.sgAmt, r.total]));
      ws.addRow(["", "Total", "", "", "", "", "", "", calc.discount, calc.taxable, calc.cgst, calc.sgst, calc.total]).font = { bold: true };
      ws.addRow([]);
      ws.addRow(["", "Taxable value", "", "", "", "", "", "", "", calc.taxable]);
      ws.addRow(["", "CGST @ " + cg + "%", "", "", "", "", "", "", "", calc.cgst]);
      ws.addRow(["", "SGST @ " + sg + "%", "", "", "", "", "", "", "", calc.sgst]);
      ws.addRow(["", "Total GST", "", "", "", "", "", "", "", r2(calc.cgst + calc.sgst)]);
      ws.addRow(["", "Invoice total", "", "", "", "", "", "", "", calc.total]).font = { bold: true };
      [8, 9, 10, 11, 12, 13].forEach(c => { ws.getColumn(c).numFmt = "#,##0.00"; });
      ws.getColumn(2).width = 34; [4, 5, 7].forEach(c => { ws.getColumn(c).width = 14; }); [8, 9, 10, 11, 12, 13].forEach(c => { ws.getColumn(c).width = 15; });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = invNo + ".xlsx"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e: any) { toast.error("Could not create the Excel file: " + (e?.message || "error")); } finally { setBusy(""); }
  }

  const inp = "mt-0.5 w-full border border-gray-200 rounded-md text-sm px-2 py-1.5 bg-white text-gray-900";
  const th = "px-2 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm text-gray-800 whitespace-nowrap";

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">GST Invoice</h1>
        <p className="text-sm text-gray-500">Pick a date range, set the CGST and SGST rates, generate the invoice for all sales in that period, then download it.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <p className="font-semibold text-gray-900 text-sm">Pharmacy details (printed on the invoice)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-gray-600">GSTIN
            <input className={inp} value={profile.gstin} maxLength={15} placeholder="15-character GSTIN" onChange={e => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })} /></label>
          <label className="text-xs text-gray-600">Drug licence no.
            <input className={inp} value={profile.drugLicence} onChange={e => setProfile({ ...profile, drugLicence: e.target.value })} /></label>
          <label className="text-xs text-gray-600 md:col-span-2">Address
            <input className={inp} value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} /></label>
          <label className="text-xs text-gray-600">HSN code (all medicines)
            <input className={inp} value={profile.defaultHsn} inputMode="numeric" onChange={e => setProfile({ ...profile, defaultHsn: e.target.value })} /></label>
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
          <label className="text-xs text-gray-600">CGST %<input type="number" min={0} max={100} step="0.01" className={inp} value={cgst} onChange={e => setCgst(e.target.value)} /></label>
          <label className="text-xs text-gray-600">SGST %<input type="number" min={0} max={100} step="0.01" className={inp} value={sgst} onChange={e => setSgst(e.target.value)} /></label>
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
              <p className="text-xs text-gray-600">Invoice No: {invNo}</p>
              <p className="text-xs text-gray-600">Period: {period}</p>
              {billRange && <p className="text-xs text-gray-600">{billRange} ({report.bills} bills)</p>}
            </div>
          </div>
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50"><tr>{heads.map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {calc.rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className={td}>{i + 1}</td><td className={td + " font-medium"}>{r.name}</td><td className={td}>{hsn}</td>
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
              <div className="flex justify-between"><span>CGST @ {cg}%</span><span>{money(calc.cgst)}</span></div>
              <div className="flex justify-between"><span>SGST @ {sg}%</span><span>{money(calc.sgst)}</span></div>
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
    </div>
  );
}
