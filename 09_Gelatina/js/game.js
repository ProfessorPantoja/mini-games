/**
 * Gelatina — soft-body (verlet + springs) com arraste elástico
 */
import { audio } from "./audio.js";

const W = 960, H = 640;
const STORAGE = "gelatina.best.v1";
const G = 1400;
const N = 14; // surface points
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

const LEVELS = [
  {
    spawn: { x: 160, y: 420 },
    walls: [
      { x: 0, y: 560, w: 960, h: 80 },
      { x: 0, y: 0, w: 24, h: 640 },
      { x: 936, y: 0, w: 24, h: 640 },
      { x: 0, y: 0, w: 960, h: 24 },
      { x: 320, y: 420, w: 200, h: 24 },
    ],
    bouncers: [{ x: 560, y: 500, w: 120, h: 20 }],
    hazards: [{ x: 420, y: 536, w: 100, h: 20 }],
    orbs: [{ x: 400, y: 340 }, { x: 620, y: 420 }, { x: 780, y: 300 }],
    portal: { x: 820, y: 500, r: 34 },
  },
  {
    spawn: { x: 120, y: 200 },
    walls: [
      { x: 0, y: 560, w: 960, h: 80 }, { x: 0, y: 0, w: 24, h: 640 }, { x: 936, y: 0, w: 24, h: 640 }, { x: 0, y: 0, w: 960, h: 24 },
      { x: 200, y: 280, w: 280, h: 22 }, { x: 520, y: 400, w: 220, h: 22 }, { x: 280, y: 480, w: 160, h: 22 },
    ],
    bouncers: [{ x: 700, y: 520, w: 100, h: 18 }],
    hazards: [{ x: 400, y: 540, w: 140, h: 18 }, { x: 600, y: 300, w: 40, h: 100 }],
    orbs: [{ x: 300, y: 200 }, { x: 560, y: 320 }, { x: 760, y: 360 }, { x: 400, y: 420 }],
    portal: { x: 840, y: 480, r: 32 },
  },
  {
    spawn: { x: 480, y: 120 },
    walls: [
      { x: 0, y: 560, w: 960, h: 80 }, { x: 0, y: 0, w: 24, h: 640 }, { x: 936, y: 0, w: 24, h: 640 }, { x: 0, y: 0, w: 960, h: 24 },
      { x: 100, y: 220, w: 180, h: 20 }, { x: 680, y: 220, w: 180, h: 20 },
      { x: 300, y: 360, w: 360, h: 20 }, { x: 120, y: 460, w: 140, h: 20 }, { x: 700, y: 460, w: 140, h: 20 },
    ],
    bouncers: [{ x: 430, y: 520, w: 100, h: 18 }],
    hazards: [{ x: 250, y: 540, w: 80, h: 16 }, { x: 630, y: 540, w: 80, h: 16 }, { x: 460, y: 300, w: 40, h: 60 }],
    orbs: [{ x: 160, y: 160 }, { x: 800, y: 160 }, { x: 480, y: 280 }, { x: 200, y: 400 }, { x: 760, y: 400 }],
    portal: { x: 480, y: 500, r: 34 },
  },
  {
    spawn: { x: 100, y: 480 },
    walls: [
      { x: 0, y: 560, w: 960, h: 80 }, { x: 0, y: 0, w: 24, h: 640 }, { x: 936, y: 0, w: 24, h: 640 }, { x: 0, y: 0, w: 960, h: 24 },
      { x: 200, y: 480, w: 24, h: 80 }, { x: 320, y: 400, w: 24, h: 160 }, { x: 440, y: 320, w: 24, h: 240 },
      { x: 560, y: 400, w: 24, h: 160 }, { x: 680, y: 300, w: 24, h: 260 }, { x: 800, y: 420, w: 24, h: 140 },
    ],
    bouncers: [{ x: 240, y: 360, w: 60, h: 16 }, { x: 600, y: 260, w: 60, h: 16 }],
    hazards: [{ x: 360, y: 540, w: 60, h: 16 }, { x: 500, y: 540, w: 60, h: 16 }, { x: 720, y: 540, w: 60, h: 16 }],
    orbs: [{ x: 260, y: 300 }, { x: 380, y: 240 }, { x: 500, y: 260 }, { x: 620, y: 200 }, { x: 760, y: 320 }],
    portal: { x: 880, y: 500, r: 30 },
  },
  {
    spawn: { x: 80, y: 120 },
    walls: [
      { x: 0, y: 560, w: 960, h: 80 }, { x: 0, y: 0, w: 24, h: 640 }, { x: 936, y: 0, w: 24, h: 640 }, { x: 0, y: 0, w: 960, h: 24 },
      { x: 0, y: 200, w: 300, h: 22 }, { x: 250, y: 320, w: 300, h: 22 }, { x: 500, y: 200, w: 300, h: 22 },
      { x: 650, y: 360, w: 280, h: 22 }, { x: 100, y: 440, w: 280, h: 22 },
    ],
    bouncers: [{ x: 420, y: 500, w: 140, h: 18 }],
    hazards: [{ x: 360, y: 280, w: 40, h: 40 }, { x: 700, y: 280, w: 40, h: 80 }, { x: 200, y: 520, w: 100, h: 16 }],
    orbs: [{ x: 160, y: 140 }, { x: 360, y: 240 }, { x: 620, y: 140 }, { x: 800, y: 300 }, { x: 220, y: 380 }, { x: 500, y: 420 }],
    portal: { x: 860, y: 480, r: 32 },
  },
  {
    spawn: { x: 480, y: 480 },
    walls: [
      { x: 0, y: 560, w: 960, h: 80 }, { x: 0, y: 0, w: 24, h: 640 }, { x: 936, y: 0, w: 24, h: 640 }, { x: 0, y: 0, w: 960, h: 24 },
      { x: 180, y: 180, w: 600, h: 22 }, { x: 180, y: 180, w: 22, h: 280 }, { x: 758, y: 180, w: 22, h: 280 },
      { x: 300, y: 360, w: 360, h: 22 },
    ],
    bouncers: [{ x: 430, y: 300, w: 100, h: 16 }],
    hazards: [{ x: 200, y: 520, w: 560, h: 16 }],
    orbs: [{ x: 280, y: 280 }, { x: 480, y: 240 }, { x: 680, y: 280 }, { x: 480, y: 420 }],
    portal: { x: 480, y: 120, r: 34 },
  },
  {
    spawn: { x: 100, y: 500 },
    walls: [
      { x: 0, y: 560, w: 960, h: 80 }, { x: 0, y: 0, w: 24, h: 640 }, { x: 936, y: 0, w: 24, h: 640 }, { x: 0, y: 0, w: 960, h: 24 },
      { x: 160, y: 420, w: 80, h: 18 }, { x: 280, y: 340, w: 80, h: 18 }, { x: 400, y: 260, w: 80, h: 18 },
      { x: 520, y: 340, w: 80, h: 18 }, { x: 640, y: 420, w: 80, h: 18 }, { x: 760, y: 300, w: 80, h: 18 },
    ],
    bouncers: [{ x: 480, y: 500, w: 80, h: 16 }],
    hazards: [{ x: 220, y: 520, w: 40, h: 16 }, { x: 360, y: 520, w: 40, h: 16 }, { x: 560, y: 520, w: 40, h: 16 }, { x: 700, y: 520, w: 40, h: 16 }],
    orbs: [{ x: 200, y: 360 }, { x: 320, y: 280 }, { x: 440, y: 200 }, { x: 560, y: 280 }, { x: 680, y: 360 }, { x: 800, y: 240 }],
    portal: { x: 860, y: 480, r: 30 },
  },
  {
    spawn: { x: 80, y: 300 },
    walls: [
      { x: 0, y: 560, w: 960, h: 80 }, { x: 0, y: 0, w: 24, h: 640 }, { x: 936, y: 0, w: 24, h: 640 }, { x: 0, y: 0, w: 960, h: 24 },
      { x: 140, y: 140, w: 22, h: 320 }, { x: 260, y: 200, w: 22, h: 360 }, { x: 380, y: 100, w: 22, h: 360 },
      { x: 500, y: 200, w: 22, h: 360 }, { x: 620, y: 120, w: 22, h: 360 }, { x: 740, y: 220, w: 22, h: 300 },
    ],
    bouncers: [{ x: 180, y: 480, w: 60, h: 14 }, { x: 420, y: 480, w: 60, h: 14 }, { x: 660, y: 480, w: 60, h: 14 }],
    hazards: [{ x: 300, y: 540, w: 360, h: 14 }],
    orbs: [{ x: 200, y: 200 }, { x: 320, y: 280 }, { x: 440, y: 160 }, { x: 560, y: 280 }, { x: 680, y: 180 }, { x: 800, y: 320 }],
    portal: { x: 880, y: 120, r: 30 },
  },
];

