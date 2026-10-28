import sys, shutil, datetime
p = "src/router/RouterContext.tsx"
s = open(p, encoding="utf-8").read()
if "/hospital-admin/functioning" in s:
    sys.exit("Already applied, nothing to do")
T = '| { path: "/hospital-admin/permissions" }'
M = 'if (pathname === "/hospital-admin/permissions") return { path: "/hospital-admin/permissions" };'
for a in (T, M):
    if s.count(a) != 1:
        sys.exit("ABORT: anchor %r found %d times (expected 1). Nothing written." % (a, s.count(a)))
stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
shutil.copy(p, p + ".bak-func-" + stamp)
s = s.replace(T, T + '\n  | { path: "/hospital-admin/functioning" }', 1)
s = s.replace(M, M + '\n  if (pathname === "/hospital-admin/functioning") return { path: "/hospital-admin/functioning" };', 1)
open(p, "w", encoding="utf-8").write(s)
print("OK. Backup: " + p + ".bak-func-" + stamp)
