/** Web Audio API — sons sintéticos para Combinação */

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.28;
  master.connect(ctx.destination);
  return ctx;
}

export function resumeAudio() {
  const c = ensure();
  if (c && c.state === "suspended") c.resume();
}

export function setMuted(v) {
  muted = !!v;
}

function tone(freq, type, start, dur, gain = 0.2, slideTo = null) {
  if (muted) return;
  const c = ensure();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + dur);
  }
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noiseBurst(start, dur, gain = 0.12) {
  if (muted) return;
  const c = ensure();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1200;
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(start);
  src.stop(start + dur + 0.02);
}

export const sfx = {
  ui() {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    tone(520, "sine", t, 0.06, 0.08);
    tone(720, "sine", t + 0.04, 0.08, 0.06);
  },
  select() {
    const c = ensure();
    if (!c) return;
    tone(440, "triangle", c.currentTime, 0.07, 0.1);
  },
  swap() {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    tone(280, "sine", t, 0.08, 0.1, 360);
    tone(360, "sine", t + 0.05, 0.08, 0.08, 280);
  },
  invalid() {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    tone(180, "sawtooth", t, 0.12, 0.07, 90);
    noiseBurst(t, 0.08, 0.05);
  },
  match(combo = 1) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const base = 380 + Math.min(combo, 8) * 40;
    tone(base, "sine", t, 0.1, 0.12);
    tone(base * 1.5, "triangle", t + 0.03, 0.12, 0.08);
    noiseBurst(t, 0.06, 0.06);
  },
  cascade(depth = 1) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const f = 500 + depth * 60;
    tone(f, "sine", t, 0.09, 0.1);
    tone(f * 1.25, "triangle", t + 0.04, 0.1, 0.07);
  },
  special() {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    tone(300, "square", t, 0.08, 0.06);
    tone(450, "square", t + 0.06, 0.08, 0.05);
    tone(600, "sine", t + 0.12, 0.14, 0.09);
  },
  levelClear() {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      tone(f, "sine", t + i * 0.09, 0.22, 0.11);
    });
  },
  gameOver() {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    tone(320, "triangle", t, 0.2, 0.1, 180);
    tone(240, "sine", t + 0.15, 0.28, 0.09, 120);
  },
  shuffle() {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 5; i++) {
      tone(200 + i * 80, "triangle", t + i * 0.05, 0.07, 0.06);
    }
  },
};
