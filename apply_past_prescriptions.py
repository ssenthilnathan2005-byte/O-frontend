import os, shutil, sys

F = os.path.join("src", "pages", "patient", "MyPrescriptionsPage.tsx")
failed = False

if not os.path.exists(F):
    print("Cannot find " + F + " - run this from F:\\O-frontend")
    sys.exit(1)

with open(F, "r", encoding="utf-8", newline="") as f:
    raw = f.read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

if "showPast" in s:
    print("[SKIP] already patched")
    sys.exit(0)
if "openIds" not in s:
    print("[FAIL] run apply_compact_prescriptions.py first")
    sys.exit(1)

shutil.copyfile(F, F + ".bak")


def rep(old, new, label):
    global s, failed
    if old in s:
        s = s.replace(old, new, 1)
        print("  [OK]   " + label)
    else:
        failed = True
        print("  [FAIL] " + label + " - text not found")


rep('import { Pill, HandMetal, ArrowLeft, ChevronDown } from "lucide-react";',
    'import { Pill, HandMetal, ArrowLeft, ChevronDown, History as HistoryIcon } from "lucide-react";',
    "import history icon")

rep('const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";',
    'const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";\n\n'
    '// Given prescriptions older than this many days move into the "Past" view\n'
    'const PAST_DAYS = 20;',
    "PAST_DAYS setting")

rep('  const [openIds, setOpenIds] = useState<Set<string>>(new Set());',
    '  const [openIds, setOpenIds] = useState<Set<string>>(new Set());\n'
    '  const [showPast, setShowPast] = useState(false);',
    "showPast state")

rep('  return (\n    <div className="min-h-screen bg-gray-50 pt-0">',
    '  // Past = already given AND older than PAST_DAYS. Anything still pending stays in the live list.\n'
    '  const isPast = (p: Prescription) =>\n'
    '    p.status === "handed_over" && Date.now() - new Date(p.created_at).getTime() > PAST_DAYS * 86400000;\n'
    '  const pastList = prescriptions.filter(isPast);\n'
    '  const visible = showPast ? pastList : prescriptions.filter(p => !isPast(p));\n\n'
    '  return (\n    <div className="min-h-screen bg-gray-50 pt-0">',
    "past / live split")

OLD_HEADER = '''      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <button onClick={() => navigate({ path: "/patient/tokens" })} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-teal-600" />
          <h1 className="font-bold text-lg">My Prescriptions</h1>
        </div>
      </div>'''
NEW_HEADER = '''      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <button
          onClick={() => { if (showPast) setShowPast(false); else navigate({ path: "/patient/tokens" }); }}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-teal-600" />
          <h1 className="font-bold text-lg">{showPast ? "Past Prescriptions" : "My Prescriptions"}</h1>
        </div>
        <button
          onClick={() => setShowPast(v => !v)}
          aria-label="Past prescriptions"
          className={"ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium " +
            (showPast ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200")}
        >
          <HistoryIcon className="w-4 h-4" />
          {pastList.length > 0 && <span>{pastList.length}</span>}
        </button>
      </div>'''
rep(OLD_HEADER, NEW_HEADER, "header with Past icon")

rep('<div className="max-w-lg mx-auto px-4 py-4 space-y-3">\n        {loading ? (',
    '<div className="max-w-lg mx-auto px-4 py-4 space-y-3">\n'
    '        {showPast && !loading && pastList.length > 0 && (\n'
    '          <p className="text-[11px] text-gray-400">Given prescriptions older than {PAST_DAYS} days</p>\n'
    '        )}\n'
    '        {loading ? (',
    "past view caption")

rep('        ) : prescriptions.map(p => {',
    '        ) : visible.length === 0 ? (\n'
    '          <div className="text-center py-14">\n'
    '            <Pill className="w-9 h-9 text-gray-300 mx-auto mb-3" />\n'
    '            <p className="text-gray-400 text-sm">{showPast ? "No past prescriptions." : "No recent prescriptions."}</p>\n'
    '            {!showPast && pastList.length > 0 && (\n'
    '              <button onClick={() => setShowPast(true)} className="mt-2 text-xs text-teal-600 underline">\n'
    '                View {pastList.length} past prescription{pastList.length === 1 ? "" : "s"}\n'
    '              </button>\n'
    '            )}\n'
    '          </div>\n'
    '        ) : visible.map(p => {',
    "list uses live / past split")

rep('{n} medicine{n === 1 ? "" : "s"} {"\\u00b7"} {p.hospital_name}',
    '{n} medicine{n === 1 ? "" : "s"}{p.hospital_name ? " \\u00b7 " + p.hospital_name : ""}',
    "no dangling dot when hospital name is empty")

if crlf:
    s = s.replace("\n", "\r\n")
with open(F, "w", encoding="utf-8", newline="") as fh:
    fh.write(s)

print()
if failed:
    print("Some steps FAILED. Backup: " + F + ".bak. Paste this output to Claude.")
else:
    print("Done. Past icon added at the top right.")
