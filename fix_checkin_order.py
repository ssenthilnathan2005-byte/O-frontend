"""
Frontend (O-frontend): in Front Office check-in form, put Cancel first
and Confirm check-in second (both stay on the right).
Run from the O-frontend folder:  python fix_checkin_order.py
Stops without changing anything if the code differs from what is expected.
"""
import sys, re, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
FO = root / "src/pages/FrontOfficeDashboard.tsx"

raw = FO.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

cancel = r'<Button\s+size="sm"\s+variant="ghost"\s+onClick=\{\(\) => setEditId\(null\)\}>Cancel</Button>'
confirm = r'<Button\s+size="sm"\s+onClick=\{\(\) => checkIn\(b\.id\)\}>Confirm check-in</Button>'

if re.search(r'justify-end gap-2">\s*' + cancel + r'\s*' + confirm, s):
    sys.exit("Already patched - nothing to do.")

pattern = re.compile(r'(justify-end gap-2">)(\s*)(' + confirm + r')(\s*)(' + cancel + r')')
s, n = pattern.subn(r'\1\2\5\4\3', s)
if n != 1:
    sys.exit(f"STOP: check-in button row found {n} times, expected 1 - nothing was changed.")

FO.write_bytes((s.replace("\n", "\r\n") if crlf else s).encode("utf-8"))
print("Patched:", FO.name)
