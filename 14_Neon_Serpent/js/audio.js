/** Web Audio sintético — Neon Serpent */
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
    this.master.gain.value = 0.26;
    this.master.connect(this.ctx.destination);
    this._unlocked = true;
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  _t() { return this.ctx ? this.ctx.currentTime : 0; }

  _tone({ type = "sine", freq = 440, dur = 0.12, peak = 0.14, slide = 0 }) {
    if (!this._unlocked || !this.enabled) return;
    const t = this._t();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur = 0.1, peak = 0.1, filterFreq = 800) {
    if (!this._unlocked || !this.enabled) return;
    const t = this._t();
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  click() { this._tone({ type: "sine", freq: 620, dur: 0.05, peak: 0.07 }); }
  eat() { this._tone({ type: "sine", freq: 520, dur: 0.07, peak: 0.12, slide: 360 }); }
  power() { this._tone({ type: "triangle", freq: 380, dur: 0.16, peak: 0.12, slide: 420 }); }
  level() {
    [440, 554, 659].forEach((f, i) => {
      setTimeout(() => this._tone({ type: "sine", freq: f, dur: 0.12, peak: 0.1 }), i * 70);
    });
  }
  boss() {
    this._noise(0.2, 0.12, 500);
    this._tone({ type: "sawtooth", freq: 90, dur: 0.35, peak: 0.12, slide: 40 });
  }
  hit() { this._tone({ type: "square", freq: 180, dur: 0.12, peak: 0.1, slide: -60 }); this._noise(0.1, 0.08, 900); }
  die() {
    this._noise(0.28, 0.16, 420);
    [300, 220, 160, 110].forEach((f, i) => {
      setTimeout(() => this._tone({ type: "sine", freq: f, dur: 0.2, peak: 0.1 }), i * 90);
    });
  }
  win() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this._tone({ type: "sine", freq: f, dur: 0.16, peak: 0.1 }), i * 90);
    });
  }
  turn() { this._tone({ type: "sine", freq: 280, dur: 0.03, peak: 0.03 }); }
}

export const audio = new AudioBus();
