import io, re
p = "src/pages/patient/ProfilePage.tsx"
with io.open(p, "r", encoding="utf-8", newline="") as fh:
    t = fh.read()
nl = "\r\n" if "\r\n" in t else "\n"
if 'aria-label="Show or hide current password"' in t:
    print("SKIP : already patched")
else:
    m = re.search(r'<input type=\{showPw \? "text" : "password"\} placeholder="Current password".*?/>', t, re.S)
    if not m:
        print("MISS : current password input not found")
    else:
        inp = m.group(0)
        inp = inp.replace("w-full mt-2 border", "w-full border").replace("px-3 py-2", "pl-3 pr-20 py-2")
        btn = ('<button type="button" onClick={() => setShowPw(v => !v)} aria-label="Show or hide current password" '
               'className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 whitespace-nowrap shrink-0 text-xs font-medium text-gray-600 hover:text-gray-800">'
               '{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}{showPw ? "Hide" : "Show"}</button>')
        new = '<div className="relative mt-2">' + nl + inp + nl + btn + nl + '</div>'
        t = t[:m.start()] + new + t[m.end():]
        with io.open(p, "w", encoding="utf-8", newline="") as fh:
            fh.write(t)
        print("OK   : current password has its own Show/Hide button")
