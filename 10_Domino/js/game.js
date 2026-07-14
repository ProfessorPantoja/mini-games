/**
 * Dominó — física de tombamento (pivô na base)
 * Confiável para cadeias: peça tomba → empurra a vizinha
 */
import { audio } from "./audio.js";

const W = 960, H = 640;
const STORAGE = "domino.best.v1";
const FLOOR = 560;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const LEVELS = [
  {
    budget: { domino: 14, ball: 0, ramp: 0 },
    platforms: [{ x: 0, y: FLOOR, w: W, h: 80 }],
    starter: { x: 100, y: FLOOR },
    trophy: { x: 780, y: FLOOR },
    hints: [180, 250, 320, 390, 460, 530, 600, 670],
  },
  {
    budget: { domino: 16, ball: 1, ramp: 0 },
    platforms: [
      { x: 0, y: FLOOR, w: W, h: 80 },
      { x: 380, y: 420, w: 200, h: 16 },
    ],
    starter: { x: 90, y: FLOOR },
    trophy: { x: 820, y: FLOOR },
    hints: [170, 250, 330, 500, 580, 660, 740],
  },
  {
    budget: { domino: 18, ball: 1, ramp: 1 },
    platforms: [
      { x: 0, y: FLOOR, w: W, h: 80 },
      { x: 280, y: 400, w: 180, h: 16 },
      { x: 520, y: 330, w: 180, h: 16 },
    ],
    starter: { x: 90, y: FLOOR },
    trophy: { x: 700, y: 330 },
    hints: [180, 260, 340, 420, 560, 640],
  },
  {
    budget: { domino: 16, ball: 2, ramp: 1 },
    platforms: [
      { x: 0, y: FLOOR, w: W, h: 80 },
      { x: 200, y: 380, w: 140, h: 16 },
      { x: 420, y: 300, w: 140, h: 16 },
      { x: 640, y: 380, w: 140, h: 16 },
    ],
    starter: { x: 100, y: 380 },
    trophy: { x: 780, y: FLOOR },
    hints: [280, 360, 480, 560, 700],
  },
  {
    budget: { domino: 20, ball: 1, ramp: 1 },
    platforms: [
      { x: 0, y: FLOOR, w: W, h: 80 },
      { x: 300, y: 450, w: 24, h: 110 },
      { x: 500, y: 450, w: 24, h: 110 },
    ],
    starter: { x: 90, y: FLOOR },
    trophy: { x: 800, y: FLOOR },
    hints: [170, 240, 360, 430, 560, 630, 720],
  },
  {
    budget: { domino: 18, ball: 2, ramp: 2 },
    platforms: [
      { x: 0, y: FLOOR, w: W, h: 80 },
      { x: 120, y: 320, w: 320, h: 16 },
      { x: 520, y: 320, w: 320, h: 16 },
      { x: 450, y: 320, w: 30, h: 240 },
    ],
    starter: { x: 160, y: 320 },
    trophy: { x: 760, y: 320 },
    hints: [240, 320, 400, 580, 660],
  },
  {
    budget: { domino: 22, ball: 1, ramp: 1 },
    platforms: [
      { x: 0, y: FLOOR, w: W, h: 80 },
      { x: 180, y: 470, w: 90, h: 14 },
      { x: 320, y: 400, w: 90, h: 14 },
      { x: 460, y: 330, w: 90, h: 14 },
      { x: 600, y: 400, w: 90, h: 14 },
      { x: 740, y: 470, w: 90, h: 14 },
    ],
    starter: { x: 90, y: FLOOR },
    trophy: { x: 860, y: FLOOR },
    hints: [160, 250, 360, 500, 640, 780],
  },
  {
    budget: { domino: 24, ball: 2, ramp: 2 },
    platforms: [
      { x: 0, y: FLOOR, w: W, h: 80 },
      { x: 150, y: 420, w: 18, h: 140 },
      { x: 300, y: 340, w: 18, h: 220 },
      { x: 450, y: 260, w: 18, h: 300 },
      { x: 600, y: 340, w: 18, h: 220 },
      { x: 750, y: 420, w: 18, h: 140 },
      { x: 200, y: 220, w: 480, h: 16 },
    ],
    starter: { x: 80, y: FLOOR },
    trophy: { x: 860, y: 220 },
    hints: [200, 360, 520, 680, 820],
  },
];

