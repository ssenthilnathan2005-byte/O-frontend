import shutil, sys

P = "src/components/VoicePrescription.tsx"
raw = open(P, "rb").read().decode("utf-8")
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

def swap(old, new):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit("ABORT: expected exactly 1 match, found %d for: %s" % (n, old[:70]))
    s = s.replace(old, new)

# 1. type for an in-progress server recording
old = 'type Phase = "ready" | "listening" | "processing" | "asking" | "review";'
swap(old, old + r'''

// handle for an in-progress recording that will be transcribed on the server
type ServerRec = { stop: () => void; abort: () => void };''')

# 2. upload helper
old = 'import { pickBestAlternative, fixMisheard } from "../lib/voiceHeard";'
swap(old, old + r'''

// Server-side speech-to-text: far better with accents and drug names than the phone's built-in recognizer
async function transcribeOnServer(blob: Blob, hints: string[]): Promise<{ text: string; confidence: number | null }> {
  const form = new FormData();
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", blob, "speech." + ext);
  form.append("language", "en");
  if (hints.length) form.append("hints", JSON.stringify(hints));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${API}/voice/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error("transcribe failed " + res.status);
    const data = await res.json();
    return { text: String(data?.text || ""), confidence: typeof data?.confidence === "number" ? data.confidence : null };
  } finally {
    clearTimeout(timer);
  }
}''')

# 3. new refs
old = 'const lastActRef = useRef(0);'
swap(old, r'''const spokeRef = useRef(false);            // speech heard in the current server recording
  const serverRef = useRef<ServerRec | null>(null);
  const serverDownUntilRef = useRef(0);      // while in the future, use the built-in recognizer instead
  const audioCtxRef = useRef<AudioContext | null>(null);
  ''' + old)

# 4. silence logic must know that speech happened even though there is no live text
old = 'const said = (liveRef.current || bankRef.current).length > 0;'
swap(old, 'const said = spokeRef.current || (liveRef.current || bankRef.current).length > 0;')

# 5. release the microphone when the dialog closes
old = 'try { recRef.current?.abort?.(); } catch { /* ignore */ }'
swap(old, old + r'''
      try { serverRef.current?.abort(); } catch { /* ignore */ }
      try { void audioCtxRef.current?.close(); } catch { /* ignore */ }''')

# 6. try the server path first when recording starts
old = 'if (!answering) appendRef.current = append;'
swap(old, old + r'''
    // preferred path: record here and transcribe on the server; fall back to the built-in recognizer
    if (Date.now() >= serverDownUntilRef.current && (await startServerRec())) return;''')

# 7. recorder + stop()
old = 'function stop() {'
swap(old, r'''// Records the doctor's voice and sends it to the server. Returns false when this device cannot
  // record, so the built-in recognizer is used instead.
  async function startServerRec(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return false;
    if (Capacitor.isNativePlatform() && !permOkRef.current) {
      try {
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== "granted") {
          setError("Microphone access is off. Allow Microphone for Doctor Booked in your phone's app settings, or use Manual.");
          return true;
        }
        permOkRef.current = true;
      } catch { /* plugin missing: the browser prompt below will ask */ }
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
        setError("Microphone access is blocked. Allow the microphone for this site, or use Manual.");
        return true;
      }
      return false;
    }
    const stopTracks = () => stream.getTracks().forEach(t => t.stop());

    let src: MediaStreamAudioSourceNode | null = null;
    let analyser!: AnalyserNode;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current as AudioContext;
      await ctx.resume().catch(() => {});
      if (ctx.state !== "running") throw new Error("audio context not running");
      src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
    } catch { stopTracks(); return false; }

    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
      .find(t => MediaRecorder.isTypeSupported(t)) || "";
    let rec!: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
    } catch {
      try { src?.disconnect(); } catch { /* ignore */ }
      stopTracks();
      return false;
    }

    const chunks: Blob[] = [];
    const buf = new Uint8Array(analyser.fftSize);
    let floor = 0.01; // background noise level, adapts while nobody is speaking
    spokeRef.current = false;
    const vad = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      if (rms > Math.max(0.03, floor * 3)) { spokeRef.current = true; lastActRef.current = Date.now(); }
      else floor = floor * 0.95 + rms * 0.05;
    }, 100);
    const maxTimer = setTimeout(() => serverRef.current?.stop(), 90000);
    const cleanup = () => {
      clearInterval(vad);
      clearTimeout(maxTimer);
      try { src?.disconnect(); } catch { /* ignore */ }
      stopTracks();
      serverRef.current = null;
    };

    rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      cleanup();
      if (deadRef.current) return;
      const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      if (!spokeRef.current || blob.size < 1500) { await finish(""); return; }
      setPhase("processing");
      try {
        const hints = medsRef.current.map(m => m.name).filter(Boolean).slice(0, 10);
        const out = await transcribeOnServer(blob, hints);
        if (deadRef.current) return;
        if (out.confidence !== null) confRef.current = out.confidence;
        await finish(out.text);
      } catch (e) {
        if (deadRef.current) return;
        console.error("[voice-rx] server speech failed", e);
        serverDownUntilRef.current = Date.now() + 2 * 60 * 1000;
        if (askRef.current) { phaseRef.current = "asking"; setPhase("asking"); void start(true, true); return; }
        setPhase(appendRef.current && medsRef.current.length ? "review" : "ready");
        setError("The speech service could not be reached, so the phone's built-in recognizer will be used. Tap the mic and speak again.");
      }
    };

    serverRef.current = {
      stop: () => { userStopRef.current = true; setAskDone(false); try { if (rec.state !== "inactive") rec.stop(); } catch { /* ignore */ } },
      abort: () => { userStopRef.current = true; try { if (rec.state !== "inactive") rec.stop(); } catch { /* ignore */ } },
    };
    try {
      rec.start(250);
    } catch { cleanup(); return false; }
    lastActRef.current = Date.now();
    setPhase("listening");
    return true;
  }

  function stop() {
    if (serverRef.current) { serverRef.current.stop(); return; }''')

shutil.copyfile(P, "bak_VoicePrescription.tsx.txt")
out = s.replace("\n", "\r\n") if crlf else s
open(P, "wb").write(out.encode("utf-8"))
print("Patched OK. Backup saved as bak_VoicePrescription.tsx.txt")
