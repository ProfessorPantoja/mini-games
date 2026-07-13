/**
 * Áudio procedural via Web Audio API (sem arquivos externos).
 * Precisa de resume() após gesto do usuário (clique em Jogar).
 */

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._last = Object.create(null); // throttle por nome
  }

  /** Chamar no clique de Jogar (política de autoplay dos browsers). */
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  play(name, opts = {}) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const throttle = opts.throttle ?? 0.04;
    if (throttle > 0 && this._last[name] != null && now - this._last[name] < throttle) {
      return;
    }
    this._last[name] = now;

    switch (name) {
      case "hit":
        this._blip(420 + Math.random() * 80, 0.04, "square", 0.09);
        break;
      case "hit_heavy":
        this._blip(180, 0.08, "sawtooth", 0.14);
        this._noise(0.05, 0.1);
        break;
      case "kill":
        this._blip(520, 0.05, "square", 0.1);
        this._blip(780, 0.08, "triangle", 0.08, 0.04);
        break;
      case "kill_big":
        this._sweep(200, 80, 0.25, "sawtooth", 0.16);
        this._noise(0.12, 0.18);
        break;
      case "hurt":
        this._blip(140, 0.12, "sawtooth", 0.18);
        this._blip(90, 0.18, "square", 0.12, 0.05);
        break;
      case "gem":
        this._blip(880 + Math.random() * 120, 0.05, "sine", 0.06);
        break;
      case "levelup":
        this._arpeggio([523, 659, 784, 1046], 0.09, 0.12);
        break;
      case "card":
        this._blip(660, 0.06, "triangle", 0.1);
        this._blip(990, 0.1, "sine", 0.08, 0.05);
        break;
      case "ambush":
        this._sweep(120, 40, 0.35, "sawtooth", 0.2);
        this._noise(0.2, 0.22);
        this._blip(60, 0.25, "square", 0.15, 0.08);
        break;
      case "boss":
        this._sweep(90, 45, 0.5, "sawtooth", 0.22);
        this._blip(55, 0.4, "square", 0.18, 0.1);
        this._noise(0.25, 0.2);
        break;
      case "boss_unlock":
        this._arpeggio([196, 247, 294, 392], 0.12, 0.14);
        this._noise(0.15, 0.12);
        break;
      case "pulse":
        this._sweep(200, 60, 0.2, "sine", 0.08);
        break;
      case "melee":
        this._noise(0.04, 0.12);
        this._blip(220 + Math.random() * 60, 0.06, "sawtooth", 0.11);
        break;
      case "melee_hit":
        this._blip(160, 0.05, "square", 0.14);
        this._noise(0.03, 0.1);
        break;
      case "victory":
        this._arpeggio([523, 659, 784, 1046, 1318], 0.11, 0.14);
        break;
      case "gameover":
        this._sweep(300, 80, 0.45, "sawtooth", 0.16);
        this._blip(70, 0.35, "triangle", 0.14, 0.15);
        break;
      case "ui":
        this._blip(500, 0.04, "sine", 0.07);
        break;
      default:
        break;
    }
  }

  _blip(freq, dur, type = "sine", vol = 0.12, delay = 0) {
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _sweep(f0, f1, dur, type = "sine", vol = 0.12) {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _arpeggio(freqs, step, vol = 0.1) {
    freqs.forEach((f, i) => this._blip(f, step * 1.2, "triangle", vol, i * step));
  }

  _noise(dur, vol = 0.1) {
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }
}

export const audio = new AudioSys();
