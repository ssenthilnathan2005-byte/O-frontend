import sys, shutil, os

def rd(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()

def once(txt, anchor, f):
    if txt.count(anchor) != 1:
        sys.exit("ABORT %s: expected 1 match, found %d for: %s" % (f, txt.count(anchor), anchor[:70]))

# ---- RouterContext.tsx ----
rf = "src/router/RouterContext.tsx"
r = rd(rf)
nl = "\r\n" if "\r\n" in r else "\n"
a1 = '  | { path: "/hospital-admin/billing" }'
a2 = 'if (pathname === "/hospital-admin/billing") return { path: "/hospital-admin/billing" };'
once(r, a1, rf); once(r, a2, rf)
r = r.replace(a1, a1 + nl + '  | { path: "/hospital-admin/permissions" }')
r = r.replace(a2, a2 + nl + '  if (pathname === "/hospital-admin/permissions") return { path: "/hospital-admin/permissions" };')

# ---- HospitalAdminPanel.tsx ----
pf = "src/pages/hospital-admin/HospitalAdminPanel.tsx"
p = rd(pf)
nl2 = "\r\n" if "\r\n" in p else "\n"
b1 = 'import { HeartPulse,'
b2 = 'import HABilling from "./HABilling";'
b3 = '{ path: "/hospital-admin/front-desk", label: "Front Desk", icon: ClipboardList },'
b4 = '    if (route.path === "/hospital-admin/billing") return <HABilling />;'
for a in (b1, b2, b3, b4): once(p, a, pf)
p = p.replace(b1, 'import { ShieldCheck, HeartPulse,')
p = p.replace(b2, b2 + nl2 + 'import HAPermissions from "./HAPermissions";')
p = p.replace(b3, b3 + nl2 + '  { path: "/hospital-admin/permissions", label: "Permissions", icon: ShieldCheck },')
p = p.replace(b4, b4 + nl2 + '    if (route.path === "/hospital-admin/permissions") return <HAPermissions />;')

for f in (rf, pf):
    if not os.path.exists(f + ".bak-perm"):
        shutil.copy(f, f + ".bak-perm")
with open(rf, "w", encoding="utf-8", newline="") as fh: fh.write(r)
with open(pf, "w", encoding="utf-8", newline="") as fh: fh.write(p)
print("ALL EDITS APPLIED")
