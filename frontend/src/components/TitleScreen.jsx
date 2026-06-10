import { useState } from 'react';

export default function TitleScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [classType, setClassType] = useState('Dreamer');

  const handleStart = () => {
    if (username.trim()) onLogin(username, classType);
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(180deg, #04071a 0%, #0d0a2e 100%)' }}>
      {/* Star field */}
      <div className="absolute inset-0">
        {Array.from({ length: 120 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: Math.random() * 2 + 0.5,
            height: Math.random() * 2 + 0.5,
            opacity: Math.random() * 0.7 + 0.1,
            animation: `twinkle ${Math.random() * 3 + 2}s infinite`
          }} />
        ))}
      </div>

      <div className="relative z-10 text-center">
        <h1 className="font-orbitron text-6xl md:text-8xl font-black bg-gradient-to-b from-white via-purple-200 to-purple-600 bg-clip-text text-transparent tracking-wider">ECHOES</h1>
        <p className="font-orbitron text-xl tracking-[0.3em] text-purple-200 mt-2">OF TOMORROW</p>

        <div className="mt-12 bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30 w-80 mx-auto">
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black/50 border border-purple-500/50 rounded-lg px-4 py-2 text-white mb-4" />
          <select value={classType} onChange={(e) => setClassType(e.target.value)} className="w-full bg-black/50 border border-purple-500/50 rounded-lg px-4 py-2 text-white mb-4">
            <option>Dreamer</option><option>Hacker</option><option>Optimist</option><option>Rebel</option><option>Archivist</option><option>Echo</option>
          </select>
          <button onClick={handleStart} className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 py-2 rounded-lg font-bold tracking-wider">ENTER THE ECHO NETWORK</button>
        </div>
      </div>

      <style>{`
        @keyframes twinkle { 0%,100% { opacity: 0.2; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  );
}