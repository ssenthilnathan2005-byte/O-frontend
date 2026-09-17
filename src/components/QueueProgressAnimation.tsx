import { Check, User } from "lucide-react";
import { motion } from "motion/react";
import type { TokenStatus } from "../types";

interface Props {
  myStatus: TokenStatus;
}

const STEPS = ["Check-in", "In Queue", "With Doctor", "Completed"];

export default function QueueProgressAnimation({ myStatus }: Props) {
  // Map token status -> which step is active
  const stepIndex =
    myStatus === "green" ? 3 :
    myStatus === "orange" ? 2 :
    1; // red / yellow / unvisited / white -> "In Queue"

  const percent = Math.round((stepIndex / (STEPS.length - 1)) * 100);

  // Decorative silhouette figures (purely visual, like image 1)
  const figures = [0, 1, 2, 3, 4, 5, 6];
  const activeFigureIndex = 3; // the glowing "you are here" figure

  return (
    <div className="relative overflow-hidden rounded-2xl mb-4 p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 border border-slate-800">
      {/* subtle background grid glow */}
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,rgba(56,189,248,0.4)_1px,transparent_0)] [background-size:20px_20px]" />

      <div className="relative flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-lg">Queue Progress</h2>
        <span className="text-cyan-400 font-bold text-lg">{percent}%</span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full bg-slate-800 mb-6 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      {/* Step tracker */}
      <div className="relative flex items-center justify-between mb-8">
        {STEPS.map((label, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <div key={label} className="relative flex-1 flex flex-col items-center">
              {i > 0 && (
                <div
                  className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${
                    i <= stepIndex ? "bg-cyan-400" : "bg-slate-700"
                  }`}
                />
              )}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                  done
                    ? "bg-cyan-400 text-slate-900"
                    : active
                      ? "bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300"
                      : "bg-slate-800 text-slate-500"
                }`}
              >
                {done ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <motion.div
                    animate={active ? { scale: [1, 1.15, 1] } : {}}
                    transition={active ? { duration: 1.4, repeat: Infinity } : {}}
                  >
                    <User className="w-4 h-4" />
                  </motion.div>
                )}
              </div>
              <span
                className={`mt-1.5 text-[11px] font-semibold ${
                  active ? "text-cyan-300" : done ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Animated silhouette queue row */}
      <div className="relative flex items-end justify-between px-1">
        {figures.map((i) => {
          const isYou = i === activeFigureIndex;
          return (
            <div key={i} className="relative flex flex-col items-center">
              {isYou && (
                <motion.div
                  className="absolute -bottom-1 w-10 h-10 rounded-full bg-cyan-400/30 blur-md"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.2, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
              )}
              <motion.div
                className={`relative w-7 h-9 rounded-t-full ${
                  isYou
                    ? "bg-gradient-to-b from-cyan-300 to-blue-500"
                    : "bg-slate-700/60"
                }`}
                animate={isYou ? { y: [0, -3, 0] } : {}}
                transition={isYou ? { duration: 1.6, repeat: Infinity } : {}}
              />
              <div
                className={`mt-1 w-8 h-1.5 rounded-full ${
                  isYou ? "bg-cyan-400/70" : "bg-slate-700/40"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
