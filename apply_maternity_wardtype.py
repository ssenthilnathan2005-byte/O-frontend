import re, sys

def rd(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()

def wr(p, s):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

def patch(path, edits):
    s = rd(path)
    nl = "\r\n" if "\r\n" in s else "\n"
    for old, new in edits:
        n = s.count(old)
        if n != 1:
            print("ABORT: %s: expected 1 match, found %d for:\n  %s" % (path, n, old[:90]))
            sys.exit(1)
        s = s.replace(old, new.replace("\n", nl))
    return s, nl

api, _ = patch("src/lib/maternityApi.ts", [(
    'record: (inwardId: string) => call<any>("GET", `/maternity-record/${inwardId}`),',
    'record: (inwardId: string) => call<any>("GET", `/maternity-record/${inwardId}`),\n  eligible: () => call<{ ids: string[] }>("GET", "/maternity-eligible"),',
)])

inward, nl = patch("src/pages/hospital-admin/HAInward.tsx", [
    ('import MaternityModal from "./MaternityModal";',
     'import MaternityModal from "./MaternityModal";\nimport { maternityApi } from "../../lib/maternityApi";'),
    ('const [matId, setMatId] = useState<string | null>(null);',
     'const [matId, setMatId] = useState<string | null>(null);\n  const [matEligible, setMatEligible] = useState<Set<string>>(new Set());\n  useEffect(() => {\n    maternityApi.eligible().then((r) => setMatEligible(new Set(r.ids))).catch(() => setMatEligible(new Set()));\n  }, [patients]);'),
])
pat = re.compile(r'([ \t]*)<button onClick=\{\(\) => setMatId\(p\.id\)\}[^>]*>.*?</button>', re.S)
found = list(pat.finditer(inward))
if len(found) != 1:
    print("ABORT: HAInward.tsx: expected 1 baby-icon button, found %d" % len(found))
    sys.exit(1)
m = found[0]
indent = m.group(1)
wrapped = indent + "{matEligible.has(p.id) && (" + nl + m.group(0) + nl + indent + ")}"
inward = inward[:m.start()] + wrapped + inward[m.end():]

nurse, _ = patch("src/pages/nurse/NurseWards.tsx", [(
    '/matern|obstet|labou?r/i.test(wards.find(w => w.id === detailsTarget.wardId)?.name || "")',
    '(wards.find(w => w.id === detailsTarget.wardId)?.type || "").toLowerCase() === "maternity"',
)])

allp, _ = patch("src/pages/hospital-admin/HAAllPatients.tsx", [
    ('import { printMaternityRecord } from "../../lib/maternityRecord";',
     'import { printMaternityRecord } from "../../lib/maternityRecord";\nimport { maternityApi } from "../../lib/maternityApi";'),
    ('const [printingId, setPrintingId] = useState<string | null>(null);',
     'const [printingId, setPrintingId] = useState<string | null>(null);\n  const [matEligible, setMatEligible] = useState<Set<string>>(new Set());\n  useEffect(() => {\n    maternityApi.eligible().then((r) => setMatEligible(new Set(r.ids))).catch(() => setMatEligible(new Set()));\n  }, [inwardList]);'),
    ('v.type === "Inward" && v.inwardId && /maternity/i.test(v.place) && (',
     'v.type === "Inward" && v.inwardId && matEligible.has(v.inwardId) && ('),
])

wr("src/lib/maternityApi.ts", api)
wr("src/pages/hospital-admin/HAInward.tsx", inward)
wr("src/pages/nurse/NurseWards.tsx", nurse)
wr("src/pages/hospital-admin/HAAllPatients.tsx", allp)
print("DONE: patched maternityApi.ts, HAInward.tsx, NurseWards.tsx, HAAllPatients.tsx")
