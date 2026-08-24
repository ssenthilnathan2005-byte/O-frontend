import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Lang = "en" | "ta";
type Mode = "chat" | "voice";

interface Message {
  role: "bot" | "user";
  text: string;
}

interface VoiceMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_REPLIES: Record<Lang, { label: string; key: string }[]> = {
  en: [
    { label: "How to book a token?", key: "book" },
    { label: "Track my token", key: "track" },
    { label: "Payment help", key: "pay" },
    { label: "What is a session?", key: "session" },
    { label: "Which doctor should I see?", key: "doctor" },
  ],
  ta: [
    { label: "டோக்கன் எப்படி பதிவு செய்வது?", key: "book" },
    { label: "என் டோக்கன் கண்காணிக்க", key: "track" },
    { label: "பணம் செலுத்த உதவி", key: "pay" },
    { label: "Session என்றால் என்ன?", key: "session" },
    { label: "எந்த மருத்துவரை சந்திக்கணும்?", key: "doctor" },
  ],
};

const WELCOME: Record<Lang, string> = {
  en: "Hi! I'm your DoctorBooked guide. I can help you book a token, track your queue, and answer any questions. How can I help?",
  ta: "வணக்கம்! நான் உங்கள் DoctorBooked வழிகாட்டி. டோக்கன் பதிவு, queue கண்காணிப்பு மற்றும் எந்த கேள்விக்கும் உதவுவேன். எப்படி உதவலாம்?",
};

const VOICE_WELCOME: Record<Lang, string> = {
  en: "Voice booking ready. Tap the mic and tell me which hospital you want.",
  ta: "Voice booking தயாராக உள்ளது. Mic அழுத்தி எந்த மருத்துவமனை வேண்டும் என்று சொல்லுங்கள்.",
};

function getJwt(): string | null {
  try { return localStorage.getItem("db_jwt"); } catch { return null; }
}

function speak(text: string, lang: Lang) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang === "ta" ? "ta-IN" : "en-IN";
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}

