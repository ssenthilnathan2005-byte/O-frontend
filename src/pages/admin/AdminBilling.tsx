import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { useStore } from "../../context/StoreContext";

const rateOf = (h: { plan?: string; ratePerToken?: number }) =>
  h.ratePerToken ?? (h.plan === "basic" ? 8 : 15);
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const monthLabel = (ym: string) =>
  new Date(ym + "-01T00:00:00").toLocaleString("en-IN", { month: "long", year: "numeric" });

export default function AdminBilling() {
  const { hospitals, bookings } = useStore();
  const nowMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(nowMonth);

  const { tokens, months } = useMemo(() => {
    const t = new Map<string, number>();
    const m = new Set<string>([nowMonth]);
    for (const b of bookings) {
      if (b.status === "cancelled" || !b.date) continue;
      const ym = b.date.slice(0, 7);
      m.add(ym);
      const k = (b.hospitalName || "").trim() + "|" + ym;
      t.set(k, (t.get(k) ?? 0) + 1);
    }
    return { tokens: t, months: Array.from(m).sort().reverse() };
  }, [bookings, nowMonth]);

  const countFor = (name: string, ym: string) => tokens.get(name.trim() + "|" + ym) ?? 0;
  const rows = hospitals.map((h) => {
    const n = countFor(h.name, month);
    return { h, n, rate: rateOf(h), amt: n * rateOf(h) };
  });
  const totalTokens = rows.reduce((s, r) => s + r.n, 0);
  const totalAmt = rows.reduce((s, r) => s + r.amt, 0);
  const history = months.map((ym) => {
    let n = 0, amt = 0;
    for (const h of hospitals) { const c = countFor(h.name, ym); n += c; amt += c * rateOf(h); }
    return { ym, n, amt };
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-muted-foreground mt-1">Amount each hospital owes = tokens booked × plan rate (cancelled bookings excluded)</p>
        </div>
        <select value={month} onChange={(e) => setMonth(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-card">
          {months.map((ym) => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mb-6 inline-block min-w-[240px]">
        <div className="text-sm text-muted-foreground">Total due for {monthLabel(month)}</div>
        <div className="text-3xl font-bold mt-1">{inr(totalAmt)}</div>
        <div className="text-xs text-muted-foreground">{totalTokens} tokens across {hospitals.length} hospitals</div>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto bg-card mb-10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Hospital</TableHead>
              <TableHead className="text-center">Plan</TableHead>
              <TableHead className="text-right">Rate / token</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Amount due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ h, n, rate, amt }) => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.name}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{h.plan === "basic" ? "Basic" : "Premium"}</Badge>
                </TableCell>
                <TableCell className="text-right">{inr(rate)}</TableCell>
                <TableCell className="text-right">{n}</TableCell>
                <TableCell className="text-right font-semibold">{inr(amt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h2 className="text-lg font-semibold mb-3">All months</h2>
      <div className="rounded-xl border border-border overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Amount due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((r) => (
              <TableRow key={r.ym} onClick={() => setMonth(r.ym)} className="cursor-pointer">
                <TableCell>{monthLabel(r.ym)}</TableCell>
                <TableCell className="text-right">{r.n}</TableCell>
                <TableCell className="text-right font-semibold">{inr(r.amt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
