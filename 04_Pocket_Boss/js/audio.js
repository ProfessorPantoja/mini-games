/**
 * SFX procedurais via Web Audio API — sem assets externos.
 */

let ctx = null;
let master = null;
let enabled = true;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === "suspended") c.resume();
}

export function setMuted(m) {
  enabled = !m;
  if (master) master.gain.value = m ? 0 : 0.22;
}

function tone({
  freq = 440,
  type = "square",
  dur = 0.08,
  gain = 0.3,
  slide = 0,
  delay = 0,
  filterFreq = 0,
}) {
  if (!enabled) return;
  const c = ensure();
  if (!c) return;

  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq + slide),
      t0 + dur
    );
  }

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  if (filterFreq) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    osc.connect(f);
    f.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.1, gain = 0.2, filterFreq = 1200, delay = 0 }) {
  if (!enabled) return;
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = filterFreq;
  f.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  ui() {
    tone({ freq: 660, type: "sine", dur: 0.05, gain: 0.12 });
  },
  attack() {
    tone({ freq: 220, type: "sawtooth", dur: 0.07, gain: 0.18, slide: 180, filterFreq: 1800 });
    noise({ dur: 0.05, gain: 0.08, filterFreq: 2000 });
  },
  dodge() {
    tone({ freq: 520, type: "sine", dur: 0.06, gain: 0.1, slide: 200 });
  },
  parry() {
    tone({ freq: 880, type: "square", dur: 0.05, gain: 0.14 });
    tone({ freq: 1320, type: "sine", dur: 0.12, gain: 0.12, delay: 0.02 });
    noise({ dur: 0.08, gain: 0.1, filterFreq: 3000 });
  },
  perfect() {
    tone({ freq: 988, type: "sine", dur: 0.08, gain: 0.16 });
    tone({ freq: 1318, type: "sine", dur: 0.14, gain: 0.12, delay: 0.05 });
    tone({ freq: 1760, type: "triangle", dur: 0.18, gain: 0.08, delay: 0.1 });
  },
  hit() {
    noise({ dur: 0.12, gain: 0.22, filterFreq: 400 });
    tone({ freq: 90, type: "sawtooth", dur: 0.15, gain: 0.2, slide: -40, filterFreq: 600 });
  },
  hurt() {
    tone({ freq: 180, type: "sawtooth", dur: 0.18, gain: 0.18, slide: -100, filterFreq: 800 });
    noise({ dur: 0.15, gain: 0.15, filterFreq: 600 });
  },
  miss() {
    tone({ freq: 160, type: "triangle", dur: 0.1, gain: 0.08, slide: -60 });
  },
  telegraph() {
    tone({ freq: 240, type: "sine", dur: 0.06, gain: 0.06 });
  },
  phase() {
    tone({ freq: 220, type: "square", dur: 0.1, gain: 0.12 });
    tone({ freq: 330, type: "square", dur: 0.12, gain: 0.1, delay: 0.08 });
    tone({ freq: 440, type: "square", dur: 0.16, gain: 0.1, delay: 0.16 });
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => {
      tone({ freq: f, type: "sine", dur: 0.2, gain: 0.12, delay: i * 0.09 });
    });
  },
  lose() {
    tone({ freq: 300, type: "sawtooth", dur: 0.25, gain: 0.14, slide: -180, filterFreq: 900 });
    tone({ freq: 180, type: "triangle", dur: 0.4, gain: 0.1, delay: 0.12, slide: -80 });
  },
  combo(n) {
    const f = 400 + Math.min(n, 20) * 30;
    tone({ freq: f, type: "sine", dur: 0.05, gain: 0.08 });
  },
};
