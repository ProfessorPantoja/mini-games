export class AudioBus {
  constructor() {
    this.ctx = null; this.master = null; this.enabled = true; this._unlocked = false;
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
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  stretch() { this._tone({ type: "sine", freq: 140, dur: 0.08, peak: 0.05, slide: 60 }); }
  launch() { this._tone({ type: "triangle", freq: 200, dur: 0.2, peak: 0.18, slide: 220 }); }
  bounce() { this._tone({ type: "sine", freq: 280, dur: 0.07, peak: 0.08, slide: -40 }); }
  orb() { this._tone({ type: "sine", freq: 740, dur: 0.14, peak: 0.14, slide: 320 }); }
  win() { [523, 659, 784].forEach((f, i) => setTimeout(() => this._tone({ type: "sine", freq: f, dur: 0.16, peak: 0.13 }), i * 90)); }
  fail() { this._tone({ type: "sawtooth", freq: 160, dur: 0.3, peak: 0.1, slide: -90 }); }
  click() { this._tone({ type: "sine", freq: 560, dur: 0.05, peak: 0.07 }); }
}
export const audio = new AudioBus();
