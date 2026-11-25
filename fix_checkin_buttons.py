"""
Frontend (O-frontend): in Front Office, move the "Confirm check-in" and
"Cancel" buttons to the right side of the check-in form.
Run from the O-frontend folder:  python fix_checkin_buttons.py
Stops without changing anything if the code differs from what is expected.
"""
import sys, re, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
FO = root / "src/pages/FrontOfficeDashboard.tsx"

raw = FO.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

if re.search(r'className="sm:col-span-3 flex justify-end gap-2">\s*<Button[^\n]*checkIn\(b\.id\)', s):
    sys.exit("Already patched - nothing to do.")

pattern = re.compile(
    r'(className="sm:col-span-3 flex) (gap-2">\s*<Button\s+size="sm"\s+onClick=\{\(\) => checkIn\(b\.id\)\}>Confirm check-in</Button>)'
)
s, n = pattern.subn(r'\1 justify-end \2', s)
if n != 1:
    sys.exit(f"STOP: check-in button row found {n} times, expected 1 - nothing was changed.")

FO.write_bytes((s.replace("\n", "\r\n") if crlf else s).encode("utf-8"))
print("Patched:", FO.name)
