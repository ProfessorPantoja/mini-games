/**
 * Estoura — pure Web Audio (no external samples)
 */

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.35;
}

function tone(freq, type, dur, gain = 0.2, when = 0, slideTo = null) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, gain = 0.12, when = 0, hp = 800) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  aimTick() {
    tone(880 + Math.random() * 40, 'sine', 0.03, 0.04);
  },

  shoot() {
    tone(220, 'triangle', 0.08, 0.15, 0, 480);
    noiseBurst(0.05, 0.06, 0, 1200);
  },

  stick() {
    tone(180, 'sine', 0.06, 0.1);
    tone(360, 'triangle', 0.05, 0.06, 0.02);
  },

  pop(index = 0) {
    const base = 420 + index * 55;
    tone(base, 'sine', 0.1, 0.12, index * 0.018, base * 1.8);
    noiseBurst(0.06, 0.08, index * 0.018, 600);
  },

  cascade() {
    tone(160, 'sawtooth', 0.18, 0.07, 0, 80);
    noiseBurst(0.15, 0.05, 0.02, 300);
  },

  combo(level = 1) {
    const f = 520 + level * 80;
    tone(f, 'square', 0.12, 0.08, 0, f * 1.4);
    tone(f * 1.25, 'sine', 0.14, 0.06, 0.04);
  },

  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, 'sine', 0.22, 0.12, i * 0.1));
  },

  lose() {
    tone(300, 'sawtooth', 0.35, 0.1, 0, 90);
    tone(200, 'triangle', 0.4, 0.08, 0.08, 70);
  },

  levelClear() {
    [392, 494, 587, 784].forEach((f, i) => tone(f, 'triangle', 0.18, 0.1, i * 0.09));
  },

  ui() {
    tone(640, 'sine', 0.05, 0.06);
  },

  invalid() {
    tone(140, 'square', 0.08, 0.06);
  },
};
