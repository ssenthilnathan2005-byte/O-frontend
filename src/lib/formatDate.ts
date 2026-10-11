const pad = (n: number) => String(n).padStart(2, "0");

/** Any date -> dd/mm/yyyy. "yyyy-mm-dd" strings are read as-is (no timezone shift). */
export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m && v.length === 10) return m[3] + "/" + m[2] + "/" + m[1];
  }
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "";
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return pad(ist.getUTCDate()) + "/" + pad(ist.getUTCMonth() + 1) + "/" + ist.getUTCFullYear();
}

/** Any date -> dd/mm/yyyy, h:mm am/pm (IST). */
export function fmtDateTime(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "";
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const h = ist.getUTCHours();
  return fmtDate(d) + ", " + (h % 12 || 12) + ":" + pad(ist.getUTCMinutes()) + " " + (h >= 12 ? "pm" : "am");
}

/** "dd/mm/yyyy" typed text -> "yyyy-mm-dd", or "" if not a real date. */
export function parseDMY(t: string): string {
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(t.trim());
  if (!m) return "";
  const d = +m[1], mo = +m[2], y = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
  return y + "-" + pad(mo) + "-" + pad(d);
}
