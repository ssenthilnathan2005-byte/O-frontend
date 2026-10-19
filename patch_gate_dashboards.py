import sys, os, shutil

def rd(p):
    with open(p, encoding="utf-8", newline="") as f: return f.read()

def sub(txt, f, old, new):
    if txt.count(old) != 1:
        sys.exit("ABORT %s: expected 1 match, found %d for: %s" % (f, txt.count(old), old[:80]))
    return txt.replace(old, new)

out = {}

# ---- admin pages: let staff tokens supply the hospital id ----
OLD_ID = 'user?.role === "hospital_admin" ? (user as any).hospitalId : ""'
NEW_ID = '(user as any)?.hospitalId || ""'
for f in ["HAInward", "HAInventory", "HALab", "HAHR", "HAWards"]:
    p = "src/pages/hospital-admin/%s.tsx" % f
    out[p] = sub(rd(p), p, OLD_ID, NEW_ID)

# ---- Nurse ----
p = "src/pages/NurseDashboard.tsx"; t = rd(p)
t = sub(t, p, 'import NurseWards from "./nurse/NurseWards";',
        'import NurseWards from "./nurse/NurseWards";\nimport { useExtraNav, ExtraPanel } from "../components/StaffExtras";')
t = sub(t, p, 'type Tab = "dashboard" | "wards";', 'type Tab = string;')
t = sub(t, p, 'const [drawerOpen, setDrawerOpen] = useState(false);',
        'const [drawerOpen, setDrawerOpen] = useState(false);\n  const { nav: extraNav, can, loading: permLoading } = useExtraNav(["beds_wards", "vitals"]);')
t = sub(t, p, 'const navButtons = NAV.map(({ key, label, icon: Icon }) => (',
        'const navButtons = [...NAV.filter(n => n.key !== "wards" || permLoading || can("beds_wards")), ...extraNav].map(({ key, label, icon: Icon }) => (')
t = sub(t, p, '{tab === "wards" ? (',
        '{tab.startsWith("x:") ? <ExtraPanel moduleKey={tab.slice(2)} /> : tab === "wards" ? (')
out[p] = t

# ---- Front Desk ----
p = "src/pages/FrontOfficeDashboard.tsx"; t = rd(p)
t = sub(t, p, 'import { Vitals, vitalsText } from "@/lib/vitals";',
        'import { Vitals, vitalsText } from "@/lib/vitals";\nimport { useExtraNav, ExtraPanel } from "@/components/StaffExtras";')
t = sub(t, p, 'const [tab, setTab] = useState<"op" | "admit">("op");',
        'const [tab, setTab] = useState<string>("op");\n  const { nav: extraNav } = useExtraNav(["live_patients", "ipd", "beds_wards"]);')
t = sub(t, p, 'onClick={() => setTab("admit")}><BedDouble className="w-4 h-4" />Admit inpatient</button>',
        'onClick={() => setTab("admit")}><BedDouble className="w-4 h-4" />Admit inpatient</button>\n'
        '        {extraNav.map(n => (<button key={n.key} className={tabCls(tab === n.key)} onClick={() => setTab(n.key)}><n.icon className="w-4 h-4" />{n.label}</button>))}')
t = sub(t, p, '{tab === "op" ? <Outpatients /> : <Admit />}',
        '{tab.startsWith("x:") ? <ExtraPanel moduleKey={tab.slice(2)} /> : tab === "op" ? <Outpatients /> : <Admit />}')
out[p] = t

# ---- Lab ----
p = "src/pages/HospitalLabDashboard.tsx"; t = rd(p)
t = sub(t, p, 'import { useStore } from "../context/StoreContext";',
        'import { useStore } from "../context/StoreContext";\nimport { useExtraNav, ExtraPanel } from "../components/StaffExtras";')
t = sub(t, p, 'const [tab, setTab] = useState<"board" | "orders">("board");',
        'const [tab, setTab] = useState<string>("board");\n  const { nav: extraNav } = useExtraNav(["lab"]);')
t = sub(t, p, 'className={tabCls(tab === "orders")}>Bookings</button>',
        'className={tabCls(tab === "orders")}>Bookings</button>\n'
        '        {extraNav.map(n => (<button key={n.key} type="button" onClick={() => setTab(n.key)} className={tabCls(tab === n.key)}>{n.label}</button>))}')
t = sub(t, p, '{tab === "board" && <TokenBoard',
        '{tab.startsWith("x:") && <ExtraPanel moduleKey={tab.slice(2)} />}\n      {tab === "board" && <TokenBoard')
out[p] = t

for f, txt in out.items():
    if not os.path.exists(f + ".bak-gate"): shutil.copy(f, f + ".bak-gate")
    with open(f, "w", encoding="utf-8", newline="") as fh: fh.write(txt)
    print("updated", f)
print("ALL EDITS APPLIED")
