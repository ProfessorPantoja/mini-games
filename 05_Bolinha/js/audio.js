/**
 * Bolinha — synthesized audio (Web Audio API)
 * No external assets. Soft, game-feel oriented.
 */

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._unlocked = false;
  }

  unlock() {
    if (this._unlocked) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.28;
    this.master.connect(this.ctx.destination);
    this._unlocked = true;
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.28 : 0;
  }

  _t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  _env(gain, a, d, s, r, peak = 1) {
    const t = this._t();
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  }

  _tone({ type = "sine", freq = 440, dur = 0.15, peak = 0.2, a = 0.005, d = 0.04, s = 0.4, r = 0.1, slide = 0, detune = 0, filterFreq = 0, q = 1 }) {
    if (!this._unlocked || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    if (detune) osc.detune.setValueAtTime(detune, t);

    let node = osc;
    if (filterFreq > 0) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(filterFreq, t);
      f.Q.value = q;
      osc.connect(f);
      node = f;
    }

    node.connect(gain);
    gain.connect(this.master);
    this._env(gain, a, d, s, r, peak);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _noise({ dur = 0.08, peak = 0.12, filterFreq = 1800, type = "bandpass", q = 0.8 }) {
    if (!this._unlocked || !this.enabled) return;
    const t = this._t();
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  paddle() {
    this._tone({ type: "triangle", freq: 220, dur: 0.09, peak: 0.14, a: 0.002, d: 0.03, s: 0.3, r: 0.05, filterFreq: 1400 });
    this._noise({ dur: 0.04, peak: 0.05, filterFreq: 900, type: "highpass" });
  }

  wall() {
    this._tone({ type: "sine", freq: 180, dur: 0.06, peak: 0.08, a: 0.001, d: 0.02, s: 0.2, r: 0.04, slide: -40 });
  }

  brick(hp = 1) {
    const base = 420 + hp * 80;
    this._tone({ type: "sine", freq: base, dur: 0.12, peak: 0.16, a: 0.002, d: 0.04, s: 0.25, r: 0.08, slide: 120 });
    this._tone({ type: "triangle", freq: base * 1.5, dur: 0.1, peak: 0.06, a: 0.001, d: 0.03, s: 0.2, r: 0.06 });
    this._noise({ dur: 0.06, peak: 0.07, filterFreq: 2400, type: "bandpass", q: 1.2 });
  }

  explode() {
    this._noise({ dur: 0.18, peak: 0.16, filterFreq: 600, type: "lowpass", q: 0.5 });
    this._tone({ type: "sawtooth", freq: 120, dur: 0.2, peak: 0.1, a: 0.002, d: 0.06, s: 0.3, r: 0.12, slide: -80, filterFreq: 800 });
  }

  powerup() {
    this._tone({ type: "sine", freq: 520, dur: 0.08, peak: 0.12, a: 0.005, d: 0.03, s: 0.5, r: 0.04 });
    this._tone({ type: "sine", freq: 780, dur: 0.1, peak: 0.1, a: 0.01, d: 0.04, s: 0.4, r: 0.06, detune: 5 });
    this._tone({ type: "triangle", freq: 1040, dur: 0.14, peak: 0.08, a: 0.02, d: 0.05, s: 0.3, r: 0.08 });
  }

  launch() {
    this._tone({ type: "sine", freq: 260, dur: 0.12, peak: 0.12, a: 0.004, d: 0.04, s: 0.3, r: 0.06, slide: 200 });
  }

  lifeLost() {
    this._tone({ type: "sine", freq: 280, dur: 0.22, peak: 0.14, a: 0.01, d: 0.08, s: 0.4, r: 0.12, slide: -160 });
    this._tone({ type: "triangle", freq: 180, dur: 0.28, peak: 0.08, a: 0.02, d: 0.1, s: 0.3, r: 0.14, slide: -100 });
  }

  gameOver() {
    [320, 280, 240, 180].forEach((f, i) => {
      setTimeout(() => {
        this._tone({ type: "sine", freq: f, dur: 0.28, peak: 0.12, a: 0.01, d: 0.1, s: 0.4, r: 0.15 });
      }, i * 120);
    });
  }

  levelClear() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => {
        this._tone({ type: "sine", freq: f, dur: 0.18, peak: 0.11, a: 0.008, d: 0.05, s: 0.4, r: 0.1 });
        this._tone({ type: "triangle", freq: f * 2, dur: 0.14, peak: 0.04, a: 0.01, d: 0.04, s: 0.3, r: 0.08 });
      }, i * 90);
    });
  }

  combo(n) {
    const f = 500 + Math.min(n, 12) * 40;
    this._tone({ type: "sine", freq: f, dur: 0.08, peak: 0.08, a: 0.002, d: 0.03, s: 0.3, r: 0.05 });
  }

  win() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => {
      setTimeout(() => {
        this._tone({ type: "sine", freq: f, dur: 0.2, peak: 0.12, a: 0.01, d: 0.06, s: 0.45, r: 0.1 });
      }, i * 100);
    });
  }

  ui() {
    this._tone({ type: "sine", freq: 640, dur: 0.05, peak: 0.06, a: 0.002, d: 0.02, s: 0.2, r: 0.03 });
  }
}

export const audio = new AudioBus();
