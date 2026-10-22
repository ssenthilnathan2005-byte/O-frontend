import re,sys
# Run from F:\O-frontend:  python add_ipd_revenue_dashboard.py
base="src/pages/hospital-admin/"
def rw(fn,f):
    p=base+fn; raw=open(p,encoding="utf-8",newline="").read()
    crlf="\r\n" in raw; s=raw.replace("\r\n","\n")
    s2=f(s); assert s2!=s,fn
    if crlf: s2=s2.replace("\n","\r\n")
    open(p,"w",encoding="utf-8",newline="").write(s2)

def rep(s,a,b,count=1):
    assert s.count(a)==count,(a,s.count(a)); return s.replace(a,b)

HOOK='''export type IpdRevenue = { collected: number; patients: number; perDay: { date: string; amount: number }[] };
const EMPTY_IPD: IpdRevenue = { collected: 0, patients: 0, perDay: [] };

// IPD (inward) money collected in the period, net of refunds. Uses the existing /ipd-billing/report route.
export function useIpdRevenue(from: string, to: string): IpdRevenue {
  const [v, setV] = useState<IpdRevenue>(EMPTY_IPD);
  useEffect(() => {
    let off = false;
    const load = async () => {
      try {
        const qs = new URLSearchParams({ from, to });
        const r = await fetch(`${BASE}/ipd-billing/report?${qs.toString()}`, { headers: { Authorization: `Bearer ${getToken()}` } });
        if (!r.ok) return;
        const d = await r.json();
        if (off || !d) return;
        setV({
          collected: Number(d.collected) || 0,
          patients: Number(d.patients) || 0,
          perDay: Array.isArray(d.perDay) ? d.perDay.map((x: any) => ({ date: String(x.date), amount: Number(x.amount) || 0 })) : [],
        });
      } catch { }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { off = true; clearInterval(t); };
  }, [from, to]);
  return v;
}

'''
def pa(s):
    s=rep(s,"export function useLabRevenue(", HOOK+"export function useLabRevenue(")
    s=rep(s,"  const lab = useLabRevenue(from, to);\n  const [view,","  const lab = useLabRevenue(from, to);\n  const ipd = useIpdRevenue(from, to).collected;\n  const [view,")
    s=rep(s,'    { name: "Laboratory", value: lab, color: "#2563eb" },\n','    { name: "Laboratory", value: lab, color: "#2563eb" },\n    { name: "Inpatient (IPD)", value: ipd, color: "#7c3aed" },\n')
    s=rep(s,"Consultations vs Laboratory vs Pharmacy","Consultations vs Laboratory vs IPD vs Pharmacy")
    return s
rw("PharmacyAnalytics.tsx",pa)

def ha(s):
    s=rep(s,'import PharmacyAnalytics, { useLabRevenue } from "./PharmacyAnalytics";','import PharmacyAnalytics, { useLabRevenue, useIpdRevenue } from "./PharmacyAnalytics";')
    s=rep(s,"import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer }","import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer }")
    s=rep(s,"  const labPrev = useLabRevenue(prevRange.from, prevRange.to);\n","  const labPrev = useLabRevenue(prevRange.from, prevRange.to);\n  const ipdNow = useIpdRevenue(range.from, range.to);\n  const ipdPrev = useIpdRevenue(prevRange.from, prevRange.to);\n")
    s=rep(s,"  const totalRev = (kpis.revenue ?? 0) + labNow + (pharmNow ? pharmNow.revenue : 0);\n",
"  const opdRev = (kpis.revenue ?? 0) + labNow + (pharmNow ? pharmNow.revenue : 0); // outpatient: consultations + lab + pharmacy\n  const ipdRev = ipdNow.collected; // inpatient: IPD payments collected (net of refunds)\n  const totalRev = opdRev + ipdRev;\n")
    s=rep(s,"kpis.revenuePrevious + labPrev + pharmPrevNow : null;","kpis.revenuePrevious + labPrev + pharmPrevNow + ipdPrev.collected : null;")
    # chart series
    s=rep(s,"useMemo<{ label: string; amount: number }[]>(() => {\n    if (!rangeValid) return [];\n    const fee","useMemo<{ label: string; amount: number; ipd: number }[]>(() => {\n    if (!rangeValid) return [];\n    const fee")
    s=rep(s,"    const out = new Map<string, number>();\n    for (const day of days) {\n      const key = byMonth ? day.slice(0, 7) : day;\n      out.set(key, (out.get(key) ?? 0) + (perDay.get(day) ?? 0));\n    }\n    return Array.from(out, ([key, amount]) => ({ label: byMonth ? key : key.slice(5), amount }));\n  }, [rangeBookings, myDoctors, rangeKey, rangeValid]);\n  const revenueChartTotal = revenueSeries.reduce((s, r) => s + r.amount, 0);",
"""    const ipdByDay = new Map(ipdNow.perDay.map((x) => [x.date, x.amount]));
    const out = new Map<string, { amount: number; ipd: number }>();
    for (const day of days) {
      const key = byMonth ? day.slice(0, 7) : day;
      const cur = out.get(key) ?? { amount: 0, ipd: 0 };
      cur.amount += perDay.get(day) ?? 0;
      cur.ipd += ipdByDay.get(day) ?? 0;
      out.set(key, cur);
    }
    return Array.from(out, ([key, v]) => ({ label: byMonth ? key : key.slice(5), amount: v.amount, ipd: v.ipd }));
  }, [rangeBookings, myDoctors, ipdNow.perDay, rangeKey, rangeValid]);
  const revenueChartTotal = revenueSeries.reduce((s, r) => s + r.amount + r.ipd, 0);""")
    s=rep(s,"{money(revenueChartTotal)} from completed visits","{money(revenueChartTotal)} OPD visits + IPD collections")
    s=rep(s,"revenueSeries.some((r) => r.amount > 0)","revenueSeries.some((r) => r.amount > 0 || r.ipd > 0)")
    s=rep(s,'''                      <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => [money(Number(v)), "Revenue"]} />
                      <Bar dataKey="amount" name="Revenue" fill="#10b981" maxBarSize={32} radius={[3, 3, 0, 0]} />''',
'''                      <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v, n) => [money(Number(v)), String(n)]} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="amount" name="Outpatient (OPD)" stackId="rev" fill="#10b981" maxBarSize={32} />
                      <Bar dataKey="ipd" name="Inpatient (IPD)" stackId="rev" fill="#7c3aed" maxBarSize={32} radius={[3, 3, 0, 0]} />''')
    # card: OPD / IPD breakdown above the split
    s=rep(s,'''                {split && splitTotal > 0 ? (''','''                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
                    <div className="text-[11px] text-emerald-700">Outpatient (OPD)</div>
                    <div className="text-sm font-semibold text-gray-900">{money(kpis.revenue === null ? null : opdRev)}</div>
                  </div>
                  <div className="rounded-lg bg-violet-50 px-2 py-1.5">
                    <div className="text-[11px] text-violet-700">Inpatient (IPD)</div>
                    <div className="text-sm font-semibold text-gray-900">{money(ipdRev)}</div>
                  </div>
                </div>
                {split && splitTotal > 0 ? (''')
    s=rep(s,'isToday ? "Today\'s Revenue" : "Revenue"} icon=','isToday ? "Today\'s Total Revenue" : "Total Revenue"} icon=')
    return s
rw("HADashboard.tsx",ha)
