// Simple sound effects using Web Audio API
let audioCtx = null;
let enabled = true;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(frequency, duration, type = 'sine', volume = 0.2) {
  if (!enabled) return;
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.frequency.value = frequency;
  oscillator.type = type;
  gain.gain.value = volume;
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
  oscillator.stop(ctx.currentTime + duration);
}

export const sounds = {
  enable: () => { enabled = true; },
  disable: () => { enabled = false; },
  choice: () => playTone(523.25, 0.25, 'sine', 0.15),
  echo: () => playTone(440, 0.6, 'sine', 0.2),
  levelUp: () => {
    playTone(523.25, 0.2);
    setTimeout(() => playTone(659.25, 0.3), 150);
    setTimeout(() => playTone(783.99, 0.5), 350);
  },
  timelineShift: () => playTone(196, 1.2, 'sawtooth', 0.25),
  reward: () => {
    playTone(659.25, 0.15);
    setTimeout(() => playTone(783.99, 0.2), 100);
  },
  error: () => playTone(110, 0.5, 'square', 0.2),
  click: () => playTone(880, 0.1, 'sine', 0.05),
};