import { useEffect, useState } from "react";
import logo from "../assets/doctorbooked-logo.png";

interface Props {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("out"), 2000);
    const t3 = setTimeout(() => onDone(), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#ffffff",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 12,
      opacity: phase === "out" ? 0 : 1,
      transition: phase === "out" ? "opacity 0.5s ease" : "none",
    }}>
      <img
        src={logo}
        alt="Doctor Booked"
        style={{
          width: 260,
          opacity: phase === "in" ? 0 : 1,
          transform: phase === "in" ? "translateY(20px)" : "translateY(0px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      />
      <div style={{
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", fontSize: 15, fontWeight: 600, color: "#555555",
        letterSpacing: 0.5, textAlign: "center",
        opacity: phase === "in" ? 0 : 1,
        transition: "opacity 0.6s ease 0.4s",
      }}>
        Skip the wait. Not the care.
      </div>
    </div>
  );
}
