import re, sys
V = "src/components/VoicePrescription.tsx"
raw = open(V, "rb").read().decode("utf-8")
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")
def swap(old, new, label):
    global s
    n = s.count(old)
    if n != 1: sys.exit("ABORT (%s): expected 1 match, found %d. Nothing changed." % (label, n))
    s = s.replace(old, new)

swap('  async function finish(text: string) {', r'''  const reaskRef = useRef(0);
  // ask out loud when something was not understood, then listen again (max 2 times)
  function reask(msg: string, hasMeds: boolean): boolean {
    if (reaskRef.current >= 2 || deadRef.current) { reaskRef.current = 0; return false; }
    reaskRef.current += 1;
    setError(msg);
    const again = () => setTimeout(() => { if (!deadRef.current) void start(hasMeds); }, 300);
    try {
      const sy: any = (window as any).speechSynthesis;
      if (voiceOutRef.current && sy) {
        const u = new SpeechSynthesisUtterance(msg);
        u.lang = "en-IN"; u.rate = 1.05;
        u.onend = again; u.onerror = again;
        sy.cancel(); sy.speak(u);
        return true;
      }
    } catch { /* fall through */ }
    again();
    return true;
  }

  async function finish(text: string) {''', "reask fn")

swap('''      setPhase(backTo);
      setError("I didn't catch anything. Tap the mic and speak again.");
      return;''', '''      setPhase(backTo);
      if (reask("Sorry, I didn't catch that. Please say the medicine again.", hasMeds)) return;
      setError("I didn't catch anything. Tap the mic and speak again.");
      return;''', "empty branch")

s, k = re.subn(r'    if \(!parsed\.length\) \{\n      setPhase\(backTo\);\n      setError\((`[^`]*`)\);\n      return;\n    \}',
  lambda m: '    if (!parsed.length) {\n      setPhase(backTo);\n      if (reask("Sorry, I did not catch a medicine. Please say the medicine name, dose, how often and for how long.", hasMeds)) return;\n      setError(' + m.group(1) + ');\n      return;\n    }', s)
if k != 1: sys.exit("ABORT (no-medicine branch): found %d. Nothing changed." % k)

swap('    setLowConf(confRef.current < 0.6);', '    reaskRef.current = 0;\n    setLowConf(confRef.current < 0.6);', "reset")
open(V, "wb").write((s.replace("\n", "\r\n") if crlf else s).encode("utf-8"))
print("DONE")
