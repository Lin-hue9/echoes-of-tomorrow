import { motion } from "motion/react";
import { useEffect, useState } from "react";

const STATUS_MESSAGES = [
  "Initializing Echo Network...",
  "Synchronizing timeline branches...",
  "Locating alternate selves...",
  "Decrypting future messages...",
  "Stabilizing paradox buffers...",
  "Connecting to the Echo Network...",
];

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + (Math.random() * 3 + 1);
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 600);
          return 100;
        }
        return next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const clockRotation = progress * 3.6;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden" style={{ background: "radial-gradient(ellipse at center, #0d0a2e 0%, #04071a 70%)" }}>
      {[140, 120, 100].map((size, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: size,
            height: size,
            top: `${(140 - size) / 2}px`,
            left: `${(140 - size) / 2}px`,
            borderColor: i === 0 ? "rgba(124,92,252,0.4)" : i === 1 ? "rgba(0,212,255,0.3)" : "rgba(255,215,0,0.2)",
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 8 + i * 4, repeat: Infinity, ease: "linear" }}
        />
      ))}

      <motion.div
        className="absolute rounded-full"
        style={{
          width: 140,
          height: 140,
          top: 0,
          left: 0,
          border: "2px dashed rgba(124,92,252,0.6)",
        }}
        animate={{ rotate: clockRotation }}
        transition={{ duration: 0.1, ease: "linear" }}
      />

      <div className="relative w-36 h-36 rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle, rgba(124,92,252,0.3) 0%, transparent 70%)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle, #7c5cfc, #00d4ff)", boxShadow: "0 0 40px rgba(124,92,252,0.8)" }}>
          <span style={{ fontSize: "1.8rem" }}>⌚</span>
        </div>
      </div>

      <motion.div className="text-center mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
        <h2 style={{ fontFamily: "'Orbitron', sans-serif", color: "#e8eaf6", letterSpacing: "0.3em", fontSize: "1.1rem" }}>ECHO NETWORK</h2>
        <p className="text-xs mt-2 tracking-widest" style={{ color: "#7b82c4", fontFamily: "'Share Tech Mono', monospace" }}>SYNCHRONIZING TIMELINES...</p>
      </motion.div>

      <div className="w-80 mb-4">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(124,92,252,0.15)" }}>
          <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #7c5cfc, #00d4ff)", boxShadow: "0 0 10px rgba(0,212,255,0.6)" }} animate={{ width: `${progress}%` }} transition={{ duration: 0.1 }} />
        </div>
        <div className="flex justify-between mt-2 text-xs" style={{ color: "#7b82c4", fontFamily: "'Share Tech Mono', monospace" }}>
          <motion.span key={statusIndex} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{STATUS_MESSAGES[statusIndex]}</motion.span>
          <span style={{ color: "#00d4ff" }}>{Math.floor(progress)}%</span>
        </div>
      </div>

      <motion.div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.01) 2px, rgba(0,212,255,0.01) 4px)" }} />

      {[
        { msg: "DON'T GO TO THE SUBWAY", x: 15, y: 25 },
        { msg: "TRUST MAYA", x: 70, y: 15 },
        { msg: "BUY THE BLUE SERVER", x: 80, y: 70 },
        { msg: "MEET ME AT THE BRIDGE", x: 10, y: 75 },
      ].map((fragment, i) => (
        <motion.div
          key={i}
          className="absolute text-xs px-3 py-1.5 rounded border"
          style={{
            left: `${fragment.x}%`,
            top: `${fragment.y}%`,
            color: "#7c5cfc66",
            borderColor: "rgba(124,92,252,0.15)",
            background: "rgba(124,92,252,0.05)",
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "0.6rem",
            letterSpacing: "0.1em",
          }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 3, delay: i * 0.8, repeat: Infinity }}
        >
          {fragment.msg}
        </motion.div>
      ))}
    </div>
  );
}