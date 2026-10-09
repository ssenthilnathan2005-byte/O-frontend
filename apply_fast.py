# Faster nurse replies. Run from F:\O-frontend AFTER apply_nurse.py:  python apply_fast.py
import os, sys
comp = "src/components/VoicePrescription.tsx"
if not os.path.exists(comp): sys.exit("STOP: run this from the O-frontend folder.")
with open(comp, "r", encoding="utf-8", newline="") as f: raw = f.read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")
if "questionFor" not in s: sys.exit("STOP: apply_nurse.py must be applied first. Nothing changed.")

OPS = []

# 1. refs + warm-up when the screen opens
OPS.append(("  voiceOutRef.current = voiceOut;\n", """  voiceOutRef.current = voiceOut;
  const pendingRef = useRef<Promise<void> | null>(null); // medicine-name matching running in the background
  const permOkRef = useRef(false);
  const warmRef = useRef(false);
  useEffect(() => {
    void getCatalog();                                   // load the medicine list before it is needed
    try { (window as any).speechSynthesis?.getVoices(); } catch { /* ignore */ }
  }, []);
"""))

# 2. the first question no longer waits for the medicine search
OPS.append(('    const catalog = await getCatalog();\n    const resolved = await Promise.all(parsed.map(m => resolveMed(m, searchDb, catalog)));\n    setLowConf(confRef.current < 0.6);\n    setHeard(prev => (appendRef.current && prev ? `${prev}\\n${t}` : t));\n    const nextMeds = appendRef.current ? [...medsRef.current, ...resolved] : resolved;\n    setMeds(nextMeds);\n    if (convoRef.current) {\n      if (!appendRef.current) countRef.current = new Map();\n      askNext(nextMeds);\n    } else setPhase("review");\n  }\n', '    setLowConf(confRef.current < 0.6);\n    setHeard(prev => (appendRef.current && prev ? `${prev}\\n${t}` : t));\n    // show the parsed medicines at once; match their names in the background\n    const nextMeds = appendRef.current ? [...medsRef.current, ...parsed] : parsed;\n    medsRef.current = nextMeds;\n    setMeds(nextMeds);\n    const pending: Promise<void> = getCatalog()\n      .then(catalog => Promise.all(parsed.map(m => resolveMed(m, searchDb, catalog))))\n      .then(resolved => {\n        if (deadRef.current) return;\n        const merged = medsRef.current.map(x => {\n          const r = resolved.find(y => y.id === x.id);\n          return r ? { ...x, name: r.name, nameState: r.nameState, candidates: r.candidates } : x;\n        });\n        medsRef.current = merged;\n        setMeds(merged);\n      })\n      .catch(() => { /* names stay unmatched; the doctor can pick them */ })\n      .then(() => { pendingRef.current = null; });\n    pendingRef.current = pending;\n    if (convoRef.current) {\n      if (!appendRef.current) countRef.current = new Map();\n      await Promise.race([pending, new Promise(r => setTimeout(r, 400))]);\n      askNext(medsRef.current);\n    } else {\n      await pending;\n      setPhase("review");\n    }\n  }\n'))

# 3. shorter questions, and the name check only once matching is finished
OPS.append(('  function questionFor(list: VoiceMed[]): Ask | null {\n    const open = (m: VoiceMed, f: Ask["field"]) => (countRef.current.get(`${m.id}:${f}`) ?? 0) < 2;\n    for (const m of list) {\n      if (!m.name) {\n        if (open(m, "name")) {\n          const text = m.nameState === "ambiguous"\n            ? `I\'m not sure which medicine you mean by ${m.spoken}. Please say the full name again.`\n            : `I couldn\'t find ${m.spoken} in the medicine list. Please say the medicine name again.`;\n          return { medId: m.id, field: "name", text };\n        }\n        continue;\n      }\n      const noFreq = !m.prn && !m.everyHours && !m.freq && !m.times.length && !m.unusualFreq;\n      if (noFreq && open(m, "freq"))\n        return { medId: m.id, field: "freq", text: `How often should the patient take ${m.name}? For example, morning and night, or three times a day.` };\n      if (!m.prn && !m.durationAmount && open(m, "duration"))\n        return { medId: m.id, field: "duration", text: `For how many days should the patient take ${m.name}?` };\n      if (!m.food && !/with food/i.test(m.extra) && open(m, "food"))\n        return { medId: m.id, field: "food", text: `Should ${m.name} be taken before food or after food?` };\n    }\n    return null;\n  }\n', '  function questionFor(list: VoiceMed[], includeName: boolean): Ask | null {\n    const open = (m: VoiceMed, f: Ask["field"]) => (countRef.current.get(`${m.id}:${f}`) ?? 0) < 2;\n    const who = (m: VoiceMed) => (list.length > 1 ? ` for ${m.name || m.spoken}` : "");\n    for (const m of list) {\n      if (!m.name && includeName) {\n        if (open(m, "name")) {\n          const text = m.nameState === "ambiguous"\n            ? `Which medicine is ${m.spoken}? Say the full name.`\n            : `${m.spoken} isn\'t in the list. Say the name again.`;\n          return { medId: m.id, field: "name", text };\n        }\n        continue;\n      }\n      const noFreq = !m.prn && !m.everyHours && !m.freq && !m.times.length && !m.unusualFreq;\n      if (noFreq && open(m, "freq"))\n        return { medId: m.id, field: "freq", text: `How often${who(m)}? Morning, afternoon, night?` };\n      if (!m.prn && !m.durationAmount && open(m, "duration"))\n        return { medId: m.id, field: "duration", text: `How many days${who(m)}?` };\n      if (!m.food && !/with food/i.test(m.extra) && open(m, "food"))\n        return { medId: m.id, field: "food", text: `Before food or after food${who(m)}?` };\n    }\n    return null;\n  }\n\n'))
OPS.append(('  function askNext(list: VoiceMed[]) {\n    const q = questionFor(list);\n    if (!q) {\n      askRef.current = null; setAsk(null); setPhase("review");\n      if (voiceOutRef.current) {\n        try {\n          const synth: any = (window as any).speechSynthesis;\n          if (synth) { synth.cancel(); synth.speak(new SpeechSynthesisUtterance("Okay. Please check and confirm the prescription.")); }\n        } catch { /* ignore */ }\n      }\n      return;\n    }\n    const key = `${q.medId}:${q.field}`;\n    const tries = countRef.current.get(key) ?? 0;\n    countRef.current.set(key, tries + 1);\n    const full: Ask = { ...q, text: (tries > 0 ? "Sorry, I didn\'t catch that. " : "") + q.text };\n    askRef.current = full;\n    setAsk(full); setLive(""); setError(""); setPhase("asking");\n    speakThen(full.text, () => { if (askRef.current === full) void start(true, true); });\n  }\n', '  function askNext(list: VoiceMed[]) {\n    const waiting = !!pendingRef.current;\n    const q = questionFor(list, !waiting);\n    if (!q) {\n      if (waiting) {\n        // medicine names are still being matched: wait for them, then check again\n        setPhase("processing");\n        void pendingRef.current!.then(() => { if (!deadRef.current) askNext(medsRef.current); });\n        return;\n      }\n      askRef.current = null; setAsk(null); setPhase("review");\n      if (voiceOutRef.current) {\n        try {\n          const synth: any = (window as any).speechSynthesis;\n          if (synth) { synth.cancel(); synth.speak(new SpeechSynthesisUtterance("Done. Please confirm.")); }\n        } catch { /* ignore */ }\n      }\n      return;\n    }\n    const key = `${q.medId}:${q.field}`;\n    const tries = countRef.current.get(key) ?? 0;\n    countRef.current.set(key, tries + 1);\n    const full: Ask = { ...q, text: (tries > 0 ? "Sorry, say again. " : "") + q.text };\n    askRef.current = full;\n    setAsk(full); setLive(""); setError(""); setPhase("asking");\n    speakThen(full.text, () => { if (askRef.current === full) void start(true, true); });\n  }\n\n'))

