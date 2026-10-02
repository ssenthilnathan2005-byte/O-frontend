import { useEffect, useState } from "react";
import "@fontsource/jost/700.css";

interface Props {
  onDone: () => void;
}

const BLUE = "#355f86";

export default function SplashScreen({ onDone }: Props) {
  const [out, setOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 2800);
    const t2 = setTimeout(() => onDone(), 3300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  const ring: React.CSSProperties = {
    position: "absolute", top: 0, width: "0.72em", height: "0.72em",
    borderRadius: "50%", border: "0.13em solid " + BLUE, boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden",
      background: "#ffffff",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 18,
      opacity: out ? 0 : 1,
      transition: out ? "opacity 0.5s ease" : "none",
    }}>
      <style>{`
        @keyframes dbRollL { from { transform: translateX(-110vw) rotate(-900deg); } to { transform: translateX(0) rotate(0); } }
        @keyframes dbRollR { from { transform: translateX(110vw) rotate(900deg); } to { transform: translateX(0) rotate(0); } }
        @keyframes dbUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dbFade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={{
        fontFamily: "'Jost', 'Segoe UI', system-ui, sans-serif",
        fontWeight: 700, fontSize: 52, color: BLUE,
        letterSpacing: "0.04em", lineHeight: 1.1, textAlign: "center",
      }}>
        <div style={{ animation: "dbUp 0.6s ease both" }}>DOCTOR</div>
        <div style={{ display: "inline-flex", alignItems: "center" }}>
          <span style={{ animation: "dbUp 0.6s ease 0.1s both" }}>B</span>
          <span style={{ position: "relative", width: "1.31em", height: "0.72em", margin: "0 0.05em", display: "inline-block" }}>
            <span style={{ ...ring, left: 0, animation: "dbRollL 1.2s cubic-bezier(.22,1.15,.36,1) 0.5s both" }} />
            <span style={{ ...ring, right: 0, animation: "dbRollR 1.2s cubic-bezier(.22,1.15,.36,1) 0.5s both" }} />
          </span>
          <span style={{ animation: "dbUp 0.6s ease 0.1s both" }}>KED</span>
        </div>
      </div>

      <div style={{
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: 15, fontWeight: 600, color: "#555555", letterSpacing: 0.5,
        animation: "dbFade 0.8s ease 1.8s both",
      }}>
        Skip the wait. Not the care.
      </div>
    </div>
  );
}
