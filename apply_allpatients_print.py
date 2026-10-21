import sys

def rd(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()

def wr(p, s):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

PATH = "src/pages/hospital-admin/HAAllPatients.tsx"
s = rd(PATH)
nl = "\r\n" if "\r\n" in s else "\n"

edits = [
    ('import { Search, X } from "lucide-react";',
     'import { Search, X, Printer } from "lucide-react";\nimport { toast } from "sonner";\nimport { printMaternityRecord } from "../../lib/maternityRecord";'),
    ('  paid?: boolean;\n};',
     '  paid?: boolean;\n  inwardId?: string;\n};'),
    ('const [selectedId, setSelectedId] = useState<string | null>(null);',
     'const [selectedId, setSelectedId] = useState<string | null>(null);\n  const [printingId, setPrintingId] = useState<string | null>(null);'),
    ('key: `ipd-${id || out.length}`,',
     'key: `ipd-${id || out.length}`,\n        inwardId: id || undefined,'),
    ('{v.place && <p><span className="text-gray-500">Ward / Bed:</span> {v.place}</p>}',
     '''{v.place && <p><span className="text-gray-500">Ward / Bed:</span> {v.place}</p>}
                  {v.type === "Inward" && v.inwardId && /maternity/i.test(v.place) && (
                    <button type="button" disabled={printingId === v.inwardId}
                      onClick={async () => {
                        setPrintingId(v.inwardId!);
                        try { await printMaternityRecord(v.inwardId!); }
                        catch (e: any) { toast.error(e?.message || "Could not open the record"); }
                        setPrintingId(null);
                      }}
                      className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-teal-600 text-teal-700 hover:bg-teal-50 disabled:opacity-50">
                      <Printer className="w-3.5 h-3.5" />{printingId === v.inwardId ? "Preparing..." : "Print maternity record"}
                    </button>
                  )}'''),
]

for old, new in edits:
    old_n = old.replace("\n", nl)
    n = s.count(old_n)
    if n != 1:
        print("ABORT: expected 1 match, found %d for:\n  %s" % (n, old[:90]))
        sys.exit(1)
    s = s.replace(old_n, new.replace("\n", nl))

wr(PATH, s)
print("DONE: patched HAAllPatients.tsx")
