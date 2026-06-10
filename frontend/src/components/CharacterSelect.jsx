import { motion } from "motion/react";
import { useState } from "react";

const CHARACTERS = [
  { id: "dreamer", name: "The Dreamer", emoji: "🌙", color: "#a78bfa", description: "Curious and kind. Sees the beauty in every timeline." },
  { id: "hacker", name: "The Hacker", emoji: "💻", color: "#00ff88", description: "Loves technology. Knows how to break any system." },
  { id: "optimist", name: "The Optimist", emoji: "☀️", color: "#ffd700", description: "Always believes in a better tomorrow. Keeps everyone going." },
  { id: "rebel", name: "The Rebel", emoji: "⚡", color: "#ff4466", description: "Questions the system. Fights for freedom." },
  { id: "archivist", name: "The Archivist", emoji: "📚", color: "#00d4ff", description: "Collects forgotten history to protect the future." },
  { id: "echo", name: "The Echo", emoji: "👁", color: "#c084fc", description: "No one knows where they came from." },
];

export default function CharacterSelect({ onSelect, onBack }) {
  const [selected, setSelected] = useState(null);

  const handleSelectClass = () => {
    if (!selected) return;
    fetch('/api/choose_class', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_name: selected.name })
    }).then(() => onSelect(selected));
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col" style={{ background: "linear-gradient(180deg, #04071a 0%, #0d0a2e 100%)" }}>
      <div className="absolute inset-0">
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: Math.random() * 1.5 + 0.5,
            height: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.4 + 0.1,
          }} />
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-purple-500/20">
        <button onClick={onBack} className="text-purple-400 hover:text-white">◀ BACK</button>
        <h2 className="font-orbitron text-sm tracking-[0.3em] text-purple-300">SELECT YOUR TIMELINE CLASS</h2>
        <div className="w-16" />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {CHARACTERS.map((char) => (
            <motion.div
              key={char.id}
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelected(char)}
              className={`cursor-pointer rounded-lg p-4 flex flex-col items-center gap-3 transition-all border card-appear ${
                selected?.id === char.id
                  ? 'bg-purple-500/20 border-purple-500'
                  : 'bg-white/5 border-purple-500/20'
              }`}
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl float-animation"
                style={{ background: `radial-gradient(circle, ${char.color}33, transparent)`, border: `2px solid ${char.color}` }}
              >
                {char.emoji}
              </div>
              <div className="text-center">
                <div className="text-sm font-bold" style={{ color: char.color }}>{char.name}</div>
                <p className="text-xs text-purple-300 mt-1">{char.description.substring(0, 40)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="relative z-10 fixed bottom-8 left-1/2 -translate-x-1/2">
          <button onClick={handleSelectClass} className="bg-gradient-to-r from-purple-600 to-cyan-500 px-8 py-3 rounded-full font-bold tracking-wider shadow-lg hover:scale-105 transition glow-pulse">SELECT CLASS</button>
        </div>
      )}
    </div>
  );
}