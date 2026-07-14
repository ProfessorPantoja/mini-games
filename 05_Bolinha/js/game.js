/**
 * Bolinha — ultra-refined breakout engine
 * Canvas 2D · 60fps · juice · power-ups · 8 levels
 */

import { audio } from "./audio.js";

// ─────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────

const W = 960;
const H = 640;
const STORAGE_KEY = "bolinha.best.v1";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;
const now = () => performance.now();

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Palette
const C = {
  cyan: "#56d6ff",
  violet: "#8b7cff",
  pink: "#ff6bcb",
  amber: "#ffc857",
  lime: "#7dffb3",
  danger: "#ff5d7a",
  white: "#eef2ff",
  dim: "#93a0bd",
  bg: "#080b12",
};

const POWER_META = {
  multi:  { color: C.violet, label: "Multi-bolinha",  icon: "◎" },
  wide:   { color: C.cyan,   label: "Barra larga",    icon: "↔" },
  slow:   { color: C.lime,   label: "Câmera lenta",   icon: "◌" },
  sticky: { color: C.amber,  label: "Ímã",            icon: "⊕" },
  fire:   { color: C.pink,   label: "Fogo",           icon: "✧" },
  life:   { color: C.lime,   label: "Vida extra",     icon: "♥" },
};

// Brick color sets by HP / type
const BRICK_COLORS = [
  null,
  { main: "#56d6ff", edge: "#9eebff" }, // 1
  { main: "#8b7cff", edge: "#b8afff" }, // 2
  { main: "#ff6bcb", edge: "#ff9edc" }, // 3
  { main: "#ffc857", edge: "#ffdfa0" }, // 4 — special
];

// ─────────────────────────────────────────────────────────────
// Level patterns (8)
// 0 empty · 1-3 hp · 4 indestructible (metal) · 5 power brick
// ─────────────────────────────────────────────────────────────

const LEVELS = [
  // 1 — gentle wave
  [
    "00000000000000",
    "00111111111100",
    "01111111111110",
    "01122222222110",
    "00111111111100",
    "00011111111000",
  ],
  // 2 — chevron
  [
    "00001111110000",
    "00011111111000",
    "00112222221100",
    "01112222221110",
    "11111111111111",
    "01111111111110",
    "00111111111100",
  ],
  // 3 — fortress
  [
    "44440000004444",
    "41111111111114",
    "41222222222114",
    "41225555522114",
    "41222222222114",
    "41111111111114",
    "44440000004444",
  ],
  // 4 — diamonds
  [
    "00001111110000",
    "00012222221000",
    "00122333322100",
    "01223355332210",
    "00122333322100",
    "00012222221000",
    "00001111110000",
  ],
  // 5 — corridors
  [
    "11110440111111",
    "22220440222222",
    "11110440111111",
    "33330550333333",
    "11110440111111",
    "22220440222222",
    "11110440111111",
  ],
  // 6 — spiral denser
  [
    "33333333333333",
    "30000000000003",
    "30222222222003",
    "30200000002003",
    "30205555002003",
    "30201111002003",
    "30222222222003",
    "30000000000003",
    "11111111111111",
  ],
  // 7 — storm
  [
    "10101010101010",
    "02020202020202",
    "30303030303030",
    "05050505050505",
    "20202020202020",
    "13131313131313",
    "04040404040404",
    "21212121212121",
  ],
  // 8 — final form
  [
    "44411111111444",
    "41222222222114",
    "41233333332114",
    "41235555532114",
    "41233333332114",
    "41222222222114",
    "41111111111114",
    "40404000040404",
    "05050555505050",
  ],
];

// ─────────────────────────────────────────────────────────────
// Particles
// ─────────────────────────────────────────────────────────────

class ParticleSystem {
  constructor() {
    this.items = [];
  }

  clear() {
    this.items.length = 0;
  }

