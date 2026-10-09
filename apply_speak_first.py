# Make Speak the main option and Manual the secondary one. Run from F:\O-frontend:  python apply_speak_first.py
import os, sys
path = "src/components/PrescriptionDialog.tsx"
if not os.path.exists(path): sys.exit("STOP: run this from the O-frontend folder.")
with open(path, "r", encoding="utf-8", newline="") as f: raw = f.read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

OLD_TOGGLE = '''        <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setMode("manual")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "manual" ? "bg-white shadow text-blue-700" : "text-gray-500"}`}
          >
            <Pencil className="w-4 h-4" /> Manual
          </button>
          <button
            onClick={() => setMode("voice")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "voice" ? "bg-white shadow text-blue-700" : "text-gray-500"}`}
          >
            <Mic className="w-4 h-4" /> Speak
          </button>
        </div>
'''
NEW_TOGGLE = '''        <div className="grid grid-cols-5 gap-1 p-1 bg-gray-100 rounded-xl">
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
# (old, new, expected occurrences)
OPS = [
  ('useState<"manual" | "voice">("manual");', 'useState<"manual" | "voice">("voice");', 1),
  ('  // always start in Manual mode (the familiar workflow) when the dialog is opened again\n  useEffect(() => { if (!open) setMode("manual"); }, [open]);',
   '  // always start in Speak mode when the dialog is opened again\n  useEffect(() => { if (!open) setMode("voice"); }, [open]);', 1),
  ('    setMode("manual");\n    onConfirm();', '    setMode("voice");\n    onConfirm();', 2),
  (OLD_TOGGLE, NEW_TOGGLE, 1),
]
for i, (old, new, n) in enumerate(OPS, 1):
    if s.count(old) != n:
        sys.exit("STOP: patch %d did not match (already applied, or the file differs). Nothing changed." % i)
for old, new, n in OPS: s = s.replace(old, new)
with open(path, "w", encoding="utf-8", newline="") as f: f.write(s.replace("\n", "\r\n") if crlf else s)
print("done: Speak is now the default and the main option")
