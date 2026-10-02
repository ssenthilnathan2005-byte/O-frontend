import { useEffect, useState } from "react";
import logo from "../assets/doctorbooked-logo.png";

interface Props {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: Props) {
  const [out, setOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 3000);
    const t2 = setTimeout(() => onDone(), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden",
      background: "#ffffff",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 14,
      opacity: out ? 0 : 1,
      transition: out ? "opacity 0.5s ease" : "none",
    }}>
      <style>{`
        @keyframes dbPop { 0% { opacity: 0; transform: scale(0.75) translateY(24px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes dbGlow { 0%,100% { opacity: 0.35; transform: scale(0.9); } 50% { opacity: 0.75; transform: scale(1.1); } }
        @keyframes dbShine { from { transform: translateX(-130%); } to { transform: translateX(130%); } }
        @keyframes dbEcg { from { stroke-dashoffset: 320; } to { stroke-dashoffset: 0; } }
        @keyframes dbUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dbDot { 0%,80%,100% { transform: scale(0.5); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }
        @keyframes dbFloatA { 0%,100% { transform: translate(0,0); } 50% { transform: translate(30px,-40px); } }
        @keyframes dbFloatB { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-40px,30px); } }
      `}</style>

      <div style={{ position: "absolute", top: "-12%", left: "-10%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,#99f6e4,transparent 70%)", opacity: 0.45, animation: "dbFloatA 6s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "-14%", right: "-12%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,#bae6fd,transparent 70%)", opacity: 0.5, animation: "dbFloatB 7s ease-in-out infinite" }} />

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", width: 320, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(20,184,166,0.28),transparent 70%)", animation: "dbGlow 2.2s ease-in-out infinite" }} />
        <div style={{ position: "relative", overflow: "hidden", animation: "dbPop 0.9s cubic-bezier(.34,1.56,.64,1) both" }}>
          <img src={logo} alt="Doctor Booked" style={{ display: "block", width: "min(260px, 70vw)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.9) 50%, transparent 62%)", animation: "dbShine 1s ease 1.2s both" }} />
        </div>
      </div>

      <svg width="200" height="30" viewBox="0 0 200 30" fill="none" style={{ marginTop: 2 }}>
        <path d="M0 15 H62 L70 15 L76 3 L84 27 L91 9 L96 15 H200" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="320" style={{ animation: "dbEcg 1.3s ease-in-out 0.9s both" }} />
      </svg>

      <div style={{
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: 15, fontWeight: 600, color: "#555555", letterSpacing: 0.5, textAlign: "center",
        animation: "dbUp 0.7s ease 1.7s both",
      }}>
        Skip the wait. Not the care.
      </div>

      <div style={{ display: "flex", gap: 7, marginTop: 10, animation: "dbUp 0.5s ease 2s both" }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#14b8a6", animation: `dbDot 1.1s ease-in-out ${i * 0.18}s infinite` }} />
        ))}
      </div>
    </div>
  );
}