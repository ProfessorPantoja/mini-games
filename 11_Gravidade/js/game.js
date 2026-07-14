/**
 * Gravidade — pinte campos vetoriais (versão legível + paint confiável)
 */
import { audio } from "./audio.js";

const W = 960, H = 640;
const STORAGE = "gravidade.best.v1";
const COLS = 20, ROWS = 12;
const CW = W / COLS, CH = H / ROWS;
const DIR = {
  none: { x: 0, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DIR_COLOR = {
  up: "#56d6ff",
  down: "#8b7cff",
  left: "#ff6bcb",
  right: "#ffc857",
};
const STRENGTH = 1100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

const LEVELS = [
  {
    ink: 50,
    spawn: { c: 1, r: 5 },
    goal: { c: 17, r: 5 },
    walls: [{ c: 9, r: 2, w: 2, h: 8 }],
    hazards: [],
    launch: { vx: 160, vy: 0 },
  },
  {
    ink: 55,
    spawn: { c: 1, r: 9 },
    goal: { c: 17, r: 2 },
    walls: [{ c: 6, r: 5, w: 8, h: 1 }, { c: 10, r: 1, w: 1, h: 5 }],
    hazards: [{ c: 13, r: 8, w: 2, h: 1 }],
    launch: { vx: 100, vy: -60 },
  },
  {
    ink: 60,
    spawn: { c: 1, r: 1 },
    goal: { c: 17, r: 9 },
    walls: [
      { c: 4, r: 0, w: 1, h: 8 },
      { c: 8, r: 4, w: 1, h: 8 },
      { c: 12, r: 0, w: 1, h: 8 },
    ],
    hazards: [{ c: 6, r: 9, w: 1, h: 1 }],
    launch: { vx: 90, vy: 40 },
  },
  {
    ink: 55,
    spawn: { c: 9, r: 10 },
    goal: { c: 9, r: 1 },
    walls: [
      { c: 4, r: 4, w: 12, h: 1 },
      { c: 4, r: 7, w: 12, h: 1 },
      { c: 4, r: 4, w: 1, h: 4 },
      { c: 15, r: 4, w: 1, h: 4 },
    ],
    hazards: [],
    launch: { vx: 0, vy: -120 },
  },
  {
    ink: 65,
    spawn: { c: 1, r: 5 },
    goal: { c: 17, r: 5 },
    walls: [
      { c: 5, r: 2, w: 1, h: 8 },
      { c: 9, r: 0, w: 1, h: 5 },
      { c: 9, r: 7, w: 1, h: 5 },
      { c: 13, r: 2, w: 1, h: 8 },
    ],
    hazards: [{ c: 7, r: 5, w: 1, h: 1 }, { c: 11, r: 5, w: 1, h: 1 }],
    launch: { vx: 110, vy: 0 },
  },
  {
    ink: 70,
    spawn: { c: 1, r: 1 },
    goal: { c: 17, r: 10 },
    walls: [
      { c: 3, r: 3, w: 5, h: 1 },
      { c: 8, r: 6, w: 5, h: 1 },
      { c: 3, r: 8, w: 5, h: 1 },
      { c: 12, r: 2, w: 1, h: 7 },
    ],
    hazards: [{ c: 6, r: 10, w: 2, h: 1 }],
    launch: { vx: 80, vy: 50 },
  },
  {
    ink: 60,
    spawn: { c: 9, r: 5 },
    goal: { c: 17, r: 1 },
    walls: [
      { c: 3, r: 2, w: 12, h: 1 },
      { c: 3, r: 9, w: 12, h: 1 },
      { c: 3, r: 2, w: 1, h: 8 },
      { c: 14, r: 2, w: 1, h: 8 },
      { c: 7, r: 5, w: 4, h: 1 },
    ],
    hazards: [{ c: 9, r: 7, w: 1, h: 1 }],
    launch: { vx: 140, vy: -20 },
  },
  {
    ink: 75,
    spawn: { c: 1, r: 10 },
    goal: { c: 17, r: 1 },
    walls: [
      { c: 3, r: 1, w: 1, h: 9 },
      { c: 6, r: 0, w: 1, h: 9 },
      { c: 9, r: 3, w: 1, h: 9 },
      { c: 12, r: 0, w: 1, h: 9 },
      { c: 15, r: 2, w: 1, h: 8 },
    ],
    hazards: [
      { c: 4, r: 10, w: 1, h: 1 },
      { c: 7, r: 1, w: 1, h: 1 },
      { c: 10, r: 10, w: 1, h: 1 },
    ],
    launch: { vx: 70, vy: -90 },
  },
];

function cellCenter(c, r) {
  return { x: (c + 0.5) * CW, y: (r + 0.5) * CH };
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "title";
    this.levelIndex = 0;
    this.score = 0;
    this.best = Number(localStorage.getItem(STORAGE) || 0);
    this.dir = "right";
    this.grid = [];
    this.inkLeft = 0;
    this.inkMax = 0;
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: 12 };
    this.trail = [];
    this.particles = [];
    this.time = 0;
    this.simTime = 0;
    this.shake = 0;
    this.painting = false;
    this.hover = { c: -1, r: -1 };
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
    const s = cellCenter(L.spawn.c, L.spawn.r);
    this.ball.x = s.x;
    this.ball.y = s.y;
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
    const s = cellCenter(this.level.spawn.c, this.level.spawn.r);
    this.ball.x = s.x;
    this.ball.y = s.y;
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

  _local(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top) * (H / r.height),
    };
  }

  _cellFrom(x, y) {
    return {
      c: clamp(Math.floor(x / CW), 0, COLS - 1),
      r: clamp(Math.floor(y / CH), 0, ROWS - 1),
    };
  }

  _blockedCell(c, r) {
    for (const w of this.level.walls) {
      if (c >= w.c && c < w.c + w.w && r >= w.r && r < w.r + w.h) return true;
    }
    for (const h of this.level.hazards) {
      if (c >= h.c && c < h.c + h.w && r >= h.r && r < h.r + h.h) return true;
    }
    // don't paint spawn/goal centers
    if (c === this.level.spawn.c && r === this.level.spawn.r) return true;
    if (c === this.level.goal.c && r === this.level.goal.r) return true;
    return false;
  }

  _paintAt(x, y) {
    if (this.state !== "paint") return;
    const { c, r } = this._cellFrom(x, y);
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
        this.emit("toast", "Sem tinta!");
        return;
      }
      this.inkLeft--;
    }
    this.grid[r][c] = this.dir;
    audio.paint();
    this.emit("hud");
  }

  _bind() {
    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.state !== "paint") return;
      e.preventDefault();
      this.painting = true;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      const p = this._local(e);
      this._paintAt(p.x, p.y);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      const p = this._local(e);
      this.hover = this._cellFrom(p.x, p.y);
      if (!this.painting || this.state !== "paint") return;
      this._paintAt(p.x, p.y);
    });
    const up = () => { this.painting = false; };
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
    this.canvas.addEventListener("pointerleave", () => { this.hover = { c: -1, r: -1 }; });

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

  _fieldAt(x, y) {
    const c = clamp(Math.floor(x / CW), 0, COLS - 1);
    const r = clamp(Math.floor(y / CH), 0, ROWS - 1);
    let fx = 0, fy = 0, wsum = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
        const d = this.grid[rr][cc];
        if (d === "none") continue;
        const cx = (cc + 0.5) * CW, cy = (rr + 0.5) * CH;
        const dist2 = (x - cx) ** 2 + (y - cy) ** 2 + 80;
        const w = 1 / dist2;
        const v = DIR[d];
        fx += v.x * w;
        fy += v.y * w;
        wsum += w;
      }
    }
    // gravidade natural fraca se não houver tinta
    if (wsum <= 0) return { x: 0, y: 0.25 };
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
      this.ball.vx *= 0.996;
      this.ball.vy *= 0.996;
      const sp = Math.hypot(this.ball.vx, this.ball.vy);
      if (sp > 560) {
        this.ball.vx = (this.ball.vx / sp) * 560;
        this.ball.vy = (this.ball.vy / sp) * 560;
      }
      this.ball.x += this.ball.vx * sdt;
      this.ball.y += this.ball.vy * sdt;

      for (const w of this.level.walls) {
        this._ballRect(this.ball, {
          x: w.c * CW, y: w.r * CH, w: w.w * CW, h: w.h * CH,
        });
      }
      for (const h of this.level.hazards) {
        const rect = { x: h.c * CW, y: h.r * CH, w: h.w * CW, h: h.h * CH };
        if (this._ballHits(this.ball, rect)) {
          this._fail("Campo hostil!");
          return;
        }
      }
      if (this.ball.x < this.ball.r) { this.ball.x = this.ball.r; this.ball.vx *= -0.45; }
      if (this.ball.x > W - this.ball.r) { this.ball.x = W - this.ball.r; this.ball.vx *= -0.45; }
      if (this.ball.y < this.ball.r) { this.ball.y = this.ball.r; this.ball.vy *= -0.45; }
      if (this.ball.y > H - this.ball.r) { this.ball.y = H - this.ball.r; this.ball.vy *= -0.45; }
    }

    this.trail.push({ x: this.ball.x, y: this.ball.y, life: 0.55 });
    this.trail = this.trail.filter((t) => { t.life -= dt; return t.life > 0; });

    const g = cellCenter(this.level.goal.c, this.level.goal.r);
    if (dist(this.ball.x, this.ball.y, g.x, g.y) < 30) {
      this._win();
      return;
    }
    if (this.simTime > 18) this._fail("Tempo esgotado no vácuo.");
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
        b.vx -= 1.5 * vn * nx;
        b.vy -= 1.5 * vn * ny;
      }
    }
  }

  _win() {
    const inkBonus = this.inkLeft * 12;
    const timeBonus = Math.max(0, Math.floor((18 - this.simTime) * 25));
    const bonus = 350 + inkBonus + timeBonus + this.levelIndex * 70;
    this.score += bonus;
    audio.goal();
    this.shake = 10;
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
    this.state = "over";
    this.emit("state", { title: "Colapso", msg });
    this.emit("hud");
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    // fundo bem contrastado
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0e1528");
    bg.addColorStop(1, "#15102a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // grade SEMPRE visível
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * CW, y = r * CH;
        const blocked = this._blockedCell(c, r);
        const d = this.grid[r][c];

        if (!blocked) {
          // célula vazia — borda clara
          ctx.fillStyle = "rgba(30, 40, 70, 0.55)";
          ctx.fillRect(x + 1, y + 1, CW - 2, CH - 2);
          ctx.strokeStyle = "rgba(160, 180, 230, 0.22)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1.5, y + 1.5, CW - 3, CH - 3);
        }

        if (d !== "none") {
          const col = DIR_COLOR[d];
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(x + 2, y + 2, CW - 4, CH - 4);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3, y + 3, CW - 6, CH - 6);
          this._arrow(ctx, x + CW / 2, y + CH / 2, d, "#fff");
        }
      }
    }

    // hover preview
    if (this.state === "paint" && this.hover.c >= 0 && !this._blockedCell(this.hover.c, this.hover.r)) {
      const x = this.hover.c * CW, y = this.hover.r * CH;
      const col = this.dir === "erase" ? "#ff5d7a" : (DIR_COLOR[this.dir] || "#fff");
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, CW - 4, CH - 4);
      if (this.dir !== "erase") {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = col;
        ctx.fillRect(x + 2, y + 2, CW - 4, CH - 4);
        ctx.globalAlpha = 1;
        this._arrow(ctx, x + CW / 2, y + CH / 2, this.dir, col);
      }
    }

    // paredes
    for (const w of this.level.walls) {
      ctx.fillStyle = "#2a3548";
      ctx.strokeStyle = "#6a8cff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(w.c * CW + 2, w.r * CH + 2, w.w * CW - 4, w.h * CH - 4, 6);
      ctx.fill();
      ctx.stroke();
    }
    // perigos
    for (const h of this.level.hazards) {
      ctx.fillStyle = "#ff5d7a";
      ctx.shadowColor = "#ff5d7a";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.roundRect(h.c * CW + 2, h.r * CH + 2, h.w * CW - 4, h.h * CH - 4, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", (h.c + h.w / 2) * CW, (h.r + h.h / 2) * CH);
    }

    // portal (goal)
    const g = cellCenter(this.level.goal.c, this.level.goal.r);
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(this.time * 1.4);
    ctx.strokeStyle = "#7dffb3";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#7dffb3";
    ctx.shadowBlur = 18;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 28 - i * 7, (28 - i * 7) * 0.6, i * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#7dffb3";
    ctx.font = "700 13px Outfit,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PORTAL", g.x, g.y + 42);

    // spawn
    const sp = cellCenter(this.level.spawn.c, this.level.spawn.r);
    ctx.strokeStyle = "#56d6ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#56d6ff";
    ctx.font = "700 12px Outfit,sans-serif";
    ctx.fillText("INÍCIO", sp.x, sp.y + 36);
    // seta de lançamento
    if (this.state === "paint") {
      ctx.strokeStyle = "#ffc857";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x + this.level.launch.vx * 0.4, sp.y + this.level.launch.vy * 0.4);
      ctx.stroke();
    }

    // trail + bola
    for (const t of this.trail) {
      ctx.fillStyle = `rgba(139,124,255,${t.life})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3 + t.life * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const showBall = this.state === "sim" || this.state === "win" || this.state === "over" || this.state === "pause";
    const bx = showBall ? this.ball.x : sp.x;
    const by = showBall ? this.ball.y : sp.y;
    const grd = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, 12);
    grd.addColorStop(0, "#fff");
    grd.addColorStop(0.4, "#56d6ff");
    grd.addColorStop(1, "#2a4a80");
    ctx.fillStyle = grd;
    ctx.shadowColor = "#56d6ff";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(bx, by, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // instrução grande
    if (this.state === "paint") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, H - 48, W, 48);
      ctx.fillStyle = "#eef2ff";
      ctx.font = "700 16px Outfit,sans-serif";
      ctx.textAlign = "center";
      const dirLabel = this.dir === "erase" ? "APAGAR" : this.dir.toUpperCase();
      ctx.fillText(`Arraste no grid para pintar (${dirLabel}) · Espaço = Lançar · tinta: ${this.inkLeft}`, W / 2, H - 20);
    }

    ctx.restore();
  }

  _arrow(ctx, x, y, dir, color) {
    const ang = dir === "up" ? -Math.PI / 2 : dir === "down" ? Math.PI / 2 : dir === "left" ? Math.PI : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export const TOTAL_LEVELS = LEVELS.length;
