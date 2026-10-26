import sys
V = "src/components/VoicePrescription.tsx"
raw = open(V, "rb").read().decode("utf-8")
crlf = "\r\n" in raw
s = raw.replace("\r\n", "\n")
def swap(old, new):
    global s
    n = s.count(old)
    if n != 1: sys.exit("ABORT: expected 1 match, found %d for: %s" % (n, old[:60]))
    s = s.replace(old, new)

swap('async function transcribeOnServer(blob: Blob, hints: string[])',
'''// Whisper invents phrases like "Thank you" from silence or noise; drop them so they never become a medicine
function cleanTranscript(t: string): string {
  let x = t.trim();
  if (/^[\\s.,!?]*(thank you( very much)?|thanks( for watching)?|please subscribe|subscribe|bye|good bye|goodbye|you|okay|ok|hmm+|um+|uh+|yes|no)[\\s.,!?]*$/i.test(x)) return "";
  x = x.replace(/[\\s.,!?]*\\b(thank you( very much)?|thanks|bye)\\b[\\s.,!?]*$/i, "").trim();
  return x;
}

async function transcribeOnServer(blob: Blob, hints: string[])''')
swap('return { text: String(data?.text || ""), confidence:',
     'return { text: cleanTranscript(String(data?.text || "")), confidence:')
open(V, "wb").write((s.replace("\n", "\r\n") if crlf else s).encode("utf-8"))
print("DONE")
