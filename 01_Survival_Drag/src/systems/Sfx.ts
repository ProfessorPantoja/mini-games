/**
 * Sons procedurais via Web Audio API — sem arquivos externos.
 * Desbloqueia no primeiro gesto do usuário (clique/tecla).
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private master = 0.22;

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  hit(): void {
    this.beep({ freq: 180, freqEnd: 90, dur: 0.07, type: 'square', gain: 0.18 });
  }

  playerHurt(): void {
    this.beep({ freq: 220, freqEnd: 80, dur: 0.14, type: 'sawtooth', gain: 0.2 });
    this.noise({ dur: 0.08, gain: 0.08 });
  }

  kill(tier: 'weak' | 'medium' | 'tank' = 'weak'): void {
    if (tier === 'weak') {
      this.beep({ freq: 520, freqEnd: 280, dur: 0.08, type: 'triangle', gain: 0.12 });
    } else if (tier === 'medium') {
      this.beep({ freq: 380, freqEnd: 160, dur: 0.12, type: 'square', gain: 0.14 });
      this.noise({ dur: 0.06, gain: 0.06 });
    } else {
      this.beep({ freq: 140, freqEnd: 50, dur: 0.22, type: 'sawtooth', gain: 0.2 });
      this.noise({ dur: 0.15, gain: 0.12 });
    }
  }

  xpPickup(): void {
    this.beep({ freq: 660, freqEnd: 990, dur: 0.06, type: 'sine', gain: 0.08 });
  }

  levelUp(): void {
    this.beep({ freq: 440, freqEnd: 660, dur: 0.1, type: 'triangle', gain: 0.14, delay: 0 });
    this.beep({ freq: 660, freqEnd: 880, dur: 0.12, type: 'triangle', gain: 0.14, delay: 0.1 });
    this.beep({ freq: 880, freqEnd: 1100, dur: 0.16, type: 'triangle', gain: 0.12, delay: 0.2 });
  }

  cardPick(): void {
    this.beep({ freq: 520, freqEnd: 780, dur: 0.1, type: 'sine', gain: 0.12 });
  }

  ambush(): void {
    this.beep({ freq: 120, freqEnd: 60, dur: 0.25, type: 'sawtooth', gain: 0.18 });
    this.beep({ freq: 90, freqEnd: 40, dur: 0.3, type: 'square', gain: 0.12, delay: 0.08 });
  }

  boss(): void {
    this.beep({ freq: 80, freqEnd: 40, dur: 0.4, type: 'sawtooth', gain: 0.22 });
    this.beep({ freq: 160, freqEnd: 100, dur: 0.25, type: 'square', gain: 0.12, delay: 0.15 });
    this.noise({ dur: 0.2, gain: 0.1, delay: 0.05 });
  }

  victory(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => {
      this.beep({ freq, freqEnd: freq * 1.05, dur: 0.18, type: 'triangle', gain: 0.14, delay: i * 0.12 });
    });
  }

  gameOver(): void {
    this.beep({ freq: 300, freqEnd: 80, dur: 0.45, type: 'sawtooth', gain: 0.16 });
    this.beep({ freq: 200, freqEnd: 50, dur: 0.5, type: 'triangle', gain: 0.1, delay: 0.1 });
  }

  pulse(): void {
    this.beep({ freq: 200, freqEnd: 90, dur: 0.1, type: 'sine', gain: 0.06 });
  }

  private beep(opts: {
    freq: number;
    freqEnd: number;
    dur: number;
    type: OscillatorType;
    gain: number;
    delay?: number;
  }): void {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;

    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + opts.dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(this.master * opts.gain, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  private noise(opts: { dur: number; gain: number; delay?: number }): void {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;

    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const samples = Math.floor(ctx.sampleRate * opts.dur);
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.master * opts.gain, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.02);
  }
}

/** Instância compartilhada entre cenas */
export const sfx = new Sfx();
