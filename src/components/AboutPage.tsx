import { motion } from "motion/react";
import { Clock, MapPin, FileText, ChevronRight } from "lucide-react";


interface Props {
  onContinue: () => void;
}

const features = [
  { icon: Clock, title: "Live token tracking", text: "See your place in the queue in real time and walk in only when it's your turn." },
  { icon: MapPin, title: "Find nearby hospitals", text: "Browse clinics and doctors around you and book a token in minutes." },
  { icon: FileText, title: "Digital prescriptions", text: "Keep all your prescriptions and records in one place." },
];

export default function AboutPage({ onContinue }: Props) {
  const up = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <div
      className="db-about fixed inset-0 overflow-y-auto"
      style={{ zIndex: 9998 }}
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
        <style>{`
        .db-about{background:linear-gradient(180deg,#ecfdf9 0%,#ffffff 55%)}
        .db-word{color:#355f86}
        .db-ring{border:0.15em solid #355f86}
        @media (prefers-color-scheme: dark){
          .db-about{background:linear-gradient(180deg,#0b1716 0%,#121212 60%)}
          .db-word{color:#8cc4e8}
          .db-ring{border-color:#8cc4e8}
          .db-about h1,.db-about h3{color:#f3f4f6}
          .db-about p{color:#9ca3af}
          .db-about .bg-white{background:#1b1f1f;border-color:#2a3030}
          .db-about .bg-teal-50{background:#0f2a27;border-color:#1d4d47}
          .db-about .text-teal-600,.db-about .text-teal-700{color:#5eead4}
        }
      `}</style>
        <motion.div {...up(0)} className="db-word" aria-label="Doctor Booked" style={{ fontFamily: "Jost, Segoe UI, system-ui, sans-serif", fontWeight: 700, fontSize: 40, letterSpacing: "0.04em", lineHeight: 1.1, textAlign: "center" }}>
          <div>DOCTOR</div>
          <div style={{ display: "inline-flex", alignItems: "baseline" }}>
            <span>B</span>
            <span style={{ position: "relative", width: "1.2em", height: "0.7em", margin: "0 0.04em", display: "inline-block" }}>
              <span className="db-ring" style={{ position: "absolute", top: 0, left: 0, width: "0.7em", height: "0.7em", borderRadius: "50%", boxSizing: "border-box" }} />
              <span className="db-ring" style={{ position: "absolute", top: 0, right: 0, width: "0.7em", height: "0.7em", borderRadius: "50%", boxSizing: "border-box" }} />
            </span>
            <span>KED</span>
          </div>
        </motion.div>

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
