import sys, os, shutil

def rd(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()

def sub(txt, f, old, new, allow_many=False):
    n = txt.count(old)
    if n == 0 or (n != 1 and not allow_many):
        sys.exit("ABORT %s: found %d for: %s" % (f, n, old[:70]))
    return txt.replace(old, new)

out = {}

# ---------- Pharmacy ----------
p = "src/pages/PharmacyDashboard.tsx"
t = rd(p)
t = sub(t, p, 'import { Button } from "@/components/ui/button";',
  'import { Button } from "@/components/ui/button";\nimport { useExtraNav, ExtraPanel } from "@/components/StaffExtras";')
t = sub(t, p,
  'const [tab, setTab] = useState<"rx" | "revenue" | "inventory" | "patients" | "sold" | "stock">("rx");',
  'const [tab, setTab] = useState<string>("rx");\n  const { nav: extraNav } = useExtraNav(["pharmacy", "inventory"]);')
t = sub(t, p, '  const sidebar = (',
  '  const ALL_NAV: { key: string; label: string; icon: any }[] = [...NAV_ITEMS, ...extraNav];\n  const sidebar = (')
t = sub(t, p, '{NAV_ITEMS.map(', '{ALL_NAV.map(', allow_many=True)
t = sub(t, p, '{tab === "revenue" ? <PharmRevenue />',
  '{tab.startsWith("x:") ? <ExtraPanel moduleKey={tab.slice(2)} /> : tab === "revenue" ? <PharmRevenue />')
out[p] = t

# ---------- Doctor ----------
p = "src/pages/doctor/DoctorDashboard.tsx"
t = rd(p)
t = sub(t, p, 'import MonthlyArchiveBanner from "../../components/MonthlyArchiveBanner";',
  'import MonthlyArchiveBanner from "../../components/MonthlyArchiveBanner";\nimport { useExtraNav, ExtraPanel } from "../../components/StaffExtras";')
t = sub(t, p, 'const [activeTab, setActiveTab] = useState<DoctorTab>(getInitialDoctorTab);',
  'const [activeTab, setActiveTab] = useState<DoctorTab>(getInitialDoctorTab);\n  const { nav: extraNav } = useExtraNav(["live_patients"]);')
TRIG = ('{extraNav.map(n => (<TabsTrigger key={n.key} value={n.key} '
        'className="flex h-auto min-w-0 flex-col items-center gap-1 px-1 py-2 text-[11px] leading-tight sm:flex-row sm:justify-center sm:gap-2 sm:px-3 sm:text-sm">'
        '<n.icon className="w-4 h-4" />{n.label}</TabsTrigger>))}')
t = sub(t, p, '</TabsList>', TRIG + '\n        </TabsList>')
CONT = '{extraNav.map(n => (<TabsContent key={n.key} value={n.key}><ExtraPanel moduleKey={n.key.slice(2)} /></TabsContent>))}'
t = sub(t, p, '<TabsContent value="presets">', CONT + '\n        <TabsContent value="presets">')
out[p] = t

for f, txt in out.items():
    if not os.path.exists(f + ".bak-gate"):
        shutil.copy(f, f + ".bak-gate")
    with open(f, "w", encoding="utf-8", newline="") as fh:
        fh.write(txt)
    print("updated", f)
print("ALL EDITS APPLIED")