/** Domino que gira em torno do pé (base no chão/plataforma) */
function makeDomino(x, footY, opts = {}) {
  return {
    kind: "domino",
    x,
    footY, // y da base
    h: 64,
    w: 16,
    angle: opts.angle || 0, // 0 = em pé; + tomba p/ direita; - p/ esquerda
    omega: 0,
    fallen: false,
    starter: !!opts.starter,
    trophy: !!opts.trophy,
    placed: !!opts.placed,
    color: opts.color || (opts.trophy ? "#ffc857" : opts.starter ? "#ff5d7a" : "#56d6ff"),
  };
}

function makeBall(x, y) {
  return {
    kind: "ball",
    x, y, r: 15,
    vx: 0, vy: 0,
    placed: true,
    color: "#ff6bcb",
  };
}

function makeRamp(x, y) {
  return {
    kind: "ramp",
    x, y,
    w: 100, h: 14,
    angle: -0.4,
    placed: true,
    color: "#8b7cff",
  };
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "title";
    this.levelIndex = 0;
    this.score = 0;
    this.best = Number(localStorage.getItem(STORAGE) || 0);
    this.tool = "domino";
    this.dominos = [];
    this.balls = [];
    this.ramps = [];
    this.platforms = [];
    this.budget = { domino: 0, ball: 0, ramp: 0 };
    this.used = { domino: 0, ball: 0, ramp: 0 };
    this.particles = [];
    this.time = 0;
    this.simTime = 0;
    this.shake = 0;
    this.listeners = {};
    this.pointer = { x: 0, y: 0 };
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
    this.platforms = L.platforms.map((p) => ({ ...p }));
    this.dominos = [];
    this.balls = [];
    this.ramps = [];
    // starter
    const sf = this._snapFoot(L.starter.x, L.starter.y);
    this.dominos.push(makeDomino(sf.x, sf.y, { starter: true, color: "#ff5d7a", angle: -0.12 }));
    // trophy
    const tf = this._snapFoot(L.trophy.x, L.trophy.y);
    this.dominos.push(makeDomino(tf.x, tf.y, { trophy: true, color: "#ffc857" }));
    this.hints = L.hints || [];
    this.simTime = 0;
    this.tool = "domino";
    this.trophyDown = false;
    this.emit("hud");
  }

  /** Encaixa a base no topo da plataforma mais alta sob o x */
  _snapFoot(x, yHint) {
    let best = FLOOR;
    let bestDist = Infinity;
    for (const p of this.platforms) {
      if (x < p.x - 4 || x > p.x + p.w + 4) continue;
      // só plataformas "chão" (largas o bastante ou top surface)
      const top = p.y;
      const d = Math.abs((yHint || FLOOR) - top);
      if (d < bestDist && top <= FLOOR + 1) {
        // prefer surfaces near hint
        bestDist = d;
        best = top;
      }
    }
    // se yHint próximo de alguma superfície, use-a
    for (const p of this.platforms) {
      if (x >= p.x && x <= p.x + p.w) {
        if (Math.abs(p.y - (yHint || FLOOR)) < 50 && p.w > 40) {
          best = p.y;
        }
      }
    }
    return { x: clamp(x, 30, W - 30), y: best };
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
    const st = this.dominos.find((d) => d.starter);
    if (st) {
      st.omega = 4.2; // tomba para a direita
      st.angle = 0.05;
    }
    // bolas ganham leve push se perto do starter
    for (const b of this.balls) {
      if (Math.abs(b.x - (st?.x || 0)) < 80) b.vx = 180;
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
      return {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top) * (H / r.height),
      };
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
    if (this.tool === "domino") {
      if (this.used.domino >= this.budget.domino) return this.emit("toast", "Sem dominós");
      const foot = this._snapFoot(x, y);
      // espaçamento mínimo
      for (const d of this.dominos) {
        if (Math.abs(d.x - foot.x) < 28 && Math.abs(d.footY - foot.y) < 20) {
          return this.emit("toast", "Muito perto");
        }
      }
      this.dominos.push(makeDomino(foot.x, foot.y, { placed: true }));
      this.used.domino++;
      audio.place();
    } else if (this.tool === "ball") {
      if (this.used.ball >= this.budget.ball) return this.emit("toast", "Sem bolas");
      const foot = this._snapFoot(x, y);
      this.balls.push(makeBall(foot.x, foot.y - 16));
      this.used.ball++;
      audio.place();
    } else if (this.tool === "ramp") {
      if (this.used.ramp >= this.budget.ramp) return this.emit("toast", "Sem rampas");
      this.ramps.push(makeRamp(x, clamp(y, 80, FLOOR - 20)));
      this.used.ramp++;
      audio.place();
    }
    this.emit("hud");
  }

  _eraseAt(x, y) {
    for (let i = this.dominos.length - 1; i >= 0; i--) {
      const d = this.dominos[i];
      if (d.starter || d.trophy) continue;
      if (!d.placed) continue;
      if (Math.abs(d.x - x) < 20 && y < d.footY && y > d.footY - d.h - 10) {
        this.dominos.splice(i, 1);
        this.used.domino = Math.max(0, this.used.domino - 1);
        audio.place();
        this.emit("hud");
        return;
      }
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (Math.hypot(b.x - x, b.y - y) < 22) {
        this.balls.splice(i, 1);
        this.used.ball = Math.max(0, this.used.ball - 1);
        audio.place();
        this.emit("hud");
        return;
      }
    }
    for (let i = this.ramps.length - 1; i >= 0; i--) {
      const r = this.ramps[i];
      if (Math.abs(r.x - x) < r.w / 2 && Math.abs(r.y - y) < 20) {
        this.ramps.splice(i, 1);
        this.used.ramp = Math.max(0, this.used.ramp - 1);
        audio.place();
        this.emit("hud");
        return;
      }
    }
  }

  /** Topo/centro da peça no ângulo atual (pivô no pé) */
  _top(d) {
    return {
      x: d.x + Math.sin(d.angle) * d.h,
      y: d.footY - Math.cos(d.angle) * d.h,
    };
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 18);
    this.particles = this.particles.filter((p) => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.life > 0;
    });
    if (this.state !== "sim") return;

    this.simTime += dt;
    const steps = 2;
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      this._simDominos(sdt);
      this._simBalls(sdt);
      this._dominoHits();
      this._ballDominoHits();
    }

    const trophy = this.dominos.find((d) => d.trophy);
    if (trophy && !this.trophyDown && (Math.abs(trophy.angle) > 1.05 || trophy.fallen)) {
      this.trophyDown = true;
      this._win();
      return;
    }
    if (this.simTime > 12) {
      // se ainda mexendo, dá mais tempo
      const moving = this.dominos.some((d) => Math.abs(d.omega) > 0.15 && !d.fallen);
      const ballMoving = this.balls.some((b) => Math.hypot(b.vx, b.vy) > 30);
      if (!moving && !ballMoving) this._fail("A cadeia parou antes do troféu.");
      else if (this.simTime > 20) this._fail("Tempo esgotado.");
    }
  }

  _simDominos(dt) {
    // α = (3/2) * (g/h) * sin(θ)  — barra rígida tombando sob gravidade
    const g = 1600;
    for (const d of this.dominos) {
      if (d.fallen) continue;
      // gravidade puxa para |angle| aumentar
      const alpha = (1.6 * g / d.h) * Math.sin(d.angle);
      d.omega += alpha * dt;
      // atrito leve
      d.omega *= 0.998;
      d.angle += d.omega * dt;

      // colisão com chão (tomba de lado)
      if (d.angle > Math.PI / 2 - 0.02) {
        d.angle = Math.PI / 2;
        d.omega = 0;
        d.fallen = true;
        audio.knock();
        this._spark(d.x + d.h * 0.5, d.footY - 8);
      } else if (d.angle < -Math.PI / 2 + 0.02) {
        d.angle = -Math.PI / 2;
        d.omega = 0;
        d.fallen = true;
        audio.knock();
        this._spark(d.x - d.h * 0.5, d.footY - 8);
      }
    }
  }

  _dominoHits() {
    // quando uma peça se inclina, o topo empurra a vizinha se estiver no alcance
    for (let i = 0; i < this.dominos.length; i++) {
      const a = this.dominos[i];
      if (Math.abs(a.angle) < 0.2) continue;
      const top = this._top(a);
      for (let j = 0; j < this.dominos.length; j++) {
        if (i === j) continue;
        const b = this.dominos[j];
        if (b.fallen) continue;
        // distância horizontal entre bases
        const dx = b.x - a.x;
        const sameFloor = Math.abs(b.footY - a.footY) < 12;
        if (!sameFloor) {
          // pode empurrar de plataforma se topo alcança
        }
        // hit se topo de A está perto do corpo de B
        // corpo de B: de (b.x, b.footY) até topo de B
        const bt = this._top(b);
        // distância do top A à haste B (segmento)
        const hit = this._distPointSeg(top.x, top.y, b.x, b.footY, bt.x, bt.y);
        const reach = Math.abs(a.angle) > 0.35 && hit < 22;

        // regra simples de cadeia no chão: se A tomba na direção de B e bases próximas
        const spacing = Math.abs(dx);
        const facing = Math.sign(a.angle) === Math.sign(dx) || Math.sign(a.omega) === Math.sign(dx);
        const chain = sameFloor && spacing > 20 && spacing < 78 && facing && Math.abs(a.angle) > 0.45;

        if (reach || chain) {
          const push = clamp(Math.abs(a.omega) * 0.9 + Math.abs(a.angle) * 2.2, 0.8, 7);
          const dir = Math.sign(dx) || Math.sign(a.angle) || 1;
          if (Math.abs(b.omega) < push * 0.7 || Math.sign(b.omega) !== dir) {
            b.omega += dir * push * 0.55;
            // kick inicial de ângulo
            if (Math.abs(b.angle) < 0.15) b.angle += dir * 0.08;
            if (Math.random() < 0.08) audio.knock();
          }
        }
      }
    }
  }

  _distPointSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = clamp(t, 0, 1);
    const qx = x1 + t * dx, qy = y1 + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  _simBalls(dt) {
    const g = 1600;
    for (const b of this.balls) {
      b.vy += g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.995;

      // plataformas
      for (const p of this.platforms) {
        if (b.x > p.x && b.x < p.x + p.w && b.y + b.r > p.y && b.y + b.r < p.y + 24 && b.vy > 0) {
          b.y = p.y - b.r;
          b.vy *= -0.25;
          b.vx *= 0.92;
        }
      }
      // rampas
      for (const r of this.ramps) {
        const rx0 = r.x - r.w / 2, rx1 = r.x + r.w / 2;
        if (b.x > rx0 && b.x < rx1) {
          const t = (b.x - rx0) / r.w;
          const surfaceY = r.y + Math.sin(r.angle) * (t - 0.5) * r.w;
          if (b.y + b.r > surfaceY && b.y < surfaceY + 30) {
            b.y = surfaceY - b.r;
            // acelera na direção da rampa
            b.vx += Math.cos(r.angle) * 40 * dt * 60;
            b.vy = Math.min(b.vy, 0);
          }
        }
      }
      if (b.y + b.r > FLOOR) {
        b.y = FLOOR - b.r;
        b.vy *= -0.3;
        b.vx *= 0.9;
      }
      if (b.x < b.r) { b.x = b.r; b.vx *= -0.5; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -0.5; }
    }
  }

  _ballDominoHits() {
    for (const b of this.balls) {
      for (const d of this.dominos) {
        if (d.fallen) continue;
        const top = this._top(d);
        const hit = this._distPointSeg(b.x, b.y, d.x, d.footY, top.x, top.y);
        if (hit < b.r + 8) {
          const dir = Math.sign(b.vx) || Math.sign(b.x - d.x) || 1;
          const power = clamp(Math.hypot(b.vx, b.vy) / 80, 0.5, 6);
          d.omega += dir * power * 1.4;
          if (Math.abs(d.angle) < 0.1) d.angle += dir * 0.1;
          // bounce ball a bit
          b.vx *= -0.4;
          b.vy *= 0.5;
          audio.knock();
          this._spark(b.x, b.y);
        }
      }
    }
  }

  _spark(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x, y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140,
        life: 0.3, color: "#ffc857", r: 2,
      });
    }
  }

  _win() {
    const leftover = (this.budget.domino - this.used.domino) * 15;
    const speedBonus = Math.max(0, Math.floor((12 - this.simTime) * 30));
    const bonus = 400 + leftover + speedBonus + this.levelIndex * 60;
    this.score += bonus;
    audio.win();
    this.shake = 10;
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
    bg.addColorStop(0, "#141a2c");
    bg.addColorStop(1, "#0c101c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // grid suave
    ctx.strokeStyle = "rgba(255,200,87,0.05)";
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // plataformas
    for (const p of this.platforms) {
      if (p.y >= FLOOR - 1) {
        ctx.fillStyle = "#1a2236";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "rgba(86,214,255,0.25)";
        ctx.fillRect(p.x, p.y, p.w, 5);
      } else {
        ctx.fillStyle = "#2a3348";
        ctx.strokeStyle = "rgba(139,124,255,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, 4);
        ctx.fill();
        ctx.stroke();
      }
    }

    // hints
    if (this.state === "build") {
      for (const hx of this.hints) {
        ctx.globalAlpha = 0.18;
        this._drawDomino(ctx, makeDomino(hx, FLOOR), true);
        ctx.globalAlpha = 1;
      }
      // ghost
      ctx.globalAlpha = 0.4;
      if (this.tool === "domino") {
        const f = this._snapFoot(this.pointer.x, this.pointer.y);
        this._drawDomino(ctx, makeDomino(f.x, f.y));
      } else if (this.tool === "ball") {
        const f = this._snapFoot(this.pointer.x, this.pointer.y);
        ctx.fillStyle = "#ff6bcb";
        ctx.beginPath();
        ctx.arc(f.x, f.y - 16, 15, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.tool === "ramp") {
        this._drawRamp(ctx, { x: this.pointer.x, y: this.pointer.y, w: 100, h: 14, angle: -0.4, color: "#8b7cff" });
      }
      ctx.globalAlpha = 1;
    }

    // ramps
    for (const r of this.ramps) this._drawRamp(ctx, r);

    // dominos
    for (const d of this.dominos) this._drawDomino(ctx, d);

    // balls
    for (const b of this.balls) {
      const g = ctx.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, b.r);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.4, b.color);
      g.addColorStop(1, "#5a1a40");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / 0.3, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.state === "build") {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, W, 44);
      ctx.fillStyle = "#eef2ff";
      ctx.font = "600 15px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Enfileire dominós do VERMELHO até o DOURADO · Espaço = Play", W / 2, 28);
    } else if (this.state === "sim") {
      ctx.fillStyle = "rgba(255,200,87,0.8)";
      ctx.font = "600 14px JetBrains Mono,monospace";
      ctx.textAlign = "left";
      ctx.fillText(`t=${this.simTime.toFixed(1)}s`, 20, 30);
    }

    ctx.restore();
  }

  _drawDomino(ctx, d) {
    ctx.save();
    // pivô no pé
    ctx.translate(d.x, d.footY);
    ctx.rotate(d.angle);
    ctx.shadowColor = d.color;
    ctx.shadowBlur = d.trophy || d.starter ? 16 : 6;
    const g = ctx.createLinearGradient(-d.w / 2, -d.h, d.w / 2, 0);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.25, d.color);
    g.addColorStop(1, "#1a2030");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-d.w / 2, -d.h, d.w, d.h, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (d.trophy) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 18px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", 0, -d.h / 2);
    } else if (d.starter) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 11px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GO", 0, -d.h / 2);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.arc(0, -d.h * 0.3, 2.2, 0, Math.PI * 2);
      ctx.arc(0, -d.h * 0.7, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // pé
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(-d.w / 2 - 2, -3, d.w + 4, 4);
    ctx.restore();
  }

  _drawRamp(ctx, r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.fillStyle = r.color;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 4);
    ctx.fill();
    ctx.restore();
  }
}

export const TOTAL_LEVELS = LEVELS.length;
