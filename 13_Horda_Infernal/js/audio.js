/** Web Audio sintético — combate, loot, UI */

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._unlocked = false;
    this._ambience = null;
  }

  unlock() {
    if (this._unlocked) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);
    this._unlocked = true;
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  _t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  _tone({ type = "sine", freq = 440, dur = 0.12, peak = 0.14, slide = 0, delay = 0 }) {
    if (!this._unlocked || !this.enabled) return;
    const t = this._t() + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) {
      o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  _noise(dur = 0.1, peak = 0.1, filterFreq = 900, type = "lowpass") {
    if (!this._unlocked || !this.enabled) return;
    const t = this._t();
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  startAmbience() {
    if (!this._unlocked || !this.enabled || this._ambience) return;
    const t = this._t();
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = "sawtooth";
    o2.type = "triangle";
    o.frequency.value = 42;
    o2.frequency.value = 55;
    f.type = "lowpass";
    f.frequency.value = 180;
    g.gain.value = 0.018;
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start(t);
    o2.start(t);
    this._ambience = { o, o2, g, f };
  }

  stopAmbience() {
    if (!this._ambience) return;
    try {
      this._ambience.o.stop();
      this._ambience.o2.stop();
    } catch (_) { /* already stopped */ }
    this._ambience = null;
  }

  swing() {
    this._noise(0.08, 0.1, 2200, "highpass");
    this._tone({ type: "sawtooth", freq: 200, dur: 0.07, peak: 0.07, slide: -100 });
    this._tone({ type: "sine", freq: 90, dur: 0.06, peak: 0.04 });
  }

  hit() {
    this._noise(0.06, 0.15, 700);
    this._tone({ type: "square", freq: 95, dur: 0.09, peak: 0.13, slide: -45 });
    this._tone({ type: "triangle", freq: 180, dur: 0.05, peak: 0.05 });
  }

  crit() {
    this._noise(0.11, 0.18, 1000);
    this._tone({ type: "square", freq: 150, dur: 0.12, peak: 0.15, slide: -70 });
    this._tone({ type: "sine", freq: 540, dur: 0.1, peak: 0.09, delay: 0.02 });
    this._tone({ type: "sine", freq: 820, dur: 0.08, peak: 0.06, delay: 0.05 });
  }

  kill() {
    this._noise(0.15, 0.14, 420);
    this._tone({ type: "sawtooth", freq: 130, dur: 0.16, peak: 0.11, slide: -95 });
    this._tone({ type: "triangle", freq: 70, dur: 0.12, peak: 0.06 });
  }

  multiKill(n = 2) {
    const base = 320 + Math.min(n, 8) * 40;
    this._tone({ type: "triangle", freq: base, dur: 0.1, peak: 0.1 });
    this._tone({ type: "triangle", freq: base * 1.25, dur: 0.12, peak: 0.09, delay: 0.05 });
    if (n >= 5) {
      this._tone({ type: "sawtooth", freq: 90, dur: 0.2, peak: 0.1, delay: 0.08 });
    }
  }

  furyActivate() {
    this._noise(0.25, 0.16, 300);
    this._tone({ type: "sawtooth", freq: 70, dur: 0.35, peak: 0.14, slide: 50 });
    this._tone({ type: "triangle", freq: 180, dur: 0.25, peak: 0.1, delay: 0.05 });
    this._tone({ type: "sine", freq: 360, dur: 0.2, peak: 0.08, delay: 0.12 });
  }

  furyHit() {
    this._noise(0.08, 0.12, 800);
    this._tone({ type: "square", freq: 110, dur: 0.08, peak: 0.1, slide: -30 });
  }

  playerHurt() {
    this._noise(0.18, 0.16, 350);
    this._tone({ type: "sawtooth", freq: 200, dur: 0.2, peak: 0.14, slide: -140 });
  }

  dash() {
    this._noise(0.12, 0.1, 2200, "highpass");
    this._tone({ type: "sine", freq: 280, dur: 0.12, peak: 0.08, slide: -160 });
  }

  pickup() {
    this._tone({ type: "sine", freq: 520, dur: 0.08, peak: 0.1 });
    this._tone({ type: "sine", freq: 780, dur: 0.1, peak: 0.08, delay: 0.05 });
  }

  equip() {
    this._tone({ type: "triangle", freq: 300, dur: 0.1, peak: 0.1 });
    this._tone({ type: "triangle", freq: 450, dur: 0.12, peak: 0.09, delay: 0.06 });
    this._tone({ type: "sine", freq: 600, dur: 0.14, peak: 0.07, delay: 0.12 });
  }

  levelUp() {
    [400, 500, 650, 800].forEach((f, i) => {
      this._tone({ type: "triangle", freq: f, dur: 0.18, peak: 0.1, delay: i * 0.07 });
    });
  }

  waveStart() {
    this._tone({ type: "sawtooth", freq: 80, dur: 0.25, peak: 0.1, slide: 40 });
    this._tone({ type: "sine", freq: 160, dur: 0.3, peak: 0.08, delay: 0.05 });
  }

  bossAppear() {
    this._noise(0.4, 0.18, 200);
    this._tone({ type: "sawtooth", freq: 55, dur: 0.5, peak: 0.16, slide: -20 });
    this._tone({ type: "square", freq: 70, dur: 0.35, peak: 0.1, delay: 0.1 });
  }

  portal() {
    this._tone({ type: "sine", freq: 200, dur: 0.4, peak: 0.08, slide: 200 });
    this._tone({ type: "triangle", freq: 300, dur: 0.35, peak: 0.07, delay: 0.05, slide: 180 });
  }

  victory() {
    [330, 415, 523, 659].forEach((f, i) => {
      this._tone({ type: "triangle", freq: f, dur: 0.35, peak: 0.11, delay: i * 0.1 });
    });
  }

  defeat() {
    this._tone({ type: "sawtooth", freq: 180, dur: 0.4, peak: 0.12, slide: -120 });
    this._tone({ type: "sine", freq: 90, dur: 0.55, peak: 0.1, delay: 0.08, slide: -40 });
  }

  uiClick() {
    this._tone({ type: "sine", freq: 440, dur: 0.05, peak: 0.06 });
  }

  bossHit() {
    this._noise(0.12, 0.18, 280);
    this._tone({ type: "square", freq: 60, dur: 0.18, peak: 0.14, slide: -20 });
  }
}
