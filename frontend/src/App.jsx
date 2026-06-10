import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import TitleScreen from './components/TitleScreen';
import CharacterSelect from './components/CharacterSelect';
import LoadingScreen from './components/LoadingScreen';
import GameScreen from './components/GameScreen';

export default function App() {
  const [screen, setScreen] = useState('title');
  const [character, setCharacter] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(data => {
        if (data.username) {
          setUser(data);
          if (data.class_name && data.class_name !== 'None') {
            setCharacter({
              name: data.class_name,
              emoji: getEmoji(data.class_name),
              color: getColor(data.class_name)
            });
            setScreen('game');
          } else {
            setScreen('character-select');
          }
        } else {
          setScreen('title');
        }
      })
      .catch(() => setScreen('title'));
  }, []);

  const getEmoji = (className) => {
    const map = { 'Dreamer': '🌙', 'Hacker': '💻', 'Optimist': '☀️', 'Rebel': '⚡', 'Archivist': '📚', 'Echo': '👁' };
    return map[className] || '⭐';
  };
  const getColor = (className) => {
    const map = { 'Dreamer': '#a78bfa', 'Hacker': '#00ff88', 'Optimist': '#ffd700', 'Rebel': '#ff4466', 'Archivist': '#00d4ff', 'Echo': '#c084fc' };
    return map[className] || '#7c5cfc';
  };

  const handleLogin = (username, class_name) => {
    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, class_name })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser({ username, class_name: null });
          setScreen('character-select');
        } else {
          alert(data.error);
        }
      });
  };

  const handleCharacterSelect = (selectedChar) => {
    setCharacter(selectedChar);
    setUser(prev => ({ ...prev, class_name: selectedChar.name }));
    setScreen('loading');
  };

  return (
    <div className="w-screen h-screen overflow-hidden">
      <AnimatePresence mode="wait">
        {screen === 'title' && <motion.div key="title" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><TitleScreen onLogin={handleLogin} /></motion.div>}
        {screen === 'character-select' && <motion.div key="char" className="absolute inset-0" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}><CharacterSelect onSelect={handleCharacterSelect} onBack={() => setScreen('title')} /></motion.div>}
        {screen === 'loading' && <motion.div key="loading" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><LoadingScreen onComplete={() => setScreen('game')} /></motion.div>}
        {screen === 'game' && character && <motion.div key="game" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><GameScreen character={character} user={user} /></motion.div>}
      </AnimatePresence>
    </div>
  );
}