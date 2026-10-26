import { useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getToken } from "@/api";
const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export type NurseApi = {
  counts: () => { arrived: number; waiting: number; ongoing: number; seen: number; skipped: number };
  nextToken: () => number | null;
  ongoingToken: () => number | null;
  nameOf: (n: number) => string;
  call: (n: number) => void;
  prescribe: () => string;
};

const TABS = [
  { tab: "regulator", words: ["regulator", "control panel"], say: "Opening the regulator." },
  { tab: "livetokens", words: ["live"], say: "Opening live patients." },
  { tab: "followups", words: ["follow up", "follow-up", "followup"], say: "Opening follow-ups." },
  { tab: "presets", words: ["preset"], say: "Opening presets." },
  { tab: "profile", words: ["profile"], say: "Opening your profile." },
];

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* speech output not available */ }
}

export default function NurseTab({ onNavigate, nurse }: { onNavigate: (tab: string) => void; nurse: NurseApi }) {
  const [phase, setPhase] = useState<"idle" | "listening" | "processing">("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [pendingTok, setPendingTok] = useState<number | null>(null);
  const nurseRef = useRef(nurse); nurseRef.current = nurse;
  const navRef = useRef(onNavigate); navRef.current = onNavigate;
  const pendingRef = useRef<number | null>(null);
  const stopRef = useRef<() => void>(() => {});

  function say(msg: string) { setReply(msg); speak(msg); }
  function setPending(n: number | null) { pendingRef.current = n; setPendingTok(n); }

  function confirmCall() {
    const tok = pendingRef.current;
    setPending(null);
    const n = nurseRef.current;
    if (tok === null) return;
    if (n.ongoingToken() !== null || n.nextToken() !== tok) { say("The queue changed. Please ask again."); return; }
    n.call(tok);
    say("Token " + tok + " is now with you.");
  }
  function cancelCall() { setPending(null); say("Okay, cancelled."); }

  function handle(text: string) {
    const t = text.toLowerCase();
    const n = nurseRef.current;
    if (pendingRef.current !== null) {
      if (/\b(yes|yeah|yep|yup|ok|okay|confirm|sure|haan)\b/.test(t)) return confirmCall();
      if (/\b(no|nope|cancel|stop|wait)\b/.test(t)) return cancelCall();
      return say("Please say yes or no.");
    }
    if (/prescri|medicine|write/.test(t)) return say(n.prescribe());
    if (/\b(call|next|first|send)\b/.test(t) && /\b(patient|token|next|first|in)\b/.test(t)) {
      const o = n.ongoingToken();
      if (o !== null) return say("Token " + o + " is still with you. Say prescribe to finish.");
      const nx = n.nextToken();
      if (nx === null) return say("No patients are waiting.");
      const name = n.nameOf(nx);
      setPending(nx);
      return say("Call token " + nx + (name ? ", " + name : "") + "? Say yes or no.");
    }
    if (/how many|status|queue|waiting|seen|arrived|today/.test(t)) {
      const c = n.counts();
      const parts = [c.arrived + " patients have come", c.seen + " seen"];
      if (c.ongoing) parts.push(c.ongoing + " with you");
      parts.push(c.waiting + " waiting");
      if (c.skipped) parts.push(c.skipped + " skipped");
      return say(parts.join(", ") + ".");
    }
    const hit = TABS.find(c => c.words.some(w => t.includes(w)));
    if (hit) { say(hit.say); navRef.current(hit.tab); return; }
    say("Sorry. Try: how many patients today, call the next patient, or prescribe.");
  }

  async function start() {
    if (phase !== "idle") return;
    setError(""); setHeard(""); setReply("");
    try {
      if (Capacitor.isNativePlatform()) {
        const p = await SpeechRecognition.requestPermissions();
        if (p.speechRecognition !== "granted") { setError("Microphone access is off for this app."); return; }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AC();
      await ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t)) || "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      const buf = new Uint8Array(an.fftSize);
      const t0 = Date.now();
      let last = t0;
      let spoke = false;
      let floor = 0.01;
      const timer = window.setInterval(() => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        const now = Date.now();
        if (rms > Math.max(0.03, floor * 3)) { spoke = true; last = now; }
        else floor = floor * 0.95 + rms * 0.05;
        if ((spoke && now - last > 1400) || (!spoke && now - t0 > 7000) || now - t0 > 20000) stopRef.current();
      }, 100);
      rec.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
      rec.onstop = async () => {
        window.clearInterval(timer);
        stream.getTracks().forEach(t => t.stop());
        ctx.close().catch(() => {});
        const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
        if (!spoke || blob.size < 1500) { setPhase("idle"); setError("I did not hear anything. Tap the mic and speak."); return; }
        setPhase("processing");
        try {
          const form = new FormData();
          form.append("audio", blob, "speech." + (blob.type.includes("mp4") ? "m4a" : "webm"));
          form.append("language", "en");
          const res = await fetch(`${API}/voice/transcribe`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: form });
          if (!res.ok) throw new Error("status " + res.status);
          const data = await res.json();
          const text = String(data?.text || "").trim();
          setHeard(text);
          if (!text || /^(thank you|thanks|you|bye)[.! ]*$/i.test(text)) setError("I did not catch that. Tap the mic and try again.");
          else handle(text);
        } catch { setError("The speech service could not be reached."); }
        setPhase("idle");
      };
      stopRef.current = () => { try { if (rec.state !== "inactive") rec.stop(); } catch { /* ignore */ } };
      rec.start();
      setPhase("listening");
    } catch { setError("Could not start the microphone."); }
  }

  return (
    <div className="max-w-md mx-auto py-8 text-center space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Personal Nurse</h2>
      <p className="text-sm text-gray-500">Tap the mic and speak. Try: "how many patients today", "call the next patient", "prescribe".</p>
      <Button
        onClick={phase === "listening" ? () => stopRef.current() : start}
        disabled={phase === "processing"}
        className={`h-20 w-20 rounded-full ${phase === "listening" ? "bg-red-600 hover:bg-red-700 animate-pulse" : ""}`}
      >
        {phase === "processing" ? <Loader2 className="w-8 h-8 animate-spin" /> : <Mic className="w-8 h-8" />}
      </Button>
      {phase === "listening" && <p className="text-sm text-red-600">Listening... stops when you stop talking</p>}
      {heard && <p className="text-sm text-gray-700">You said: {heard}</p>}
      {reply && <p className="text-sm font-medium text-sky-700">{reply}</p>}
      {pendingTok !== null && (
        <div className="flex justify-center gap-3">
          <Button onClick={confirmCall}>Yes</Button>
          <Button variant="outline" onClick={cancelCall}>No</Button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
