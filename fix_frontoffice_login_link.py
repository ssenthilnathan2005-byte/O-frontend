"""
Frontend (O-frontend): add "Not front office staff? Go to patient login"
to the Front Office login card, same style and target as the nurse login.
Run from the O-frontend folder:  python fix_frontoffice_login_link.py
Stops without changing anything if the code differs from what is expected.
"""
import sys, re, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
FL = root / "src/pages/FrontOfficeLogin.tsx"
NL = root / "src/pages/NurseLogin.tsx"

def load(p):
    raw = p.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n"), "\r\n" in raw

s, crlf = load(FL)
if "Go to patient login" in s:
    sys.exit("Already patched - nothing to do.")

# Reuse the exact router import the nurse login uses.
nurse, _ = load(NL)
m = re.search(r'^import \{[^}]*\buseRouter\b[^}]*\} from [^\n]+;$', nurse, re.M)
if not m:
    sys.exit("STOP: could not find the useRouter import in NurseLogin.tsx - nothing was changed.")
router_import = m.group(0)

# 1) import
anchor = 'import { useStore } from "../context/StoreContext";'
if s.count(anchor) != 1:
    sys.exit("STOP: useStore import not found exactly once - nothing was changed.")
s = s.replace(anchor, anchor + "\n" + router_import)

# 2) hook
anchor = "const { login } = useStore();"
if s.count(anchor) != 1:
    sys.exit("STOP: 'const { login } = useStore();' not found exactly once - nothing was changed.")
s = s.replace(anchor, anchor + "\n  const { navigate } = useRouter();")

# 3) link, inside the card, after the setup/login switch
BUTTON = (
    '          <button\n'
    '            type="button"\n'
    '            onClick={() => navigate({ path: "/login", tab: "patient", patientMode: "login" })}\n'
    '            className="w-full text-center text-xs text-gray-400 hover:text-teal-600 transition-colors"\n'
    '          >\n'
    '            Not front office staff? Go to patient login\n'
    '          </button>\n'
)
pat = re.compile(r'(\n\s*\)\}\n)(\s*</div>\n\s*</div>\n\s*</div>\n\s*\);\n\}\s*)$')
s, n = pat.subn(lambda mm: mm.group(1) + BUTTON + mm.group(2), s)
if n != 1:
    sys.exit(f"STOP: end of login card found {n} times, expected 1 - nothing was changed.")

FL.write_bytes((s.replace("\n", "\r\n") if crlf else s).encode("utf-8"))
print("Patched:", FL.name)
