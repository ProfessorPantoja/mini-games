/** Web Audio sintético — motor, crash, pickups */
export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._unlocked = false;
    this._engine = null;
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

  _t() { return this.ctx ? this.ctx.currentTime : 0; }

  _tone({ type = "sine", freq = 440, dur = 0.12, peak = 0.16, slide = 0 }) {
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

  startEngine() {
    if (!this._unlocked || !this.enabled || this._engine) return;
    const t = this._t();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.value = 55;
    g.gain.value = 0.03;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 400;
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t);
    this._engine = { o, g, f };
  }

  setEngineSpeed(norm) {
    if (!this._engine) return;
    const t = this._t();
    const f = 50 + norm * 90;
    this._engine.o.frequency.setTargetAtTime(f, t, 0.05);
    this._engine.g.gain.setTargetAtTime(0.02 + norm * 0.04, t, 0.05);
    this._engine.f.frequency.setTargetAtTime(300 + norm * 900, t, 0.08);
  }

  stopEngine() {
    if (!this._engine) return;
    try {
      this._engine.o.stop();
    } catch (_) {}
    this._engine = null;
  }

  whoosh() { this._noise(0.08, 0.07, 1800); this._tone({ type: "sine", freq: 400, dur: 0.08, peak: 0.06, slide: 200 }); }
  nearMiss() { this._tone({ type: "triangle", freq: 880, dur: 0.1, peak: 0.1, slide: 300 }); }
  coin() { this._tone({ type: "sine", freq: 880, dur: 0.08, peak: 0.12, slide: 400 }); }
  nitro() { this._tone({ type: "sawtooth", freq: 180, dur: 0.2, peak: 0.1, slide: 280 }); this._noise(0.15, 0.08, 1200); }
  shield() { this._tone({ type: "sine", freq: 520, dur: 0.15, peak: 0.12, slide: 200 }); }
  crash() { this._noise(0.25, 0.18, 400); this._tone({ type: "sawtooth", freq: 120, dur: 0.3, peak: 0.12, slide: -80 }); }
  life() { this._tone({ type: "sine", freq: 300, dur: 0.2, peak: 0.12, slide: -120 }); }
  click() { this._tone({ type: "sine", freq: 600, dur: 0.05, peak: 0.07 }); }
  gameOver() {
    [280, 220, 180, 140].forEach((f, i) => {
      setTimeout(() => this._tone({ type: "sine", freq: f, dur: 0.25, peak: 0.1 }), i * 110);
    });
  }
}

export const audio = new AudioBus();
