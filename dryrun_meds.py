import re, os

RAW = "medicines_raw.txt"
CM = "src/lib/commonMedicines.ts"
TS = re.compile(r"\[\d{1,2}/\d{1,2},\s*\d{1,2}:\d{2}\]\s*[^:\n]{1,30}:\s*")
TERM = {"Syrup", "Suspension", "Solution", "Tonic", "Supplement"}
MULTI = ["Calcium Acetate", "Calcium Lactate", "Benzoyl Peroxide", "Liquid Paraffin"]
DROP = {"celexocib"}
WINDOW = 6

def norm(s):
    s = re.sub(r"\s+", " ", s).strip()
    return re.sub(r"\s*\+\s*", " + ", s)

text = open(RAW, encoding="utf-8-sig", errors="replace").read()
text = TS.sub("\n", text)
lines = [norm(l) for l in text.splitlines() if l.strip()]
is_short = lambda l: len(l.split()) <= 6

known = {tuple(x.lower().split()) for x in [l for l in lines if is_short(l)] + MULTI}
maxlen = max(len(k) for k in known)

def known_len(toks, i):
    for L in range(min(maxlen, len(toks) - i), 0, -1):
        if tuple(t.lower() for t in toks[i:i + L]) in known:
            return L
    return 0

def absorb(toks, j):
    n = len(toks)
    if j + 1 < n and toks[j].lower() == "oral" and toks[j + 1] in TERM:
        return j + 2
    if j < n and toks[j] in TERM:
        return j + 1
    return j

def chunk(toks, i):
    n = len(toks)
    L = known_len(toks, i)
    if L:
        j = absorb(toks, i + L)
    else:
        k = next((m for m in range(i, min(n, i + WINDOW)) if toks[m] in TERM), None)
        j = k + 1 if k is not None else i + 1
    while j < n and toks[j] == "+" and j + 1 < n:
        j = chunk(toks, j + 1)
    return j

names, from_runon = [], []
for l in lines:
    if is_short(l):
        names.append(l)
        continue
    toks, i = l.split(), 0
    while i < len(toks):
        j = chunk(toks, i)
        e = " ".join(toks[i:j])
        names.append(e)
        if len(e.split()) > 1:
            from_runon.append(e)
        i = j

seen, dups, dropped = {}, 0, []
for n in names:
    key = n.lower()
    if not re.search(r"[A-Za-z]", n):
        continue
    if key in DROP:
        dropped.append(n)
        continue
    if key in seen:
        dups += 1
        continue
    seen[key] = n
clean = sorted(seen.values(), key=str.lower)
open("medicines_clean.txt", "w", encoding="utf-8").write("\n".join(clean) + "\n")

existing = []
if os.path.exists(CM):
    src = open(CM, encoding="utf-8-sig", errors="replace").read()
    existing = [a or b for a, b in re.findall(r'"([^"\n]+)"|\'([^\'\n]+)\'', src)]
ex = {e.lower() for e in existing}
new = [n for n in clean if n.lower() not in ex]

print("lines read:", len(lines))
print("entries before dedupe:", len(names), "| duplicates removed:", dups, "| dropped:", dropped)
print("final unique:", len(clean))
print("string literals found in commonMedicines.ts:", len(existing), "| first 8:", existing[:8])
print("new names to add:", len(new))
print()
print("=== multi-word entries split out of the run-on lines (check these) ===")
for e in sorted(set(from_runon), key=str.lower):
    print("  ", e)
