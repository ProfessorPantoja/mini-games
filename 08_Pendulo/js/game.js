/**
 * Pêndulo — arraste para puxar a corda, solte para lançar
 * Física corrigida + níveis alcançáveis
 */
import { audio } from "./audio.js";

const W = 960;
const H = 640;
const STORAGE = "pendulo.best.v1";
const G = 1400;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// Níveis desenhados para a bola REALMENTE alcançar estrelas/meta
const LEVELS = [
  {
    anchor: { x: 280, y: 80 }, len: 200,
    goal: { x: 620, y: 480, w: 160, h: 18 },
    platforms: [],
    stars: [{ x: 420, y: 300 }, { x: 520, y: 380 }],
    hazards: [],
  },
  {
    anchor: { x: 220, y: 70 }, len: 220,
    goal: { x: 700, y: 500, w: 140, h: 18 },
    platforms: [{ x: 500, y: 380, w: 110, h: 14 }],
    stars: [{ x: 380, y: 280 }, { x: 560, y: 300 }],
    hazards: [{ x: 420, y: 520, w: 80, h: 14 }],
  },
  {
    anchor: { x: 200, y: 90 }, len: 190,
    goal: { x: 740, y: 420, w: 130, h: 18 },
    platforms: [{ x: 480, y: 320, w: 90, h: 14 }, { x: 620, y: 400, w: 80, h: 14 }],
    stars: [{ x: 400, y: 240 }, { x: 560, y: 280 }, { x: 680, y: 340 }],
    hazards: [],
  },
  {
    anchor: { x: 480, y: 60 }, len: 200,
    goal: { x: 200, y: 500, w: 130, h: 18 },
    platforms: [{ x: 360, y: 360, w: 100, h: 14 }],
    stars: [{ x: 380, y: 260 }, { x: 300, y: 380 }],
    hazards: [{ x: 400, y: 520, w: 200, h: 14 }],
  },
  {
    anchor: { x: 180, y: 70 }, len: 210,
    goal: { x: 780, y: 480, w: 120, h: 18 },
    platforms: [
      { x: 400, y: 360, w: 80, h: 14 },
      { x: 560, y: 420, w: 80, h: 14 },
    ],
    stars: [{ x: 360, y: 260 }, { x: 500, y: 300 }, { x: 660, y: 360 }],
    hazards: [{ x: 480, y: 520, w: 120, h: 14 }],
  },
  {
    anchor: { x: 300, y: 60 }, len: 230,
    goal: { x: 720, y: 280, w: 110, h: 18 },
    platforms: [{ x: 480, y: 460, w: 120, h: 14 }, { x: 620, y: 360, w: 80, h: 14 }],
    stars: [{ x: 450, y: 280 }, { x: 600, y: 240 }],
    hazards: [{ x: 500, y: 520, w: 180, h: 14 }],
  },
  {
    anchor: { x: 160, y: 80 }, len: 200,
    goal: { x: 800, y: 520, w: 100, h: 18 },
    platforms: [
      { x: 380, y: 300, w: 70, h: 14 },
      { x: 520, y: 380, w: 70, h: 14 },
      { x: 660, y: 460, w: 70, h: 14 },
    ],
    stars: [{ x: 360, y: 220 }, { x: 500, y: 300 }, { x: 640, y: 380 }],
    hazards: [{ x: 300, y: 500, w: 280, h: 14 }],
  },
  {
    anchor: { x: 240, y: 50 }, len: 240,
    goal: { x: 780, y: 200, w: 100, h: 16 },
    platforms: [
      { x: 420, y: 480, w: 90, h: 14 },
      { x: 580, y: 380, w: 80, h: 14 },
      { x: 700, y: 290, w: 70, h: 14 },
    ],
    stars: [{ x: 400, y: 320 }, { x: 560, y: 280 }, { x: 720, y: 220 }],
    hazards: [{ x: 480, y: 200, w: 30, h: 160 }, { x: 500, y: 540, w: 200, h: 14 }],
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
    this.tries = 5;
    this.particles = [];
    this.trail = [];
    this.shake = 0;
    this.flash = 0;
    this.time = 0;
    this.listeners = {};
    this.drag = null; // { angle held by player }
    this._bindInput();
    this.resetLevel(false);
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, data) { (this.listeners[evt] || []).forEach((fn) => fn(data)); }

  resetLevel(keepScore = true) {
    const L = structuredClone(LEVELS[this.levelIndex]);
    this.level = L;
    this.anchor = { ...L.anchor };
    this.len = L.len;
    this.theta = -0.85;
    this.omega = 0.9; // começa com balanço leve
    this.mode = "swing"; // swing | hold | fly
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: 16 };
    this.stars = L.stars.map((s) => ({ ...s, taken: false }));
    this.collected = 0;
    this.trail = [];
    this.drag = null;
    this._syncBallFromPendulum();
    if (!keepScore) {
      this.score = 0;
      this.tries = 5;
    }
    this.emit("hud");
  }

  startGame() {
    audio.unlock();
    this.levelIndex = 0;
    this.score = 0;
    this.tries = 5;
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
    this.drag = null;
    this.emit("state");
    this.emit("hud");
  }
  nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.state = "over";
      this.emit("state", { title: "Campanha completa!", msg: `Você dominou o pêndulo. Pontuação: ${this.score}` });
      return;
    }
    this.levelIndex++;
    this.state = "playing";
    this.resetLevel(true);
    this.emit("state");
  }

  _local(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top) * (H / r.height),
    };
  }

  _bindInput() {
    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.state !== "playing" || this.mode === "fly") return;
      const p = this._local(e);
      // gruda se perto da bola ou da corda
      if (dist(p.x, p.y, this.ball.x, this.ball.y) < 50) {
        this.mode = "hold";
        this.drag = true;
        this.omega = 0;
        this._holdTo(p.x, p.y);
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        audio.swing();
      }
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.drag || this.state !== "playing") return;
      const p = this._local(e);
      this._holdTo(p.x, p.y);
    });
    const end = (e) => {
      if (!this.drag) return;
      this.drag = null;
      // solta: se puxou o bastante, lança; senão volta a balançar
      this.release(true);
    };
    this.canvas.addEventListener("pointerup", end);
    this.canvas.addEventListener("pointercancel", end);

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (this.state === "title") this.startGame();
        else if (this.state === "playing" && this.mode === "swing") this.release(false);
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
        this.state = "playing";
      }
    });
  }

  /** Posiciona bola no ângulo apontado pelo ponteiro (limitado) */
  _holdTo(px, py) {
    const dx = px - this.anchor.x;
    const dy = py - this.anchor.y;
    // theta a partir da vertical: 0 = baixo, + direita
    let theta = Math.atan2(dx, dy);
    theta = clamp(theta, -2.4, 2.4);
    // comprimento pode encolher um pouco ao puxar
    const pull = clamp(Math.hypot(dx, dy), this.len * 0.55, this.len * 1.05);
    this.theta = theta;
    this.holdLen = pull;
    this.ball.x = this.anchor.x + Math.sin(theta) * pull;
    this.ball.y = this.anchor.y + Math.cos(theta) * pull;
  }

  /**
   * fromDrag: se true, usa energia elástica do puxão
   * se false (espaço), usa velocidade angular atual do balanço
   */
  release(fromDrag = false) {
    if (this.mode === "fly") return;
    const L = this.holdLen || this.len;

    // velocidade tangencial correta: d/dt [sin θ L, cos θ L]
    // vx =  cos(θ) * ω * L
    // vy = -sin(θ) * ω * L
    let vx = Math.cos(this.theta) * this.omega * L;
    let vy = -Math.sin(this.theta) * this.omega * L;

    if (fromDrag || this.mode === "hold") {
      // slingshot: quanto mais puxado e mais alto, mais impulso na direção oposta ao puxão
      const restX = this.anchor.x + Math.sin(this.theta) * this.len;
      const restY = this.anchor.y + Math.cos(this.theta) * this.len;
      // direção de "retorno" da corda + tangente do ângulo
      const stretch = Math.max(0, (this.holdLen || this.len) - this.len * 0.7);
      // impulso base pelo ângulo (mais horizontal = mais voo)
      const power = 380 + Math.abs(this.theta) * 420 + stretch * 3.2;
      // lança na direção tangencial "para frente" (sentido de cair / crescer |θ|)
      const dir = Math.sign(this.theta) || 1;
      // tangente unitária no sentido de aumentar |theta| caindo
      // dpos/dθ = (cos θ * L, -sin θ * L)
      const tx = Math.cos(this.theta);
      const ty = -Math.sin(this.theta);
      // também um pouco de "soltar a corda" (para fora do âncora)
      const ox = Math.sin(this.theta);
      const oy = Math.cos(this.theta);
      vx = tx * dir * power + ox * stretch * 1.2;
      vy = ty * dir * power + oy * stretch * 0.4;
      // bônus se soltar de ângulo alto
      if (Math.abs(this.theta) > 1.0) {
        vx *= 1.1;
        vy *= 1.05;
      }
    }

    this.ball.vx = vx;
    this.ball.vy = vy;
    this.mode = "fly";
    this.state = "flying";
    this.drag = null;
    this.holdLen = null;
    audio.release();
    this.shake = 5;
    this.flash = 0.2;
    this._burst(this.ball.x, this.ball.y, "#56d6ff", 12);
    this.emit("toast", "Lançou!");
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

    if (this.mode === "hold") {
      // parado na mão do jogador
      return;
    }

    if (this.mode === "swing") {
      // θ'' = -(g/L) sin θ - c ω
      // pump suave para manter balanço divertido
      const damp = 0.04;
      const alpha = -(G / this.len) * Math.sin(this.theta) - damp * this.omega;
      this.omega += alpha * dt;
      // empurrão periódico leve (como empurrar o balanço)
      if (Math.abs(this.theta) < 0.08 && Math.abs(this.omega) < 0.8) {
        this.omega += 1.6 * Math.sign(this.omega || 1);
      }
      // limitar energia
      this.omega = clamp(this.omega, -4.5, 4.5);
      this.theta += this.omega * dt;
      this.theta = clamp(this.theta, -2.5, 2.5);
      this._syncBallFromPendulum();
    } else if (this.mode === "fly") {
      this.ball.vy += G * dt;
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;
      this.trail.push({ x: this.ball.x, y: this.ball.y, life: 0.4 });
      this.trail = this.trail.filter((t) => {
        t.life -= dt;
        return t.life > 0;
      });

      for (const s of this.stars) {
        if (s.taken) continue;
        if (dist(this.ball.x, this.ball.y, s.x, s.y) < this.ball.r + 18) {
          s.taken = true;
          this.collected++;
          this.score += 100;
          audio.star();
          this._burst(s.x, s.y, "#ffc857", 14);
          this.emit("toast", "+100 estrela");
          this.emit("hud");
        }
      }

      for (const h of this.level.hazards) {
        if (this._circleRect(this.ball, h)) {
          this._die("Espinhos!");
          return;
        }
      }

      for (const p of this.level.platforms) {
        if (this._landOn(this.ball, p)) {
          this.ball.y = p.y - this.ball.r;
          this.ball.vy *= -0.4;
          this.ball.vx *= 0.8;
          if (Math.abs(this.ball.vy) < 90) this.ball.vy = 0;
          audio.land();
          this._burst(this.ball.x, this.ball.y, "#8b7cff", 8);
        }
      }

      const g = this.level.goal;
      if (this._landOn(this.ball, g) || this._circleRect(this.ball, { ...g, h: g.h + 8 })) {
        this._win();
        return;
      }

      if (this.ball.y > H + 50 || this.ball.x < -60 || this.ball.x > W + 60) {
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
    const onX = c.x > p.x - 4 && c.x < p.x + p.w + 4;
    const top = p.y;
    const prevBottom = c.y - c.vy * 0.02 - c.r;
    const nowBottom = c.y + c.r;
    return onX && c.vy >= 0 && prevBottom <= top + 8 && nowBottom >= top && c.y < p.y + p.h + c.r;
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
    const levelBonus = 200 + this.levelIndex * 50;
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
      title: this.levelIndex >= LEVELS.length - 1 ? "Lenda do pêndulo!" : "Aterrissagem!",
      msg: `Estrelas ${this.collected}/${this.stars.length}`,
      score: this.score,
      bonus: levelBonus,
    });
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b1224");
    bg.addColorStop(1, "#12102a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(86,214,255,0.06)";
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // arco de alcance (ajuda o jogador)
    if (this.mode !== "fly") {
      ctx.strokeStyle = "rgba(255,200,87,0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.anchor.x, this.anchor.y, this.len, -2.4 + Math.PI / 2, 2.4 + Math.PI / 2);
      // wait - canvas arc uses standard math: 0 = right. Our theta is from vertical.
      // Draw as polyline instead
      ctx.beginPath();
      for (let t = -2.4; t <= 2.4; t += 0.08) {
        const x = this.anchor.x + Math.sin(t) * this.len;
        const y = this.anchor.y + Math.cos(t) * this.len;
        if (t === -2.4) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    if (this.mode !== "fly") this._drawPrediction(ctx);

    for (const p of this.level.platforms) this._plat(ctx, p, "#8b7cff", "#b8afff");
    for (const h of this.level.hazards) this._hazard(ctx, h);
    this._plat(ctx, this.level.goal, "#ffc857", "#ffe29a", true);

    for (const s of this.stars) {
      if (s.taken) continue;
      this._star(ctx, s.x, s.y, 12 + Math.sin(this.time * 6 + s.x) * 2);
    }

    // corda
    if (this.mode !== "fly") {
      const len = this.holdLen || this.len;
      ctx.strokeStyle = this.mode === "hold" ? "rgba(255,107,203,0.95)" : "rgba(86,214,255,0.9)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.anchor.x, this.anchor.y);
      ctx.lineTo(this.ball.x, this.ball.y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(86,214,255,0.2)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(this.anchor.x, this.anchor.y);
      ctx.lineTo(this.ball.x, this.ball.y);
      ctx.stroke();
    }

    // âncora
    ctx.fillStyle = "#ffc857";
    ctx.beginPath();
    ctx.arc(this.anchor.x, this.anchor.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const t of this.trail) {
      ctx.fillStyle = `rgba(255,107,203,${t.life})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4 * t.life + 1, 0, Math.PI * 2);
      ctx.fill();
    }

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
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // hand hint when hold
    if (this.mode === "hold") {
      ctx.strokeStyle = "rgba(255,107,203,0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.mode !== "fly" && this.state === "playing") {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, H - 46, W, 46);
      ctx.fillStyle = "#eef2ff";
      ctx.font = "600 15px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        this.mode === "hold"
          ? "Solte para lançar · puxe mais para o lado = mais alcance"
          : "ARRASTE a bola para puxar · ou Espaço no auge do balanço",
        W / 2,
        H - 18
      );
    }

    ctx.restore();
  }

  _drawPrediction(ctx) {
    // simula soltura atual
    let L = this.holdLen || this.len;
    let vx, vy;
    if (this.mode === "hold") {
      const power = 380 + Math.abs(this.theta) * 420 + Math.max(0, L - this.len * 0.7) * 3.2;
      const dir = Math.sign(this.theta) || 1;
      const tx = Math.cos(this.theta);
      const ty = -Math.sin(this.theta);
      vx = tx * dir * power;
      vy = ty * dir * power;
    } else {
      vx = Math.cos(this.theta) * this.omega * L;
      vy = -Math.sin(this.theta) * this.omega * L;
    }
    let x = this.ball.x, y = this.ball.y;
    ctx.strokeStyle = "rgba(255,200,87,0.55)";
    ctx.setLineDash([6, 7]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const step = 1 / 45;
    for (let i = 0; i < 100; i++) {
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
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "700 12px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("META", p.x + p.w / 2, p.y - 8);
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
    ctx.shadowBlur = 14;
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
