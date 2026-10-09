# Nurse conversation: the assistant asks (by voice + on screen) for anything the doctor didn't say.
# Run from F:\O-frontend AFTER apply_keeplistening.py:  python apply_nurse.py
import os, sys
comp = "src/components/VoicePrescription.tsx"
if not os.path.exists(comp): sys.exit("STOP: run this from the O-frontend folder.")
with open(comp, "r", encoding="utf-8", newline="") as f: raw = f.read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")
if "bankRef" not in s or "askDone" not in s:
    sys.exit("STOP: apply_keeplistening.py must be applied first. Nothing changed.")

OPS = []

# imports from the parser
OPS.append(("  toPrescriptionItem, defaultTimes, TIME_ORDER,\n} from \"@/lib/voicePrescription\";",
            "  toPrescriptionItem, defaultTimes, TIME_ORDER, normalise, parseSegment,\n} from \"@/lib/voicePrescription\";"))

# phase type
OPS.append(('type Phase = "ready" | "listening" | "processing" | "review";',
            'type Phase = "ready" | "listening" | "processing" | "asking" | "review";'))

# helpers (module level)
OPS.append(('const STRENGTH_UNITS = ["mg", "mcg", "g", "unit"];\n', '''// ---- nurse conversation helpers ----
type Ask = { medId: string; field: "name" | "freq" | "duration" | "food"; text: string };

function chipOptions(f: Ask["field"]): { label: string; say: string }[] {
  if (f === "freq") return [
    { label: "Once daily", say: "once a day" }, { label: "Twice daily", say: "twice a day" },
    { label: "3 times daily", say: "three times a day" }, { label: "Night only", say: "night" },
  ];
  if (f === "duration") return [3, 5, 7, 10].map(d => ({ label: `${d} days`, say: `${d} days` }));
  if (f === "food") return [
    { label: "After food", say: "after food" }, { label: "Before food", say: "before food" }, { label: "Any time", say: "any time" },
  ];
  return [];
}

// read the doctor's spoken answer to ONE question and merge it into the medicine
function applyAnswer(m: VoiceMed, field: Ask["field"], text: string): { med: VoiceMed; ok: boolean } {
  const norm = normalise(text);
  const p = parseSegment("zzmed " + norm);
  const lone = /^\\d+$/.test(norm) ? parseInt(norm, 10) : null;
  let out: VoiceMed = { ...m };
  let ok = false;
  const hasFreq = (x: VoiceMed) => x.prn || !!x.everyHours || !!x.freq || x.times.length > 0 || !!x.unusualFreq;

  if (field === "freq") {
    if (p && hasFreq(p)) {
      out = { ...out, prn: p.prn, everyHours: p.everyHours, freq: p.freq, times: p.times, unusualFreq: p.unusualFreq };
      ok = true;
    } else if (lone && lone >= 1 && lone <= 6) {
      out = { ...out, freq: lone, times: defaultTimes(lone), prn: false, everyHours: null, unusualFreq: "" };
      ok = true;
    }
  } else if (field === "duration") {
    if (p?.durationAmount) { out = { ...out, durationAmount: p.durationAmount, durationUnit: p.durationUnit }; ok = true; }
    else if (lone) { out = { ...out, durationAmount: String(lone), durationUnit: "day" }; ok = true; }
  } else if (field === "food") {
    if (p?.food) { out.food = p.food; ok = true; }
    else if (/\\bafter\\b/.test(norm)) { out.food = "After food"; ok = true; }
    else if (/\\bbefore\\b|empty stomach/.test(norm)) { out.food = "Before food"; ok = true; }
    else if (/with (food|meals?)/.test(norm)) { out.extra = [m.extra, "With food"].filter(Boolean).join(", "); ok = true; }
    else if (/\\b(any ?time|whenever|no matter|doesn t matter|does not matter|no)\\b/.test(norm)) ok = true;
  }
  // the doctor may answer more than was asked ("after food for five days")
  if (p) {
    if (!out.durationAmount && p.durationAmount) { out.durationAmount = p.durationAmount; out.durationUnit = p.durationUnit; }
    if (!out.food && p.food) out.food = p.food;
    if (!hasFreq(out) && hasFreq(p)) out = { ...out, prn: p.prn, everyHours: p.everyHours, freq: p.freq, times: p.times, unusualFreq: p.unusualFreq };
  }
  return { med: out, ok };
}

const STRENGTH_UNITS = ["mg", "mcg", "g", "unit"];
'''))

