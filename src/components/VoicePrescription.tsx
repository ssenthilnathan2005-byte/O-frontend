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
  toPrescriptionItem, defaultTimes, TIME_ORDER,
} from "@/lib/voicePrescription";

export type VoiceItem = { name: string; dosage: string; duration: string; instructions: string };

interface Props {
  saving: boolean;
  notes: string;
  onNotesChange: (v: string) => void;
  onSkip: () => void;
  onConfirm: (items: VoiceItem[]) => void;
}

type Phase = "ready" | "listening" | "processing" | "review";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function searchDb(q: string): Promise<string[]> {
  const res = await fetch(`${API}/pharmacy/medicines?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("medicine search failed");
  const data = await res.json();
  return Array.isArray(data) ? data.map((m: any) => m?.name).filter(Boolean) : [];
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

  // never leave the microphone running when the dialog closes or the mode changes
  useEffect(() => () => {
    try { recRef.current?.abort?.(); } catch { /* ignore */ }
    if (Capacitor.isNativePlatform() && phaseRef.current === "listening") SpeechRecognition.stop().catch(() => {});
  }, []);

  async function finish(text: string) {
    const t = text.trim();
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
    const resolved = await Promise.all(parsed.map(m => resolveMed(m, searchDb)));
    setLowConf(confRef.current < 0.6);
    setHeard(prev => (appendRef.current && prev ? `${prev}\n${t}` : t));
    setMeds(prev => (appendRef.current ? [...prev, ...resolved] : resolved));
    setPhase("review");
  }

  async function start(append = false) {
    if (phase === "listening" || phase === "processing") return;
    setError("");
    setLive("");
    finalRef.current = ""; liveRef.current = ""; confRef.current = 1; errRef.current = "";
    appendRef.current = append;

    if (Capacitor.isNativePlatform()) {
      try {
        const avail = await SpeechRecognition.available();
        if (!avail.available) { setError("Voice input isn't available on this phone. Please use Manual."); return; }
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== "granted") {
          setError("Microphone access is off. Allow Microphone for Doctor Booked in your phone's app settings, or use Manual.");
          return;
        }
        setPhase("listening");
        const result = await SpeechRecognition.start({ language: "en-IN", maxResults: 1, partialResults: false, popup: false });
        await finish(result?.matches?.[0] ?? "");
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
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalRef.current += " " + r[0].transcript;
          confRef.current = Math.min(confRef.current, r[0].confidence || 1);
        } else interim += r[0].transcript;
      }
      liveRef.current = `${finalRef.current} ${interim}`.trim();
      setLive(liveRef.current);
    };
    rec.onerror = (e: any) => { errRef.current = e?.error || "error"; };
    rec.onend = () => {
      recRef.current = null;
      const err = errRef.current;
      const back: Phase = append && medsRef.current.length ? "review" : "ready";
      if (err === "not-allowed" || err === "service-not-allowed") {
        setPhase(back); setError("Microphone access is blocked. Allow the microphone for this site in the browser, or use Manual."); return;
      }
      if (err === "audio-capture") { setPhase(back); setError("No microphone found. Connect one, or use Manual."); return; }
      if (err === "network") { setPhase(back); setError("Voice needs an internet connection. Check your connection, or use Manual."); return; }
      void finish(finalRef.current || liveRef.current);
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
    if (Capacitor.isNativePlatform()) { SpeechRecognition.stop().catch(() => {}); return; }
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
            <p className="text-sm text-red-700 font-medium">Which medicine did you mean?</p>
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
