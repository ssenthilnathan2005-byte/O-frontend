import re

FILE = "src/pages/patient/LabDetailPage.tsx"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

old_block = '''          {tests.map((test) => (
            <div
              key={test.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{test.name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Clock className="w-3.5 h-3.5" /> Report in {test.report_hours}h · {test.sample_type} sample
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900 text-sm">₹{test.price}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      navigate({ path: "/login", tab: "patient", patientMode: "login" });
                      return;
                    }
                    setBookingTest(test);
                  }}
                  className="mt-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
                >
                  Book →
                </button>
              </div>
            </div>
          ))}'''

new_block = '''          {tests.map((test) => (
            <div
              key={test.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!user) {
                  navigate({ path: "/login", tab: "patient", patientMode: "login" });
                  return;
                }
                setBookingTest(test);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!user) {
                    navigate({ path: "/login", tab: "patient", patientMode: "login" });
                    return;
                  }
                  setBookingTest(test);
                }
              }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-teal-200 hover:shadow-md transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{test.name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Clock className="w-3.5 h-3.5" /> Report in {test.report_hours}h · {test.sample_type} sample
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900 text-sm">₹{test.price}</p>
                <span className="mt-1 text-xs font-semibold text-teal-600 block">
                  Book →
                </span>
              </div>
            </div>
          ))}'''

if old_block not in content:
    print("ERROR: Could not find the exact block to replace. No changes made.")
    print("The file may have been modified since this script was written.")
else:
    content = content.replace(old_block, new_block)
    with open(FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Success: Updated {FILE}")
    print("The whole test card is now clickable (not just the 'Book' link).")
