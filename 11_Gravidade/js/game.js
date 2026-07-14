/**
 * Gravidade — pinte campos vetoriais e lance a partícula
 */
import { audio } from "./audio.js";

const W = 960, H = 640;
const STORAGE = "gravidade.best.v1";
const COLS = 24, ROWS = 16;
const CW = W / COLS, CH = H / ROWS;
const DIR = {
  none: { x: 0, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const STRENGTH = 920;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

const LEVELS = [
  {
    ink: 40,
    spawn: { x: 3.5 * CW, y: 8 * CH },
    goal: { x: 20 * CW, y: 8 * CH, r: 28 },
    walls: [{ c: 11, r: 4, w: 2, h: 8 }],
    hazards: [],
    launch: { vx: 120, vy: 0 },
  },
  {
    ink: 45,
    spawn: { x: 2.5 * CW, y: 13 * CH },
    goal: { x: 21 * CW, y: 3 * CH, r: 28 },
    walls: [{ c: 8, r: 6, w: 8, h: 2 }, { c: 12, r: 2, w: 2, h: 6 }],
    hazards: [{ c: 16, r: 10, w: 3, h: 2 }],
    launch: { vx: 80, vy: -40 },
  },
  {
    ink: 50,
    spawn: { x: 2 * CW, y: 2.5 * CH },
    goal: { x: 21.5 * CW, y: 13 * CH, r: 26 },
    walls: [
      { c: 5, r: 0, w: 1, h: 10 },
      { c: 10, r: 6, w: 1, h: 10 },
      { c: 15, r: 0, w: 1, h: 10 },
    ],
    hazards: [{ c: 7, r: 12, w: 2, h: 2 }],
    launch: { vx: 100, vy: 40 },
  },
  {
    ink: 48,
    spawn: { x: 12 * CW, y: 13 * CH },
    goal: { x: 12 * CW, y: 2.5 * CH, r: 28 },
    walls: [
      { c: 6, r: 5, w: 12, h: 1 },
      { c: 6, r: 9, w: 12, h: 1 },
      { c: 6, r: 5, w: 1, h: 5 },
      { c: 17, r: 5, w: 1, h: 5 },
    ],
    hazards: [],
    launch: { vx: 0, vy: -100 },
  },
  {
    ink: 55,
    spawn: { x: 2 * CW, y: 8 * CH },
    goal: { x: 21 * CW, y: 8 * CH, r: 26 },
    walls: [
      { c: 6, r: 3, w: 2, h: 10 },
      { c: 11, r: 1, w: 2, h: 6 },
      { c: 11, r: 9, w: 2, h: 6 },
      { c: 16, r: 3, w: 2, h: 10 },
    ],
    hazards: [{ c: 9, r: 7, w: 1, h: 2 }, { c: 14, r: 7, w: 1, h: 2 }],
    launch: { vx: 90, vy: 0 },
  },
  {
    ink: 60,
    spawn: { x: 2.5 * CW, y: 2.5 * CH },
    goal: { x: 21 * CW, y: 13 * CH, r: 26 },
    walls: [
      { c: 4, r: 4, w: 6, h: 1 },
      { c: 10, r: 7, w: 6, h: 1 },
      { c: 4, r: 10, w: 6, h: 1 },
      { c: 14, r: 3, w: 1, h: 8 },
    ],
    hazards: [{ c: 8, r: 12, w: 3, h: 1 }, { c: 18, r: 6, w: 2, h: 2 }],
    launch: { vx: 70, vy: 50 },
  },
  {
    ink: 52,
    spawn: { x: 12 * CW, y: 8 * CH },
    goal: { x: 21.5 * CW, y: 2.5 * CH, r: 24 },
    walls: [
      { c: 5, r: 3, w: 14, h: 1 },
      { c: 5, r: 12, w: 14, h: 1 },
      { c: 5, r: 3, w: 1, h: 10 },
      { c: 18, r: 3, w: 1, h: 10 },
      { c: 9, r: 6, w: 6, h: 1 },
    ],
    hazards: [{ c: 11, r: 9, w: 2, h: 2 }],
    launch: { vx: 120, vy: -30 },
  },
  {
    ink: 65,
    spawn: { x: 2 * CW, y: 13 * CH },
    goal: { x: 21.5 * CW, y: 2 * CH, r: 24 },
    walls: [
      { c: 4, r: 2, w: 1, h: 12 },
      { c: 8, r: 0, w: 1, h: 12 },
      { c: 12, r: 4, w: 1, h: 12 },
      { c: 16, r: 0, w: 1, h: 12 },
      { c: 20, r: 3, w: 1, h: 10 },
    ],
    hazards: [
      { c: 6, r: 14, w: 2, h: 1 },
      { c: 10, r: 1, w: 2, h: 1 },
      { c: 14, r: 14, w: 2, h: 1 },
      { c: 18, r: 8, w: 1, h: 2 },
    ],
    launch: { vx: 60, vy: -80 },
  },
];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "title";
    this.levelIndex = 0;
    this.score = 0;
    this.best = Number(localStorage.getItem(STORAGE) || 0);
    this.dir = "down";
    this.grid = [];
    this.inkLeft = 0;
    this.inkMax = 0;
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: 11 };
    this.trail = [];
    this.particles = [];
    this.time = 0;
    this.simTime = 0;
    this.shake = 0;
    this.painting = false;
    this.listeners = {};
    this._bind();
  }

  on(e, fn) { (this.listeners[e] ||= []).push(fn); }
  emit(e, d) { (this.listeners[e] || []).forEach((f) => f(d)); }

  startGame() {
    audio.unlock();
    this.levelIndex = 0;
    this.score = 0;
    this.loadLevel();
    this.state = "paint";
    this.emit("state");
    this.emit("hud");
  }

  loadLevel() {
    const L = LEVELS[this.levelIndex];
    this.level = L;
    this.inkMax = L.ink;
    this.inkLeft = L.ink;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill("none"));
    this.ball.x = L.spawn.x;
    this.ball.y = L.spawn.y;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.trail = [];
    this.simTime = 0;
    this.emit("hud");
  }

  setDir(d) {
    this.dir = d;
    this.emit("hud");
  }

  clearPaint() {
    if (this.state !== "paint") return;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill("none"));
    this.inkLeft = this.inkMax;
    this.emit("hud");
    this.emit("toast", "Campo limpo");
  }

  launch() {
    if (this.state !== "paint") return;
    this.ball.x = this.level.spawn.x;
    this.ball.y = this.level.spawn.y;
    this.ball.vx = this.level.launch.vx;
    this.ball.vy = this.level.launch.vy;
    this.trail = [];
    this.simTime = 0;
    this.state = "sim";
    audio.launch();
    this.emit("toast", "Lançamento!");
    this.emit("hud");
    this.emit("state");
  }

  pause() {
    if (this.state !== "paint" && this.state !== "sim") return;
    this.prevState = this.state;
    this.state = "pause";
    this.emit("state");
  }
  resume() {
    if (this.state !== "pause") return;
    this.state = this.prevState || "paint";
    this.emit("state");
  }
  toMenu() {
    this.state = "title";
    this.emit("state");
  }
  nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.state = "over";
      this.emit("state", { title: "Senhor da gravidade!", msg: `Campanha completa · ${this.score} pts` });
      return;
    }
    this.levelIndex++;
    this.loadLevel();
    this.state = "paint";
    this.emit("state");
  }
  retryLevel() {
    this.loadLevel();
    this.state = "paint";
    this.emit("state");
  }

  _bind() {
    const local = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top) * (H / r.height),
      };
    };
    const paintAt = (x, y) => {
      if (this.state !== "paint") return;
      const c = clamp(Math.floor(x / CW), 0, COLS - 1);
      const r = clamp(Math.floor(y / CH), 0, ROWS - 1);
      if (this._blockedCell(c, r)) return;
      if (this.dir === "erase") {
        if (this.grid[r][c] !== "none") {
          this.grid[r][c] = "none";
          this.inkLeft = Math.min(this.inkMax, this.inkLeft + 1);
          audio.paint();
          this.emit("hud");
        }
        return;
      }
      if (this.grid[r][c] === this.dir) return;
      if (this.grid[r][c] === "none") {
        if (this.inkLeft <= 0) {
          this.emit("toast", "Sem tinta");
          return;
        }
        this.inkLeft--;
      }
      this.grid[r][c] = this.dir;
      audio.paint();
      this.emit("hud");
    };

    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.state !== "paint") return;
      this.painting = true;
      this.canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      paintAt(p.x, p.y);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.painting || this.state !== "paint") return;
      const p = local(e);
      paintAt(p.x, p.y);
    });
    const up = () => { this.painting = false; };
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (this.state === "paint") this.launch();
        else if (this.state === "title") this.startGame();
      }
      if (e.code === "Escape") {
        if (this.state === "paint" || this.state === "sim") this.pause();
        else if (this.state === "pause") this.resume();
      }
      if (e.code === "KeyR" && (this.state === "paint" || this.state === "sim")) this.retryLevel();
      if (e.code === "Digit1") this.setDir("down");
      if (e.code === "Digit2") this.setDir("up");
      if (e.code === "Digit3") this.setDir("left");
      if (e.code === "Digit4") this.setDir("right");
      if (e.code === "Digit5") this.setDir("erase");
    });
  }

  _blockedCell(c, r) {
    for (const w of this.level.walls) {
      if (c >= w.c && c < w.c + w.w && r >= w.r && r < w.r + w.h) return true;
    }
    for (const h of this.level.hazards) {
      if (c >= h.c && c < h.c + h.w && r >= h.r && r < h.r + h.h) return true;
    }
    return false;
  }

  _fieldAt(x, y) {
    const c = clamp(Math.floor(x / CW), 0, COLS - 1);
    const r = clamp(Math.floor(y / CH), 0, ROWS - 1);
    // bilinear-ish sample of neighboring cells
    let fx = 0, fy = 0, wsum = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
        const d = this.grid[rr][cc];
        if (d === "none") continue;
        const cx = (cc + 0.5) * CW, cy = (rr + 0.5) * CH;
        const dist2 = (x - cx) ** 2 + (y - cy) ** 2 + 40;
        const w = 1 / dist2;
        const v = DIR[d];
        fx += v.x * w;
        fy += v.y * w;
        wsum += w;
      }
    }
    if (wsum <= 0) return { x: 0, y: 0.15 }; // slight default down drift
    const inv = 1 / wsum;
    return { x: fx * inv, y: fy * inv };
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 18);
    this.particles = this.particles.filter((p) => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.life > 0;
    });
    if (this.state !== "sim") return;

    this.simTime += dt;
    const steps = 3;
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      const f = this._fieldAt(this.ball.x, this.ball.y);
      this.ball.vx += f.x * STRENGTH * sdt;
      this.ball.vy += f.y * STRENGTH * sdt;
      // drag
      this.ball.vx *= 0.995;
      this.ball.vy *= 0.995;
      // max speed
      const sp = Math.hypot(this.ball.vx, this.ball.vy);
      if (sp > 520) {
        this.ball.vx = (this.ball.vx / sp) * 520;
        this.ball.vy = (this.ball.vy / sp) * 520;
      }
      this.ball.x += this.ball.vx * sdt;
      this.ball.y += this.ball.vy * sdt;

      // walls as AABBs in cell space
      for (const w of this.level.walls) {
        const rect = { x: w.c * CW, y: w.r * CH, w: w.w * CW, h: w.h * CH };
        this._ballRect(this.ball, rect);
      }
      for (const h of this.level.hazards) {
        const rect = { x: h.c * CW, y: h.r * CH, w: h.w * CW, h: h.h * CH };
        if (this._ballHits(this.ball, rect)) {
          this._fail("Campo hostil!");
          return;
        }
      }
      // bounds
      if (this.ball.x < this.ball.r) { this.ball.x = this.ball.r; this.ball.vx *= -0.5; }
      if (this.ball.x > W - this.ball.r) { this.ball.x = W - this.ball.r; this.ball.vx *= -0.5; }
      if (this.ball.y < this.ball.r) { this.ball.y = this.ball.r; this.ball.vy *= -0.5; }
      if (this.ball.y > H - this.ball.r) { this.ball.y = H - this.ball.r; this.ball.vy *= -0.5; }
    }

    this.trail.push({ x: this.ball.x, y: this.ball.y, life: 0.6 });
    this.trail = this.trail.filter((t) => { t.life -= dt; return t.life > 0; });

    const g = this.level.goal;
    if (dist(this.ball.x, this.ball.y, g.x, g.y) < g.r - 2) {
      this._win();
      return;
    }
    if (this.simTime > 16) this._fail("Tempo esgotado no vácuo.");
  }

  _ballHits(b, r) {
    const cx = clamp(b.x, r.x, r.x + r.w);
    const cy = clamp(b.y, r.y, r.y + r.h);
    return dist(b.x, b.y, cx, cy) < b.r;
  }

  _ballRect(b, r) {
    const cx = clamp(b.x, r.x, r.x + r.w);
    const cy = clamp(b.y, r.y, r.y + r.h);
    const dx = b.x - cx, dy = b.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < b.r * b.r && d2 > 0) {
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      const pen = b.r - d;
      b.x += nx * pen;
      b.y += ny * pen;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= 1.4 * vn * nx;
        b.vy -= 1.4 * vn * ny;
      }
    } else if (b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h) {
      // stuck inside — push out
      const left = b.x - r.x, right = r.x + r.w - b.x;
      const top = b.y - r.y, bot = r.y + r.h - b.y;
      const m = Math.min(left, right, top, bot);
      if (m === left) b.x = r.x - b.r;
      else if (m === right) b.x = r.x + r.w + b.r;
      else if (m === top) b.y = r.y - b.r;
      else b.y = r.y + r.h + b.r;
    }
  }

  _win() {
    const inkBonus = this.inkLeft * 12;
    const timeBonus = Math.max(0, Math.floor((16 - this.simTime) * 25));
    const bonus = 350 + inkBonus + timeBonus + this.levelIndex * 70;
    this.score += bonus;
    audio.goal();
    this.shake = 10;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x: this.ball.x, y: this.ball.y,
        vx: Math.cos(a) * 200, vy: Math.sin(a) * 200,
        life: 0.6, color: "#8b7cff", r: 2 + Math.random() * 3,
      });
    }
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE, String(this.best));
    }
    this.state = "win";
    this.emit("state", {
      title: this.levelIndex >= LEVELS.length - 1 ? "Universo domado!" : "Portal alcançado!",
      msg: `Tinta restante: ${this.inkLeft} · tempo ${this.simTime.toFixed(1)}s`,
      score: this.score,
      bonus,
    });
    this.emit("hud");
  }

  _fail(msg) {
    audio.crash();
    this.shake = 12;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE, String(this.best));
    }
    // allow retry paint without full game over — more friendly
    this.state = "over";
    this.emit("state", { title: "Colapso", msg });
    this.emit("hud");
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b1020");
    bg.addColorStop(1, "#120a22");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // grid cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * CW, y = r * CH;
        const d = this.grid[r][c];
        if (d !== "none") {
          const col = d === "up" ? "rgba(86,214,255,0.22)"
            : d === "down" ? "rgba(139,124,255,0.22)"
            : d === "left" ? "rgba(255,107,203,0.2)"
            : "rgba(255,200,87,0.2)";
          ctx.fillStyle = col;
          ctx.fillRect(x + 1, y + 1, CW - 2, CH - 2);
          // arrow
          ctx.save();
          ctx.translate(x + CW / 2, y + CH / 2);
          const ang = d === "up" ? -Math.PI / 2 : d === "down" ? Math.PI / 2 : d === "left" ? Math.PI : 0;
          ctx.rotate(ang);
          ctx.fillStyle = "rgba(238,242,255,0.75)";
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(-6, -7);
          ctx.lineTo(-6, 7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.strokeStyle = "rgba(139,124,255,0.06)";
          ctx.strokeRect(x + 0.5, y + 0.5, CW - 1, CH - 1);
        }
      }
    }

    // walls
    for (const w of this.level.walls) {
      ctx.fillStyle = "#1c2740";
      ctx.strokeStyle = "rgba(86,214,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(w.c * CW + 2, w.r * CH + 2, w.w * CW - 4, w.h * CH - 4, 6);
      ctx.fill(); ctx.stroke();
    }
    // hazards
    for (const h of this.level.hazards) {
      ctx.fillStyle = "rgba(255,93,122,0.85)";
      ctx.shadowColor = "#ff5d7a";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(h.c * CW + 2, h.r * CH + 2, h.w * CW - 4, h.h * CH - 4, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // goal
    const g = this.level.goal;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(this.time * 1.5);
    ctx.strokeStyle = "#7dffb3";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#7dffb3";
    ctx.shadowBlur = 16;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, g.r - i * 7, (g.r - i * 7) * 0.6, i * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // spawn
    const sp = this.level.spawn;
    ctx.strokeStyle = "rgba(86,214,255,0.7)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // launch vector
    if (this.state === "paint") {
      ctx.strokeStyle = "rgba(255,200,87,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x + this.level.launch.vx * 0.35, sp.y + this.level.launch.vy * 0.35);
      ctx.stroke();
    }

    // trail
    for (const t of this.trail) {
      ctx.fillStyle = `rgba(139,124,255,${t.life})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3 + t.life * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ball
    if (this.state === "sim" || this.state === "win" || this.state === "over" || this.state === "pause") {
      const b = this.ball;
      const grd = ctx.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, b.r);
      grd.addColorStop(0, "#fff");
      grd.addColorStop(0.4, "#56d6ff");
      grd.addColorStop(1, "#2a4a80");
      ctx.fillStyle = grd;
      ctx.shadowColor = "#56d6ff";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // idle ball at spawn
      const b = this.level.spawn;
      ctx.fillStyle = "#56d6ff";
      ctx.shadowColor = "#56d6ff";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.state === "paint") {
      ctx.fillStyle = "rgba(238,242,255,0.4)";
      ctx.font = "600 15px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Pinte campos · Espaço ou ▶ para lançar", W / 2, H - 22);
    }

    ctx.restore();
  }
}

export const TOTAL_LEVELS = LEVELS.length;
