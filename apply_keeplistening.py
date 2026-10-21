# Keep listening through pauses + "Still speaking?" prompt. Run from F:\O-frontend:  python apply_keeplistening.py
import os, sys
comp = "src/components/VoicePrescription.tsx"
if not os.path.exists(comp): sys.exit("STOP: run this from the O-frontend folder.")
with open(comp, "r", encoding="utf-8", newline="") as f: raw = f.read()
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")

OPS = []

# 1. refs + state
OPS.append(("  const appendRef = useRef(false);\n",
"""  const appendRef = useRef(false);
  const bankRef = useRef("");         // text from earlier listening rounds in this recording
  const userStopRef = useRef(false);  // set once the doctor taps Stop / I'm done
  const deadRef = useRef(false);      // set when the component unmounts
  const lastActRef = useRef(0);       // last time speech was heard
  const [askDone, setAskDone] = useState(false);
"""))

# 2. unmount cleanup + silence timer
OPS.append(("""  useEffect(() => () => {
    try { recRef.current?.abort?.(); } catch { /* ignore */ }
    if (Capacitor.isNativePlatform() && phaseRef.current === "listening") SpeechRecognition.stop().catch(() => {});
  }, []);
""",
"""  useEffect(() => {
    deadRef.current = false;
    return () => {
      deadRef.current = true; userStopRef.current = true;
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
      setAskDone(idle >= 4000);
      if (idle >= 45000) stop();
    }, 500);
    return () => clearInterval(id);
  }, [phase]);
"""))

# 3. reset at start of each recording
OPS.append(('    finalRef.current = ""; liveRef.current = ""; confRef.current = 1; errRef.current = "";\n',
            '    finalRef.current = ""; liveRef.current = ""; confRef.current = 1; errRef.current = "";\n    bankRef.current = ""; userStopRef.current = false; setAskDone(false);\n'))

# 4. phone app: keep restarting the recognizer until the doctor is done
OPS.append(("""        setPhase("listening");
        const result = await SpeechRecognition.start({ language: "en-IN", maxResults: 1, partialResults: false, popup: false });
        await finish(result?.matches?.[0] ?? "");
""",
"""        setPhase("listening");
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
          if (fails >= 8 && !bankRef.current) break;
        }
        if (!deadRef.current && phaseRef.current === "listening") await finish(bankRef.current);
"""))

# 5. web: add earlier rounds to the live text
OPS.append(("""      liveRef.current = pieces.join(" ");
      setLive(liveRef.current);
""",
"""      liveRef.current = (bankRef.current + " " + pieces.join(" ")).trim();
      lastActRef.current = Date.now();
      setLive(liveRef.current);
"""))

# 6. web: restart when the browser stops after a pause
OPS.append(("""      recRef.current = null;
      const err = errRef.current;
""",
"""      recRef.current = null;
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
"""))

# 7. stop()
OPS.append(("""  function stop() {
    if (Capacitor.isNativePlatform()) { SpeechRecognition.stop().catch(() => {}); return; }
    try { recRef.current?.stop(); } catch { /* ignore */ }
  }
""",
"""  function stop() {
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
"""))

# 8. UI prompt
OPS.append(("""              <button
                onClick={stop}
                aria-label="Stop recording"
""",
"""              {askDone && (
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
"""))

for i, (old, new) in enumerate(OPS, 1):
    if s.count(old) != 1:
        sys.exit("STOP: patch %d did not match exactly once (already applied, or the file differs). Nothing changed." % i)
for old, new in OPS: s = s.replace(old, new)
with open(comp, "w", encoding="utf-8", newline="") as f: f.write(s.replace("\n", "\r\n") if crlf else s)
print("done: patched", comp)
