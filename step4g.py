import sys, shutil, datetime
card = "src/pages/hospital-admin/HAIntakeSettings.tsx"
page = "src/pages/hospital-admin/HospitalFunctioning.tsx"
panel = "src/pages/hospital-admin/HospitalAdminPanel.tsx"
c = open(card, encoding="utf-8").read()
g = open(page, encoding="utf-8").read()
p = open(panel, encoding="utf-8").read()
if "hideType" in c:
    sys.exit("Already applied, nothing to do")
C1 = 'export default function HAIntakeSettings() {'
C2 = '<div className="space-y-1">\n              <label className="text-sm font-medium text-gray-700">Hospital type</label>'
G1 = '      </Card>\n    </div>\n  );\n}'
G2 = 'import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";\n'
P1 = '<HAIntakeSettings /><HAFrontDeskCollections />'
P2 = 'import HAIntakeSettings from "./HAIntakeSettings";\n'
for name, txt, a in (("card", c, C1), ("card", c, C2), ("page", g, G1), ("page", g, G2), ("panel", p, P1), ("panel", p, P2)):
    if txt.count(a) != 1:
        sys.exit("ABORT: %s anchor %r found %d times (expected 1). Nothing written." % (name, a, txt.count(a)))
stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
for f in (card, page, panel):
    shutil.copy(f, f + ".bak-fold-" + stamp)
c = c.replace(C1, 'export default function HAIntakeSettings({ hideType = false }: { hideType?: boolean } = {}) {', 1)
c = c.replace(C2, '<div className={"space-y-1" + (hideType ? " hidden" : "")}>\n              <label className="text-sm font-medium text-gray-700">Hospital type</label>', 1)
g = g.replace(G2, G2 + 'import HAIntakeSettings from "./HAIntakeSettings";\n', 1)
g = g.replace(G1, '      </Card>\n      <HAIntakeSettings key={savedType} hideType />\n    </div>\n  );\n}', 1)
p = p.replace(P1, '<HAFrontDeskCollections />', 1)
p = p.replace(P2, '', 1)
open(card, "w", encoding="utf-8").write(c)
open(page, "w", encoding="utf-8").write(g)
open(panel, "w", encoding="utf-8").write(p)
print("OK. Backups: *.bak-fold-" + stamp)
