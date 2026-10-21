import sys

def rd(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()

def wr(p, s):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

PATH = "src/pages/FrontOfficeDashboard.tsx"
s = rd(PATH)
nl = "\r\n" if "\r\n" in s else "\n"

BILL_BTN = '<button type="button" onClick={() => setBillId(p.id)} className="flex items-center gap-1 text-xs text-teal-700 border border-teal-200 rounded-md px-2 py-0.5 hover:bg-teal-50"><Receipt className="w-3 h-3" />Bill</button>'

PRINT_BTN = """{matEligible.has(p.id) && (
                    <button type="button" disabled={printingId === p.id}
                      onClick={async () => {
                        setPrintingId(p.id);
                        try { await printMaternityRecord(p.id); }
                        catch (e: any) { toast.error(e?.message || "Could not open the record"); }
                        setPrintingId(null);
                      }}
                      className="flex items-center gap-1 text-xs text-pink-700 border border-pink-200 rounded-md px-2 py-0.5 hover:bg-pink-50 disabled:opacity-50">
                      <Printer className="w-3 h-3" />{printingId === p.id ? "Preparing..." : "Print record"}
                    </button>
                  )}"""

edits = [
    ('import { LogOut, RefreshCw, UserCheck, BedDouble, Undo2, ClipboardList, Activity, Receipt } from "lucide-react";',
     'import { LogOut, RefreshCw, UserCheck, BedDouble, Undo2, ClipboardList, Activity, Receipt, Printer } from "lucide-react";'),
    ('import IPDBillModal from "./hospital-admin/IPDBillModal";',
     'import IPDBillModal from "./hospital-admin/IPDBillModal";\nimport { maternityApi } from "@/lib/maternityApi";\nimport { printMaternityRecord } from "@/lib/maternityRecord";'),
    ('const [billId, setBillId] = useState<string | null>(null);',
     'const [billId, setBillId] = useState<string | null>(null);\n  const [printingId, setPrintingId] = useState<string | null>(null);\n  const [matEligible, setMatEligible] = useState<Set<string>>(new Set());'),
    ('useEffect(() => { load(); }, [load]);\n\n  async function submit() {',
     'useEffect(() => { load(); }, [load]);\n  useEffect(() => {\n    maternityApi.eligible().then((r) => setMatEligible(new Set(r.ids))).catch(() => setMatEligible(new Set()));\n  }, [inward]);\n\n  async function submit() {'),
    (BILL_BTN,
     '<div className="flex items-center gap-1.5">\n                  ' + PRINT_BTN + '\n                  ' + BILL_BTN + '\n                </div>'),
]

for old, new in edits:
    o = old.replace("\n", nl)
    n = s.count(o)
    if n != 1:
        print("ABORT: expected 1 match, found %d for:\n  %s" % (n, old[:100]))
        sys.exit(1)
    s = s.replace(o, new.replace("\n", nl))

wr(PATH, s)
print("DONE: patched FrontOfficeDashboard.tsx")
