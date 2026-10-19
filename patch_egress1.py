import sys, os, shutil
p = "src/context/StoreContext.tsx"
with open(p, encoding="utf-8", newline="") as f:
    t = f.read()
if "_bkLastAt" in t:
    sys.exit("ALREADY APPLIED - nothing changed")
def once(t, old, new):
    if t.count(old) != 1:
        sys.exit("ABORT: found %d for: %s" % (t.count(old), old[:70]))
    return t.replace(old, new)
t = once(t, "let _bkDeniedAt = 0;", "let _bkDeniedAt = 0;\nlet _bkLastAt = 0;")
t = once(t, "if (hid && Date.now() - _bkDeniedAt > 60000) {",
  'if (hid && document.visibilityState === "visible" && Date.now() - _bkDeniedAt > 60000 && Date.now() - _bkLastAt > 20000) {\n        _bkLastAt = Date.now();')
if not os.path.exists(p + ".bak-egress"):
    shutil.copy(p, p + ".bak-egress")
with open(p, "w", encoding="utf-8", newline="") as f:
    f.write(t)
print("ALL EDITS APPLIED")
