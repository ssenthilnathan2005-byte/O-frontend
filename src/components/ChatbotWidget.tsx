import { useEffect, useRef, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Lang = "en" | "ta";

interface Message {
  role: "bot" | "user";
  text: string;
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

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [messages, setMessages] = useState<Message[]>([{ role: "bot", text: WELCOME.en }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);

  function switchLang(l: Lang) {
    setLang(l);
    setMessages([{ role: "bot", text: WELCOME[l] }]);
    setShowQuickReplies(true);
  }

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

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-label="Open DoctorBooked guide"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg hover:bg-teal-700 transition-colors"
        style={{ fontSize: 24 }}>
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-80 sm:w-96 rounded-2xl border border-gray-200 bg-white flex flex-col overflow-hidden"
          style={{ maxHeight: "75vh", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
          <div className="bg-teal-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">DB</div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">DB Guide</p>
                <p className="text-teal-100 text-xs mt-0.5">Online · here to help</p>
              </div>
            </div>
            <div className="flex gap-1">
              {(["en", "ta"] as Lang[]).map((l) => (
                <button key={l} onClick={() => switchLang(l)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors font-medium ${lang === l ? "bg-white/25 border-white/50 text-white" : "border-white/30 text-white/70 hover:text-white"}`}>
                  {l === "en" ? "EN" : "தமிழ்"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${msg.role === "user" ? "bg-teal-600 text-white rounded-br-sm" : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

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
        </div>
      )}
    </>
  );
}
