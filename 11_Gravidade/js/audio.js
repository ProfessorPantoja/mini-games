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
  _tone({ type = "sine", freq = 440, dur = 0.1, peak = 0.14, slide = 0 }) {
    if (!this._unlocked || !this.enabled) return;
    const t = this._t();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  paint() { this._tone({ type: "sine", freq: 380 + Math.random() * 80, dur: 0.04, peak: 0.04 }); }
  launch() { this._tone({ type: "triangle", freq: 240, dur: 0.2, peak: 0.16, slide: 280 }); }
  goal() { [660, 880, 1100].forEach((f, i) => setTimeout(() => this._tone({ type: "sine", freq: f, dur: 0.14, peak: 0.12 }), i * 80)); }
  crash() { this._tone({ type: "sawtooth", freq: 140, dur: 0.25, peak: 0.1, slide: -80 }); }
  click() { this._tone({ type: "sine", freq: 560, dur: 0.05, peak: 0.07 }); }
}
export const audio = new AudioBus();
