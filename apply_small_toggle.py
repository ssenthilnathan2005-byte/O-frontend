# Replace the big Speak | Manual bar with one small switch button. Run from F:\O-frontend AFTER apply_speak_first.py
import os, sys
path = "src/components/PrescriptionDialog.tsx"
if not os.path.exists(path): sys.exit("STOP: run this from the O-frontend folder.")
with open(path, "r", encoding="utf-8", newline="") as f: raw = f.read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

OLD = '''        <div className="grid grid-cols-5 gap-1 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setMode("voice")}
            className={`col-span-3 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${mode === "voice" ? "bg-blue-600 text-white shadow" : "text-blue-700"}`}
          >
            <Mic className="w-4 h-4" /> Speak
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === "manual" ? "bg-white shadow text-blue-700" : "text-gray-500"}`}
          >
            <Pencil className="w-4 h-4" /> Manual
          </button>
        </div>
'''
NEW = '''        <div className="flex justify-end">
          {mode === "voice" ? (
            <button
              onClick={() => setMode("manual")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Pencil className="w-3.5 h-3.5" /> Manual
            </button>
          ) : (
            <button
              onClick={() => setMode("voice")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-300 text-sm text-blue-700 hover:bg-blue-50"
            >
              <Mic className="w-3.5 h-3.5" /> Speak
            </button>
          )}
        </div>
'''
if s.count(OLD) != 1:
    sys.exit("STOP: the big toggle bar wasn't found (apply_speak_first.py not applied, or already changed). Nothing changed.")
s = s.replace(OLD, NEW)
with open(path, "w", encoding="utf-8", newline="") as f: f.write(s.replace("\n", "\r\n") if crlf else s)
print("done: Speak is the main screen; a small Manual button switches, and a small Speak button switches back")
