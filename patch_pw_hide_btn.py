import io
p = "src/pages/patient/ProfilePage.tsx"
with io.open(p, "r", encoding="utf-8", newline="") as fh:
    t = fh.read()
cls = "absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 whitespace-nowrap shrink-0 text-xs font-medium text-gray-600 hover:text-gray-800"
old = 'className="' + cls + '"'
new = 'className={pwEditing ? "' + cls + '" : "hidden"}'
if new in t:
    print("SKIP : already patched")
elif old in t:
    with io.open(p, "w", encoding="utf-8", newline="") as fh:
        fh.write(t.replace(old, new, 1))
    print("OK   : show/hide only while changing password")
else:
    print("MISS : pattern not found")