export default function ChatbotWidget() {
  const [open, setOpen]               = useState(false);
  const [lang, setLang]               = useState<Lang>("en");
  const [mode, setMode]               = useState<Mode>("chat");

  // ── chat state ──
  const [messages, setMessages]       = useState<Message[]>([{ role: "bot", text: WELCOME.en }]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  // ── voice state ──
  const [voiceHistory, setVoiceHistory] = useState<VoiceMessage[]>([]);
  const [voiceLog, setVoiceLog]         = useState<Message[]>([{ role: "bot", text: VOICE_WELCOME.en }]);
  const [listening, setListening]       = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [bookedToken, setBookedToken]   = useState<null | { tokenNumber: number; doctorName: string; hospitalName: string }>(null);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const recognitionRef  = useRef<SpeechRecognition | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, voiceLog, loading, voiceLoading]);
  useEffect(() => { if (open && mode === "chat") setTimeout(() => inputRef.current?.focus(), 100); }, [open, mode]);

  // ── reset voice state when switching to voice mode ──
  useEffect(() => {
    if (mode === "voice") {
      setVoiceHistory([]);
      setVoiceLog([{ role: "bot", text: VOICE_WELCOME[lang] }]);
      setBookedToken(null);
      setListening(false);
      setVoiceLoading(false);
      speak(VOICE_WELCOME[lang], lang);
    }
  }, [mode, lang]);

  function switchLang(l: Lang) {
    setLang(l);
    setMessages([{ role: "bot", text: WELCOME[l] }]);
    setShowQuickReplies(true);
    if (mode === "voice") {
      setVoiceHistory([]);
      setVoiceLog([{ role: "bot", text: VOICE_WELCOME[l] }]);
      setBookedToken(null);
    }
  }

  // ── TEXT CHAT ──────────────────────────────────────────────────────────────
  async function sendToBot(text: string) {
    setMessages((prev) => [...prev, { role: "user", text }]);
    setShowQuickReplies(false);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, lang }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "bot", text: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: lang === "ta" ? "மன்னிக்கவும், மீண்டும் முயற்சிக்கவும்." : "Sorry, please try again." }]);
    } finally {
      setLoading(false);
      setShowQuickReplies(true);
    }
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    sendToBot(trimmed);
  }

  // ── VOICE BOOKING ──────────────────────────────────────────────────────────
  const sendVoiceTurn = useCallback(async (transcript: string) => {
    const jwt = getJwt();
    if (!jwt) {
      const msg = lang === "ta" ? "குரல் booking-க்கு login செய்யவும்." : "Please log in to use voice booking.";
      setVoiceLog((p) => [...p, { role: "bot", text: msg }]);
      speak(msg, lang);
      return;
    }

    const userMsg: VoiceMessage = { role: "user", content: transcript };
    const nextHistory = [...voiceHistory, userMsg];
    setVoiceHistory(nextHistory);
    setVoiceLog((p) => [...p, { role: "user", text: transcript }]);
    setVoiceLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat/voice-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ messages: nextHistory, lang }),
      });
      const data = await res.json();
      const reply: string = data.reply || (lang === "ta" ? "மன்னிக்கவும், மீண்டும் முயற்சிக்கவும்." : "Sorry, please try again.");

      setVoiceHistory((p) => [...p, { role: "assistant", content: reply }]);
      setVoiceLog((p) => [...p, { role: "bot", text: reply }]);
      speak(reply, lang);

      if (data.booking?.success) {
        setBookedToken({
          tokenNumber: data.booking.tokenNumber,
          doctorName: data.booking.doctorName,
          hospitalName: data.booking.hospitalName,
        });
      }
    } catch {
      const err = lang === "ta" ? "இணைப்பு பிழை. மீண்டும் முயற்சிக்கவும்." : "Connection error. Please try again.";
      setVoiceLog((p) => [...p, { role: "bot", text: err }]);
      speak(err, lang);
    } finally {
      setVoiceLoading(false);
    }
  }, [voiceHistory, lang]);

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Your browser doesn't support voice input. Please use Chrome.");
      return;
    }
    if (listening || voiceLoading) return;

    window.speechSynthesis?.cancel();

    const rec = new SR() as SpeechRecognition;
    rec.lang = lang === "ta" ? "ta-IN" : "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = () => setListening(false);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      if (transcript) sendVoiceTurn(transcript);
    };

    rec.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  const displayMessages = mode === "chat" ? messages : voiceLog;
  const isLoading       = mode === "chat" ? loading : voiceLoading;

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-label="Open DoctorBooked guide"
        className="fixed bottom-24 right-4 lg:bottom-16 lg:right-6 z-40 w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg hover:bg-teal-700 transition-colors text-2xl lg:text-3xl">
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="fixed bottom-40 right-4 lg:bottom-36 lg:right-6 z-40 w-80 sm:w-96 lg:w-[26rem] rounded-2xl border border-gray-200 bg-white flex flex-col overflow-hidden"
          style={{ maxHeight: "75vh", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>

          {/* Header */}
          <div className="bg-teal-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">DB</div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">DB Guide</p>
                <p className="text-teal-100 text-xs mt-0.5">{mode === "voice" ? "🎙 Voice Booking" : "Online · here to help"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {(["en", "ta"] as Lang[]).map((l) => (
                <button key={l} onClick={() => switchLang(l)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors font-medium ${lang === l ? "bg-white/25 border-white/50 text-white" : "border-white/30 text-white/70 hover:text-white"}`}>
                  {l === "en" ? "EN" : "தமிழ்"}
                </button>
              ))}
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-gray-200 bg-white">
            <button onClick={() => setMode("chat")}
              className={`flex-1 text-xs font-semibold py-2 transition-colors ${mode === "chat" ? "text-teal-600 border-b-2 border-teal-600" : "text-gray-500 hover:text-gray-700"}`}>
              💬 Chat
            </button>
            <button onClick={() => setMode("voice")}
              className={`flex-1 text-xs font-semibold py-2 transition-colors ${mode === "voice" ? "text-teal-600 border-b-2 border-teal-600" : "text-gray-500 hover:text-gray-700"}`}>
              🎙 Voice Book
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {displayMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${msg.role === "user" ? "bg-teal-600 text-white rounded-br-sm" : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {/* Booking success card */}
            {mode === "voice" && bookedToken && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm text-teal-900 mt-2">
                <p className="font-bold text-base mb-1">✅ Token Booked!</p>
                <p>Token <span className="font-bold text-teal-700 text-lg">#{bookedToken.tokenNumber}</span></p>
                <p>{bookedToken.doctorName}</p>
                <p className="text-teal-600">{bookedToken.hospitalName}</p>
                <p className="text-xs text-teal-500 mt-1">Track it under My Tokens in the app.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat mode: quick replies + text input */}
          {mode === "chat" && (
            <>
              {showQuickReplies && !loading && (
                <div className="px-3 py-2 flex flex-wrap gap-1.5 border-t border-gray-100 bg-white">
                  {QUICK_REPLIES[lang].map((qr) => (
                    <button key={qr.key} onClick={() => sendToBot(qr.label)}
                      className="text-xs px-3 py-1.5 rounded-full border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-600 hover:text-white transition-colors">
                      {qr.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-200 bg-white">
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={lang === "ta" ? "உங்கள் கேள்வியை தட்டச்சு செய்யுங்கள்..." : "Type your question..."}
                  className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 outline-none focus:border-teal-500 bg-gray-50"
                  disabled={loading} />
                <button onClick={handleSend} disabled={loading || !input.trim()} aria-label="Send"
                  className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-teal-700 transition-colors flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </>
          )}

          {/* Voice mode: mic button */}
          {mode === "voice" && (
            <div className="flex flex-col items-center gap-2 px-4 py-4 border-t border-gray-200 bg-white">
              {bookedToken ? (
                <button onClick={() => { setBookedToken(null); setVoiceHistory([]); setVoiceLog([{ role: "bot", text: VOICE_WELCOME[lang] }]); speak(VOICE_WELCOME[lang], lang); }}
                  className="w-full py-2 rounded-full bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors">
                  Book another token
                </button>
              ) : (
                <>
                  <button
                    onClick={listening ? stopListening : startListening}
                    disabled={voiceLoading}
                    aria-label={listening ? "Stop listening" : "Start voice input"}
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl shadow-lg transition-all
                      ${listening ? "bg-red-500 animate-pulse scale-110" : voiceLoading ? "bg-gray-400" : "bg-teal-600 hover:bg-teal-700"}`}>
                    {listening ? "⏹" : voiceLoading ? "⏳" : "🎙"}
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    {listening
                      ? (lang === "ta" ? "கேட்கிறேன்... பேசுங்கள்" : "Listening… speak now")
                      : voiceLoading
                        ? (lang === "ta" ? "செயல்படுகிறது..." : "Processing…")
                        : (lang === "ta" ? "Mic அழுத்தி பேசுங்கள்" : "Tap mic and speak")}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
