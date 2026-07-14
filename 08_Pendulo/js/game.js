/**
 * Pêndulo — física de pêndulo + lançamento parabólico
 * 8 níveis · estrelas · plataformas · juice
 */
import { audio } from "./audio.js";

const W = 960;
const H = 640;
const STORAGE = "pendulo.best.v1";
const G = 1650;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

const LEVELS = [
  {
    anchor: { x: 220, y: 70 }, len: 210,
    goal: { x: 720, y: 520, w: 140, h: 18 },
    platforms: [{ x: 520, y: 400, w: 100, h: 14 }],
    stars: [{ x: 480, y: 280 }, { x: 600, y: 340 }],
    hazards: [],
  },
  {
    anchor: { x: 180, y: 80 }, len: 200,
    goal: { x: 760, y: 480, w: 120, h: 18 },
    platforms: [{ x: 430, y: 360, w: 90, h: 14 }, { x: 600, y: 430, w: 80, h: 14 }],
    stars: [{ x: 400, y: 250 }, { x: 540, y: 300 }, { x: 700, y: 360 }],
    hazards: [{ x: 500, y: 500, w: 60, h: 16 }],
  },
  {
    anchor: { x: 260, y: 60 }, len: 240,
    goal: { x: 780, y: 300, w: 110, h: 18 },
    platforms: [{ x: 500, y: 480, w: 120, h: 14 }, { x: 680, y: 400, w: 70, h: 14 }],
    stars: [{ x: 420, y: 320 }, { x: 620, y: 280 }, { x: 740, y: 220 }],
    hazards: [{ x: 560, y: 360, w: 50, h: 14 }, { x: 700, y: 520, w: 80, h: 14 }],
  },
  {
    anchor: { x: 140, y: 90 }, len: 190,
    goal: { x: 800, y: 540, w: 100, h: 18 },
    platforms: [
      { x: 360, y: 300, w: 70, h: 14 },
      { x: 500, y: 380, w: 70, h: 14 },
      { x: 640, y: 460, w: 70, h: 14 },
    ],
    stars: [{ x: 340, y: 220 }, { x: 480, y: 300 }, { x: 620, y: 380 }, { x: 760, y: 460 }],
    hazards: [{ x: 420, y: 500, w: 200, h: 14 }],
  },
  {
    anchor: { x: 300, y: 50 }, len: 260,
    goal: { x: 120, y: 500, w: 120, h: 18 },
    platforms: [{ x: 520, y: 280, w: 90, h: 14 }, { x: 300, y: 400, w: 80, h: 14 }],
    stars: [{ x: 500, y: 180 }, { x: 380, y: 300 }, { x: 220, y: 400 }],
    hazards: [{ x: 400, y: 520, w: 300, h: 14 }],
  },
  {
    anchor: { x: 200, y: 70 }, len: 180,
    goal: { x: 820, y: 200, w: 90, h: 18 },
    platforms: [
      { x: 400, y: 500, w: 100, h: 14 },
      { x: 560, y: 400, w: 80, h: 14 },
      { x: 700, y: 300, w: 70, h: 14 },
    ],
    stars: [{ x: 450, y: 400 }, { x: 620, y: 320 }, { x: 760, y: 230 }],
    hazards: [{ x: 480, y: 280, w: 40, h: 200 }, { x: 650, y: 450, w: 120, h: 14 }],
  },
  {
    anchor: { x: 480, y: 50 }, len: 200,
    goal: { x: 480, y: 560, w: 100, h: 18 },
    platforms: [
      { x: 300, y: 280, w: 70, h: 14 },
      { x: 660, y: 280, w: 70, h: 14 },
      { x: 360, y: 420, w: 60, h: 14 },
      { x: 600, y: 420, w: 60, h: 14 },
    ],
    stars: [{ x: 300, y: 200 }, { x: 660, y: 200 }, { x: 480, y: 360 }, { x: 480, y: 480 }],
    hazards: [{ x: 200, y: 500, w: 160, h: 14 }, { x: 600, y: 500, w: 160, h: 14 }],
  },
  {
    anchor: { x: 160, y: 60 }, len: 220,
    goal: { x: 840, y: 520, w: 80, h: 16 },
    platforms: [
      { x: 380, y: 320, w: 50, h: 12 },
      { x: 520, y: 260, w: 50, h: 12 },
      { x: 660, y: 340, w: 50, h: 12 },
      { x: 760, y: 440, w: 50, h: 12 },
    ],
    stars: [{ x: 360, y: 230 }, { x: 520, y: 180 }, { x: 660, y: 250 }, { x: 780, y: 360 }, { x: 840, y: 450 }],
    hazards: [
      { x: 300, y: 480, w: 220, h: 14 },
      { x: 560, y: 520, w: 180, h: 14 },
      { x: 450, y: 180, w: 30, h: 120 },
    ],
  },
];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "title"; // title | playing | flying | landed | dead | pause | win | over
    this.levelIndex = 0;
    this.score = 0;
    this.best = Number(localStorage.getItem(STORAGE) || 0);
    this.tries = 3;
    this.particles = [];
    this.trail = [];
    this.shake = 0;
    this.flash = 0;
    this.time = 0;
    this.listeners = {};
    this._bindInput();
    this.resetLevel(false);
  }

  on(evt, fn) {
    (this.listeners[evt] ||= []).push(fn);
  }
  emit(evt, data) {
    (this.listeners[evt] || []).forEach((fn) => fn(data));
  }

  resetLevel(keepScore = true) {
    const L = LEVELS[this.levelIndex];
    this.level = structuredClone(L);
    this.anchor = { ...L.anchor };
    this.len = L.len;
    this.theta = -0.95; // rad from vertical
    this.omega = 0;
    this.mode = "swing"; // swing | fly
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: 16 };
    this.stars = L.stars.map((s) => ({ ...s, taken: false }));
    this.collected = 0;
    this.trail = [];
    this.landedSoft = false;
    this._syncBallFromPendulum();
    if (!keepScore) {
      this.score = 0;
      this.tries = 3;
    }
    this.emit("hud");
  }

  startGame() {
    audio.unlock();
    this.levelIndex = 0;
    this.score = 0;
    this.tries = 3;
    this.state = "playing";
    this.resetLevel(false);
    this.emit("hud");
    this.emit("state");
  }

  pause() {
    if (this.state !== "playing" && this.state !== "flying") return;
    this.prevState = this.state;
    this.state = "pause";
    this.emit("state");
  }

  resume() {
    if (this.state !== "pause") return;
    this.state = this.prevState || "playing";
    this.emit("state");
  }

  toMenu() {
    this.state = "title";
    this.emit("state");
    this.emit("hud");
  }

  nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.state = "over";
      this.emit("state", { title: "Campanha completa!", msg: `Você dominou o pêndulo. Pontuação final: ${this.score}` });
      return;
    }
    this.levelIndex++;
    this.state = "playing";
    this.resetLevel(true);
    this.emit("state");
  }

  _bindInput() {
    const release = (e) => {
      e?.preventDefault?.();
      if (this.state === "playing" && this.mode === "swing") this.release();
    };
    this.canvas.addEventListener("pointerdown", release);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (this.state === "title") this.startGame();
        else if (this.state === "playing" && this.mode === "swing") this.release();
        else if (this.state === "pause") this.resume();
        else if (this.state === "win") this.nextLevel();
        else if (this.state === "over") this.startGame();
      }
      if (e.code === "Escape") {
        if (this.state === "playing" || this.state === "flying") this.pause();
        else if (this.state === "pause") this.resume();
      }
      if (e.code === "KeyR" && (this.state === "playing" || this.state === "flying")) {
        this.resetLevel(true);
      }
    });
  }

  release() {
    if (this.mode !== "swing") return;
    // Velocity tangential: v = ω * L, direction perpendicular to rope
    const vx = this.omega * this.len * Math.cos(this.theta);
    const vy = this.omega * this.len * Math.sin(this.theta);
    this.ball.vx = vx;
    this.ball.vy = vy;
    this.mode = "fly";
    this.state = "flying";
    audio.release();
    this.shake = 6;
    this.flash = 0.25;
    this._burst(this.ball.x, this.ball.y, "#56d6ff", 14);
    this.emit("toast", "Soltou!");
    this.emit("hud");
  }

  _syncBallFromPendulum() {
    this.ball.x = this.anchor.x + Math.sin(this.theta) * this.len;
    this.ball.y = this.anchor.y + Math.cos(this.theta) * this.len;
  }

  _burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 180;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5, max: 0.9, r: 2 + Math.random() * 3, color,
      });
    }
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 20);
    this.flash = Math.max(0, this.flash - dt);
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      return p.life > 0;
    });

    if (this.state !== "playing" && this.state !== "flying") return;

    if (this.mode === "swing") {
      // θ'' = -(g/L) sin(θ) - c θ'
      const damp = 0.08;
      const alpha = -(G / this.len) * Math.sin(this.theta) - damp * this.omega;
      this.omega += alpha * dt;
      this.theta += this.omega * dt;
      // Soft push to keep swinging interesting
      if (Math.abs(this.omega) < 0.4 && Math.abs(this.theta) < 0.15) {
        this.omega += (this.theta >= 0 ? 1 : -1) * 1.8 * dt;
      }
      this._syncBallFromPendulum();
      if (Math.random() < 0.02) audio.swing();
    } else if (this.mode === "fly") {
      this.ball.vy += G * dt;
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;
      this.trail.push({ x: this.ball.x, y: this.ball.y, life: 0.45 });
      this.trail = this.trail.filter((t) => {
        t.life -= dt;
        return t.life > 0;
      });

      // Stars
      for (const s of this.stars) {
        if (s.taken) continue;
        if (dist(this.ball.x, this.ball.y, s.x, s.y) < this.ball.r + 14) {
          s.taken = true;
          this.collected++;
          this.score += 100;
          audio.star();
          this._burst(s.x, s.y, "#ffc857", 12);
          this.emit("toast", "+100 estrela");
          this.emit("hud");
        }
      }

      // Hazards
      for (const h of this.level.hazards) {
        if (this._circleRect(this.ball, h)) {
          this._die("Espinhos!");
          return;
        }
      }

      // Platforms (landing if falling onto top)
      for (const p of this.level.platforms) {
        if (this._landOn(this.ball, p)) {
          this.ball.y = p.y - this.ball.r;
          this.ball.vy *= -0.35;
          this.ball.vx *= 0.75;
          if (Math.abs(this.ball.vy) < 80) this.ball.vy = 0;
          audio.land();
          this._burst(this.ball.x, this.ball.y, "#8b7cff", 8);
        }
      }

      // Goal
      const g = this.level.goal;
      if (this._landOn(this.ball, g) || this._circleRect(this.ball, g)) {
        this._win();
        return;
      }

      // Bounds
      if (this.ball.y > H + 40 || this.ball.x < -40 || this.ball.x > W + 40) {
        this._die("Fora do mapa");
      }
    }
  }

  _circleRect(c, r) {
    const cx = clamp(c.x, r.x, r.x + r.w);
    const cy = clamp(c.y, r.y, r.y + r.h);
    return dist(c.x, c.y, cx, cy) < c.r;
  }

  _landOn(c, p) {
    const onX = c.x > p.x - 2 && c.x < p.x + p.w + 2;
    const top = p.y;
    const prevBottom = c.y - c.vy * 0.016 - c.r;
    const nowBottom = c.y + c.r;
    return onX && c.vy >= 0 && prevBottom <= top + 4 && nowBottom >= top && c.y < p.y + p.h + c.r;
  }

  _die(reason) {
    this.tries--;
    audio.fail();
    this.shake = 12;
    this._burst(this.ball.x, this.ball.y, "#ff5d7a", 20);
    if (this.tries <= 0) {
      this.state = "over";
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem(STORAGE, String(this.best));
      }
      this.emit("state", { title: "Sem tentativas", msg: `${reason}. Pontuação: ${this.score}` });
    } else {
      this.state = "playing";
      this.mode = "swing";
      this.resetLevel(true);
      this.emit("toast", `${reason} · restam ${this.tries}`);
      this.emit("hud");
      this.emit("state");
    }
  }

  _win() {
    const bonus = 250 + this.collected * 50 + Math.max(0, 3 - (3 - this.tries)) * 20;
    const levelBonus = 200 + this.levelIndex * 50;
    const total = levelBonus + this.collected * 100;
    // stars already added; add level clear
    this.score += levelBonus;
    audio.win();
    this.shake = 8;
    this.flash = 0.4;
    this._burst(this.ball.x, this.ball.y, "#7dffb3", 24);
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE, String(this.best));
    }
    this.state = "win";
    this.emit("hud");
    this.emit("state", {
      title: this.levelIndex >= LEVELS.length - 1 ? "Lenda do pêndulo!" : "Aterrissagem perfeita!",
      msg: `Estrelas ${this.collected}/${this.stars.length}`,
      score: this.score,
      bonus: levelBonus,
    });
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    // shake
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b1224");
    bg.addColorStop(1, "#12102a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = "rgba(86,214,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // predicted arc when swinging
    if (this.mode === "swing" && (this.state === "playing" || this.state === "flying")) {
      this._drawPrediction(ctx);
    }

    // platforms
    for (const p of this.level.platforms) this._plat(ctx, p, "#8b7cff", "#b8afff");
    // hazards
    for (const h of this.level.hazards) this._hazard(ctx, h);
    // goal
    this._plat(ctx, this.level.goal, "#ffc857", "#ffe29a", true);

    // stars
    for (const s of this.stars) {
      if (s.taken) continue;
      this._star(ctx, s.x, s.y, 10 + Math.sin(this.time * 6 + s.x) * 1.5);
    }

    // rope + anchor
    if (this.mode === "swing") {
      ctx.strokeStyle = "rgba(86,214,255,0.85)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.anchor.x, this.anchor.y);
      ctx.lineTo(this.ball.x, this.ball.y);
      ctx.stroke();
      // glow rope
      ctx.strokeStyle = "rgba(86,214,255,0.2)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(this.anchor.x, this.anchor.y);
      ctx.lineTo(this.ball.x, this.ball.y);
      ctx.stroke();
    }

    // anchor
    ctx.fillStyle = "#ffc857";
    ctx.beginPath();
    ctx.arc(this.anchor.x, this.anchor.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // trail
    for (const t of this.trail) {
      ctx.fillStyle = `rgba(255,107,203,${t.life})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4 * t.life + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // ball
    const grd = ctx.createRadialGradient(
      this.ball.x - 5, this.ball.y - 5, 2,
      this.ball.x, this.ball.y, this.ball.r
    );
    grd.addColorStop(0, "#fff");
    grd.addColorStop(0.35, "#ff6bcb");
    grd.addColorStop(1, "#8b1e5a");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    // hint
    if (this.mode === "swing" && this.state === "playing") {
      ctx.fillStyle = "rgba(238,242,255,0.55)";
      ctx.font = "600 16px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Toque / Espaço para soltar no auge", W / 2, H - 24);
    }

    ctx.restore();
  }

  _drawPrediction(ctx) {
    let x = this.ball.x;
    let y = this.ball.y;
    let vx = this.omega * this.len * Math.cos(this.theta);
    let vy = this.omega * this.len * Math.sin(this.theta);
    ctx.strokeStyle = "rgba(255,200,87,0.35)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const step = 1 / 50;
    for (let i = 0; i < 90; i++) {
      vy += G * step;
      x += vx * step;
      y += vy * step;
      ctx.lineTo(x, y);
      if (y > H || x < 0 || x > W) break;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _plat(ctx, p, main, edge, goal = false) {
    ctx.save();
    ctx.shadowColor = main;
    ctx.shadowBlur = goal ? 18 : 8;
    const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    g.addColorStop(0, edge);
    g.addColorStop(1, main);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, 6);
    ctx.fill();
    if (goal) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(p.x + 8, p.y + 3, p.w - 16, 3);
    }
    ctx.restore();
  }

  _hazard(ctx, h) {
    ctx.fillStyle = "#ff5d7a";
    ctx.shadowColor = "#ff5d7a";
    ctx.shadowBlur = 10;
    ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.shadowBlur = 0;
    const spikes = Math.max(2, Math.floor(h.w / 14));
    ctx.fillStyle = "#ff8fa3";
    for (let i = 0; i < spikes; i++) {
      const sx = h.x + (i + 0.5) * (h.w / spikes);
      ctx.beginPath();
      ctx.moveTo(sx - 6, h.y);
      ctx.lineTo(sx, h.y - 12);
      ctx.lineTo(sx + 6, h.y);
      ctx.fill();
    }
  }

  _star(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.time * 1.5);
    ctx.fillStyle = "#ffc857";
    ctx.shadowColor = "#ffc857";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export const TOTAL_LEVELS = LEVELS.length;
