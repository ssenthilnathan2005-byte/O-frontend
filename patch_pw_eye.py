import io
p = "src/pages/patient/ProfilePage.tsx"
with io.open(p, "r", encoding="utf-8", newline="") as fh:
    t = fh.read()
old = '<input type="password" placeholder="Current password" value={currentPw}'
new = '<input type={showPw ? "text" : "password"} placeholder="Current password" value={currentPw}'
if new in t:
    print("SKIP : already patched")
elif old in t:
    with io.open(p, "w", encoding="utf-8", newline="") as fh:
        fh.write(t.replace(old, new, 1))
    print("OK   : current password follows showPw")
else:
    print("MISS : pattern not found")
