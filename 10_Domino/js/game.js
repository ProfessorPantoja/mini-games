/**
 * Dominó — física 2D simplificada (caixas rotativas + bolas)
 * Build → Play → derrube o troféu
 */
import { audio } from "./audio.js";

const W = 960, H = 640;
const STORAGE = "domino.best.v1";
const G = 1600;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const LEVELS = [
  {
    budget: { domino: 12, ball: 1, ramp: 1 },
    statics: [
      { type: "ground", x: 0, y: 580, w: 960, h: 60 },
      { type: "block", x: 40, y: 480, w: 30, h: 100, fixed: true },
    ],
    starter: { x: 70, y: 520 },
    trophy: { x: 820, y: 520 },
    hints: [{ x: 200, y: 520 }, { x: 280, y: 520 }, { x: 360, y: 520 }],
  },
  {
    budget: { domino: 14, ball: 1, ramp: 2 },
    statics: [
      { type: "ground", x: 0, y: 580, w: 960, h: 60 },
      { type: "block", x: 420, y: 500, w: 40, h: 80, fixed: true },
      { type: "block", x: 200, y: 400, w: 160, h: 18, fixed: true },
    ],
    starter: { x: 80, y: 520 },
    trophy: { x: 860, y: 520 },
    hints: [],
  },
  {
    budget: { domino: 16, ball: 2, ramp: 2 },
    statics: [
      { type: "ground", x: 0, y: 580, w: 960, h: 60 },
      { type: "block", x: 300, y: 450, w: 200, h: 16, fixed: true },
      { type: "block", x: 560, y: 360, w: 180, h: 16, fixed: true },
      { type: "block", x: 500, y: 500, w: 24, h: 80, fixed: true },
    ],
    starter: { x: 100, y: 520 },
    trophy: { x: 720, y: 300 },
    hints: [],
  },
  {
    budget: { domino: 18, ball: 2, ramp: 3 },
    statics: [
      { type: "ground", x: 0, y: 580, w: 960, h: 60 },
      { type: "block", x: 180, y: 420, w: 120, h: 16, fixed: true },
      { type: "block", x: 380, y: 340, w: 120, h: 16, fixed: true },
      { type: "block", x: 580, y: 420, w: 120, h: 16, fixed: true },
      { type: "block", x: 760, y: 500, w: 24, h: 80, fixed: true },
    ],
    starter: { x: 80, y: 360 },
    trophy: { x: 860, y: 520 },
    hints: [],
  },
  {
    budget: { domino: 20, ball: 2, ramp: 3 },
    statics: [
      { type: "ground", x: 0, y: 580, w: 960, h: 60 },
      { type: "block", x: 250, y: 500, w: 24, h: 80, fixed: true },
      { type: "block", x: 400, y: 430, w: 24, h: 150, fixed: true },
      { type: "block", x: 550, y: 500, w: 24, h: 80, fixed: true },
      { type: "block", x: 300, y: 300, w: 200, h: 16, fixed: true },
    ],
    starter: { x: 100, y: 520 },
    trophy: { x: 800, y: 520 },
    hints: [],
  },
  {
    budget: { domino: 16, ball: 3, ramp: 4 },
    statics: [
      { type: "ground", x: 0, y: 580, w: 960, h: 60 },
      { type: "block", x: 100, y: 280, w: 300, h: 16, fixed: true },
      { type: "block", x: 500, y: 280, w: 300, h: 16, fixed: true },
      { type: "block", x: 420, y: 280, w: 40, h: 200, fixed: true },
    ],
    starter: { x: 140, y: 220 },
    trophy: { x: 780, y: 220 },
    hints: [],
  },
  {
    budget: { domino: 22, ball: 2, ramp: 3 },
    statics: [
      { type: "ground", x: 0, y: 580, w: 960, h: 60 },
      { type: "block", x: 200, y: 500, w: 80, h: 16, fixed: true },
      { type: "block", x: 340, y: 430, w: 80, h: 16, fixed: true },
      { type: "block", x: 480, y: 360, w: 80, h: 16, fixed: true },
      { type: "block", x: 620, y: 430, w: 80, h: 16, fixed: true },
      { type: "block", x: 760, y: 500, w: 80, h: 16, fixed: true },
    ],
    starter: { x: 80, y: 520 },
    trophy: { x: 880, y: 520 },
    hints: [],
  },
  {
    budget: { domino: 24, ball: 3, ramp: 4 },
    statics: [
      { type: "ground", x: 0, y: 580, w: 960, h: 60 },
      { type: "block", x: 160, y: 460, w: 16, h: 120, fixed: true },
      { type: "block", x: 300, y: 380, w: 16, h: 200, fixed: true },
      { type: "block", x: 460, y: 300, w: 16, h: 280, fixed: true },
      { type: "block", x: 620, y: 380, w: 16, h: 200, fixed: true },
      { type: "block", x: 780, y: 460, w: 16, h: 120, fixed: true },
      { type: "block", x: 200, y: 240, w: 500, h: 16, fixed: true },
    ],
    starter: { x: 80, y: 520 },
    trophy: { x: 880, y: 180 },
    hints: [],
  },
];