  burst(x, y, color, n = 12, speed = 180, life = 0.55) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + rand(-0.2, 0.2);
      const s = rand(speed * 0.35, speed);
      this.items.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life, max: life,
        size: rand(1.5, 4.2),
        color,
        drag: rand(0.92, 0.97),
        g: rand(40, 140),
        type: "spark",
      });
    }
  }

  confetti(x, y, n = 24) {
    const colors = [C.cyan, C.violet, C.pink, C.amber, C.lime];
    for (let i = 0; i < n; i++) {
      this.items.push({
        x: x + rand(-20, 20),
        y: y + rand(-10, 10),
        vx: rand(-160, 160),
        vy: rand(-280, -80),
        life: rand(0.7, 1.3),
        max: 1.2,
        size: rand(2, 5),
        color: colors[i % colors.length],
        drag: 0.98,
        g: 420,
        type: "confetti",
        rot: rand(0, Math.PI * 2),
        vr: rand(-8, 8),
      });
    }
  }

  trail(x, y, color, size = 3) {
    this.items.push({
      x, y,
      vx: rand(-8, 8),
      vy: rand(-8, 8),
      life: 0.28,
      max: 0.28,
      size,
      color,
      drag: 0.9,
      g: 0,
      type: "trail",
    });
  }

  floatText(x, y, text, color = C.amber) {
    this.items.push({
      x, y,
      vx: 0,
      vy: -40,
      life: 0.85,
      max: 0.85,
      size: 14,
      color,
      drag: 1,
      g: 0,
      type: "text",
      text,
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
  }

  draw(ctx) {
    for (const p of this.items) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.type === "text") {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.font = `600 ${p.size}px "Outfit", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.globalAlpha = a * (p.type === "trail" ? 0.55 : 0.9);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.type === "spark" ? 10 : 6;
      if (p.type === "confetti") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Game
// ─────────────────────────────────────────────────────────────

class Game {
  constructor() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.stage = document.getElementById("stage");

    // Scale handling
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._resizeCanvas();

    // State machine
    this.state = "title"; // title | ready | playing | paused | levelclear | gameover | win
    this.levelIndex = 0;
    this.score = 0;
    this.best = Number(localStorage.getItem(STORAGE_KEY) || 0);
    this.lives = 3;
    this.combo = 0;
    this.maxCombo = 1;
    this.bricksBroken = 0;
    this.totalBricksBroken = 0;

    // World
    this.bricks = [];
    this.balls = [];
    this.powerups = [];
    this.particles = new ParticleSystem();
    this.paddle = this._makePaddle();

    // FX
    this.shake = 0;
    this.shakeMag = 0;
    this.flash = 0;
    this.slowMo = 0;
    this.timeScale = 1;
    this.bgPulse = 0;
    this.stars = this._makeStars(80);

    // Input
    this.pointerX = W / 2;
    this.keys = new Set();
    this.sticky = false;
    this.fireBall = 0;
    this.wideTimer = 0;

    // Timing
    this.lastT = now();
    this.raf = 0;
    this.levelClearTimer = 0;
    this.readyTimer = 0;

    this._bindUI();
    this._bindInput();
    this._updateHUDStatic();
    this._showOverlay("title");
    this._loop();
  }

  // ── setup ────────────────────────────────────────────────

  _resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.canvas.width = Math.floor(W * dpr);
    this.canvas.height = Math.floor(H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _makeStars(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      arr.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(0.4, 1.6),
        a: rand(0.15, 0.55),
        s: rand(2, 12),
        p: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }

  _makePaddle() {
    return {
      x: W / 2,
      y: H - 48,
      w: 120,
      h: 14,
      baseW: 120,
      targetX: W / 2,
      vx: 0,
      glow: 0,
      sticky: false,
    };
  }

  // ── UI ───────────────────────────────────────────────────

  _bindUI() {
    const $ = (id) => document.getElementById(id);

    this.ui = {
      hud: $("hud"),
      score: $("score"),
      combo: $("combo"),
      level: $("level"),
      best: $("best"),
      lives: $("lives"),
      titleBest: $("title-best"),
      toast: $("toast"),
      mobileLaunch: $("mobile-launch"),
      overlays: {
        title: $("overlay-title"),
        how: $("overlay-how"),
        pause: $("overlay-pause"),
        level: $("overlay-level"),
        gameover: $("overlay-gameover"),
        win: $("overlay-win"),
      },
    };

    $("btn-start").addEventListener("click", () => this.startGame());
    $("btn-how").addEventListener("click", () => {
      audio.unlock();
      audio.ui();
      this._showOverlay("how");
    });
    $("btn-how-close").addEventListener("click", () => {
      audio.ui();
      this._showOverlay("title");
    });
    $("btn-resume").addEventListener("click", () => this.resume());
    $("btn-restart").addEventListener("click", () => this.startGame());
    $("btn-menu").addEventListener("click", () => this.toMenu());
    $("btn-again").addEventListener("click", () => this.startGame());
    $("btn-go-menu").addEventListener("click", () => this.toMenu());
    $("btn-win-again").addEventListener("click", () => this.startGame());
    $("btn-win-menu").addEventListener("click", () => this.toMenu());
    $("mobile-launch").addEventListener("click", (e) => {
      e.stopPropagation();
      this.tryLaunch();
    });

    window.addEventListener("resize", () => this._resizeCanvas());
  }

  _bindInput() {
    const toGameX = (clientX) => {
      const rect = this.canvas.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) * W;
    };

    const onMove = (clientX) => {
      this.pointerX = toGameX(clientX);
      this.paddle.targetX = this.pointerX;
    };

    window.addEventListener("mousemove", (e) => onMove(e.clientX));
    window.addEventListener("touchmove", (e) => {
      if (e.touches[0]) onMove(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener("touchstart", (e) => {
      audio.unlock();
      if (e.touches[0]) onMove(e.touches[0].clientX);
    }, { passive: true });

    this.canvas.addEventListener("mousedown", () => {
      audio.unlock();
      this.tryLaunch();
    });

    window.addEventListener("keydown", (e) => {
      audio.unlock();
      this.keys.add(e.code);

      if (e.code === "Space") {
        e.preventDefault();
        if (this.state === "title") this.startGame();
        else if (this.state === "ready" || this.state === "playing") this.tryLaunch();
        else if (this.state === "paused") this.resume();
      }
      if (e.code === "Escape") {
        if (this.state === "playing" || this.state === "ready") this.pause();
        else if (this.state === "paused") this.resume();
      }
      if (e.code === "KeyR" && (this.state === "playing" || this.state === "paused" || this.state === "ready")) {
        this.startGame();
      }
    });

    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
  }

  _showOverlay(name) {
    for (const [k, el] of Object.entries(this.ui.overlays)) {
      el.classList.toggle("hidden", k !== name);
    }
    const playingish = ["ready", "playing", "paused"].includes(this.state) || name === "level";
    // hud visibility managed separately
  }

  _hideOverlays() {
    for (const el of Object.values(this.ui.overlays)) el.classList.add("hidden");
  }

  _updateHUDStatic() {
    this.ui.best.textContent = String(this.best);
    this.ui.titleBest.textContent = String(this.best);
  }

  _updateHUD() {
    this.ui.score.textContent = String(this.score);
    this.ui.level.textContent = String(this.levelIndex + 1);
    this.ui.combo.textContent = `×${Math.max(1, this.combo)}`;
    this.ui.combo.classList.toggle("combo-hot", this.combo >= 5);
    this.ui.best.textContent = String(this.best);

    // lives
    const livesEl = this.ui.lives;
    const maxShow = Math.max(3, this.lives);
    while (livesEl.children.length < maxShow) {
      const d = document.createElement("span");
      d.className = "life";
      livesEl.appendChild(d);
    }
    while (livesEl.children.length > maxShow) livesEl.lastChild.remove();
    [...livesEl.children].forEach((el, i) => {
      el.classList.toggle("lost", i >= this.lives);
    });
  }

  _bumpStat(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  toast(msg, ms = 1400) {
    const t = this.ui.toast;
    t.hidden = false;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => { t.hidden = true; }, 250);
    }, ms);
  }

  // ── flow ─────────────────────────────────────────────────

  startGame() {
    audio.unlock();
    audio.ui();
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.maxCombo = 1;
    this.totalBricksBroken = 0;
    this.levelIndex = 0;
    this.sticky = false;
    this.fireBall = 0;
    this.wideTimer = 0;
    this.slowMo = 0;
    this.particles.clear();
    this.powerups = [];
    this.ui.hud.hidden = false;
    this._loadLevel(0);
    this._hideOverlays();
    this.state = "ready";
    this._updateHUD();
    this._updateMobileLaunch();
  }

  toMenu() {
    audio.ui();
    this.state = "title";
    this.balls = [];
    this.powerups = [];
    this.particles.clear();
    this.ui.hud.hidden = true;
    this.ui.mobileLaunch.classList.add("hidden");
    this._updateHUDStatic();
    this._showOverlay("title");
  }

  pause() {
    if (this.state !== "playing" && this.state !== "ready") return;
    this._prevState = this.state;
    this.state = "paused";
    this._showOverlay("pause");
    this.ui.mobileLaunch.classList.add("hidden");
  }

  resume() {
    if (this.state !== "paused") return;
    audio.ui();
    this.state = this._prevState || "playing";
    this._hideOverlays();
    this._updateMobileLaunch();
  }

  _loadLevel(idx) {
    this.levelIndex = idx;
    this.bricks = [];
    this.balls = [];
    this.powerups = [];
    this.combo = 0;
    this.fireBall = 0;
    this.slowMo = 0;
    this.wideTimer = 0;
    this.sticky = false;
    this.paddle = this._makePaddle();
    this.paddle.targetX = this.pointerX;

    const pattern = LEVELS[idx];
    const rows = pattern.length;
    const cols = pattern[0].length;
    const marginX = 48;
    const topY = 72;
    const gap = 6;
    const brickW = (W - marginX * 2 - gap * (cols - 1)) / cols;
    const brickH = 22;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = pattern[r][c];
        if (ch === "0") continue;
        const type = Number(ch);
        const x = marginX + c * (brickW + gap);
        const y = topY + r * (brickH + gap);
        let hp = type;
        let power = false;
        let metal = false;
        if (type === 4) {
          metal = true;
          hp = Infinity;
        } else if (type === 5) {
          hp = 1;
          power = true;
        }
        this.bricks.push({
          x, y, w: brickW, h: brickH,
          hp, maxHp: Number.isFinite(hp) ? hp : 4,
          metal, power,
          alive: true,
          hitFlash: 0,
          appear: rand(0, 0.35) + r * 0.03,
          scale: 0,
        });
      }
    }

    this.bricksBroken = 0;
    this._spawnBall(true);
    this.state = "ready";
    this.readyTimer = 0;
    this._updateHUD();
    this._updateMobileLaunch();
  }

  _spawnBall(attached = false) {
    const p = this.paddle;
    const ball = {
      x: p.x,
      y: p.y - p.h / 2 - 10,
      r: 8.5,
      vx: 0,
      vy: 0,
      speed: 360 + this.levelIndex * 18,
      attached,
      trail: [],
      spin: 0,
      glow: 1,
      fire: this.fireBall > 0,
    };
    if (!attached) {
      const angle = rand(-0.7, 0.7);
      ball.vx = Math.sin(angle) * ball.speed;
      ball.vy = -Math.cos(angle) * ball.speed;
    }
    this.balls.push(ball);
    return ball;
  }

  tryLaunch() {
    if (this.state !== "ready" && this.state !== "playing") return;
    let launched = false;
    for (const b of this.balls) {
      if (b.attached) {
        b.attached = false;
        const offset = (b.x - this.paddle.x) / (this.paddle.w / 2);
        const angle = clamp(offset, -0.85, 0.85) * 0.9;
        const spd = b.speed;
        b.vx = Math.sin(angle) * spd + this.paddle.vx * 0.15;
        b.vy = -Math.abs(Math.cos(angle) * spd);
        this._normalizeBall(b);
        launched = true;
      }
    }
    if (launched) {
      audio.launch();
      this.state = "playing";
      this._updateMobileLaunch();
    }
  }

  _updateMobileLaunch() {
    const hasAttached = this.balls.some((b) => b.attached);
    const show = hasAttached && (this.state === "ready" || this.state === "playing") && window.matchMedia("(pointer: coarse)").matches;
    this.ui.mobileLaunch.classList.toggle("hidden", !show);
  }

  // ── scoring ──────────────────────────────────────────────

  _addScore(base, x, y) {
    const mult = Math.max(1, this.combo);
    const pts = Math.round(base * mult);
    this.score += pts;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE_KEY, String(this.best));
    }
    this._updateHUD();
    this._bumpStat(this.ui.score);
    if (mult >= 2) this.particles.floatText(x, y, `+${pts}`, mult >= 6 ? C.amber : C.cyan);
  }

  _incCombo(x, y) {
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this._updateHUD();
    if (this.combo >= 3 && this.combo % 2 === 1) {
      audio.combo(this.combo);
      this.particles.floatText(x, y - 16, `COMBO ×${this.combo}`, C.amber);
    }
    if (this.combo === 5 || this.combo === 10 || this.combo === 15) {
      this.toast(`Combo ×${this.combo}`);
    }
  }

  _resetCombo() {
    this.combo = 0;
    this._updateHUD();
  }

  // ── power-ups ────────────────────────────────────────────

  _spawnPowerup(x, y) {
    const types = ["multi", "wide", "slow", "sticky", "fire", "life"];
    // Weighted
    const weights = [0.22, 0.2, 0.16, 0.16, 0.16, 0.1];
    let r = Math.random();
    let type = types[0];
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) { type = types[i]; break; }
    }
    this.powerups.push({
      x, y,
      r: 11,
      vy: 90,
      type,
      rot: 0,
      life: 12,
      bob: Math.random() * Math.PI * 2,
    });
  }

  _applyPowerup(type) {
    const meta = POWER_META[type];
    audio.powerup();
    this.toast(meta.label);
    this.shake = 0.12;
    this.shakeMag = 4;
    this.flash = 0.18;
    this.bgPulse = 1;

    switch (type) {
      case "multi": {
        const base = this.balls.find((b) => !b.attached) || this.balls[0];
        if (!base) break;
        // If still attached, launch first so multi is useful
        if (base.attached) {
          base.attached = false;
          base.vx = rand(-0.3, 0.3) * base.speed;
          base.vy = -base.speed;
          this._normalizeBall(base);
          this.state = "playing";
        }
        for (let i = 0; i < 2; i++) {
          const a = (i === 0 ? -0.55 : 0.55);
          const b = {
            x: base.x,
            y: base.y,
            r: base.r,
            speed: base.speed,
            attached: false,
            trail: [],
            spin: rand(-3, 3),
            glow: 1,
            fire: this.fireBall > 0,
            vx: Math.sin(a) * base.speed,
            vy: -Math.abs(Math.cos(a) * base.speed),
          };
          this._normalizeBall(b);
          this.balls.push(b);
        }
        this._updateMobileLaunch();
        break;
      }
      case "wide":
        this.wideTimer = 12;
        this.paddle.baseW = 180;
        break;
      case "slow":
        this.slowMo = 8;
        break;
      case "sticky":
        this.sticky = true;
        this.paddle.sticky = true;
        break;
      case "fire":
        this.fireBall = 10;
        for (const b of this.balls) b.fire = true;
        break;
      case "life":
        this.lives = Math.min(this.lives + 1, 6);
        this._updateHUD();
        break;
    }
  }

  // ── physics helpers ──────────────────────────────────────

  _normalizeBall(b) {
    const spd = Math.hypot(b.vx, b.vy) || 1;
    const target = b.speed;
    b.vx = (b.vx / spd) * target;
    b.vy = (b.vy / spd) * target;
    // Prevent too-horizontal
    const minVy = target * 0.28;
    if (Math.abs(b.vy) < minVy) {
      b.vy = Math.sign(b.vy || -1) * minVy;
      const rest = Math.sqrt(Math.max(0, target * target - b.vy * b.vy));
      b.vx = Math.sign(b.vx || 1) * rest;
    }
  }

  _bouncePaddle(ball) {
    const p = this.paddle;
    const rel = (ball.x - p.x) / (p.w / 2);
    const clamped = clamp(rel, -1, 1);
    // Angle: center goes straight up, edges go wide
    const maxAngle = Math.PI * 0.42;
    const angle = clamped * maxAngle;
    const spd = ball.speed * (1 + Math.abs(clamped) * 0.06 + Math.min(Math.abs(p.vx) / 800, 0.12));
    ball.speed = clamp(spd, 320, 560 + this.levelIndex * 12);
    ball.vx = Math.sin(angle) * ball.speed + p.vx * 0.12;
    ball.vy = -Math.abs(Math.cos(angle) * ball.speed);
    ball.spin = clamped * 4;
    ball.y = p.y - p.h / 2 - ball.r - 0.5;
    this._normalizeBall(ball);

    p.glow = 1;
    this.shake = 0.08;
    this.shakeMag = 2 + Math.abs(clamped) * 2;
    this.particles.burst(ball.x, ball.y, C.cyan, 8, 120, 0.3);
    audio.paddle();

    if (this.sticky && !ball.attached) {
      ball.attached = true;
      ball.offsetX = clamp(ball.x - p.x, -p.w / 2 + ball.r, p.w / 2 - ball.r);
      ball.vx = 0;
      ball.vy = 0;
      this.state = "ready";
      this._updateMobileLaunch();
    }
  }

  _hitBrick(brick, ball) {
    if (!brick.alive) return;

    if (brick.metal) {
      brick.hitFlash = 0.25;
      this.shake = 0.06;
      this.shakeMag = 2;
      audio.wall();
      this.particles.burst(ball.x, ball.y, C.dim, 6, 90, 0.25);
      // metal always reflects — even fire balls
      this._reflectBrick(brick, ball);
      return;
    }

    if (ball.fire) {
      // destroy in one hit
      this._destroyBrick(brick, true);
      // fire does not bounce
      return;
    }

    brick.hp -= 1;
    brick.hitFlash = 0.2;
    if (brick.hp <= 0) {
      this._destroyBrick(brick, false);
    } else {
      audio.brick(brick.hp);
      const col = BRICK_COLORS[Math.min(brick.hp, 3)]?.main || C.cyan;
      this.particles.burst(ball.x, ball.y, col, 8, 110, 0.3);
      this._incCombo(brick.x + brick.w / 2, brick.y);
      this._addScore(15, brick.x + brick.w / 2, brick.y);
    }
    this._reflectBrick(brick, ball);
  }

  _reflectBrick(brick, ball) {
    // Determine side by penetration
    const prevX = ball.x - ball.vx * 0.016;
    const prevY = ball.y - ball.vy * 0.016;
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;

    // Approximate: which edge is closer from previous position
    const dx = prevX - cx;
    const dy = prevY - cy;
    const px = brick.w / 2 + ball.r;
    const py = brick.h / 2 + ball.r;
    const ox = Math.abs(dx) / px;
    const oy = Math.abs(dy) / py;

    if (ox > oy) {
      ball.vx *= -1;
      ball.x = cx + Math.sign(dx || 1) * (px + 0.5);
    } else {
      ball.vy *= -1;
      ball.y = cy + Math.sign(dy || 1) * (py + 0.5);
    }
    ball.spin *= -0.6;
    this._normalizeBall(ball);
  }

  _destroyBrick(brick, fiery) {
    brick.alive = false;
    this.bricksBroken += 1;
    this.totalBricksBroken += 1;
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    const col = brick.power ? C.amber : (BRICK_COLORS[brick.maxHp]?.main || C.cyan);

    this.particles.burst(cx, cy, col, fiery ? 22 : 16, fiery ? 260 : 200, 0.55);
    this.particles.burst(cx, cy, C.white, 6, 100, 0.35);
    audio.brick(1);
    if (fiery) audio.explode();

    this.shake = 0.1;
    this.shakeMag = fiery ? 6 : 3.5;
    this.bgPulse = 0.6;

    this._incCombo(cx, cy);
    const base = brick.power ? 80 : 40 + brick.maxHp * 15;
    this._addScore(base, cx, cy);

    if (brick.power || chance(0.12)) {
      this._spawnPowerup(cx, cy);
    }

    // check level clear
    if (this._remainingBricks() === 0) {
      this._onLevelClear();
    }
  }

  _remainingBricks() {
    return this.bricks.filter((b) => b.alive && !b.metal).length;
  }

  _onLevelClear() {
    this.state = "levelclear";
    this.levelClearTimer = 2.2;
    const bonus = 500 + this.levelIndex * 250 + this.lives * 100 + Math.max(0, this.combo) * 20;
    this.score += bonus;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE_KEY, String(this.best));
    }
    this._updateHUD();
    audio.levelClear();
    this.particles.confetti(W / 2, H * 0.35, 48);
    this.flash = 0.35;
    this.shake = 0.2;
    this.shakeMag = 5;

    document.getElementById("level-clear-title").textContent = `Nível ${this.levelIndex + 1}`;
    document.getElementById("level-bonus").textContent = `+${bonus}`;
    this._showOverlay("level");
    this.ui.mobileLaunch.classList.add("hidden");
  }

  _onBallLost() {
    // remove dead balls handled in update; if none left:
    if (this.balls.length > 0) return;

    this._resetCombo();
    this.lives -= 1;
    this.sticky = false;
    this.paddle.sticky = false;
    this.fireBall = 0;
    this.slowMo = 0;
    this.wideTimer = 0;
    this.paddle.baseW = 120;
    this._updateHUD();
    audio.lifeLost();
    this.shake = 0.25;
    this.shakeMag = 8;
    this.flash = 0.25;

    if (this.lives <= 0) {
      this._gameOver(false);
      return;
    }

    this._spawnBall(true);
    this.state = "ready";
    this.toast("Vida perdida");
    this._updateMobileLaunch();
  }

  _gameOver(won) {
    this.ui.mobileLaunch.classList.add("hidden");
    if (won) {
      this.state = "win";
      audio.win();
      this.particles.confetti(W / 2, H / 2, 60);
      document.getElementById("win-score").textContent = String(this.score);
      document.getElementById("win-combo").textContent = `×${this.maxCombo}`;
      this._showOverlay("win");
    } else {
      this.state = "gameover";
      audio.gameOver();
      const isRecord = this.score >= this.best && this.score > 0;
      document.getElementById("go-badge").textContent = isRecord ? "recorde" : "fim de jogo";
      document.getElementById("go-title").textContent = isRecord ? "Novo recorde!" : "A bolinha caiu";
      document.getElementById("go-score").textContent = String(this.score);
      document.getElementById("go-combo").textContent = `×${this.maxCombo}`;
      document.getElementById("go-level").textContent = String(this.levelIndex + 1);
      document.getElementById("go-bricks").textContent = String(this.totalBricksBroken);
      document.getElementById("new-record").classList.toggle("hidden", !isRecord || this.score === 0);
      this._showOverlay("gameover");
    }
  }

  // ── update ───────────────────────────────────────────────

  _loop = () => {
    this.raf = requestAnimationFrame(this._loop);
    const t = now();
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    dt = clamp(dt, 0, 0.033);

    // slow-mo
    let scale = 1;
    if (this.slowMo > 0 && (this.state === "playing" || this.state === "ready")) {
      scale = 0.55;
      this.slowMo -= dt;
      if (this.slowMo <= 0) this.slowMo = 0;
    }
    this.timeScale = scale;
    const sdt = dt * scale;

    this._update(sdt, dt);
    this._draw(dt);
  };

  _update(dt, rawDt) {
    // always animate ambience
    this.bgPulse = Math.max(0, this.bgPulse - rawDt * 1.5);
    this.flash = Math.max(0, this.flash - rawDt * 2.2);
    this.shake = Math.max(0, this.shake - rawDt * 3.5);
    this.particles.update(rawDt);

    // brick appear anim even on title? only when bricks exist
    for (const b of this.bricks) {
      if (!b.alive) continue;
      if (b.appear > 0) {
        b.appear -= rawDt;
      } else {
        b.scale = lerp(b.scale, 1, 1 - Math.pow(0.001, rawDt));
      }
      b.hitFlash = Math.max(0, b.hitFlash - rawDt * 4);
    }

    if (this.state === "title") {
      // idle demo paddle
      this.paddle.targetX = W / 2 + Math.sin(now() / 900) * 180;
      this._updatePaddle(dt);
      return;
    }

    if (this.state === "levelclear") {
      this.levelClearTimer -= rawDt;
      if (this.levelClearTimer <= 0) {
        if (this.levelIndex + 1 >= LEVELS.length) {
          this._gameOver(true);
        } else {
          this._hideOverlays();
          this._loadLevel(this.levelIndex + 1);
          this.toast(`Nível ${this.levelIndex + 1}`);
        }
      }
      return;
    }

    if (this.state === "paused" || this.state === "gameover" || this.state === "win") {
      this._updatePaddle(dt * 0.3);
      return;
    }

    // ready / playing
    this._updatePaddle(dt);
    this._updateTimers(dt);
    this._updateBalls(dt);
    this._updatePowerups(dt);

    // keyboard nudge
    let kx = 0;
    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) kx -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) kx += 1;
    if (kx !== 0) {
      this.paddle.targetX += kx * 720 * dt;
      this.pointerX = this.paddle.targetX;
    }
  }

  _updateTimers(dt) {
    if (this.wideTimer > 0) {
      this.wideTimer -= dt;
      if (this.wideTimer <= 0) {
        this.wideTimer = 0;
        this.paddle.baseW = 120;
      }
    }
    if (this.fireBall > 0) {
      this.fireBall -= dt;
      if (this.fireBall <= 0) {
        this.fireBall = 0;
        for (const b of this.balls) b.fire = false;
      }
    }
    // smooth paddle width
    this.paddle.w = lerp(this.paddle.w, this.paddle.baseW, 1 - Math.pow(0.0001, dt));
    this.paddle.glow = Math.max(0, this.paddle.glow - dt * 2.5);
  }

  _updatePaddle(dt) {
    const p = this.paddle;
    const prev = p.x;
    const maxX = W - p.w / 2 - 16;
    const minX = p.w / 2 + 16;
    p.targetX = clamp(p.targetX, minX, maxX);
    // smooth follow with slight lag for feel
    p.x = lerp(p.x, p.targetX, 1 - Math.pow(0.00002, dt));
    p.vx = (p.x - prev) / Math.max(dt, 0.0001);

    // attached balls follow
    for (const b of this.balls) {
      if (b.attached) {
        const off = b.offsetX || 0;
        b.x = clamp(p.x + off, p.x - p.w / 2 + b.r, p.x + p.w / 2 - b.r);
        b.y = p.y - p.h / 2 - b.r - 1;
        b.vx = 0;
        b.vy = 0;
      }
    }
  }

  _updateBalls(dt) {
    const p = this.paddle;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.attached) {
        // trail idle
        b.trail.push({ x: b.x, y: b.y, a: 0.4 });
        if (b.trail.length > 10) b.trail.shift();
        continue;
      }

      // substeps for tunneling
      const steps = Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 6);
      const sdt = dt / steps;

      for (let s = 0; s < steps; s++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        // slight spin curve
        b.vx += b.spin * 8 * sdt;
        this._normalizeBall(b);

        // walls
        if (b.x - b.r < 16) {
          b.x = 16 + b.r;
          b.vx = Math.abs(b.vx);
          b.spin *= -0.5;
          audio.wall();
          this.particles.burst(b.x, b.y, C.violet, 5, 80, 0.2);
        } else if (b.x + b.r > W - 16) {
          b.x = W - 16 - b.r;
          b.vx = -Math.abs(b.vx);
          b.spin *= -0.5;
          audio.wall();
          this.particles.burst(b.x, b.y, C.violet, 5, 80, 0.2);
        }
        if (b.y - b.r < 16) {
          b.y = 16 + b.r;
          b.vy = Math.abs(b.vy);
          audio.wall();
          this.particles.burst(b.x, b.y, C.violet, 5, 80, 0.2);
        }

        // floor — lose ball
        if (b.y - b.r > H + 20) {
          this.balls.splice(i, 1);
          s = steps;
          continue;
        }

        // paddle
        if (
          b.vy > 0 &&
          b.y + b.r >= p.y - p.h / 2 &&
          b.y - b.r <= p.y + p.h / 2 + 6 &&
          b.x >= p.x - p.w / 2 - b.r &&
          b.x <= p.x + p.w / 2 + b.r
        ) {
          this._bouncePaddle(b);
        }

        // bricks
        for (const br of this.bricks) {
          if (!br.alive || br.scale < 0.9) continue;
          if (this._circleRect(b.x, b.y, b.r, br.x, br.y, br.w, br.h)) {
            this._hitBrick(br, b);
            if (!b.fire) break;
          }
        }
      }

      // trail
      if (chance(0.7)) {
        const col = b.fire ? C.pink : C.cyan;
        this.particles.trail(b.x, b.y, col, b.fire ? 3.5 : 2.4);
      }
      b.trail.push({ x: b.x, y: b.y, a: 1 });
      if (b.trail.length > 14) b.trail.shift();
      b.glow = lerp(b.glow, b.fire ? 1.4 : 1, 0.1);
    }

    if ((this.state === "playing" || this.state === "ready") && this.balls.length === 0) {
      this._onBallLost();
    }
  }

  _circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy <= cr * cr;
  }

  _updatePowerups(dt) {
    const p = this.paddle;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const u = this.powerups[i];
      u.y += u.vy * dt;
      u.rot += dt * 2.5;
      u.bob += dt * 4;
      u.life -= dt;
      if (u.life <= 0 || u.y - u.r > H) {
        this.powerups.splice(i, 1);
        continue;
      }
      // paddle catch
      if (
        u.y + u.r >= p.y - p.h / 2 &&
        u.y - u.r <= p.y + p.h / 2 &&
        u.x >= p.x - p.w / 2 - u.r &&
        u.x <= p.x + p.w / 2 + u.r
      ) {
        this.powerups.splice(i, 1);
        this._applyPowerup(u.type);
      }
    }
  }

  // ── draw ─────────────────────────────────────────────────

  _draw(rawDt) {
    const ctx = this.ctx;
    ctx.save();

    // screen shake
    if (this.shake > 0) {
      const m = this.shakeMag * this.shake;
      ctx.translate(rand(-m, m), rand(-m, m));
    }

    this._drawBackground(ctx, rawDt);
    this._drawPlayfield(ctx);
    this._drawBricks(ctx);
    this._drawPowerups(ctx);
    this._drawPaddle(ctx);
    this._drawBalls(ctx);
    this.particles.draw(ctx);
    this._drawReadyHint(ctx);
    this._drawVignetteFX(ctx);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.slowMo > 0 && (this.state === "playing" || this.state === "ready")) {
      ctx.fillStyle = "rgba(125, 255, 179, 0.04)";
      ctx.fillRect(0, 0, W, H);
      // border tint
      ctx.strokeStyle = rgba(C.lime, 0.15 + Math.sin(now() / 200) * 0.05);
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, W - 20, H - 20);
    }

    ctx.restore();
  }

  _drawBackground(ctx, rawDt) {
    // base
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a0e18");
    g.addColorStop(0.5, "#080b12");
    g.addColorStop(1, "#06080e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // soft radial pulse
    if (this.bgPulse > 0) {
      const rg = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, 420);
      rg.addColorStop(0, rgba(C.cyan, 0.08 * this.bgPulse));
      rg.addColorStop(1, "transparent");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    // stars / dust
    const t = now() / 1000;
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * s.s * 0.2 + s.p);
      ctx.beginPath();
      ctx.fillStyle = `rgba(180, 200, 255, ${s.a * tw})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // subtle grid
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    const grid = 48;
    for (let x = 16; x < W; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 16);
      ctx.lineTo(x, H - 16);
      ctx.stroke();
    }
    for (let y = 16; y < H; y += grid) {
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.lineTo(W - 16, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawPlayfield(ctx) {
    // soft border
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, W - 28, H - 28);

    // top glow line
    const lg = ctx.createLinearGradient(40, 0, W - 40, 0);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, rgba(C.cyan, 0.25));
    lg.addColorStop(1, "transparent");
    ctx.strokeStyle = lg;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, 16);
    ctx.lineTo(W - 40, 16);
    ctx.stroke();
    ctx.restore();
  }

  _drawBricks(ctx) {
    for (const b of this.bricks) {
      if (!b.alive || b.scale <= 0.01) continue;
      const sc = b.scale;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const w = b.w * sc;
      const h = b.h * sc;
      const x = cx - w / 2;
      const y = cy - h / 2;
      const r = 6;

      let main, edge;
      if (b.metal) {
        main = "#3a4258";
        edge = "#7a849e";
      } else if (b.power) {
        main = C.amber;
        edge = "#ffe09a";
      } else {
        const c = BRICK_COLORS[Math.min(Math.max(b.hp, 1), 3)];
        main = c.main;
        edge = c.edge;
      }

      ctx.save();

      // glow
      ctx.shadowColor = main;
      ctx.shadowBlur = b.power ? 18 : 10;

      // body
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, edge);
      grad.addColorStop(0.45, main);
      grad.addColorStop(1, rgba(main, 0.75));

      this._roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = grad;
      ctx.fill();

      // glass highlight
      ctx.shadowBlur = 0;
      const hi = ctx.createLinearGradient(x, y, x, y + h * 0.55);
      hi.addColorStop(0, "rgba(255,255,255,0.35)");
      hi.addColorStop(1, "rgba(255,255,255,0)");
      this._roundRect(ctx, x + 1, y + 1, w - 2, h * 0.45, r - 1);
      ctx.fillStyle = hi;
      ctx.fill();

      // metal hatch
      if (b.metal) {
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const lx = x + 8 + i * (w / 4);
          ctx.beginPath();
          ctx.moveTo(lx, y + 4);
          ctx.lineTo(lx - 6, y + h - 4);
          ctx.stroke();
        }
      }

      // power shimmer
      if (b.power) {
        const sh = 0.5 + 0.5 * Math.sin(now() / 200 + b.x);
        ctx.strokeStyle = rgba("#fff", 0.25 + sh * 0.25);
        ctx.lineWidth = 1.5;
        this._roundRect(ctx, x + 2, y + 2, w - 4, h - 4, r - 1);
        ctx.stroke();
      }

      // hit flash
      if (b.hitFlash > 0) {
        this._roundRect(ctx, x, y, w, h, r);
        ctx.fillStyle = `rgba(255,255,255,${b.hitFlash * 0.7})`;
        ctx.fill();
      }

      // HP pips for multi-hit
      if (!b.metal && !b.power && b.maxHp > 1) {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        const pipW = 5;
        const total = b.maxHp;
        const start = cx - (total * (pipW + 3) - 3) / 2;
        for (let i = 0; i < total; i++) {
          ctx.globalAlpha = i < b.hp ? 0.9 : 0.25;
          ctx.fillStyle = i < b.hp ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.35)";
          ctx.beginPath();
          ctx.arc(start + i * (pipW + 3) + pipW / 2, cy + h * 0.18, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }
  }

  _drawPaddle(ctx) {
    const p = this.paddle;
    const x = p.x - p.w / 2;
    const y = p.y - p.h / 2;
    const r = p.h / 2;

    ctx.save();

    // floor reflection
    ctx.globalAlpha = 0.12;
    const rg = ctx.createRadialGradient(p.x, p.y + 10, 0, p.x, p.y + 10, p.w * 0.7);
    rg.addColorStop(0, C.cyan);
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg;
    ctx.fillRect(p.x - p.w, p.y, p.w * 2, 40);
    ctx.globalAlpha = 1;

    // glow
    ctx.shadowColor = this.sticky ? C.amber : C.cyan;
    ctx.shadowBlur = 16 + p.glow * 20;

    const body = ctx.createLinearGradient(x, y, x, y + p.h);
    if (this.sticky) {
      body.addColorStop(0, "#ffe09a");
      body.addColorStop(0.5, C.amber);
      body.addColorStop(1, "#c9942a");
    } else {
      body.addColorStop(0, "#b8f0ff");
      body.addColorStop(0.45, C.cyan);
      body.addColorStop(1, "#3aa0c8");
    }

    this._roundRect(ctx, x, y, p.w, p.h, r);
    ctx.fillStyle = body;
    ctx.fill();

    // center gem
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    this._roundRect(ctx, p.x - 10, y + 3, 20, p.h - 6, 4);
    ctx.fill();

    // edge marks for angle zones
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(x + 8, y + 4, 3, p.h - 8);
    ctx.fillRect(x + p.w - 11, y + 4, 3, p.h - 8);

    ctx.restore();
  }

  _drawBalls(ctx) {
    for (const b of this.balls) {
      // trail ribbon
      if (b.trail.length > 1) {
        ctx.save();
        for (let i = 0; i < b.trail.length; i++) {
          const t = b.trail[i];
          const a = (i / b.trail.length) * 0.35;
          ctx.beginPath();
          ctx.fillStyle = b.fire ? rgba(C.pink, a) : rgba(C.cyan, a);
          ctx.arc(t.x, t.y, b.r * (0.35 + 0.45 * (i / b.trail.length)), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.save();
      const col = b.fire ? C.pink : C.cyan;
      ctx.shadowColor = col;
      ctx.shadowBlur = 18 * b.glow;

      // outer glow
      const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3.2);
      glow.addColorStop(0, rgba(col, 0.35));
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 3.2, 0, Math.PI * 2);
      ctx.fill();

      // core
      const core = ctx.createRadialGradient(
        b.x - b.r * 0.35,
        b.y - b.r * 0.4,
        b.r * 0.1,
        b.x,
        b.y,
        b.r
      );
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.35, col);
      core.addColorStop(1, b.fire ? "#a02060" : "#4b3fd4");
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // specular
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  _drawPowerups(ctx) {
    for (const u of this.powerups) {
      const meta = POWER_META[u.type];
      const bob = Math.sin(u.bob) * 3;
      const x = u.x;
      const y = u.y + bob;
      const fade = u.life < 2 ? u.life / 2 : 1;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x, y);
      ctx.rotate(Math.sin(u.rot) * 0.2);

      ctx.shadowColor = meta.color;
      ctx.shadowBlur = 16;

      // ring
      ctx.beginPath();
      ctx.arc(0, 0, u.r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(meta.color, 0.7);
      ctx.lineWidth = 2;
      ctx.stroke();

      // body
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, u.r);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.4, meta.color);
      g.addColorStop(1, rgba(meta.color, 0.5));
      ctx.beginPath();
      ctx.arc(0, 0, u.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();

      // icon
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = "700 11px 'Outfit', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(meta.icon, 0, 0.5);

      ctx.restore();
    }
  }

  _drawReadyHint(ctx) {
    if (this.state !== "ready") return;
    const has = this.balls.some((b) => b.attached);
    if (!has) return;

    const t = now() / 1000;
    const a = 0.45 + 0.25 * Math.sin(t * 3);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.white;
    ctx.font = "500 15px 'Outfit', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Clique ou Espaço para lançar", W / 2, H - 88);

    // aim ghost
    const ball = this.balls.find((b) => b.attached);
    if (ball) {
      const offset = (ball.x - this.paddle.x) / (this.paddle.w / 2);
      const angle = clamp(offset, -0.85, 0.85) * 0.9;
      const len = 70;
      const ax = Math.sin(angle) * len;
      const ay = -Math.cos(angle) * len;
      ctx.strokeStyle = rgba(C.cyan, 0.35);
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + ax, ball.y + ay);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawVignetteFX(ctx) {
    // bottom danger zone soft
    const g = ctx.createLinearGradient(0, H - 80, 0, H);
    g.addColorStop(0, "transparent");
    g.addColorStop(1, "rgba(255, 93, 122, 0.06)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 80, W, 80);
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

// Boot
new Game();