# state + refs (added after the keep-listening state)
OPS.append(("  const [askDone, setAskDone] = useState(false);\n", '''  const [askDone, setAskDone] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [convo, setConvo] = useState(true);       // assistant asks for missing details
  const [voiceOut, setVoiceOut] = useState(true); // assistant speaks its questions aloud
  const askRef = useRef<Ask | null>(null);
  const countRef = useRef<Map<string, number>>(new Map());
  const convoRef = useRef(true);
  const voiceOutRef = useRef(true);
  const overrideRef = useRef<string | null>(null);
  const skipRef = useRef(false);
  convoRef.current = convo;
  voiceOutRef.current = voiceOut;
'''))

# stop any speech when the dialog closes
OPS.append(("      deadRef.current = true; userStopRef.current = true;\n",
            "      deadRef.current = true; userStopRef.current = true;\n      try { (window as any).speechSynthesis?.cancel(); } catch { /* ignore */ }\n"))

# silence handling: in conversation mode a short pause ends the turn
OPS.append(("""    const id = setInterval(() => {
      const idle = Date.now() - lastActRef.current;
      setAskDone(idle >= 4000);
      if (idle >= 45000) stop();
    }, 500);
""", """    const id = setInterval(() => {
      const idle = Date.now() - lastActRef.current;
      if (convoRef.current) {
        // conversation mode: a short pause after speaking ends the turn; the assistant asks for what is missing
        const said = (liveRef.current || bankRef.current).length > 0;
        const pause = Capacitor.isNativePlatform() ? 1200 : 1800;
        if (said ? idle >= pause : idle >= 10000) stop();
        return;
      }
      setAskDone(idle >= 4000);
      if (idle >= 45000) stop();
    }, 500);
"""))

# finish(): route answers and skips
OPS.append(("    const t = text.trim();\n    const hasMeds = medsRef.current.length > 0;\n",
"""    const t = text.trim();
    if (skipRef.current) { skipRef.current = false; setPhase(medsRef.current.length ? "review" : "ready"); return; }
    if (askRef.current) { await handleAnswer(t); return; }
    const hasMeds = medsRef.current.length > 0;
"""))

# finish(): after the first utterance, start asking
OPS.append(("""    setMeds(prev => (appendRef.current ? [...prev, ...resolved] : resolved));
    setPhase("review");
  }
""", """    const nextMeds = appendRef.current ? [...medsRef.current, ...resolved] : resolved;
    setMeds(nextMeds);
    if (convoRef.current) {
      if (!appendRef.current) countRef.current = new Map();
      askNext(nextMeds);
    } else setPhase("review");
  }
"""))