# 4. phone: do not re-check permission every turn; the phone already detected the pause, so reply at once
OPS.append(('        const avail = await SpeechRecognition.available();\n        if (!avail.available) { setError("Voice input isn\'t available on this phone. Please use Manual."); return; }\n        const perm = await SpeechRecognition.requestPermissions();\n        if (perm.speechRecognition !== "granted") {\n          setError("Microphone access is off. Allow Microphone for Doctor Booked in your phone\'s app settings, or use Manual.");\n          return;\n        }\n', '        if (!permOkRef.current) {\n          const avail = await SpeechRecognition.available();\n          if (!avail.available) { setError("Voice input isn\'t available on this phone. Please use Manual."); return; }\n          const perm = await SpeechRecognition.requestPermissions();\n          if (perm.speechRecognition !== "granted") {\n            setError("Microphone access is off. Allow Microphone for Doctor Booked in your phone\'s app settings, or use Manual.");\n            return;\n          }\n          permOkRef.current = true;\n        }\n'))
OPS.append(("          if (userStopRef.current) break;\n          if (fails >= 8 && !bankRef.current) break;\n",
            "          if (userStopRef.current) break;\n          if (chunk && convoRef.current) break;\n          if (fails >= 8 && !bankRef.current) break;\n"))

# 5. browser: shorter pause, and reply as soon as the browser marks the sentence as final
OPS.append(("        const pause = Capacitor.isNativePlatform() ? 1200 : 1800;\n",
            "        const pause = askRef.current ? 800 : 1400;\n"))
OPS.append(("      lastActRef.current = Date.now();\n      setLive(liveRef.current);\n", """      lastActRef.current = Date.now();
      setLive(liveRef.current);
      if (convoRef.current && e.results[e.results.length - 1]?.isFinal) {
        setTimeout(() => { if (Date.now() - lastActRef.current >= 400) stop(); }, 450);
      }
"""))

# 6. faster voice: quicker speech, tiny gap before the mic opens, warm-up on the first tap
OPS.append(('      u.lang = "en-IN";\n      u.onend = () => setTimeout(go, 300);\n',
            '      u.lang = "en-IN";\n      u.rate = 1.15;\n      u.onend = () => setTimeout(go, 120);\n'))
OPS.append(("    if (!synth || !voiceOutRef.current) { setTimeout(go, 400); return; }\n",
            "    if (!synth || !voiceOutRef.current) { setTimeout(go, 50); return; }\n"))
OPS.append(("    if (!answering) { askRef.current = null; setAsk(null); }\n", """    if (!answering) { askRef.current = null; setAsk(null); }
    if (!answering && convoRef.current && voiceOutRef.current && !warmRef.current) {
      warmRef.current = true; // wake up the phone's voice engine now, so the first question is not slow
      try {
        const sy: any = (window as any).speechSynthesis;
        const w = new SpeechSynthesisUtterance(".");
        w.volume = 0;
        sy?.speak(w);
      } catch { /* ignore */ }
    }
"""))

for i, (old, new) in enumerate(OPS, 1):
    if s.count(old) != 1:
        sys.exit("STOP: patch %d did not match exactly once (already applied, or the file differs). Nothing changed." % i)
for old, new in OPS: s = s.replace(old, new)
with open(comp, "w", encoding="utf-8", newline="") as f: f.write(s.replace("\n", "\r\n") if crlf else s)
print("done: faster nurse replies")
