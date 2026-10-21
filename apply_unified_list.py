import os, shutil, sys

DIALOG = os.path.join("src", "components", "PrescriptionDialog.tsx")
VOICE = os.path.join("src", "components", "VoicePrescription.tsx")
failed = False


def load(p):
    with open(p, "r", encoding="utf-8", newline="") as f:
        raw = f.read()
    return raw.replace("\r\n", "\n"), ("\r\n" in raw)


def save(p, t, crlf):
    if crlf:
        t = t.replace("\n", "\r\n")
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(t)


def ok(m): print("  [OK]   " + m)
def skip(m): print("  [SKIP] " + m)
def fail(m):
    global failed
    print("  [FAIL] " + m)
    failed = True


for p in (DIALOG, VOICE):
    if not os.path.exists(p):
        print("Cannot find " + p + " - run this from F:\\O-frontend")
        sys.exit(1)

# =================================================================== Voice
print("Patching " + VOICE)
s, crlf = load(VOICE)
shutil.copyfile(VOICE, VOICE + ".bak")

old = "onItemsChange?: (items: VoiceItem[]) => void;"
new = "onItemsChange?: (items: VoiceItem[], pending?: string[]) => void;"
if new in s:
    skip("Props type already updated")
elif old in s:
    s = s.replace(old, new, 1)
    ok("Props type updated")
else:
    fail("could not find onItemsChange in Props (run apply_merge_voice_manual.py first)")

old = "onItemsChange?.(meds.filter(m => blockingIssues(m).length === 0).map(toPrescriptionItem));"
new = ("onItemsChange?.(\n"
       "      meds.filter(m => blockingIssues(m).length === 0).map(toPrescriptionItem),\n"
       "      meds.filter(m => blockingIssues(m).length > 0).map(m => m.name || \"Unnamed medicine\"),\n"
       "    );")
if "m.name || \"Unnamed medicine\"" in s:
    skip("effect already reports pending medicines")
elif old in s:
    s = s.replace(old, new, 1)
    ok("effect now also reports voice medicines that still need details")
else:
    fail("could not find the onItemsChange effect")

save(VOICE, s, crlf)

# ================================================================= Dialog
print("Patching " + DIALOG)
s, crlf = load(DIALOG)
shutil.copyfile(DIALOG, DIALOG + ".bak")

# 1. pending state
if "const [voicePending, setVoicePending]" in s:
    skip("voicePending state already there")
else:
    a = "const [voiceItems, setVoiceItems] = useState<VoiceItem[]>([]);"
    if a in s:
        s = s.replace(a, a + "\n  const [voicePending, setVoicePending] = useState<string[]>([]);", 1)
        ok("added voicePending state")
    else:
        fail("could not find voiceItems state (run apply_merge_voice_manual.py first)")

# 2. reset
if "setVoicePending([]);" in s:
    skip("reset already patched")
else:
    n = s.count("setVoiceItems([]);")
    if n:
        s = s.replace("setVoiceItems([]);", "setVoiceItems([]);\n    setVoicePending([]);")
        ok("reset added in %d places" % n)
    else:
        fail("could not find setVoiceItems([]) resets")

# 3. block manual save while a voice medicine is incomplete
a = "await submitPrescription([...voiceItems, ...buildManualItems()], true);"
b = ('if (voicePending.length) {\n'
     '      toast.error(`Finish the voice medicine details first: ${voicePending.join(", ")}`);\n'
     '      setMode("voice");\n'
     '      return;\n'
     '    }\n'
     '    ' + a)
if "Finish the voice medicine details first" in s:
    skip("save guard already there")
elif a in s:
    s = s.replace(a, b, 1)
    ok("save now warns if a voice medicine is incomplete")
else:
    fail("could not find merged save line")

# 4. pass pending list up from the voice panel
a = "onItemsChange={setVoiceItems}"
b = "onItemsChange={(items, pending) => { setVoiceItems(items); setVoicePending(pending ?? []); }}"
if b in s:
    skip("onItemsChange already updated")
elif a in s:
    s = s.replace(a, b, 1)
    ok("voice panel reports pending medicines")
else:
    fail("could not find onItemsChange in the dialog")

# 5. manual mode: show voice medicines first
VOICE_SUMMARY = '''{(voiceItems.length > 0 || voicePending.length > 0) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-700 flex items-center gap-1">
                  <Mic className="w-3.5 h-3.5" /> Added by voice ({voiceItems.length + voicePending.length})
                </span>
                <button onClick={() => setMode("voice")} className="text-xs text-blue-700 underline">Edit in Speak</button>
              </div>
              {voiceItems.map((v, i) => (
                <div key={"vs" + i} className="flex items-start gap-2 text-sm bg-white border rounded-lg px-3 py-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-gray-500">{[v.dosage, v.duration, v.instructions].filter(Boolean).join(", ")}</div>
                  </div>
                </div>
              ))}
              {voicePending.map((n, i) => (
                <div key={"vp" + i} className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <Mic className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{n}</div>
                    <div className="text-xs text-amber-700">Needs details. Tap "Edit in Speak" to finish it.</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          '''
if "Added by voice (" in s:
    skip("voice summary already in manual mode")
else:
    a = "{medicines.map((med, idx) => {"
    if s.count(a) == 1:
        s = s.replace(a, VOICE_SUMMARY + a, 1)
        ok("manual mode now shows the voice medicines on top")
    else:
        fail("could not find the manual medicines list")

# 6. voice mode: show manual medicines
MANUAL_SUMMARY = '''{mode === "voice" && medicines.some(m => m.name.trim()) && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" /> Added manually ({medicines.filter(m => m.name.trim()).length})
              </span>
              <button onClick={() => setMode("manual")} className="text-xs text-blue-700 underline">Edit in Manual</button>
            </div>
            {medicines.filter(m => m.name.trim()).map((m, i) => (
              <div key={"ms" + i} className="flex items-start gap-2 text-sm bg-white border rounded-lg px-3 py-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">{[dosageText(m), formatDuration(m.durationAmount, m.durationUnit), m.instructions].filter(Boolean).join(", ")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        '''
if "Added manually (" in s:
    skip("manual summary already in voice mode")
else:
    a = '<div className={mode === "voice" ? "" : "hidden"}>'
    if a in s:
        s = s.replace(a, MANUAL_SUMMARY + a, 1)
        ok("voice mode now shows the manual medicines")
    else:
        fail("could not find the voice panel wrapper (run apply_merge_voice_manual.py first)")

save(DIALOG, s, crlf)

print()
if failed:
    print("Some steps FAILED. Backups are saved as .bak. Paste this output to Claude.")
else:
    print("Done. Test: voice medicine -> Manual (shows on top) -> add manual -> Speak (shows manual list).")