# conversation functions + start() signature
OPS.append(("""  async function start(append = false) {
    if (phase === "listening" || phase === "processing") return;
""", """  // ---------- nurse conversation ----------
  function speakThen(text: string, then: () => void) {
    let done = false;
    const go = () => { if (done) return; done = true; if (!deadRef.current) then(); };
    const synth: any = (window as any).speechSynthesis;
    if (!synth || !voiceOutRef.current) { setTimeout(go, 400); return; }
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-IN";
      u.onend = () => setTimeout(go, 300);
      u.onerror = go;
      synth.speak(u);
    } catch { setTimeout(go, 400); return; }
    setTimeout(go, Math.min(12000, 2500 + text.length * 90)); // in case the phone never reports the end
  }

  function questionFor(list: VoiceMed[]): Ask | null {
    const open = (m: VoiceMed, f: Ask["field"]) => (countRef.current.get(`${m.id}:${f}`) ?? 0) < 2;
    for (const m of list) {
      if (!m.name) {
        if (open(m, "name")) {
          const text = m.nameState === "ambiguous"
            ? `I'm not sure which medicine you mean by ${m.spoken}. Please say the full name again.`
            : `I couldn't find ${m.spoken} in the medicine list. Please say the medicine name again.`;
          return { medId: m.id, field: "name", text };
        }
        continue;
      }
      const noFreq = !m.prn && !m.everyHours && !m.freq && !m.times.length && !m.unusualFreq;
      if (noFreq && open(m, "freq"))
        return { medId: m.id, field: "freq", text: `How often should the patient take ${m.name}? For example, morning and night, or three times a day.` };
      if (!m.prn && !m.durationAmount && open(m, "duration"))
        return { medId: m.id, field: "duration", text: `For how many days should the patient take ${m.name}?` };
      if (!m.food && !/with food/i.test(m.extra) && open(m, "food"))
        return { medId: m.id, field: "food", text: `Should ${m.name} be taken before food or after food?` };
    }
    return null;
  }

  function askNext(list: VoiceMed[]) {
    const q = questionFor(list);
    if (!q) {
      askRef.current = null; setAsk(null); setPhase("review");
      if (voiceOutRef.current) {
        try {
          const synth: any = (window as any).speechSynthesis;
          if (synth) { synth.cancel(); synth.speak(new SpeechSynthesisUtterance("Okay. Please check and confirm the prescription.")); }
        } catch { /* ignore */ }
      }
      return;
    }
    const key = `${q.medId}:${q.field}`;
    const tries = countRef.current.get(key) ?? 0;
    countRef.current.set(key, tries + 1);
    const full: Ask = { ...q, text: (tries > 0 ? "Sorry, I didn't catch that. " : "") + q.text };
    askRef.current = full;
    setAsk(full); setLive(""); setError(""); setPhase("asking");
    speakThen(full.text, () => { if (askRef.current === full) void start(true, true); });
  }

  async function handleAnswer(spoken: string) {
    const q = askRef.current;
    if (!q) return;
    const t = (overrideRef.current ?? spoken).trim();
    overrideRef.current = null;
    askRef.current = null; setAsk(null);
    setPhase("processing");
    const key = `${q.medId}:${q.field}`;
    let list = medsRef.current;
    const cur = list.find(m => m.id === q.medId);
    if (cur && t) {
      setLive(t);
      let next = cur;
      let ok = false;
      if (q.field === "name") {
        const p = parseTranscript(t)[0];
        const probe: VoiceMed = { ...cur, spoken: p?.spoken ?? t, searchTerm: p?.searchTerm ?? t.toLowerCase() };
        next = await resolveMed(probe, searchDb, await getCatalog());
        ok = true;
        if (!next.name) countRef.current.set(key, 2); // leave it for the doctor to pick on the review screen
      } else {
        const r = applyAnswer(cur, q.field, t);
        next = r.med; ok = r.ok;
      }
      if (ok) countRef.current.set(key, 2);
      list = list.map(m => (m.id === q.medId ? next : m));
      medsRef.current = list;
      setMeds(list);
    }
    askNext(list);
  }

  // tapping an answer chip instead of speaking
  function chipAnswer(say: string) {
    overrideRef.current = say;
    try { (window as any).speechSynthesis?.cancel(); } catch { /* ignore */ }
    if (phaseRef.current === "listening") stop();
    else void handleAnswer("");
  }

  function skipQuestions() {
    askRef.current = null; setAsk(null);
    try { (window as any).speechSynthesis?.cancel(); } catch { /* ignore */ }
    if (phaseRef.current === "listening") { skipRef.current = true; stop(); }
    else setPhase(medsRef.current.length ? "review" : "ready");
  }

  async function start(append = false, answering = false) {
    const ph: Phase = phaseRef.current;
    if (ph === "listening" || ph === "processing") return;
"""))

# start(): a user-started recording ends any conversation; answers keep the append mode
OPS.append(("    bankRef.current = \"\"; userStopRef.current = false; setAskDone(false);\n",
            "    bankRef.current = \"\"; userStopRef.current = false; setAskDone(false);\n    if (!answering) { askRef.current = null; setAsk(null); }\n"))
OPS.append(("    appendRef.current = append;\n", "    if (!answering) appendRef.current = append;\n"))

# UI: assistant card
OPS.append(("          {phase === \"ready\" && (\n", """          {ask && (phase === "asking" || phase === "listening") && (
            <div className="w-full rounded-xl border border-blue-200 bg-blue-50 p-3 text-left space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-blue-500">
                {phase === "asking" ? "Assistant is asking..." : "Assistant is listening for your answer"}
              </div>
              <p className="text-sm font-medium text-blue-900">{ask.text}</p>
              <div className="flex flex-wrap gap-2">
                {chipOptions(ask.field).map(o => (
                  <button key={o.label} className={chip(false)} onClick={() => chipAnswer(o.say)}>{o.label}</button>
                ))}
              </div>
              <button className="text-xs text-gray-500 underline" onClick={skipQuestions}>Skip questions, review now</button>
            </div>
          )}

          {phase === "ready" && (
"""))

# UI: toggles on the ready screen
OPS.append(('              <p className="text-sm text-gray-500">Tap to speak</p>\n', '''              <p className="text-sm text-gray-500">Tap to speak</p>
              <div className="flex flex-col gap-1 text-sm text-gray-600 items-start">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={convo} onChange={e => setConvo(e.target.checked)} /> Ask me for anything I miss
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={voiceOut} disabled={!convo} onChange={e => setVoiceOut(e.target.checked)} /> Speak the questions aloud
                </label>
              </div>
'''))

for i, (old, new) in enumerate(OPS, 1):
    if s.count(old) != 1:
        sys.exit("STOP: patch %d did not match exactly once (already applied, or the file differs). Nothing changed." % i)
for old, new in OPS: s = s.replace(old, new)
with open(comp, "w", encoding="utf-8", newline="") as f: f.write(s.replace("\n", "\r\n") if crlf else s)
print("done: patched", comp)
