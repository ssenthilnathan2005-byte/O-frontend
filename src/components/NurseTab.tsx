import { useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getToken } from "@/api";
const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const COMMANDS = [
  { tab: "regulator", words: ["regulator", "control panel", "token control"], say: "Opening the regulator." },
  { tab: "livetokens", words: ["live", "patients list", "who is waiting"], say: "Opening live patients." },
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

export default function NurseTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [phase, setPhase] = useState<"idle" | "listening" | "processing">("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);

  function handle(text: string) {
    const t = text.toLowerCase();
    const hit = COMMANDS.find(c => c.words.some(w => t.includes(w)));
    if (hit) { setReply(hit.say); speak(hit.say); onNavigate(hit.tab); return; }
    const msg = "Sorry, I can open: regulator, live, follow-ups, presets or profile.";
    setReply(msg); speak(msg);
  }

  async function start() {
    setError(""); setHeard(""); setReply("");
    try {
      if (Capacitor.isNativePlatform()) {
        const p = await SpeechRecognition.requestPermissions();
        if (p.speechRecognition !== "granted") { setError("Microphone access is off for this app."); return; }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t)) || "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
        if (blob.size < 1500) { setPhase("idle"); setError("I did not hear anything."); return; }
        setPhase("processing");
        try {
          const form = new FormData();
          const ext = blob.type.includes("mp4") ? "m4a" : "webm";
          form.append("audio", blob, "speech." + ext);
          form.append("language", "en");
          const res = await fetch(`${API}/voice/transcribe`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: form });
          if (!res.ok) throw new Error("status " + res.status);
          const data = await res.json();
          const text = String(data?.text || "");
          setHeard(text);
          handle(text);
        } catch { setError("The speech service could not be reached."); }
        setPhase("idle");
      };
      recRef.current = rec;
      rec.start();
      setPhase("listening");
    } catch { setError("Could not start the microphone."); }
  }

  function stop() { try { recRef.current?.stop(); } catch { /* ignore */ } }

  return (
    <div className="max-w-md mx-auto py-8 text-center space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Personal Nurse</h2>
      <p className="text-sm text-gray-500">Tap the mic, say a command, tap stop. Try: "open live patients".</p>
      <Button
        onClick={phase === "listening" ? stop : start}
        disabled={phase === "processing"}
        className={`h-20 w-20 rounded-full ${phase === "listening" ? "bg-red-600 hover:bg-red-700" : ""}`}
      >
        {phase === "processing" ? <Loader2 className="w-8 h-8 animate-spin" /> : phase === "listening" ? <Square className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
      </Button>
      {phase === "listening" && <p className="text-sm text-red-600">Listening...</p>}
      {heard && <p className="text-sm text-gray-700">You said: {heard}</p>}
      {reply && <p className="text-sm font-medium text-sky-700">{reply}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