function makeDomino(x, y, opts = {}) {
  return {
    kind: "domino",
    x, y,
    w: 14, h: 56,
    angle: opts.angle || 0,
    vx: 0, vy: 0, omega: 0,
    mass: opts.mass || 1.2,
    fixed: !!opts.fixed,
    starter: !!opts.starter,
    color: opts.color || "#56d6ff",
    placed: !!opts.placed,
  };
}
function makeBall(x, y, opts = {}) {
  return {
    kind: "ball",
    x, y, r: 16,
    vx: 0, vy: 0,
    mass: 1.5,
    fixed: false,
    color: opts.color || "#ff6bcb",
    placed: !!opts.placed,
  };
}
function makeRamp(x, y, opts = {}) {
  return {
    kind: "ramp",
    x, y,
    w: 90, h: 16,
    angle: opts.angle ?? -0.45,
    vx: 0, vy: 0, omega: 0,
    mass: 2,
    fixed: true,
    color: "#8b7cff",
    placed: !!opts.placed,
  };
}
function makeTrophy(x, y) {
  return {
    kind: "trophy",
    x, y,
    w: 28, h: 48,
    angle: 0,
    vx: 0, vy: 0, omega: 0,
    mass: 1.4,
    fixed: false,
    color: "#ffc857",
    fallen: false,
  };
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "title"; // title | build | sim | pause | win | over
    this.levelIndex = 0;
    this.score = 0;
    this.best = Number(localStorage.getItem(STORAGE) || 0);
    this.tool = "domino";
    this.bodies = [];
    this.statics = [];
    this.budget = { domino: 0, ball: 0, ramp: 0 };
    this.used = { domino: 0, ball: 0, ramp: 0 };
    this.particles = [];
    this.time = 0;
    this.simTime = 0;
    this.shake = 0;
    this.listeners = {};
    this.pointer = { x: 0, y: 0, down: false };
    this._bind();
  }

  on(e, fn) { (this.listeners[e] ||= []).push(fn); }
  emit(e, d) { (this.listeners[e] || []).forEach((f) => f(d)); }

  startGame() {
    audio.unlock();
    this.levelIndex = 0;
    this.score = 0;
    this.loadLevel();
    this.state = "build";
    this.emit("state");
    this.emit("hud");
  }

  loadLevel() {
    const L = LEVELS[this.levelIndex];
    this.budget = { ...L.budget };
    this.used = { domino: 0, ball: 0, ramp: 0 };
    this.statics = L.statics.map((s) => ({ ...s }));
    this.bodies = [];
    // starter domino leaning
    const st = makeDomino(L.starter.x, L.starter.y, { starter: true, color: "#ff5d7a", angle: -0.25 });
    st.fixed = false;
    this.bodies.push(st);
    this.trophy = makeTrophy(L.trophy.x, L.trophy.y);
    this.bodies.push(this.trophy);
    this.hints = L.hints || [];
    this.simTime = 0;
    this.tool = "domino";
    this.emit("hud");
  }

  pause() {
    if (this.state !== "build" && this.state !== "sim") return;
    this.prevState = this.state;
    this.state = "pause";
    this.emit("state");
  }
  resume() {
    if (this.state !== "pause") return;
    this.state = this.prevState || "build";
    this.emit("state");
  }
  toMenu() {
    this.state = "title";
    this.emit("state");
  }
  nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.state = "over";
      this.emit("state", { title: "Arquiteto do caos!", msg: `Campanha completa · ${this.score} pts` });
      return;
    }
    this.levelIndex++;
    this.loadLevel();
    this.state = "build";
    this.emit("state");
  }

  setTool(t) {
    this.tool = t;
    this.emit("hud");
  }

  startSim() {
    if (this.state !== "build") return;
    // give starter a firm tip to the right
    const starter = this.bodies.find((b) => b.starter);
    if (starter) {
      starter.omega = 5.5;
      starter.vx = 90;
      starter.angle = -0.35;
    }
    this.state = "sim";
    this.simTime = 0;
    audio.play();
    this.emit("toast", "Cadeia em movimento!");
    this.emit("hud");
    this.emit("state");
  }

  resetBuild() {
    this.loadLevel();
    this.state = "build";
    this.emit("state");
    this.emit("hud");
  }

  _bind() {
    const local = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    };
    this.canvas.addEventListener("pointermove", (e) => {
      const p = local(e);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
    });
    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.state !== "build") return;
      const p = local(e);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      if (this.tool === "erase") {
        this._eraseAt(p.x, p.y);
        return;
      }
      this._placeAt(p.x, p.y);
    });
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (this.state === "build") this.startSim();
        else if (this.state === "title") this.startGame();
      }
      if (e.code === "Escape") {
        if (this.state === "build" || this.state === "sim") this.pause();
        else if (this.state === "pause") this.resume();
      }
      if (e.code === "KeyR" && (this.state === "build" || this.state === "sim")) this.resetBuild();
      if (e.code === "Digit1") this.setTool("domino");
      if (e.code === "Digit2") this.setTool("ball");
      if (e.code === "Digit3") this.setTool("ramp");
      if (e.code === "Digit4") this.setTool("erase");
    });
  }

  _placeAt(x, y) {
    // snap y near ground-ish freely
    if (y < 40 || y > 560) return;
    if (this.tool === "domino") {
      if (this.used.domino >= this.budget.domino) return this.emit("toast", "Sem dominós");
      this.bodies.push(makeDomino(x, y, { placed: true, color: "#56d6ff" }));
      this.used.domino++;
      audio.place();
    } else if (this.tool === "ball") {
      if (this.used.ball >= this.budget.ball) return this.emit("toast", "Sem bolas");
      this.bodies.push(makeBall(x, y, { placed: true }));
      this.used.ball++;
      audio.place();
    } else if (this.tool === "ramp") {
      if (this.used.ramp >= this.budget.ramp) return this.emit("toast", "Sem rampas");
      this.bodies.push(makeRamp(x, y, { placed: true }));
      this.used.ramp++;
      audio.place();
    }
    this.emit("hud");
  }

  _eraseAt(x, y) {
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      if (b.starter || b.kind === "trophy") continue;
      if (!b.placed) continue;
      let hit = false;
      if (b.kind === "ball") hit = Math.hypot(b.x - x, b.y - y) < b.r + 8;
      else hit = Math.abs(b.x - x) < b.w && Math.abs(b.y - y) < b.h;
      if (hit) {
        this.used[b.kind] = Math.max(0, (this.used[b.kind] || 0) - 1);
        this.bodies.splice(i, 1);
        audio.place();
        this.emit("hud");
        break;
      }
    }
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
    for (let s = 0; s < steps; s++) this._physics(sdt);

    // win: trophy fallen
    if (this.trophy && !this.trophy.fallen) {
      if (Math.abs(this.trophy.angle) > 1.0 || this.trophy.y > 560) {
        this.trophy.fallen = true;
        this._win();
        return;
      }
    }

    // timeout fail
    if (this.simTime > 14) {
      this._fail("A cadeia parou antes do troféu.");
    }
  }

  _physics(dt) {
    for (const b of this.bodies) {
      if (b.fixed) continue;
      b.vy += G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.angle !== undefined) b.angle += b.omega * dt;
      // damping
      b.vx *= 0.995;
      b.vy *= 0.995;
      if (b.omega !== undefined) b.omega *= 0.99;
    }

    // static collisions
    for (const b of this.bodies) {
      if (b.fixed) continue;
      for (const s of this.statics) this._collideStatic(b, s);
      // floor implicit
      if (b.kind === "ball") {
        if (b.y + b.r > 580) {
          b.y = 580 - b.r;
          if (b.vy > 0) b.vy *= -0.35;
          b.vx *= 0.9;
        }
      } else {
        const halfH = (b.h / 2) * Math.abs(Math.cos(b.angle)) + (b.w / 2) * Math.abs(Math.sin(b.angle));
        if (b.y + halfH > 580) {
          b.y = 580 - halfH;
          if (b.vy > 0) b.vy *= -0.25;
          // tip friction on ground
          b.omega *= 0.92;
          b.vx *= 0.9;
        }
      }
      if (b.x < 20) { b.x = 20; b.vx *= -0.4; }
      if (b.x > W - 20) { b.x = W - 20; b.vx *= -0.4; }
    }

    // body-body
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        this._collideBodies(this.bodies[i], this.bodies[j]);
      }
    }
  }

  _collideStatic(b, s) {
    if (b.kind === "ball") {
      const cx = clamp(b.x, s.x, s.x + s.w);
      const cy = clamp(b.y, s.y, s.y + s.h);
      const dx = b.x - cx, dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < b.r * b.r) {
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, ny = dy / d;
        const pen = b.r - d;
        b.x += nx * pen;
        b.y += ny * pen;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= 1.4 * vn * nx;
          b.vy -= 1.4 * vn * ny;
          if (Math.abs(vn) > 80) audio.knock();
        }
      }
    } else {
      // approximate OBB as circle for static AABB
      const r = Math.max(b.w, b.h) * 0.45;
      const cx = clamp(b.x, s.x, s.x + s.w);
      const cy = clamp(b.y, s.y, s.y + s.h);
      const dx = b.x - cx, dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, ny = dy / d;
        const pen = r - d;
        b.x += nx * pen * 0.8;
        b.y += ny * pen * 0.8;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= 1.2 * vn * nx;
          b.vy -= 1.2 * vn * ny;
          b.omega += (nx * 0.02) * -Math.sign(vn);
        }
        // ramp-like tilt if thin platform and coming from side
      }
    }
  }

  _collideBodies(a, b) {
    if (a.fixed && b.fixed) return;
    // circle-circle
    if (a.kind === "ball" && b.kind === "ball") {
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const min = a.r + b.r;
      if (dist < min) {
        const nx = dx / dist, ny = dy / dist;
        const pen = min - dist;
        const inv = 1 / a.mass + 1 / b.mass;
        a.x -= nx * pen * (1 / a.mass) / inv;
        a.y -= ny * pen * (1 / a.mass) / inv;
        b.x += nx * pen * (1 / b.mass) / inv;
        b.y += ny * pen * (1 / b.mass) / inv;
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const j = -(1.2) * vn / inv;
          a.vx -= (j / a.mass) * nx; a.vy -= (j / a.mass) * ny;
          b.vx += (j / b.mass) * nx; b.vy += (j / b.mass) * ny;
          if (Math.abs(j) > 40) { audio.knock(); this._spark((a.x + b.x) / 2, (a.y + b.y) / 2); }
        }
      }
      return;
    }

    // treat rects as capsules/circles approx + torque
    const ra = a.kind === "ball" ? a.r : Math.max(a.w, a.h) * 0.42;
    const rb = b.kind === "ball" ? b.r : Math.max(b.w, b.h) * 0.42;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    if (dist < ra + rb) {
      const nx = dx / dist, ny = dy / dist;
      const pen = ra + rb - dist;
      const ma = a.fixed ? 1e9 : a.mass;
      const mb = b.fixed ? 1e9 : b.mass;
      const inv = 1 / ma + 1 / mb;
      if (!a.fixed) { a.x -= nx * pen * (1 / ma) / inv; a.y -= ny * pen * (1 / ma) / inv; }
      if (!b.fixed) { b.x += nx * pen * (1 / mb) / inv; b.y += ny * pen * (1 / mb) / inv; }
      const rvx = (b.vx || 0) - (a.vx || 0);
      const rvy = (b.vy || 0) - (a.vy || 0);
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const j = -1.15 * vn / inv;
        if (!a.fixed) { a.vx -= (j / ma) * nx; a.vy -= (j / ma) * ny; }
        if (!b.fixed) { b.vx += (j / mb) * nx; b.vy += (j / mb) * ny; }
        // torque for dominos — strong tip transfer
        if (a.kind !== "ball" && a.omega !== undefined && !a.fixed) {
          a.omega += -ny * 10 * (j / 160);
          a.omega += Math.sign(nx || 1) * clamp(Math.abs(j) * 0.04, 0, 6);
        }
        if (b.kind !== "ball" && b.omega !== undefined && !b.fixed) {
          b.omega += ny * 10 * (j / 160);
          b.omega += Math.sign(nx || 1) * clamp(Math.abs(j) * 0.04, 0, 6);
        }
        // extra knock when upright domino is hit from the side
        if ((b.kind === "domino" || b.kind === "trophy") && Math.abs(b.angle) < 0.6) {
          b.omega += Math.sign(nx || 1) * clamp(Math.abs(j) * 0.06, 0.5, 8);
        }
        if ((a.kind === "domino" || a.kind === "trophy") && Math.abs(a.angle) < 0.6) {
          a.omega += -Math.sign(nx || 1) * clamp(Math.abs(j) * 0.06, 0.5, 8);
        }
        if (Math.abs(j) > 28) {
          audio.knock();
          this._spark((a.x + b.x) / 2, (a.y + b.y) / 2);
        }
      }
    }
  }

  _spark(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x, y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120,
        life: 0.25 + Math.random() * 0.2, color: "#ffc857", r: 2,
      });
    }
  }

  _win() {
    const leftover = (this.budget.domino - this.used.domino) * 20 + (this.budget.ball - this.used.ball) * 40;
    const speedBonus = Math.max(0, Math.floor((14 - this.simTime) * 30));
    const bonus = 400 + leftover + speedBonus + this.levelIndex * 60;
    this.score += bonus;
    audio.win();
    this.shake = 10;
    this._spark(this.trophy.x, this.trophy.y);
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE, String(this.best));
    }
    this.state = "win";
    this.emit("state", {
      title: this.levelIndex >= LEVELS.length - 1 ? "Juízo Final!" : "Cadeia completa!",
      msg: `Troféu derrubado em ${this.simTime.toFixed(1)}s`,
      score: this.score,
      bonus,
    });
    this.emit("hud");
  }

  _fail(msg) {
    audio.fail();
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE, String(this.best));
    }
    this.state = "over";
    this.emit("state", { title: "Cadeia falhou", msg });
    this.emit("hud");
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#12182a");
    bg.addColorStop(1, "#0c101c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = "rgba(255,200,87,0.04)";
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

    // statics
    for (const s of this.statics) {
      if (s.type === "ground") {
        ctx.fillStyle = "#1a2236";
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.fillStyle = "rgba(86,214,255,0.15)";
        ctx.fillRect(s.x, s.y, s.w, 4);
      } else {
        ctx.fillStyle = "#2a3348";
        ctx.strokeStyle = "rgba(139,124,255,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(s.x, s.y, s.w, s.h, 4);
        ctx.fill(); ctx.stroke();
      }
    }

    // hints ghosts
    if (this.state === "build") {
      for (const h of this.hints) {
        ctx.globalAlpha = 0.2;
        this._drawDominoShape(ctx, h.x, h.y, 0, "#56d6ff", 14, 56);
        ctx.globalAlpha = 1;
      }
      // ghost tool
      ctx.globalAlpha = 0.45;
      if (this.tool === "domino") this._drawDominoShape(ctx, this.pointer.x, this.pointer.y, 0, "#56d6ff", 14, 56);
      else if (this.tool === "ball") {
        ctx.fillStyle = "#ff6bcb";
        ctx.beginPath(); ctx.arc(this.pointer.x, this.pointer.y, 16, 0, Math.PI * 2); ctx.fill();
      } else if (this.tool === "ramp") this._drawDominoShape(ctx, this.pointer.x, this.pointer.y, -0.45, "#8b7cff", 90, 16);
      ctx.globalAlpha = 1;
    }

    // bodies
    for (const b of this.bodies) {
      if (b.kind === "ball") {
        const g = ctx.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, b.r);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.4, b.color);
        g.addColorStop(1, "#5a1a40");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        this._drawDominoShape(ctx, b.x, b.y, b.angle || 0, b.color, b.w, b.h, b.kind === "trophy", b.starter);
      }
    }

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / 0.4, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // labels
    if (this.state === "build") {
      ctx.fillStyle = "rgba(238,242,255,0.45)";
      ctx.font = "600 15px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Monte a cadeia · vermelho inicia · dourado é o alvo · Espaço = Play", W / 2, 36);
    } else if (this.state === "sim") {
      ctx.fillStyle = "rgba(255,200,87,0.7)";
      ctx.font = "600 14px JetBrains Mono,monospace";
      ctx.textAlign = "left";
      ctx.fillText(`t=${this.simTime.toFixed(1)}s`, 24, 36);
    }

    ctx.restore();
  }

  _drawDominoShape(ctx, x, y, angle, color, w, h, trophy = false, starter = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = color;
    ctx.shadowBlur = trophy || starter ? 14 : 6;
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.2, color);
    g.addColorStop(1, "#222");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (trophy) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "bold 16px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", 0, 0);
    } else if (!starter && w < 40) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.arc(0, -h * 0.2, 2.5, 0, Math.PI * 2);
      ctx.arc(0, h * 0.2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export const TOTAL_LEVELS = LEVELS.length;
