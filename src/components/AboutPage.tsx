import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Clock, MapPin, FileText, ChevronRight } from "lucide-react";
import logo from "../assets/doctorbooked-logo.png";

interface Props {
  onContinue: () => void;
}

const features = [
  { icon: Clock, title: "Live token tracking", text: "See your place in the queue in real time and walk in only when it's your turn." },
  { icon: MapPin, title: "Find nearby hospitals", text: "Browse clinics and doctors around you and book a token in minutes." },
  { icon: FileText, title: "Digital prescriptions", text: "Keep all your prescriptions and records in one place." },
];

function TransparentLogo({ src, width }: { src: string; width: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (!ctx) { setUrl(src); return; }
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        const p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const lum = (p[i] + p[i + 1] + p[i + 2]) / 3;
          const a = Math.max(0, Math.min(1, (255 - lum) / 161));
          p[i] = 53; p[i + 1] = 95; p[i + 2] = 134;
          p[i + 3] = Math.round(a * 255);
        }
        ctx.putImageData(d, 0, 0);
        setUrl(c.toDataURL("image/png"));
      } catch {
        setUrl(src);
      }
    };
    img.onerror = () => setUrl(src);
    img.src = src;
  }, [src]);
  return (
    <img
      src={url ?? src}
      alt="Doctor Booked"
      style={{ width, display: "block", opacity: url ? 1 : 0, mixBlendMode: url === src ? "multiply" : "normal" }}
    />
  );
}

export default function AboutPage({ onContinue }: Props) {
  const up = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 9998, colorScheme: "light", background: "linear-gradient(180deg,#ecfdf9 0%,#ffffff 55%)" }}
    >
      <button
        type="button"
        onClick={onContinue}
        className="fixed top-4 right-4 text-sm font-medium text-gray-500 hover:text-teal-600 transition-colors"
        style={{ zIndex: 2 }}
      >
        Skip
      </button>

      <div className="max-w-3xl mx-auto px-6 py-12 lg:py-20 flex flex-col items-center text-center min-h-full">
        <motion.div {...up(0)}><TransparentLogo src={logo} width={190} /></motion.div>

        <motion.span
          {...up(0.15)}
          className="mt-8 inline-block rounded-full bg-teal-50 border border-teal-100 px-4 py-1 text-xs font-semibold tracking-wide text-teal-700 uppercase"
        >
          About us
        </motion.span>

        <motion.h1 {...up(0.25)} className="mt-4 text-3xl lg:text-5xl font-bold text-gray-900 leading-tight">
          Healthcare without the <span className="text-teal-600">waiting room</span>
        </motion.h1>

        <motion.p {...up(0.35)} className="mt-4 text-base lg:text-lg text-gray-500 max-w-xl">
          Doctor Booked lets you book a token at your hospital, track your turn live, and skip the long wait. Built for all hospitals and clinics.
        </motion.p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              {...up(0.5 + i * 0.12)}
              className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-teal-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{f.text}</p>
            </motion.div>
          ))}
        </div>

        <motion.button
          {...up(0.95)}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={onContinue}
          className="mt-10 mb-6 inline-flex items-center gap-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-semibold px-8 py-3.5 shadow-lg shadow-teal-600/25 transition-colors"
        >
          Get Started <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}