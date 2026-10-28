import sys, shutil, datetime
p = "src/pages/hospital-admin/HospitalAdminPanel.tsx"
raw = open(p, encoding="utf-8", newline="").read()
lines = raw.splitlines(keepends=True)
out, i, n = [], 0, 0
while i < len(lines):
    if lines[i].startswith("<<<<<<<"):
        j = i + 1; head = []
        while not lines[j].startswith("======="):
            head.append(lines[j]); j += 1
        k = j + 1; theirs = []
        while not lines[k].startswith(">>>>>>>"):
            theirs.append(lines[k]); k += 1
        if "violet-scroll-dark" not in "".join(theirs) or "has(NAV_MODULE" not in "".join(head):
            sys.exit("ABORT: unexpected conflict shape. Nothing written.")
        for h in head:
            out.append(h.replace('<nav className="flex-1', '<nav className="violet-scroll-dark flex-1'))
        n += 1; i = k + 1
    else:
        out.append(lines[i]); i += 1
if n != 2:
    sys.exit("ABORT: expected 2 conflicts, found %d. Nothing written." % n)
res = "".join(out)
if "<<<<<<<" in res or ">>>>>>>" in res:
    sys.exit("ABORT: markers remain. Nothing written.")
stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
shutil.copy(p, p + ".bak-merge-" + stamp)
open(p, "w", encoding="utf-8", newline="").write(res)
print("OK: resolved 2 conflicts. Backup: " + p + ".bak-merge-" + stamp)
