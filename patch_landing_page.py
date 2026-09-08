import re

path = "src/App.tsx"
with open(path) as f:
    content = f.read()

changes = 0

# 1. Import line — add the icons the new tiles need
old_import = 'import { Calendar, ChevronRight, MapPin, User, Search, Navigation, Loader2, XCircle, Users } from "lucide-react";'
new_import = 'import { Calendar, ChevronRight, MapPin, User, Search, Navigation, Loader2, XCircle, Users, Hospital, Pill, Ambulance, FileText } from "lucide-react";'
if old_import in content:
    content = content.replace(old_import, new_import, 1)
    changes += 1
    print("Import line: updated")
else:
    print("IMPORT LINE MARKER NOT FOUND")

# 2. quickLinks array — 2 tiles -> 4 tiles, with icons and full route objects
old_links = '''  const quickLinks = [
    { title: "Find Hospitals", sub: "TOP CLINICS", path: "/patient/hospitals" as const },
    { title: "Pharmacies", sub: "FIND NEAR YOU", path: "/pharmacies" as const },
  ];'''
new_links = '''  const quickLinks = [
    { title: "Find hospitals", sub: "Top clinics near you", route: { path: "/patient/hospitals" } as const, icon: Hospital },
    { title: "Pharmacies", sub: "Order medicines", route: { path: "/pharmacies" } as const, icon: Pill },
    { title: "Book ambulance", sub: "Emergency response", route: { path: "/ambulance" } as const, icon: Ambulance },
    { title: "My prescriptions", sub: "View your records", route: { path: "/login", tab: "patient", patientMode: "login" } as const, icon: FileText },
  ];'''
if old_links in content:
    content = content.replace(old_links, new_links, 1)
    changes += 1
    print("Quick links data: updated")
else:
    print("QUICK LINKS DATA MARKER NOT FOUND")

# 3. Hero section — add prominent search bar, and quick-link tile rendering — icon + consistent sizing
old_hero_and_grid = '''          <div className="mb-6 lg:mb-8 rounded-2xl bg-gradient-to-br from-teal-50 to-white border border-teal-100 px-5 py-8 lg:px-8 lg:py-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">Save Time on Your<br /><span className="text-teal-600">Doctor Visits</span></h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-10 lg:mb-12">
            {quickLinks.map((card, i) => (
              <div key={i} onClick={() => navigate({ path: card.path })} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all">
                <div><h3 className="font-semibold text-sm text-gray-800">{card.title}</h3><p className="text-[10px] font-bold text-gray-400 mt-0.5 tracking-wide">{card.sub}</p></div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            ))}
          </div>'''

new_hero_and_grid = '''          <div className="mb-8 lg:mb-10 rounded-2xl bg-gradient-to-br from-teal-50 to-white border border-teal-100 px-5 py-8 lg:px-8 lg:py-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight mb-6">Save Time on Your<br /><span className="text-teal-600">Doctor Visits</span></h2>
            <button
              type="button"
              onClick={() => navigate({ path: "/patient/hospitals" })}
              className="w-full max-w-md flex items-center gap-2.5 bg-white border-2 border-teal-600 rounded-xl px-4 py-3 text-left shadow-md hover:shadow-lg transition-shadow"
            >
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500">Search hospitals, doctors or specialty</span>
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10 lg:mb-12">
            {quickLinks.map((card, i) => (
              <div key={i} onClick={() => navigate(card.route)} className="bg-white border border-gray-200 rounded-xl px-4 py-4 flex items-center gap-3 cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                  <card.icon className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 truncate">{card.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{card.sub}</p>
                </div>
              </div>
            ))}
          </div>'''

if old_hero_and_grid in content:
    content = content.replace(old_hero_and_grid, new_hero_and_grid, 1)
    changes += 1
    print("Hero + quick link tiles: updated")
else:
    print("HERO/GRID MARKER NOT FOUND")

# 4. Top Hospitals section — de-duplicate: fewer items + "View all" link instead of a second full listing
old_hospitals_section = '''          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-6">Top Hospitals ({hospitals.length})</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-4">
              {hospitals.slice(0, 16).map(h => ('''

new_hospitals_section = '''          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Popular hospitals</h2>
              <button type="button" onClick={() => navigate({ path: "/patient/hospitals" })} className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors">
                View all hospitals
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-4">
              {hospitals.slice(0, 8).map(h => ('''

if old_hospitals_section in content:
    content = content.replace(old_hospitals_section, new_hospitals_section, 1)
    changes += 1
    print("Hospital grid section: updated")
else:
    print("HOSPITALS SECTION MARKER NOT FOUND")

with open(path, "w") as f:
    f.write(content)

print(f"\nTotal sections changed: {changes} / 4")