class SoftBody {
  constructor(x, y, radius = 42) {
    this.radius = radius;
    this.points = [];
    this.center = { x, y, ox: x, oy: y };
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      this.points.push({ x: px, y: py, ox: px, oy: py });
    }
    this.restRadial = radius;
    this.restNeighbor = 2 * radius * Math.sin(Math.PI / N);
  }

  centroid() {
    let x = 0, y = 0;
    for (const p of this.points) { x += p.x; y += p.y; }
    return { x: x / N, y: y / N };
  }

  integrate(dt, grav = G) {
    const damp = 0.988;
    for (const p of this.points) {
      const vx = (p.x - p.ox) * damp;
      const vy = (p.y - p.oy) * damp + grav * dt * dt;
      p.ox = p.x; p.oy = p.y;
      p.x += vx;
      p.y += vy;
    }
  }

  constrain(iterations = 6) {
    const kRadial = 0.45;
    const kNeighbor = 0.5;
    const kShape = 0.18;
    for (let it = 0; it < iterations; it++) {
      const c = this.centroid();
      // radial springs to centroid
      for (const p of this.points) {
        const dx = p.x - c.x, dy = p.y - c.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const diff = (d - this.restRadial) / d;
        p.x -= dx * diff * kRadial;
        p.y -= dy * diff * kRadial;
      }
      // neighbor springs
      for (let i = 0; i < N; i++) {
        const a = this.points[i];
        const b = this.points[(i + 1) % N];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const diff = (d - this.restNeighbor) / d * 0.5 * kNeighbor;
        a.x += dx * diff; a.y += dy * diff;
        b.x -= dx * diff; b.y -= dy * diff;
      }
      // volume / shape memory toward circle
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const tx = c.x + Math.cos(a) * this.restRadial;
        const ty = c.y + Math.sin(a) * this.restRadial;
        const p = this.points[i];
        p.x += (tx - p.x) * kShape;
        p.y += (ty - p.y) * kShape;
      }
    }
  }

  collideWalls(walls, bouncers) {
    let bounced = false;
    const collideRect = (p, r, bounce = 0.15) => {
      const cx = clamp(p.x, r.x, r.x + r.w);
      const cy = clamp(p.y, r.y, r.y + r.h);
      const dx = p.x - cx, dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1 && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        // inside — push out via nearest edge
        const left = p.x - r.x, right = r.x + r.w - p.x;
        const top = p.y - r.y, bot = r.y + r.h - p.y;
        const m = Math.min(left, right, top, bot);
        if (m === left) p.x = r.x;
        else if (m === right) p.x = r.x + r.w;
        else if (m === top) p.y = r.y;
        else p.y = r.y + r.h;
        return true;
      }
      // ponto com raio maior = menos "entrar na parede"
      const pr = 7;
      if (d2 < pr * pr && d2 > 0) {
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const pen = pr - d;
        p.x += nx * pen;
        p.y += ny * pen;
        const vx = p.x - p.ox, vy = p.y - p.oy;
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          p.ox = p.x - (vx - (1 + bounce) * vn * nx);
          p.oy = p.y - (vy - (1 + bounce) * vn * ny);
          bounced = true;
        }
        return true;
      }
      return false;
    };
    for (const p of this.points) {
      for (const w of walls) collideRect(p, w, 0.28);
      for (const b of bouncers) {
        if (collideRect(p, b, 1.35)) {
          p.oy = p.y + Math.abs(p.y - p.oy) * 0.55 + 10;
          bounced = true;
        }
      }
      // world bounds soft
      if (p.x < 8) { p.x = 8; p.ox = p.x + (p.x - p.ox) * 0.3; }
      if (p.x > W - 8) { p.x = W - 8; p.ox = p.x + (p.x - p.ox) * 0.3; }
      if (p.y < 8) { p.y = 8; p.oy = p.y + (p.y - p.oy) * 0.3; }
      if (p.y > H - 8) { p.y = H - 8; p.oy = p.y + (p.y - p.oy) * 0.3; }
    }
    return bounced;
  }

  applyImpulse(ix, iy) {
    // impulso mais forte e uniforme no blob inteiro
    const scale = 1.35;
    for (const p of this.points) {
      p.ox -= ix * scale;
      p.oy -= iy * scale;
    }
  }

  contains(x, y) {
    // ray cast
    let inside = false;
    for (let i = 0, j = N - 1; i < N; j = i++) {
      const pi = this.points[i], pj = this.points[j];
      const inter = ((pi.y > y) !== (pj.y > y)) &&
        (x < (pj.x - pi.x) * (y - pi.y) / (pj.y - pi.y + 1e-9) + pi.x);
      if (inter) inside = !inside;
    }
    return inside;
  }
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "title";
    this.levelIndex = 0;
    this.score = 0;
    this.best = Number(localStorage.getItem(STORAGE) || 0);
    this.particles = [];
    this.time = 0;
    this.shake = 0;
    this.listeners = {};
    this.drag = null;
    this.blob = null;
    this._bind();
    this.resetLevel(false);
  }

  on(e, fn) { (this.listeners[e] ||= []).push(fn); }
  emit(e, d) { (this.listeners[e] || []).forEach((f) => f(d)); }

  resetLevel(keep = true) {
    const L = structuredClone(LEVELS[this.levelIndex]);
    this.level = L;
    this.blob = new SoftBody(L.spawn.x, L.spawn.y, 40);
    this.orbs = L.orbs.map((o) => ({ ...o, taken: false }));
    this.orbsLeft = this.orbs.length;
    this.drag = null;
    this.alive = true;
    if (!keep) this.score = 0;
    this.emit("hud");
  }

  startGame() {
    audio.unlock();
    this.levelIndex = 0;
    this.score = 0;
    this.state = "playing";
    this.resetLevel(false);
    this.emit("state");
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "pause";
    this.emit("state");
  }
  resume() {
    if (this.state !== "pause") return;
    this.state = "playing";
    this.emit("state");
  }
  toMenu() {
    this.state = "title";
    this.drag = null;
    this.emit("state");
  }
  nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.state = "over";
      this.emit("state", { title: "Gelatina suprema!", msg: `Campanha completa · ${this.score} pts` });
      return;
    }
    this.levelIndex++;
    this.state = "playing";
    this.resetLevel(true);
    this.emit("state");
  }

  _bind() {
    const toLocal = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top) * (H / r.height),
      };
    };
    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.state !== "playing") return;
      const p = toLocal(e);
      const c = this.blob.centroid();
      if (dist(p.x, p.y, c.x, c.y) < this.blob.radius * 2.2 || this.blob.contains(p.x, p.y)) {
        this.drag = { x: p.x, y: p.y, cx: c.x, cy: c.y };
        this.canvas.setPointerCapture(e.pointerId);
        audio.stretch();
      }
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.drag || this.state !== "playing") return;
      const p = toLocal(e);
      this.drag.x = p.x;
      this.drag.y = p.y;
    });
    const endDrag = (e) => {
      if (!this.drag || this.state !== "playing") return;
      const c = this.blob.centroid();
      const dx = this.drag.cx - this.drag.x;
      const dy = this.drag.cy - this.drag.y;
      const len = Math.hypot(dx, dy);
      const power = clamp(len / 70, 0, 3.4);
      // direção normalizada * potência (mais previsível)
      const nx = len > 1 ? dx / len : 0;
      const ny = len > 1 ? dy / len : 0;
      this.blob.applyImpulse(nx * 14 * power, ny * 14 * power);
      // stretch opposite during release juice
      audio.launch();
      this.shake = 5;
      this.drag = null;
    };
    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointercancel", endDrag);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        if (this.state === "playing") this.pause();
        else if (this.state === "pause") this.resume();
      }
      if (e.code === "KeyR" && this.state === "playing") this.resetLevel(true);
      if (e.code === "Space" && this.state === "title") this.startGame();
    });
  }

  _burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 50 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, r: 2 + Math.random() * 3, color });
    }
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 18);
    this.particles = this.particles.filter((p) => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt;
      return p.life > 0;
    });
    if (this.state !== "playing" || !this.alive) return;

    // drag stretch visual — pull surface toward pointer
    if (this.drag) {
      const c = this.blob.centroid();
      const pull = 0.22;
      for (const p of this.blob.points) {
        // bias points toward opposite of drag (rubber band aim)
        const tx = c.x + (c.x - this.drag.x) * 0.15;
        const ty = c.y + (c.y - this.drag.y) * 0.15;
        // actually stretch blob toward drag point from centroid
      }
      // Stretch: move points near drag direction
      const ang = Math.atan2(this.drag.y - c.y, this.drag.x - c.x);
      const stretch = clamp(dist(this.drag.x, this.drag.y, c.x, c.y) / 120, 0, 1.6);
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const align = Math.cos(a - ang);
        const targetR = this.blob.restRadial * (1 + align * stretch * 0.85);
        const p = this.blob.points[i];
        const tx = c.x + Math.cos(a) * targetR;
        const ty = c.y + Math.sin(a) * targetR;
        p.x = lerp(p.x, tx, 0.35);
        p.y = lerp(p.y, ty, 0.35);
        p.ox = p.x; p.oy = p.y; // freeze while aiming
      }
    } else {
      const sub = 2;
      const sdt = dt / sub;
      for (let s = 0; s < sub; s++) {
        this.blob.integrate(sdt);
        this.blob.constrain(5);
        if (this.blob.collideWalls(this.level.walls, this.level.bouncers)) {
          if (Math.random() < 0.08) audio.bounce();
        }
      }
    }

    const c = this.blob.centroid();

    // orbs
    for (const o of this.orbs) {
      if (o.taken) continue;
      if (dist(c.x, c.y, o.x, o.y) < this.blob.radius + 12) {
        o.taken = true;
        this.orbsLeft--;
        this.score += 150;
        audio.orb();
        this._burst(o.x, o.y, "#ffc857", 14);
        this.emit("toast", "+150");
        this.emit("hud");
      }
    }

    // hazards
    for (const h of this.level.hazards) {
      for (const p of this.blob.points) {
        if (p.x > h.x && p.x < h.x + h.w && p.y > h.y && p.y < h.y + h.h) {
          this._die();
          return;
        }
      }
    }

    // portal
    const portal = this.level.portal;
    if (this.orbsLeft <= 0 && dist(c.x, c.y, portal.x, portal.y) < portal.r + 10) {
      this._win();
    }
  }

  _die() {
    this.alive = false;
    audio.fail();
    const c = this.blob.centroid();
    this._burst(c.x, c.y, "#ff5d7a", 28);
    this.shake = 12;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE, String(this.best));
    }
    this.state = "over";
    this.emit("state", { title: "Espalmou!", msg: "A gelatina encontrou os espinhos." });
    this.emit("hud");
  }

  _win() {
    const bonus = 300 + this.levelIndex * 80;
    this.score += bonus;
    audio.win();
    this.shake = 8;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE, String(this.best));
    }
    this.state = "win";
    this.emit("state", {
      title: this.levelIndex >= LEVELS.length - 1 ? "Mestre elástico!" : "Nível superado!",
      msg: "Portal alcançado com todos os orbes.",
      score: this.score,
      bonus,
    });
    this.emit("hud");
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#120a22");
    bg.addColorStop(1, "#0a1420");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // soft grid
    ctx.strokeStyle = "rgba(125,255,179,0.04)";
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

    // walls
    for (const w of this.level.walls) {
      ctx.fillStyle = "#1c2438";
      ctx.strokeStyle = "rgba(155,124,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(w.x, w.y, w.w, w.h, 6);
      ctx.fill(); ctx.stroke();
    }
    // bouncers
    for (const b of this.level.bouncers) {
      ctx.fillStyle = "#7dffb3";
      ctx.shadowColor = "#7dffb3";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(b.x + 8, b.y + 4, b.w - 16, 3);
    }
    // hazards
    for (const h of this.level.hazards) {
      ctx.fillStyle = "#ff5d7a";
      ctx.shadowColor = "#ff5d7a";
      ctx.shadowBlur = 10;
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.shadowBlur = 0;
      const n = Math.max(2, Math.floor(h.w / 12));
      for (let i = 0; i < n; i++) {
        const sx = h.x + (i + 0.5) * (h.w / n);
        ctx.beginPath();
        ctx.moveTo(sx - 5, h.y);
        ctx.lineTo(sx, h.y - 10);
        ctx.lineTo(sx + 5, h.y);
        ctx.fillStyle = "#ff8fa3";
        ctx.fill();
      }
    }

    // orbs
    for (const o of this.orbs) {
      if (o.taken) continue;
      const pulse = 8 + Math.sin(this.time * 5 + o.x) * 2;
      const g = ctx.createRadialGradient(o.x - 3, o.y - 3, 1, o.x, o.y, pulse);
      g.addColorStop(0, "#fff6c8");
      g.addColorStop(0.4, "#ffc857");
      g.addColorStop(1, "rgba(255,200,87,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, pulse + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffc857";
      ctx.beginPath();
      ctx.arc(o.x, o.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // portal
    const p = this.level.portal;
    const ready = this.orbsLeft <= 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(this.time * (ready ? 2 : 0.6));
    ctx.strokeStyle = ready ? "#7dffb3" : "rgba(155,124,255,0.5)";
    ctx.lineWidth = 4;
    ctx.shadowColor = ready ? "#7dffb3" : "#9b7cff";
    ctx.shadowBlur = ready ? 20 : 8;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r - i * 8, (p.r - i * 8) * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    if (!ready) {
      ctx.fillStyle = "rgba(238,242,255,0.45)";
      ctx.font = "600 13px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("colete os orbes", p.x, p.y + p.r + 18);
    }

    // aim rubber band
    if (this.drag) {
      const c = this.blob.centroid();
      ctx.strokeStyle = "rgba(255,107,203,0.7)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(this.drag.x, this.drag.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // predicted impulse arrow
      const dx = c.x - this.drag.x, dy = c.y - this.drag.y;
      ctx.strokeStyle = "rgba(125,255,179,0.8)";
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + dx * 0.8, c.y + dy * 0.8);
      ctx.stroke();
    }

    // blob
    this._drawBlob(ctx);

    // particles
    for (const q of this.particles) {
      ctx.globalAlpha = clamp(q.life / 0.5, 0, 1);
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.state === "playing" && !this.drag) {
      ctx.fillStyle = "rgba(238,242,255,0.4)";
      ctx.font = "600 15px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Arraste a gelatina e solte para impulsionar", W / 2, H - 20);
    }

    ctx.restore();
  }

  _drawBlob(ctx) {
    const pts = this.blob.points;
    const c = this.blob.centroid();
    ctx.save();
    // outer glow
    ctx.shadowColor = "rgba(125,255,179,0.55)";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    // smooth curve through points
    for (let i = 0; i <= N; i++) {
      const p0 = pts[(i - 1 + N) % N];
      const p1 = pts[i % N];
      const p2 = pts[(i + 1) % N];
      const p3 = pts[(i + 2) % N];
      if (i === 0) ctx.moveTo(p1.x, p1.y);
      // catmull-rom-ish quadratic
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(c.x - 10, c.y - 12, 8, c.x, c.y, this.blob.radius * 1.4);
    g.addColorStop(0, "rgba(220,255,236,0.95)");
    g.addColorStop(0.35, "rgba(125,255,179,0.9)");
    g.addColorStop(1, "rgba(40,120,90,0.85)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // face
    const faceY = c.y - 4;
    ctx.fillStyle = "#0a0614";
    ctx.beginPath();
    ctx.ellipse(c.x - 10, faceY, 4.2, 5.5, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + 10, faceY, 4.2, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(c.x - 9, faceY - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(c.x + 11, faceY - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // smile based on speed
    const spd = Math.hypot(pts[0].x - pts[0].ox, pts[0].y - pts[0].oy);
    ctx.strokeStyle = "#0a0614";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (spd > 3) {
      ctx.arc(c.x, faceY + 10, 8, 0.15, Math.PI - 0.15);
    } else {
      ctx.arc(c.x, faceY + 8, 6, 0.2, Math.PI - 0.2);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
export const TOTAL_LEVELS = LEVELS.length;
