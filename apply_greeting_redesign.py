import re

path = "src/App.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = '''          <div className="mb-8">
            <p style={{ fontSize: 24, lineHeight: 1.3 }} className="font-bold text-gray-900">{timeGreeting}</p>
            {user && (
              <p style={{ fontSize: 16 }} className="font-medium text-gray-500 mt-1">{(user as { name: string }).name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate({ path: "/patient/hospitals" })}
            className="w-full flex items-center gap-4 bg-teal-700 rounded-2xl px-5 py-5 text-left mb-4 shadow-sm active:bg-teal-800 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-white text-[15px]">Book an appointment</h2>
              <p className="text-teal-50/80 text-xs mt-0.5">Find a hospital and reserve your visit in minutes</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/70 shrink-0" />
          </button>'''

new_block = '''          <div className="mb-6">
            <p style={{ fontSize: 28, lineHeight: 1.3 }} className="font-bold text-gray-900">
              {timeGreeting} <span role="img" aria-label="wave">\U0001F44B</span>
            </p>
            <p className="text-gray-500 mt-1" style={{ fontSize: 15 }}>Your health matters. We're here to help.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ path: "/patient/hospitals" })}
            className="relative w-full overflow-hidden bg-teal-700 rounded-3xl px-6 py-6 text-left mb-4 shadow-sm active:bg-teal-800 transition-colors"
          >
            <div className="absolute -right-6 -top-10 w-40 h-40 rounded-full bg-white/5" />
            <div className="absolute right-2 top-10 w-24 h-24 rounded-full bg-white/5" />
            <FileText className="absolute right-5 bottom-4 w-14 h-14 text-white/10" strokeWidth={1.5} />

            <div className="relative w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-4">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h2 className="relative font-bold text-white text-xl leading-snug mb-2">Book an<br/>appointment</h2>
            <p className="relative text-teal-50/80 text-sm mb-5">Find a hospital and get your token in minutes</p>
            <span className="relative inline-flex items-center gap-1.5 bg-white text-teal-800 font-semibold text-sm rounded-full px-5 py-2.5">
              Get Started <ChevronRight className="w-4 h-4" />
            </span>
          </button>'''

if old_block not in content:
    print("ERROR: old_block not found — no changes made.")
else:
    content = content.replace(old_block, new_block, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: greeting + appointment card redesigned.")
