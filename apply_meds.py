import re, json, datetime

CM = "src/lib/commonMedicines.ts"
CLEAN = "medicines_clean.txt"

src = open(CM, encoding="utf-8", newline="").read()
eol = "\r\n" if "\r\n" in src else "\n"

existing = {(a or b).lower() for a, b in re.findall(r'"([^"\n]+)"|\'([^\'\n]+)\'', src)}
clean = [l.strip() for l in open(CLEAN, encoding="utf-8").read().splitlines() if l.strip()]
new = [n for n in clean if n.lower() not in existing]

if not new:
    raise SystemExit("Nothing new to add.")

end = src.rindex("];")
if not src[:end].rstrip().endswith(","):
    raise SystemExit("Unexpected file layout: last entry has no trailing comma. Nothing written.")

block = "  // Added " + datetime.date.today().isoformat() + " from doctor-supplied lists" + eol
block += "".join("  " + json.dumps(n, ensure_ascii=False) + "," + eol for n in new)

out = src[:end] + block + src[end:]
open(CM, "w", encoding="utf-8", newline="").write(out)
print("Added", len(new), "names. First 5:", new[:5])
