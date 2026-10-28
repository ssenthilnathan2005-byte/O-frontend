import re, sys, pathlib

design = pathlib.Path("src/mobile/MobileDesign.tsx")
app = pathlib.Path("src/App.tsx")
if not design.exists():
    sys.exit("src/mobile/MobileDesign.tsx not found - run convert_mockup.py first")

d = design.read_text(encoding="utf-8")
m = re.search(r"export\s+default\s+function\s+(\w+)", d) or re.search(r"export\s+default\s+(\w+)\s*;?", d)
if m:
    imp = 'import MobileDesign from "./mobile/MobileDesign";'
    comp = "MobileDesign"
else:
    n = re.search(r"export\s+(?:function|const)\s+(\w+)", d)
    if not n:
        sys.exit("Could not find an export in MobileDesign.tsx")
    comp = n.group(1)
    imp = 'import { %s } from "./mobile/MobileDesign";' % comp

raw = app.read_bytes().decode("utf-8")
nl = "\r\n" if "\r\n" in raw else "\n"
s = raw

if "mobile-preview" in s:
    sys.exit("Already patched")

def once(s, old, new):
    if s.count(old) != 1:
        sys.exit("Expected exactly one match for: %r (found %d)" % (old, s.count(old)))
    return s.replace(old, new)

s = once(s, 'import TopNav from "./components/layout/TopNav";',
         'import TopNav from "./components/layout/TopNav";' + nl + imp)
s = once(s, "  function renderPage() {",
         "  function renderPage() {" + nl +
         '    if (window.location.pathname === "/mobile-preview") return <%s />;' % comp)
s = once(s, "  const hideTopNav =",
         "  const hideTopNav =" + nl + '    window.location.pathname === "/mobile-preview" ||')

app.write_bytes(s.encode("utf-8"))
print("Patched src/App.tsx - preview at /mobile-preview, component:", comp)
