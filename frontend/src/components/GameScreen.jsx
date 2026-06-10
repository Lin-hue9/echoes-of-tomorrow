import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { sounds } from '../utils/sounds';

export default function GameScreen({ character, user }) {
  const [echoes, setEchoes] = useState([]);
  const [activeTab, setActiveTab] = useState('story');
  const [modalContent, setModalContent] = useState(null);
  const [missions, setMissions] = useState([]);
  const [progress, setProgress] = useState({ level: 1, xp: 0, crystals: 0, fragments: 0, timeline_health: 100 });
  const [inventory, setInventory] = useState([]);
  const [timelines, setTimelines] = useState([]);
  const [globalEvent, setGlobalEvent] = useState({ name: 'None', progress: 0 });
  const [futureMessages, setFutureMessages] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [journalEntries, setJournalEntries] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [dailyChoices, setDailyChoices] = useState([]);
  const [echoMessage, setEchoMessage] = useState('');
  const [flash, setFlash] = useState(false);
  const [miniGame, setMiniGame] = useState(null);
  const [miniGameAnswer, setMiniGameAnswer] = useState('');
  const [dailyRewardClaimed, setDailyRewardClaimed] = useState(false);

  const [storyChapters, setStoryChapters] = useState([]);
  const [combatEncounters, setCombatEncounters] = useState([]);
  const [craftingRecipes, setCraftingRecipes] = useState([]);
  const [selectedEncounter, setSelectedEncounter] = useState(null);
  const [combatLog, setCombatLog] = useState(null);

  const getClassFlavor = () => {
    switch(character.name) {
      case 'Dreamer': return "✨ You see faint glowing paths others can't.";
      case 'Hacker': return "💻 Glitchy UI elements appear – you can exploit them.";
      case 'Optimist': return "☀️ Your echoes always end with a hopeful note.";
      case 'Rebel': return "⚡ You occasionally receive forbidden messages.";
      case 'Archivist': return "📚 You can read deleted echoes from the timeline.";
      case 'Echo': return "👁 Sometimes you see ghost players from other timelines.";
      default: return "";
    }
  };

  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
  };

  const fetchAllData = () => {
    fetch('/api/progress').then(res => res.json()).then(setProgress);
    fetch('/api/missions').then(res => res.json()).then(setMissions);
    fetch('/api/inventory').then(res => res.json()).then(setInventory);
    fetch('/api/timelines').then(res => res.json()).then(setTimelines);
    fetch('/api/global_event').then(res => res.json()).then(setGlobalEvent);
    fetch('/api/future_messages').then(res => res.json()).then(msgs => {
      if (msgs.length) setFutureMessages(prev => [...prev, ...msgs]);
    });
    fetch('/api/journal').then(res => res.json()).then(setJournalEntries);
    fetch('/api/friends').then(res => res.json()).then(setFriendsList);
    fetch('/api/story_chapters').then(res => res.json()).then(setStoryChapters);
    fetch('/api/combat_encounters').then(res => res.json()).then(setCombatEncounters);
    fetch('/api/crafting_recipes').then(res => res.json()).then(setCraftingRecipes);
  };

  const loadDailyChoices = () => {
    const choicesPool = [
      { id: 1, question: "A stranger asks for help. Do you...", options: ["Help them", "Ignore them"] },
      { id: 2, question: "You find a mysterious letter. Do you...", options: ["Read it", "Burn it"] },
      { id: 3, question: "A glitch in the timeline appears. Do you...", options: ["Investigate", "Walk away"] },
      { id: 4, question: "You receive an anonymous echo. Do you...", options: ["Trust it", "Delete it"] },
      { id: 5, question: "A crying child is lost. Do you...", options: ["Guide them home", "Leave them"] },
      { id: 6, question: "You discover a time crystal. Do you...", options: ["Keep it", "Shatter it"] },
      { id: 7, question: "An old friend reaches out. Do you...", options: ["Respond", "Ignore"] },
      { id: 8, question: "You see a future disaster. Do you...", options: ["Warn others", "Stay silent"] },
    ];
    const shuffled = [...choicesPool].sort(() => 0.5 - Math.random());
    setDailyChoices(shuffled.slice(0, 4).map(c => ({ ...c, selected: null })));
  };

  useEffect(() => {
    if (progress.level > 1) {
      fetch(`/api/lore/${progress.level}`).then(res => res.json()).then(data => {
        if (data.content) {
          setModalContent({ title: "📜 LORE DISCOVERED", text: data.content });
          sounds.reward();
        }
      });
    }
  }, [progress.level]);

  // Mini‑game trigger (30% chance after choices load – increase to test)
  useEffect(() => {
    if (dailyChoices.length && !miniGame && Math.random() < 0.3) {
      setMiniGame({
        question: "Decode the temporal cipher: 7731 8820 4401",
        hint: "Each number maps to a word: echo, branch, delta",
        answer: "echo",
        reward: { crystals: 10, fragments: 5 }
      });
    }
  }, [dailyChoices]);

  useEffect(() => {
    fetch('/api/messages').then(res => res.json()).then(setEchoes);
    fetchAllData();
    loadDailyChoices();

    const socket = io();
    socket.on('new_message', (data) => {
      setEchoes(prev => [
        { id: Date.now(), from: data.from, content: data.content, timestamp: new Date().toLocaleTimeString() },
        ...prev,
      ]);
      fetchAllData();
      sounds.echo();
      triggerFlash();
    });
    socket.on('timeline_collapse', (data) => {
      setModalContent({ title: "⚠ TIMELINE COLLAPSE", text: `${data.username}'s timeline has vanished!` });
      sounds.timelineShift();
      triggerFlash();
    });
    socket.on('global_event', (data) => {
      setModalContent({ title: "🌌 TIMELINE EVENT", text: data.message });
      sounds.timelineShift();
      triggerFlash();
      fetchAllData();
    });
    return () => socket.close();
  }, []);

  const updateMission = (missionId, increment, xpReward, crystalReward) => {
    fetch('/api/update_mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mission_id: missionId, increment, xp_reward: xpReward, crystal_reward: crystalReward })
    }).then(() => {
      fetchAllData();
      if (xpReward) {
        fetch('/api/add_xp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: xpReward }) })
          .then(res => res.json())
          .then(data => {
            if (data.leveled_up) {
              setModalContent({ title: "🎉 LEVEL UP!", text: `You are now level ${data.new_level}` });
              sounds.levelUp();
              triggerFlash();
            }
            fetchAllData();
          });
      }
    });
  };

  const submitChoice = (choiceId, option, question) => {
    const reward = Math.random() < 0.3 ? { crystals: Math.floor(Math.random() * 3) + 1, fragments: Math.floor(Math.random() * 2) } : null;
    fetch('/api/make_choice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot1: option, slot2: question, slot3: reward ? `+${reward.crystals} crystals, +${reward.fragments} fragments` : '' })
    }).then(() => {
      if (reward) {
        setModalContent({ title: "✨ BONUS REWARD", text: `You gained ${reward.crystals} crystals and ${reward.fragments} fragments!` });
        setProgress(prev => ({ ...prev, crystals: prev.crystals + reward.crystals, fragments: prev.fragments + reward.fragments }));
        sounds.reward();
      }
      setDailyChoices(prev => prev.map(c => c.id === choiceId ? { ...c, selected: option } : c));
      fetchAllData();
      fetch('/api/messages').then(res => res.json()).then(setEchoes);
      sounds.choice();
      triggerFlash();
    });
  };

  const sendEcho = () => {
    if (!echoMessage.trim()) return;
    fetch('/api/send_echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: echoMessage })
    }).then(() => {
      setEchoMessage('');
      setModalContent({ title: "Echo Sent", text: "Your message has been transmitted to another timeline." });
      updateMission(1, 1, 100, 5);
      fetchAllData();
      sounds.echo();
      triggerFlash();
    });
  };

  const contributeToEvent = () => {
    fetch('/api/contribute_event', { method: 'POST' }).then(() => fetch('/api/global_event').then(res => res.json()).then(setGlobalEvent));
    sounds.click();
  };

  const switchTimeline = (timelineName) => {
    fetch('/api/switch_timeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timeline: timelineName }) })
      .then(() => window.location.reload());
  };

  const fetchLeaderboard = () => {
    fetch('/api/leaderboard').then(res => res.json()).then(setLeaderboard);
    setShowLeaderboard(true);
    sounds.click();
  };

  const claimDailyReward = () => {
    fetch('/api/claim_daily', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setModalContent({ title: "Daily Reward", text: data.error });
        } else {
          setModalContent({ title: "Daily Reward", text: `You claimed ${data.crystals} crystals! Streak: ${data.streak} days.` });
          setDailyRewardClaimed(true);
          fetchAllData();
          sounds.reward();
        }
      });
  };

  const visitLocation = (location) => {
    fetch('/api/visit_location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location })
    }).then(res => res.json()).then(data => {
      setModalContent({ title: `📍 ${location}`, text: data.message });
      if (data.leveled_up) {
        sounds.levelUp();
        setTimeout(() => setModalContent({ title: "🎉 LEVEL UP!", text: `You are now level ${data.new_level}` }), 2000);
      } else {
        sounds.reward();
      }
      fetchAllData();
      fetch('/api/messages').then(res => res.json()).then(setEchoes);
      triggerFlash();
    });
  };

  const submitMiniGame = () => {
    if (miniGameAnswer.toLowerCase().trim() === miniGame.answer.toLowerCase()) {
      fetch('/api/add_item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'crystal', amount: miniGame.reward.crystals })
      });
      setModalContent({ title: "🔓 MINI-GAME SUCCESS", text: `You decoded the cipher! +${miniGame.reward.crystals} crystals, +${miniGame.reward.fragments} fragments.` });
      setProgress(prev => ({ ...prev, crystals: prev.crystals + miniGame.reward.crystals, fragments: prev.fragments + miniGame.reward.fragments }));
      sounds.reward();
    } else {
      setModalContent({ title: "❌ MINI-GAME FAILED", text: `Wrong answer. The correct was "${miniGame.answer}". Try again next time.` });
      sounds.error();
    }
    setMiniGame(null);
    setMiniGameAnswer('');
  };

  const completeChapter = (chapter) => {
    fetch('/api/complete_chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter: chapter.chapter })
    }).then(res => res.json()).then(data => {
      if (data.success) {
        setModalContent({ title: `📖 Chapter ${chapter.chapter} Completed!`, text: `You earned ${data.xp} XP and ${data.crystals} crystals!` });
        if (data.level_up) sounds.levelUp();
        else sounds.reward();
        fetchAllData();
      } else {
        setModalContent({ title: "Error", text: data.error || "Could not complete chapter." });
      }
    });
  };

  const startFight = (encounter) => {
    setSelectedEncounter(encounter);
    setCombatLog(null);
    fetch('/api/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounter_id: encounter.id })
    }).then(res => res.json()).then(data => {
      if (data.victory) {
        setModalContent({ title: `⚔️ Victory!`, text: `You defeated the ${encounter.enemy}! Gained ${data.xp} XP and ${data.crystals} crystals.` });
        if (data.level_up) sounds.levelUp();
        else sounds.reward();
        fetchAllData();
      } else {
        setModalContent({ title: `💀 Defeat`, text: data.message || "You lost. Try again later." });
        sounds.error();
      }
      setCombatLog(data.log);
      setSelectedEncounter(null);
    });
  };

  const craftItem = (recipe) => {
    fetch('/api/craft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipe.id })
    }).then(res => res.json()).then(data => {
      if (data.success) {
        setModalContent({ title: "🔨 Crafting Success", text: data.message });
        sounds.reward();
        fetchAllData();
      } else {
        setModalContent({ title: "Crafting Failed", text: data.error });
        sounds.error();
      }
    });
  };

  const closeModal = () => setModalContent(null);
  const xpPercent = (progress.xp % 100) / 100 * 100;

  const locations = [
    { name: "Central Plaza", status: "unlocked", description: "Hub of echoes." },
    { name: "Old Library", status: "unlocked", description: "Find hidden lore." },
    { name: "Sky Gardens", status: progress.level >= 5 ? "unlocked" : "locked", description: "Requires level 5." },
    { name: "Clock Tower", status: "unlocked", description: "Meet your future self." },
  ];

  const getChibiImage = () => {
    const nameMap = {
      'The Dreamer': 'dreamer', 'Dreamer': 'dreamer',
      'The Hacker': 'hacker', 'Hacker': 'hacker',
      'The Optimist': 'optimist', 'Optimist': 'optimist',
      'The Rebel': 'rebel', 'Rebel': 'rebel',
      'The Archivist': 'archivist', 'Archivist': 'archivist',
      'The Echo': 'echo', 'Echo': 'echo'
    };
    const imgName = nameMap[character.name] || 'dreamer';
    return `/assets/characters/${imgName}.png`;
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ background: '#080b1a' }}>
      {flash && <div className="fixed inset-0 bg-white/20 pointer-events-none z-50" />}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-purple-500/20 bg-black/50">
        <div className="flex items-center gap-3">
          <img src={getChibiImage()} alt={character.name} className="w-10 h-10 rounded-full object-cover border border-purple-500" />
          <div>
            <div className="text-sm font-orbitron">{user?.username || 'Player'}</div>
            <div className="text-xs text-purple-300">{character.name}</div>
            <div className="text-[10px] text-cyan-400 italic">{getClassFlavor()}</div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="bg-black/50 rounded-full px-2 py-1 text-xs">Lv.{progress.level}</div>
          <div className="w-24 h-1.5 bg-purple-900/50 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full" style={{ width: `${xpPercent}%` }}></div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="bg-black/50 px-2 py-1 rounded">💎 {progress.crystals}</span>
            <span className="bg-black/50 px-2 py-1 rounded">🔮 {progress.fragments}</span>
          </div>
          <button onClick={claimDailyReward} disabled={dailyRewardClaimed} className="text-xs bg-yellow-600/50 px-2 py-1 rounded hover:bg-yellow-600">Daily</button>
          {/* Test button to force mini-game */}
          <button onClick={() => setMiniGame({
            question: "Decode the temporal cipher: 7731 8820 4401",
            hint: "Each number maps to a word: echo, branch, delta",
            answer: "echo",
            reward: { crystals: 10, fragments: 5 }
          })} className="text-xs bg-purple-600/50 px-2 py-1 rounded">Test Mini-Game</button>
        </div>
      </div>

      {/* Timeline health & global event */}
      <div className="px-4 py-1 bg-black/30">
        <div className="flex justify-between text-[10px] text-purple-400"><span>Timeline Health</span><span>{progress.timeline_health}%</span></div>
        <div className="h-1.5 bg-purple-900/50 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-gradient-to-r from-green-400 to-red-500 rounded-full" style={{ width: `${progress.timeline_health}%` }}></div>
        </div>
        <div className="flex justify-between text-[10px] text-purple-400"><span>Global: {globalEvent.name}</span><span>{Math.round(globalEvent.progress * 100)}%</span></div>
        <div className="h-1 bg-purple-900/50 rounded-full overflow-hidden">
          <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${globalEvent.progress * 100}%` }}></div>
        </div>
        <button onClick={contributeToEvent} className="text-[10px] mt-1 bg-purple-600/30 px-2 py-0.5 rounded">Contribute</button>
      </div>

      {/* Timeline switcher */}
      <div className="flex gap-1 px-2 py-1 bg-black/30">
        {timelines.map(tl => (
          <button key={tl.name} onClick={() => switchTimeline(tl.name)} className={`text-xs px-2 py-0.5 rounded ${tl.active ? 'bg-cyan-600' : 'bg-purple-600/30'}`}>
            {tl.name}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-purple-500/20 px-4">
        {['story', 'combat', 'craft', 'echoes', 'missions', 'map', 'choices', 'send'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-2 text-xs font-orbitron tracking-wider transition whitespace-nowrap ${activeTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-purple-400'}`}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4">
        {/* Story Tab */}
        {activeTab === 'story' && (
          <div className="space-y-4">
            <h3 className="font-orbitron text-cyan-400 text-sm">📖 STORY CAMPAIGN</h3>
            {storyChapters.map(ch => (
              <div key={ch.chapter} className={`glass-panel p-4 card-appear ${ch.completed ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-orbitron text-white text-sm">Chapter {ch.chapter}: {ch.title}</h4>
                    <p className="text-xs text-purple-300 mt-1">{ch.description}</p>
                    <div className="flex gap-3 mt-2 text-[10px]">
                      <span className="bg-green-900/50 px-2 py-0.5 rounded">+{ch.reward_xp} XP</span>
                      <span className="bg-blue-900/50 px-2 py-0.5 rounded">+{ch.reward_crystals} 💎</span>
                    </div>
                    {!ch.unlocked && <p className="text-xs text-yellow-500 mt-2">🔒 Requires level {ch.required_level}</p>}
                  </div>
                  {ch.unlocked && !ch.completed && <button onClick={() => completeChapter(ch)} className="text-xs bg-cyan-600 px-3 py-1 rounded hover:bg-cyan-700">Start →</button>}
                  {ch.completed && <span className="text-xs text-green-400">✓ Completed</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Combat Tab */}
        {activeTab === 'combat' && (
          <div className="space-y-4">
            <h3 className="font-orbitron text-cyan-400 text-sm">⚔️ COMBAT ENCOUNTERS</h3>
            {combatEncounters.map(enc => (
              <div key={enc.id} className={`glass-panel p-4 card-appear ${!enc.unlocked ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-orbitron text-white text-sm">{enc.name}</h4>
                    <p className="text-xs text-purple-300">Enemy: {enc.enemy} | HP: {enc.hp} | Attack: {enc.attack}</p>
                    <div className="flex gap-3 mt-2 text-[10px]">
                      <span className="bg-red-900/50 px-2 py-0.5 rounded">+{enc.xp_reward} XP</span>
                      <span className="bg-blue-900/50 px-2 py-0.5 rounded">+{enc.crystal_reward} 💎</span>
                    </div>
                    {enc.on_cooldown && <p className="text-xs text-orange-400 mt-2">⏳ On cooldown (1 hour)</p>}
                    {!enc.unlocked && <p className="text-xs text-yellow-500 mt-2">🔒 Requires level {enc.required_level}</p>}
                  </div>
                  {enc.unlocked && !enc.on_cooldown && <button onClick={() => startFight(enc)} className="text-xs bg-red-600 px-3 py-1 rounded hover:bg-red-700">Fight →</button>}
                </div>
                {combatLog && selectedEncounter?.id === enc.id && (
                  <div className="mt-3 p-2 bg-black/50 rounded text-xs text-cyan-300 max-h-32 overflow-auto">
                    {combatLog.map((line, i) => <div key={i}>{line}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Crafting Tab */}
        {activeTab === 'craft' && (
          <div className="space-y-4">
            <h3 className="font-orbitron text-cyan-400 text-sm">🔨 CRAFTING</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {craftingRecipes.map(recipe => (
                <div key={recipe.id} className={`glass-panel p-4 card-appear ${!recipe.unlocked ? 'opacity-60' : ''}`}>
                  <h4 className="font-orbitron text-white text-sm">{recipe.name}</h4>
                  <p className="text-xs text-purple-300 mt-1">{recipe.description}</p>
                  <div className="flex gap-3 mt-2 text-[10px]">
                    <span className="bg-yellow-900/50 px-2 py-0.5 rounded">💎 {recipe.crystals_cost}</span>
                    <span className="bg-purple-900/50 px-2 py-0.5 rounded">🔮 {recipe.fragments_cost}</span>
                  </div>
                  {!recipe.unlocked && <p className="text-xs text-yellow-500 mt-2">🔒 Requires level {recipe.required_level}</p>}
                  {recipe.unlocked && <button onClick={() => craftItem(recipe)} className="mt-3 text-xs bg-green-600 px-3 py-1 rounded hover:bg-green-700">Craft</button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Echoes Tab */}
        {activeTab === 'echoes' && (
          <div className="space-y-3">
            {futureMessages.map((msg, idx) => (
              <div key={idx} className="glass-panel p-3 border-l-4 border-yellow-400">
                <div className="text-xs text-yellow-400">📨 Future Message {msg.is_fake && "(Fake)"}</div>
                <p className="text-sm">{msg.content}</p>
              </div>
            ))}
            {echoes.length === 0 ? (
              <div className="glass-panel p-8 text-center text-purple-400">No echoes yet. Make choices or visit locations.</div>
            ) : (
              echoes.map(echo => (
                <div key={echo.id} className="glass-panel p-4 card-appear">
                  <div className="text-xs text-cyan-400">{echo.from}</div>
                  <p className="mt-1 text-sm">{echo.content}</p>
                  <div className="text-xs text-purple-500 mt-2">{echo.timestamp}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Missions Tab */}
        {activeTab === 'missions' && (
          <div className="space-y-4">
            {missions.map(mission => (
              <div key={mission.id} className="glass-panel p-4 card-appear">
                <div className="flex justify-between items-start">
                  <h3 className="font-orbitron text-cyan-400 text-sm">{mission.title}</h3>
                  <span className="text-xs text-gold">+{mission.xp_reward} XP</span>
                </div>
                <p className="text-xs text-purple-300 mt-1">{mission.desc}</p>
                <div className="mt-3 h-1.5 bg-purple-900/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full" style={{ width: `${(mission.progress / mission.total) * 100}%` }}></div>
                </div>
                <div className="text-right text-xs text-purple-400 mt-1">{mission.progress}/{mission.total}</div>
                {mission.completed && <div className="text-xs text-green-400 mt-2">✓ Completed</div>}
              </div>
            ))}
          </div>
        )}

        {/* Map Tab */}
        {activeTab === 'map' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locations.map((loc, idx) => (
              <div key={idx} className={`glass-panel p-4 card-appear ${loc.status === 'locked' ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-center">
                  <h3 className="font-orbitron text-cyan-400 text-sm">{loc.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${loc.status === 'unlocked' ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>{loc.status.toUpperCase()}</span>
                </div>
                <p className="text-xs text-purple-300 mt-2">{loc.description}</p>
                {loc.status === 'unlocked' && <button onClick={() => visitLocation(loc.name)} className="mt-3 text-xs text-cyan-400 hover:text-white transition">Visit →</button>}
              </div>
            ))}
          </div>
        )}

        {/* Choices Tab */}
        {activeTab === 'choices' && (
          <div className="space-y-4 max-w-xl mx-auto">
            <h3 className="font-orbitron text-cyan-400 text-sm mb-2">⚡ TIMELINE CHOICES</h3>
            {dailyChoices.map(choice => (
              <div key={choice.id} className="glass-panel p-4 card-appear">
                <p className="text-sm text-white">{choice.question}</p>
                <div className="flex gap-3 mt-3 flex-wrap">
                  {choice.options.map(opt => (
                    <button key={opt} onClick={() => submitChoice(choice.id, opt, choice.question)} disabled={choice.selected !== null} className={`text-xs px-4 py-2 rounded-lg transition ${choice.selected === opt ? 'bg-cyan-600 text-white' : 'bg-purple-600/50 hover:bg-purple-600'}`}>{opt}</button>
                  ))}
                </div>
                {choice.selected && <p className="text-xs text-cyan-400 mt-3">✓ You chose: {choice.selected}</p>}
              </div>
            ))}
            {dailyChoices.length === 0 && <div className="text-center text-purple-400">No choices left today. Come back tomorrow.</div>}
          </div>
        )}

        {/* Send Tab */}
        {activeTab === 'send' && (
          <div className="glass-panel p-6 max-w-xl mx-auto">
            <h3 className="font-orbitron text-cyan-400 mb-2">📡 SEND ECHO TO THE PAST</h3>
            <textarea rows={4} value={echoMessage} onChange={(e) => setEchoMessage(e.target.value)} className="w-full bg-black/50 border border-purple-500/30 rounded-lg p-3 text-white" placeholder="Type your message..." />
            <button onClick={sendEcho} className="mt-3 w-full bg-gradient-to-r from-purple-600 to-cyan-500 py-2 rounded-lg font-bold tracking-wider glow-pulse">TRANSMIT ECHO</button>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="flex justify-around p-2 border-t border-purple-500/20 bg-black/50">
        <button onClick={() => { const invText = inventory.map(i => `${i.type}: ${i.quantity}`).join(', ') || 'Empty'; setModalContent({ title: "INVENTORY", text: invText }); sounds.click(); }} className="text-xs font-orbitron tracking-wider text-purple-400 hover:text-white transition">INVENTORY</button>
        <button onClick={() => { if (journalEntries.length === 0) setModalContent({ title: "JOURNAL", text: "Your journal is empty." }); else { const entriesText = journalEntries.slice(0, 10).map(e => `${e.type.toUpperCase()}: ${e.content}`).join('\n'); setModalContent({ title: "JOURNAL", text: entriesText }); } sounds.click(); }} className="text-xs font-orbitron tracking-wider text-purple-400 hover:text-white transition">JOURNAL</button>
        <button onClick={() => { if (friendsList.length === 0) setModalContent({ title: "FRIENDS", text: "No friends yet." }); else { const friendsText = friendsList.map(f => `${f.username} (${f.class})`).join('\n'); setModalContent({ title: "FRIENDS", text: friendsText }); } sounds.click(); }} className="text-xs font-orbitron tracking-wider text-purple-400 hover:text-white transition">FRIENDS</button>
        <button onClick={() => { const activeMissions = missions.filter(m => !m.completed); if (activeMissions.length === 0) setModalContent({ title: "QUESTS", text: "All missions completed!" }); else { const questsText = activeMissions.map(m => `${m.title}: ${m.progress}/${m.total}`).join('\n'); setModalContent({ title: "QUESTS", text: questsText }); } sounds.click(); }} className="text-xs font-orbitron tracking-wider text-purple-400 hover:text-white transition">QUESTS</button>
        <button onClick={fetchLeaderboard} className="text-xs font-orbitron tracking-wider text-purple-400 hover:text-white transition">RANKING</button>
      </div>

      {/* Mini-game modal */}
      {miniGame && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="glass-panel p-6 max-w-md w-full mx-4">
            <h3 className="font-orbitron text-cyan-400 mb-2">🔐 TEMPORAL CIPHER</h3>
            <p className="text-sm text-purple-200 mb-2">{miniGame.question}</p>
            <p className="text-xs text-purple-400 mb-4">{miniGame.hint}</p>
            <input type="text" value={miniGameAnswer} onChange={(e) => setMiniGameAnswer(e.target.value)} className="w-full bg-black/50 border border-purple-500/30 rounded p-2 text-white mb-4" placeholder="Your answer..." />
            <div className="flex gap-3">
              <button onClick={submitMiniGame} className="flex-1 bg-purple-600 py-2 rounded">Submit</button>
              <button onClick={() => setMiniGame(null)} className="flex-1 bg-gray-700 py-2 rounded">Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* Standard modal */}
      {modalContent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="glass-panel p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-orbitron text-cyan-400 mb-2">{modalContent.title}</h3>
            <pre className="text-sm text-purple-200 whitespace-pre-wrap font-sans">{modalContent.text}</pre>
            <button onClick={closeModal} className="mt-4 text-xs text-purple-400 hover:text-white">CLOSE</button>
          </div>
        </div>
      )}

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowLeaderboard(false)}>
          <div className="glass-panel p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-orbitron text-cyan-400 mb-2">🏆 LEADERBOARD</h3>
            <div className="space-y-2 max-h-96 overflow-auto">
              {leaderboard.map((p, i) => (
                <div key={i} className="flex justify-between border-b border-purple-500/20 py-1"><span>{i+1}. {p.username}</span><span>Lv.{p.level} ({p.xp} XP)</span></div>
              ))}
            </div>
            <button onClick={() => setShowLeaderboard(false)} className="mt-4 text-xs text-purple-400 hover:text-white">CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}