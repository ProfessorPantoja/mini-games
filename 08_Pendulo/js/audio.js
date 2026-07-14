/** Web Audio — sintético, sem assets externos */
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
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
    this._unlocked = true;
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  _t() { return this.ctx ? this.ctx.currentTime : 0; }

  _tone({ type = "sine", freq = 440, dur = 0.12, peak = 0.18, slide = 0 }) {
    if (!this._unlocked || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _noise(dur = 0.08, peak = 0.1, filterFreq = 1200) {
    if (!this._unlocked || !this.enabled) return;
    const t = this._t();
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  swing() { this._tone({ type: "sine", freq: 180, dur: 0.06, peak: 0.04, slide: 40 }); }
  release() { this._tone({ type: "triangle", freq: 320, dur: 0.18, peak: 0.2, slide: 180 }); this._noise(0.06, 0.08, 900); }
  star() { this._tone({ type: "sine", freq: 880, dur: 0.12, peak: 0.14, slide: 400 }); }
  land() { this._tone({ type: "square", freq: 220, dur: 0.1, peak: 0.1, slide: -80 }); this._noise(0.1, 0.12, 400); }
  win() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this._tone({ type: "sine", freq: f, dur: 0.18, peak: 0.14 }), i * 90);
    });
  }
  fail() { this._tone({ type: "sawtooth", freq: 180, dur: 0.35, peak: 0.12, slide: -120 }); }
  click() { this._tone({ type: "sine", freq: 600, dur: 0.05, peak: 0.08 }); }
}

export const audio = new AudioBus();
