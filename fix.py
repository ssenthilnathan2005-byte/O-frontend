p = r'F:\O-frontend\src\pages\FrontOfficeDashboard.tsx'
t = open(p, encoding='utf-8').read()
old = 'px-1.5 py-0.5">Front desk</span>}</p>'
if t.count(old) != 1: print("ERROR anchor"); exit(1)
new = 'px-1.5 py-0.5">Front desk</span>}{(docTab === "all" || !shown.some(x => x.doctor_name === docTab)) && <span className="ml-2 text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">{b.doctor_name}</span>}</p>'
t = t.replace(old, new)
open(p, 'w', encoding='utf-8').write(t)
print("Done")
