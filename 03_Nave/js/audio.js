/**
 * NEON STRIKE — Procedural Audio (Web Audio API)
 * Sons e música gerados em runtime, sem arquivos externos.
 */
const AudioSys = (() => {
  let ctx = null;
  let master = null;
  let sfxGain = null;
  let musicGain = null;
  let musicNodes = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.55;
    sfxGain.connect(master);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(master);
  }

  async function unlock() {
    ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();
    started = true;
  }

  function setMuted(v) {
    muted = !!v;
    try {
      localStorage.setItem("neonstrike_muted", muted ? "1" : "0");
    } catch (_) {}
    if (master) master.gain.value = muted ? 0 : 0.7;
  }

  function toggleMute() {
    ensure();
    setMuted(!muted);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  // restaura preferência
  try {
    if (localStorage.getItem("neonstrike_muted") === "1") muted = true;
  } catch (_) {}

  function tone(freq, type, dur, vol, dest, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t);
    if (slideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq || 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(sfxGain);
    src.start(t);
    src.stop(t + dur);
  }

  function shoot(weapon) {
    if (weapon === "laser") {
      tone(880, "sawtooth", 0.08, 0.08, null, 220);
      tone(1320, "square", 0.05, 0.04);
    } else if (weapon === "spread") {
      tone(520, "square", 0.06, 0.07, null, 180);
      tone(640, "triangle", 0.05, 0.04);
    } else {
      tone(660, "square", 0.05, 0.06, null, 240);
    }
  }

  function hit() {
    tone(180, "triangle", 0.07, 0.08, null, 60);
    noise(0.05, 0.06, 900);
  }

  function explosion(big) {
    noise(big ? 0.45 : 0.22, big ? 0.35 : 0.18, big ? 600 : 1200);
    tone(big ? 90 : 140, "sawtooth", big ? 0.4 : 0.18, big ? 0.2 : 0.1, null, 40);
  }

  function powerup() {
    tone(440, "square", 0.08, 0.1);
    setTimeout(() => tone(660, "square", 0.08, 0.1), 70);
    setTimeout(() => tone(880, "square", 0.12, 0.12), 140);
  }

  function bomb() {
    noise(0.6, 0.4, 400);
    tone(60, "sawtooth", 0.5, 0.25, null, 30);
    tone(200, "square", 0.3, 0.1, null, 50);
  }

  function playerHit() {
    noise(0.3, 0.25, 500);
    tone(120, "sawtooth", 0.35, 0.2, null, 40);
  }

  function waveClear() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => tone(f, "triangle", 0.18, 0.12), i * 90);
    });
  }

  function bossAlert() {
    [200, 160, 200, 140].forEach((f, i) => {
      setTimeout(() => tone(f, "sawtooth", 0.2, 0.15), i * 160);
    });
  }

  function gameOver() {
    [400, 320, 260, 180, 120].forEach((f, i) => {
      setTimeout(() => tone(f, "triangle", 0.28, 0.14), i * 140);
    });
  }

  function uiClick() {
    tone(720, "square", 0.04, 0.06);
  }

  function startMusic() {
    ensure();
    if (!ctx || musicNodes) return;
    stopMusic();

    const tempo = 128;
    const beat = 60 / tempo;
    const t0 = ctx.currentTime + 0.05;

    // Bass pulse
    const bass = ctx.createOscillator();
    const bassG = ctx.createGain();
    const bassF = ctx.createBiquadFilter();
    bass.type = "sawtooth";
    bassF.type = "lowpass";
    bassF.frequency.value = 180;
    bassG.gain.value = 0.0;
    bass.connect(bassF);
    bassF.connect(bassG);
    bassG.connect(musicGain);
    bass.start(t0);

    // Pad
    const pad = ctx.createOscillator();
    const pad2 = ctx.createOscillator();
    const padG = ctx.createGain();
    pad.type = "triangle";
    pad2.type = "triangle";
    pad.frequency.value = 110;
    pad2.frequency.value = 164.81;
    padG.gain.value = 0.04;
    pad.connect(padG);
    pad2.connect(padG);
    padG.connect(musicGain);
    pad.start(t0);
    pad2.start(t0);

    // Arp-ish pulse via LFO on bass gain
    const notes = [55, 55, 73.42, 82.41, 55, 98, 73.42, 82.41];
    let step = 0;
    const interval = setInterval(() => {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const n = notes[step % notes.length];
      bass.frequency.setValueAtTime(n, t);
      bassG.gain.cancelScheduledValues(t);
      bassG.gain.setValueAtTime(0.12, t);
      bassG.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.7);

      // hi-hat noise ticks
      if (step % 2 === 0) noiseTick(0.03, 0.03, 6000);
      if (step % 4 === 0) noiseTick(0.05, 0.05, 800);

      step++;
    }, beat * 1000);

    musicNodes = { bass, pad, pad2, bassG, padG, interval };
  }

  function noiseTick(dur, vol, freq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(musicGain);
    src.start(t);
    src.stop(t + dur);
  }

  function stopMusic() {
    if (!musicNodes) return;
    clearInterval(musicNodes.interval);
    try {
      musicNodes.bass.stop();
      musicNodes.pad.stop();
      musicNodes.pad2.stop();
    } catch (_) {}
    musicNodes = null;
  }

  return {
    unlock,
    setMuted,
    toggleMute,
    isMuted,
    shoot,
    hit,
    explosion,
    powerup,
    bomb,
    playerHit,
    waveClear,
    bossAlert,
    gameOver,
    uiClick,
    startMusic,
    stopMusic,
    get started() {
      return started;
    },
  };
})();
