import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { Mic, Square, Loader2, Pencil, Trash2, Check, AlertTriangle, RotateCcw, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getToken } from "@/api";
import {
  VoiceMed, parseTranscript, resolveMed, blockingIssues, softWarnings, summaryLine, displayName,
  toPrescriptionItem, defaultTimes, TIME_ORDER, normalise, parseSegment,
} from "@/lib/voicePrescription";

export type VoiceItem = { name: string; dosage: string; duration: string; instructions: string };

interface Props {
  saving: boolean;
  notes: string;
  onNotesChange: (v: string) => void;
  onSkip: () => void;
  onConfirm: (items: VoiceItem[]) => void;
}

type Phase = "ready" | "listening" | "processing" | "asking" | "review";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function searchDb(q: string): Promise<string[]> {
  const res = await fetch(`${API}/pharmacy/medicines?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("medicine search failed");
  const data = await res.json();
  return Array.isArray(data) ? data.map((m: any) => m?.name).filter(Boolean) : [];
}

import { COMMON_MEDICINES } from "../lib/commonMedicines";

// the whole medicine list, loaded once, so mispronounced names can be matched by sound
let catalogPromise: Promise<string[]> | null = null;
function getCatalog(): Promise<string[]> {
  if (!catalogPromise) catalogPromise = searchDb("").catch(() => [] as string[]).then(db => {
    const seen = new Set(db.map(n => n.toLowerCase()));
    return [...db, ...COMMON_MEDICINES.filter(n => !seen.has(n.toLowerCase()))];
  });
  return catalogPromise;
}

// ---- nurse conversation helpers ----
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
  const lone = /^\d+$/.test(norm) ? parseInt(norm, 10) : null;
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
    else if (/\bafter\b/.test(norm)) { out.food = "After food"; ok = true; }
    else if (/\bbefore\b|empty stomach/.test(norm)) { out.food = "Before food"; ok = true; }
    else if (/with (food|meals?)/.test(norm)) { out.extra = [m.extra, "With food"].filter(Boolean).join(", "); ok = true; }
    else if (/\b(any ?time|whenever|no matter|doesn t matter|does not matter|no)\b/.test(norm)) ok = true;
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
const DOSE_FORMS = ["tablet", "capsule", "ml", "drop", "puff"];
const DURATION_CHIPS = [3, 5, 7, 10, 14];

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-full border text-sm transition-colors ${on ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`;

export default function VoicePrescription({ saving, notes, onNotesChange, onSkip, onConfirm }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState("");
  const [live, setLive] = useState("");
  const [heard, setHeard] = useState("");
  const [lowConf, setLowConf] = useState(false);
  const [meds, setMeds] = useState<VoiceMed[]>([]);

  const medsRef = useRef<VoiceMed[]>([]);
  medsRef.current = meds;
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  const recRef = useRef<any>(null);
  const finalRef = useRef("");
  const liveRef = useRef("");
  const confRef = useRef(1);
  const errRef = useRef("");
  const appendRef = useRef(false);
  const bankRef = useRef("");         // text from earlier listening rounds in this recording
  const userStopRef = useRef(false);  // set once the doctor taps Stop / I'm done
  const deadRef = useRef(false);      // set when the component unmounts
  const lastActRef = useRef(0);       // last time speech was heard
  const [askDone, setAskDone] = useState(false);
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
  const pendingRef = useRef<Promise<void> | null>(null); // medicine-name matching running in the background
  const permOkRef = useRef(false);
  const warmRef = useRef(false);
  useEffect(() => {
    void getCatalog();                                   // load the medicine list before it is needed
    try { (window as any).speechSynthesis?.getVoices(); } catch { /* ignore */ }
  }, []);

  // never leave the microphone running when the dialog closes or the mode changes
  useEffect(() => {
    deadRef.current = false;
    return () => {
      deadRef.current = true; userStopRef.current = true;
      try { (window as any).speechSynthesis?.cancel(); } catch { /* ignore */ }
      try { recRef.current?.abort?.(); } catch { /* ignore */ }
      if (Capacitor.isNativePlatform() && phaseRef.current === "listening") SpeechRecognition.stop().catch(() => {});
    };
  }, []);

  // while listening: after 4s of silence ask "Still speaking?", and stop by itself after 45s of silence
  useEffect(() => {
    if (phase !== "listening") { setAskDone(false); return; }
    lastActRef.current = Date.now();
    const id = setInterval(() => {
      const idle = Date.now() - lastActRef.current;
      if (convoRef.current) {
        // conversation mode: a short pause after speaking ends the turn; the assistant asks for what is missing
        const said = (liveRef.current || bankRef.current).length > 0;
        const pause = askRef.current ? 800 : 1400;
        if (said ? idle >= pause : idle >= 10000) stop();
        return;
      }
      setAskDone(idle >= 4000);
      if (idle >= 45000) stop();
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  async function finish(text: string) {
    const t = text.trim();
    if (skipRef.current) { skipRef.current = false; setPhase(medsRef.current.length ? "review" : "ready"); return; }
    if (askRef.current) { await handleAnswer(t); return; }
    const hasMeds = medsRef.current.length > 0;
    const backTo: Phase = appendRef.current && hasMeds ? "review" : "ready";
    if (!t) {
      setPhase(backTo);
      setError("I didn't catch anything. Tap the mic and speak again.");
      return;
    }
    setLive(t);
    setPhase("processing");
    const parsed = parseTranscript(t);
    if (!parsed.length) {
      setPhase(backTo);
      setError(`I couldn't find a medicine in: “${t}”. Say the medicine name first, then dose, how often and for how long.`);
      return;
    }
    setLowConf(confRef.current < 0.6);
    setHeard(prev => (appendRef.current && prev ? `${prev}\n${t}` : t));
    // show the parsed medicines at once; match their names in the background
    const nextMeds = appendRef.current ? [...medsRef.current, ...parsed] : parsed;
    medsRef.current = nextMeds;
    setMeds(nextMeds);
    const pending: Promise<void> = getCatalog()
      .then(catalog => Promise.all(parsed.map(m => resolveMed(m, searchDb, catalog))))
      .then(resolved => {
        if (deadRef.current) return;
        const merged = medsRef.current.map(x => {
          const r = resolved.find(y => y.id === x.id);
          return r ? { ...x, name: r.name, nameState: r.nameState, candidates: r.candidates } : x;
        });
        medsRef.current = merged;
        setMeds(merged);
      })
      .catch(() => { /* names stay unmatched; the doctor can pick them */ })
      .then(() => { pendingRef.current = null; });
    pendingRef.current = pending;
    if (convoRef.current) {
      if (!appendRef.current) countRef.current = new Map();
      await Promise.race([pending, new Promise(r => setTimeout(r, 400))]);
      askNext(medsRef.current);
    } else {
      await pending;
      setPhase("review");
    }
  }

  // ---------- nurse conversation ----------
  function speakThen(text: string, then: () => void) {
    let done = false;
    const go = () => { if (done) return; done = true; if (!deadRef.current) then(); };
    const synth: any = (window as any).speechSynthesis;
    if (!synth || !voiceOutRef.current) { setTimeout(go, 50); return; }
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-IN";
      u.rate = 1.15;
      u.onend = () => setTimeout(go, 120);
      u.onerror = go;
      synth.speak(u);
    } catch { setTimeout(go, 400); return; }
    setTimeout(go, Math.min(12000, 2500 + text.length * 90)); // in case the phone never reports the end
  }

  function questionFor(list: VoiceMed[], includeName: boolean): Ask | null {
    const open = (m: VoiceMed, f: Ask["field"]) => (countRef.current.get(`${m.id}:${f}`) ?? 0) < 2;
    const who = (m: VoiceMed) => (list.length > 1 ? ` for ${m.name || m.spoken}` : "");
    for (const m of list) {
      if (!m.name && includeName) {
        if (open(m, "name")) {
          const text = m.nameState === "ambiguous"
            ? `Which medicine is ${m.spoken}? Say the full name.`
            : `${m.spoken} isn't in the list. Say the name again.`;
          return { medId: m.id, field: "name", text };
        }
        continue;
      }
      const noFreq = !m.prn && !m.everyHours && !m.freq && !m.times.length && !m.unusualFreq;
      if (noFreq && open(m, "freq"))
        return { medId: m.id, field: "freq", text: `How often${who(m)}? Morning, afternoon, night?` };
      if (!m.prn && !m.durationAmount && open(m, "duration"))
        return { medId: m.id, field: "duration", text: `How many days${who(m)}?` };
      if (!m.food && !/with food/i.test(m.extra) && open(m, "food"))
        return { medId: m.id, field: "food", text: `Before food or after food${who(m)}?` };
    }
    return null;
  }


  function askNext(list: VoiceMed[]) {
    const waiting = !!pendingRef.current;
    const q = questionFor(list, !waiting);
    if (!q) {
      if (waiting) {
        // medicine names are still being matched: wait for them, then check again
        setPhase("processing");
        void pendingRef.current!.then(() => { if (!deadRef.current) askNext(medsRef.current); });
        return;
      }
      askRef.current = null; setAsk(null); setPhase("review");
      if (voiceOutRef.current) {
        try {
          const synth: any = (window as any).speechSynthesis;
          if (synth) { synth.cancel(); synth.speak(new SpeechSynthesisUtterance("Done. Please confirm.")); }
        } catch { /* ignore */ }
      }
      return;
    }
    const key = `${q.medId}:${q.field}`;
    const tries = countRef.current.get(key) ?? 0;
    countRef.current.set(key, tries + 1);
    const full: Ask = { ...q, text: (tries > 0 ? "Sorry, say again. " : "") + q.text };
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
    setError("");
    setLive("");
    finalRef.current = ""; liveRef.current = ""; confRef.current = 1; errRef.current = "";
    bankRef.current = ""; userStopRef.current = false; setAskDone(false);
    if (!answering) { askRef.current = null; setAsk(null); }
    if (!answering && convoRef.current && voiceOutRef.current && !warmRef.current) {
      warmRef.current = true; // wake up the phone's voice engine now, so the first question is not slow
      try {
        const sy: any = (window as any).speechSynthesis;
        const w = new SpeechSynthesisUtterance(".");
        w.volume = 0;
        sy?.speak(w);
      } catch { /* ignore */ }
    }
    if (!answering) appendRef.current = append;

    if (Capacitor.isNativePlatform()) {
      try {
        if (!permOkRef.current) {
          const avail = await SpeechRecognition.available();
          if (!avail.available) { setError("Voice input isn't available on this phone. Please use Manual."); return; }
          const perm = await SpeechRecognition.requestPermissions();
          if (perm.speechRecognition !== "granted") {
            setError("Microphone access is off. Allow Microphone for Doctor Booked in your phone's app settings, or use Manual.");
            return;
          }
          permOkRef.current = true;
        }
        setPhase("listening");
        let fails = 0;
        while (!deadRef.current) {
          let chunk = "";
          try {
            const result = await SpeechRecognition.start({ language: "en-IN", maxResults: 1, partialResults: false, popup: false });
            chunk = (result?.matches?.[0] ?? "").trim();
          } catch {
            fails++;
            if (!userStopRef.current) await new Promise(r => setTimeout(r, 300));
          }
          if (chunk) {
            fails = 0;
            bankRef.current = (bankRef.current + " " + chunk).trim();
            lastActRef.current = Date.now();
            setLive(bankRef.current);
          }
          if (userStopRef.current) break;
          if (chunk && convoRef.current) break;
          if (fails >= 8 && !bankRef.current) break;
        }
        if (!deadRef.current && phaseRef.current === "listening") await finish(bankRef.current);
      } catch (e: any) {
        console.error("[voice-rx] native speech failed", e);
        setPhase(append && medsRef.current.length ? "review" : "ready");
        setError("Recording failed. Check the microphone and try again, or use Manual.");
      }
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError("This browser doesn't support voice input. Use Chrome, or switch to Manual."); return; }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recRef.current = rec;
    rec.onresult = (e: any) => {
      // Chrome on Android re-sends the whole sentence in every result, so rebuild the text from
      // all results each time and let a result that extends the previous one replace it.
      const pieces: string[] = [];
      let minConf = 1;
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = (r[0]?.transcript || "").trim();
        if (!t) continue;
        if (r.isFinal) minConf = Math.min(minConf, r[0].confidence || 1);
        const last = pieces[pieces.length - 1];
        if (last && t.toLowerCase().startsWith(last.toLowerCase())) pieces[pieces.length - 1] = t;
        else pieces.push(t);
      }
      confRef.current = minConf;
      liveRef.current = (bankRef.current + " " + pieces.join(" ")).trim();
      lastActRef.current = Date.now();
      setLive(liveRef.current);
      if (convoRef.current && e.results[e.results.length - 1]?.isFinal) {
        setTimeout(() => { if (Date.now() - lastActRef.current >= 400) stop(); }, 450);
      }
    };
    rec.onerror = (e: any) => { errRef.current = e?.error || "error"; };
    rec.onend = () => {
      recRef.current = null;
      const err = errRef.current;
      // the browser stops after a short pause; keep listening until the doctor says done
      const fatal = ["not-allowed", "service-not-allowed", "audio-capture", "network"].includes(err);
      if (!userStopRef.current && !deadRef.current && !fatal) {
        bankRef.current = liveRef.current;
        errRef.current = "";
        setTimeout(() => {
          if (deadRef.current) return;
          if (userStopRef.current) { void finish(liveRef.current); return; }
          try { rec.start(); recRef.current = rec; } catch { void finish(liveRef.current); }
        }, 200);
        return;
      }
      const back: Phase = append && medsRef.current.length ? "review" : "ready";
      if (err === "not-allowed" || err === "service-not-allowed") {
        setPhase(back); setError("Microphone access is blocked. Allow the microphone for this site in the browser, or use Manual."); return;
      }
      if (err === "audio-capture") { setPhase(back); setError("No microphone found. Connect one, or use Manual."); return; }
      if (err === "network") { setPhase(back); setError("Voice needs an internet connection. Check your connection, or use Manual."); return; }
      void finish(liveRef.current);
    };
    try {
      setPhase("listening");
      rec.start();
    } catch {
      recRef.current = null;
      setPhase(append && medsRef.current.length ? "review" : "ready");
      setError("Couldn't start the microphone. Please try again.");
    }
  }

  function stop() {
    userStopRef.current = true;
    setAskDone(false);
    if (Capacitor.isNativePlatform()) {
      SpeechRecognition.stop().catch(() => {});
      // safety net in case the phone never returns a final result
      setTimeout(() => {
        if (!deadRef.current && phaseRef.current === "listening") void finish(bankRef.current);
      }, 2500);
      return;
    }
    try { recRef.current?.stop(); } catch { /* ignore */ }
  }

  function speakAgain() {
    setMeds([]); setHeard(""); setLowConf(false); setPhase("ready"); setError("");
    void start(false);
  }

  const patchMed = (id: string, p: Partial<VoiceMed>) => setMeds(prev => prev.map(m => (m.id === id ? { ...m, ...p } : m)));
  const removeMed = (id: string) => setMeds(prev => {
    const next = prev.filter(m => m.id !== id);
    if (!next.length) { setPhase("ready"); setHeard(""); }
    return next;
  });

  const totalIssues = meds.reduce((n, m) => n + blockingIssues(m).length, 0);
  const canConfirm = meds.length > 0 && totalIssues === 0 && !saving;

  // ───────────── ready / listening / processing ─────────────
  if (phase !== "review") {
    return (
      <div className="flex flex-col min-h-[55vh] sm:min-h-[340px]">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-2 py-6">
          {error && (
            <div className="w-full flex gap-2 items-start text-left text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          {ask && (phase === "asking" || phase === "listening") && (
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
            <>
              <h3 className="text-lg font-semibold text-gray-800">Speak your prescription</h3>
              <button
                onClick={() => start(false)}
                aria-label="Start speaking"
                className="w-28 h-28 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white flex items-center justify-center shadow-lg"
              >
                <Mic className="w-12 h-12" />
              </button>
              <p className="text-sm text-gray-500">Tap to speak</p>
              <div className="flex flex-col gap-1 text-sm text-gray-600 items-start">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={convo} onChange={e => setConvo(e.target.checked)} /> Ask me for anything I miss
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={voiceOut} disabled={!convo} onChange={e => setVoiceOut(e.target.checked)} /> Speak the questions aloud
                </label>
              </div>
              <p className="text-xs text-gray-400 max-w-xs">
                Say the medicine, dose, how often and for how long. e.g. “Paracetamol 650 mg, one tablet three times a day for five days.”
              </p>
            </>
          )}

          {phase === "listening" && (
            <>
              <div className="flex items-center gap-2 text-red-600 font-semibold">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                </span>
                <Mic className="w-5 h-5" /> Listening...
              </div>
              <p className="text-sm text-gray-500">Speak your prescription</p>
              <div className="w-full min-h-[64px] rounded-xl border bg-gray-50 p-3 text-sm text-gray-700 text-left">
                {live || <span className="text-gray-400">…</span>}
              </div>
              {askDone && (
                <div className="w-full rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
                  <p className="font-medium">Still speaking?</p>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" variant="outline" onClick={() => { lastActRef.current = Date.now(); setAskDone(false); }}>Keep going</Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={stop}>I&apos;m done</Button>
                  </div>
                </div>
              )}
              <button
                onClick={stop}
                aria-label="Stop recording"
                className="w-24 h-24 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition text-white flex flex-col items-center justify-center shadow-lg gap-1"
              >
                <Square className="w-8 h-8 fill-white" />
                <span className="text-xs font-medium">Stop</span>
              </button>
            </>
          )}

          {phase === "processing" && (
            <>
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-gray-700 font-medium">Understanding prescription...</p>
              {live && <p className="text-sm text-gray-500 italic max-w-sm">“{live}”</p>}
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" size="sm" onClick={onSkip} disabled={saving || phase !== "ready"}>
            Skip — No Prescription
          </Button>
        </div>
      </div>
    );
  }

  // ───────────── review ─────────────
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
        <Check className="w-4 h-4 text-green-600" /> Prescription detected
      </h3>

      <div className="text-xs text-gray-500 bg-gray-50 border rounded-lg p-2 whitespace-pre-line">
        <span className="font-medium text-gray-600">Heard: </span>“{heard}”
      </div>
      {lowConf && (
        <div className="flex gap-2 items-start text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Speech was not very clear. Please check every line carefully.
        </div>
      )}
      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>}

      {meds.map((m, i) => (
        <MedCard key={m.id} med={m} index={i} onPatch={p => patchMed(m.id, p)} onRemove={() => removeMed(m.id)} />
      ))}

      <button
        onClick={() => start(true)}
        className="flex items-center justify-center gap-2 text-sm text-blue-700 border border-dashed border-blue-300 rounded-xl py-2 hover:bg-blue-50"
      >
        <Plus className="w-4 h-4" /> <Mic className="w-4 h-4" /> Add another medicine by voice
      </button>

      <div>
        <Label className="text-xs text-gray-500">Doctor's Notes (optional)</Label>
        <Textarea
          placeholder="Additional notes, advice, follow-up instructions..."
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          rows={2}
        />
      </div>

      <div className="sticky bottom-0 bg-white pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t space-y-2">
        {totalIssues > 0 && (
          <p className="text-xs text-red-600">Fix the {totalIssues} item{totalIssues > 1 ? "s" : ""} marked in red to continue.</p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={speakAgain} disabled={saving} className="shrink-0">
            <RotateCcw className="w-4 h-4 mr-1" /> Speak Again
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
            disabled={!canConfirm}
            onClick={() => onConfirm(meds.map(toPrescriptionItem))}
          >
            <Send className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Confirm Prescription"}
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={onSkip} disabled={saving}>Skip — No Prescription</Button>
      </div>
    </div>
  );
}

// ───────────────────────── one detected medicine ─────────────────────────

function MedCard({ med: m, index, onPatch, onRemove }: {
  med: VoiceMed; index: number; onPatch: (p: Partial<VoiceMed>) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const issues = blockingIssues(m);
  const warnings = softWarnings(m);
  const needsName = !m.name.trim();

  const setFreq = (n: number) => onPatch({ freq: n, times: defaultTimes(n), prn: false, everyHours: null, unusualFreq: "" });
  const toggleTime = (t: string) => {
    const set = new Set(m.times);
    if (set.has(t)) set.delete(t); else set.add(t);
    const times = TIME_ORDER.filter(x => set.has(x));
    onPatch({ times, freq: times.length || null, prn: false, everyHours: null, unusualFreq: "" });
  };
  const typedName = m.spoken;

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${issues.length ? "border-red-300 bg-red-50/40" : "bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] text-gray-400">Medicine {index + 1}</div>
          <div className="font-semibold text-gray-900 break-words">{needsName ? `“${m.spoken}”` : displayName(m)}</div>
          {!needsName && <div className="text-sm text-gray-600">{summaryLine(m) || "—"}</div>}
          {!needsName && (m.food || m.extra) && (
            <div className="text-xs text-gray-500">{[m.food, m.extra].filter(Boolean).join(" · ")}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-xs text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50">
            <Pencil className="w-3.5 h-3.5" /> {open ? "Done" : "Edit"}
          </button>
          <button onClick={onRemove} aria-label="Remove medicine" className="p-1.5 text-red-400 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {needsName && (
        <div className="space-y-2">
          {m.nameState === "ambiguous" ? (
            <p className="text-sm text-red-700 font-medium">Closest matches in your medicine list. Tap the right one:</p>
          ) : (
            <p className="text-sm text-red-700 font-medium">Not found in the medicine list. Search again or use as typed.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {m.candidates.map(c => (
              <button key={c} className={chip(false)} onClick={() => onPatch({ name: c, nameState: "matched", candidates: [] })}>{c}</button>
            ))}
            <button className={chip(false)} onClick={() => onPatch({ name: typedName, nameState: "manual" })}>
              Use “{typedName}” as typed
            </button>
          </div>
          <NameSearch value="" onPick={n => onPatch({ name: n, nameState: "matched", candidates: [] })} />
        </div>
      )}

      {issues.length > 0 && !needsName && (
        <div className="flex flex-wrap gap-1.5">
          {issues.map(s => (
            <button key={s} onClick={() => setOpen(true)} className="text-xs text-red-700 bg-red-100 rounded-full px-2.5 py-1">{s}</button>
          ))}
        </div>
      )}
      {warnings.length > 0 && !needsName && <p className="text-xs text-amber-700">{warnings.join(" · ")}</p>}

      {open && (
        <div className="space-y-3 pt-2 border-t">
          <div>
            <Label className="text-xs text-gray-500">Medicine</Label>
            <NameSearch value={m.name} onPick={n => onPatch({ name: n, nameState: "matched", candidates: [] })} onType={n => onPatch({ name: n, nameState: "manual" })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">Strength</Label>
              <div className="flex gap-1">
                <Input type="number" min="0" step="any" inputMode="decimal" placeholder="650" value={m.strengthAmount}
                  onChange={e => onPatch({ strengthAmount: e.target.value, strengthAssumed: false })} className="flex-1 min-w-0" />
                <select value={m.strengthUnit} onChange={e => onPatch({ strengthUnit: e.target.value, strengthAssumed: false })}
                  className="border rounded-md text-sm px-2 bg-white shrink-0">
                  {STRENGTH_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Dose each time</Label>
              <div className="flex gap-1">
                <Input type="number" min="0" step="any" inputMode="decimal" placeholder="1" value={m.qty}
                  onChange={e => onPatch({ qty: e.target.value })} className="flex-1 min-w-0" />
                <select value={m.qtyUnit} onChange={e => onPatch({ qtyUnit: e.target.value })}
                  className="border rounded-md text-sm px-2 bg-white shrink-0">
                  {DOSE_FORMS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500">How often</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[1, 2, 3, 4].map(n => (
                <button key={n} className={chip(!m.prn && !m.everyHours && m.freq === n)} onClick={() => setFreq(n)}>{n}× daily</button>
              ))}
              <button className={chip(m.prn)} onClick={() => onPatch({ prn: !m.prn, freq: null, times: [], everyHours: null, unusualFreq: "" })}>SOS</button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {TIME_ORDER.map(t => (
                <button key={t} className={chip(m.times.includes(t))} onClick={() => toggleTime(t)}>{t}</button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500">Food</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {(["", "After food", "Before food"] as const).map(f => (
                <button key={f || "none"} className={chip(m.food === f)} onClick={() => onPatch({ food: f })}>{f || "Any time"}</button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500">Duration</Label>
            <div className="flex gap-1 mt-1">
              <Input type="number" min="0" step="1" inputMode="numeric" placeholder="5" value={m.durationAmount}
                onChange={e => onPatch({ durationAmount: e.target.value })} className="flex-1 min-w-0" />
              <select value={m.durationUnit} onChange={e => onPatch({ durationUnit: e.target.value as "day" | "week" })}
                className="border rounded-md text-sm px-2 bg-white shrink-0">
                <option value="day">day</option>
                <option value="week">week</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {DURATION_CHIPS.map(d => (
                <button key={d} className={chip(m.durationUnit === "day" && m.durationAmount === String(d))}
                  onClick={() => onPatch({ durationAmount: String(d), durationUnit: "day" })}>{d} days</button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500">Extra instruction (optional)</Label>
            <Input value={m.extra} onChange={e => onPatch({ extra: e.target.value })} placeholder="e.g. With warm water" />
          </div>
        </div>
      )}
    </div>
  );
}

// medicine search box backed by the existing medicine list
function NameSearch({ value, onPick, onType }: { value: string; onPick: (n: string) => void; onType?: (n: string) => void }) {
  const [q, setQ] = useState(value);
  const [list, setList] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function change(v: string) {
    setQ(v);
    onType?.(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) { setList([]); return; }
    timer.current = setTimeout(async () => {
      try { setList((await searchDb(v.trim())).slice(0, 8)); } catch { setList([]); }
    }, 250);
  }

  return (
    <div className="relative">
      <Input value={q} onChange={e => change(e.target.value)} placeholder="Search medicine..." />
      {list.length > 0 && (
        <div className="absolute z-20 bg-white border rounded-lg shadow-lg mt-1 w-full max-h-48 overflow-y-auto">
          {list.map(s => (
            <button key={s} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
              onClick={() => { setQ(s); setList([]); onPick(s); }}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
