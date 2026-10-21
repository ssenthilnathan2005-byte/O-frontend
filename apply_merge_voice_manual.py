import re, shutil, sys, os

DIALOG = os.path.join("src", "components", "PrescriptionDialog.tsx")
VOICE = os.path.join("src", "components", "VoicePrescription.tsx")

failed = False


def load(path):
    with open(path, "r", encoding="utf-8", newline="") as f:
        raw = f.read()
    crlf = "\r\n" in raw
    return raw.replace("\r\n", "\n"), crlf


def save(path, text, crlf):
    if crlf:
        text = text.replace("\n", "\r\n")
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def ok(msg):
    print("  [OK]   " + msg)


def skip(msg):
    print("  [SKIP] " + msg)


def fail(msg):
    global failed
    print("  [FAIL] " + msg)
    failed = True


for p in (DIALOG, VOICE):
    if not os.path.exists(p):
        print("Cannot find " + p + " - run this from F:\\O-frontend")
        sys.exit(1)

# ---------------------------------------------------------------- Dialog
print("Patching " + DIALOG)
src, crlf = load(DIALOG)
shutil.copyfile(DIALOG, DIALOG + ".bak")

if "const [voiceItems, setVoiceItems]" in src:
    skip("voiceItems state already there")
else:
    anchor = 'const [mode, setMode] = useState<"manual" | "voice">("voice");'
    if anchor in src:
        src = src.replace(anchor, anchor + "\n  const [voiceItems, setVoiceItems] = useState<VoiceItem[]>([]);", 1)
        ok("added voiceItems state")
    else:
        fail("could not find the mode state line")

if "function buildManualItems" in src:
    skip("handleSave already patched")
else:
    new_save = '''  function buildManualItems(): VoiceItem[] {
    return medicines
      .filter(m => m.name.trim())
      .map(m => ({
        name: m.name,
        dosage: dosageText(m),
        duration: formatDuration(m.durationAmount, m.durationUnit),
        instructions: m.instructions,
        form: guessForm(m),
        quantity: finalQuantity(m),
        quantityUnit: FORM_OPTIONS.find(o => o.value === guessForm(m))?.unit ?? "units",
      }));
  }

  async function handleSave() {
    // voice medicines first, then manual ones
    await submitPrescription([...voiceItems, ...buildManualItems()], true);
  }
'''
    pat = re.compile(r"  async function handleSave\(\) \{.*?\n  \}\n", re.S)
    if pat.search(src):
        src = pat.sub(lambda m: new_save, src, count=1)
        ok("replaced handleSave with merged save")
    else:
        fail("could not find handleSave")

if "setVoiceItems([]);" in src:
    skip("reset already patched")
else:
    old_reset = '    setMedicines([{ ...EMPTY_MED }]);\n    setNotes("");'
    new_reset = '    setMedicines([{ ...EMPTY_MED }]);\n    setVoiceItems([]);\n    setNotes("");'
    n = src.count(old_reset)
    if n >= 1:
        src = src.replace(old_reset, new_reset)
        ok("added setVoiceItems([]) in %d reset places" % n)
    else:
        fail("could not find the reset blocks")

if "onItemsChange={setVoiceItems}" in src:
    skip("voice block already patched")
else:
    new_block = '''<div className={mode === "voice" ? "" : "hidden"}>
          <VoicePrescription
            saving={saving}
            notes={notes}
            onNotesChange={setNotes}
            onSkip={handleSkip}
            onItemsChange={setVoiceItems}
            onConfirm={items => submitPrescription([...items, ...buildManualItems()], true)}
          />
        </div>'''
    pat = re.compile(r'\{mode === "voice" && \(\s*<VoicePrescription.*?/>\s*\)\}', re.S)
    if pat.search(src):
        src = pat.sub(lambda m: new_block, src, count=1)
        ok("voice panel now stays mounted and merges with manual")
    else:
        fail("could not find the VoicePrescription block")

save(DIALOG, src, crlf)

# ----------------------------------------------------------------- Voice
print("Patching " + VOICE)
src, crlf = load(VOICE)
shutil.copyfile(VOICE, VOICE + ".bak")

if "onItemsChange?:" in src:
    skip("Props already has onItemsChange")
elif "interface Props {" in src:
    src = src.replace("interface Props {", "interface Props {\n  onItemsChange?: (items: VoiceItem[]) => void;", 1)
    ok("added onItemsChange to Props")
else:
    fail("could not find interface Props")

if "onConfirm, onItemsChange }: Props" in src:
    skip("signature already patched")
elif "onSkip, onConfirm }: Props" in src:
    src = src.replace("onSkip, onConfirm }: Props", "onSkip, onConfirm, onItemsChange }: Props", 1)
    ok("added onItemsChange to component params")
else:
    fail("could not find the component signature")

if "onItemsChange?.(" in src:
    skip("effect already there")
elif "medsRef.current = meds;" in src:
    effect = '''
  useEffect(() => {
    onItemsChange?.(meds.filter(m => blockingIssues(m).length === 0).map(toPrescriptionItem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meds]);'''
    src = src.replace("medsRef.current = meds;", "medsRef.current = meds;" + effect, 1)
    ok("added effect to report voice medicines")
else:
    fail("could not find 'medsRef.current = meds;'")

m = re.search(r'import\s*\{([^}]*)\}\s*from\s*"react";', src)
if m:
    if "useEffect" in m.group(1):
        skip("useEffect already imported")
    else:
        names = m.group(1).rstrip().rstrip(",") + ", useEffect "
        src = src[: m.start(1)] + names + src[m.end(1):]
        ok("added useEffect to the react import")
else:
    fail("could not find the react import - add useEffect manually")

save(VOICE, src, crlf)

print()
if failed:
    print("Some steps FAILED. Backups are saved as .bak next to each file.")
    print("Paste this output to Claude and it will be fixed.")
else:
    print("Done. Test: 2 voice + 1 manual, then Save & Complete.")
