/**
 * NEON DRIVE — corrida arcade vertical
 * Direto: desviar · near-miss · nitro · score
 * Inspirado no espírito da Nave (controle imediato, juice, progressão)
 */
import { audio } from "./audio.js";

const W = 480;
const H = 720;
const STORAGE = "neondrive.best.v1";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

// Pista
const ROAD_W = 300;
const ROAD_L = (W - ROAD_W) / 2;
const ROAD_R = ROAD_L + ROAD_W;
const LANE_W = ROAD_W / 3;
const laneX = (i) => ROAD_L + LANE_W * (i + 0.5);

const CAR_COLORS = ["#ff2bd6", "#ffc857", "#8b7cff", "#7dffb3", "#ff6b4a", "#56d6ff"];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "title";
    this.best = Number(localStorage.getItem(STORAGE) || 0);
    this.listeners = {};
    this.keys = { left: false, right: false, nitro: false };
    this.pointer = { active: false, x: W / 2 };
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this._bind();
    this._resetRun();
  }

  on(e, fn) { (this.listeners[e] ||= []).push(fn); }
  emit(e, d) { (this.listeners[e] || []).forEach((f) => f(d)); }

  _resetRun() {
    this.score = 0;
    this.dist = 0;
    this.lives = 3;
    this.speed = 280; // px/s scroll base
    this.targetSpeed = 280;
    this.scroll = 0;
    this.nitro = 0; // 0–1
    this.nitroActive = 0;
    this.shield = 0;
    this.invuln = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.player = {
      x: W / 2,
      y: H - 120,
      w: 36,
      h: 58,
      vx: 0,
      lean: 0,
    };
    this.traffic = [];
    this.pickups = [];
    this.particles = [];
    this.sparks = [];
    this.spawnTimer = 0.6;
    this.pickupTimer = 2.5;
    this.stars = Array.from({ length: 50 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: 0.4 + Math.random() * 1.4,
      a: 0.2 + Math.random() * 0.5,
    }));
  }

  start() {
    audio.unlock();
    this._resetRun();
    this.state = "playing";
    audio.startEngine();
    this.emit("state");
    this.emit("hud");
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "pause";
    audio.stopEngine();
    this.emit("state");
  }

  resume() {
    if (this.state !== "pause") return;
    this.state = "playing";
    audio.unlock();
    audio.startEngine();
    this.emit("state");
  }

  toMenu() {
    this.state = "title";
    audio.stopEngine();
    this.emit("state");
    this.emit("hud");
  }

  _bind() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = true;
      if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        e.preventDefault();
        this.keys.nitro = true;
        if (this.state === "title") this.start();
        else if (this.state === "playing") this._tryNitro();
      }
      if (e.code === "Escape") {
        if (this.state === "playing") this.pause();
        else if (this.state === "pause") this.resume();
      }
      if (e.code === "Enter" && this.state === "title") this.start();
      if (e.code === "KeyR" && this.state === "playing") this.start();
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = false;
      if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") this.keys.nitro = false;
    });

    const local = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top) * (H / r.height),
      };
    };
    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.state !== "playing") return;
      this.pointer.active = true;
      const p = local(e);
      this.pointer.x = p.x;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.pointer.active) return;
      this.pointer.x = local(e).x;
    });
    const up = () => { this.pointer.active = false; };
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
  }

  _tryNitro() {
    if (this.nitro < 0.25 || this.nitroActive > 0) return;
    this.nitroActive = 1.8;
    this.nitro = Math.max(0, this.nitro - 0.25);
    audio.nitro();
    this.emit("toast", "NITRO!");
    this.shake = 6;
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 22);
    this.flash = Math.max(0, this.flash - dt);

    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.life > 0;
    });

    if (this.state !== "playing") return;

    this.invuln = Math.max(0, this.invuln - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.nitroActive = Math.max(0, this.nitroActive - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.combo = 0;

    // velocidade sobe com distância
    const base = 280 + Math.min(420, this.dist * 0.018);
    const boost = this.nitroActive > 0 ? 1.55 : 1;
    this.targetSpeed = base * boost;
    this.speed = lerp(this.speed, this.targetSpeed, 1 - Math.exp(-dt * 4));
    audio.setEngineSpeed(clamp((this.speed - 250) / 500, 0, 1));

    this.scroll += this.speed * dt;
    this.dist += this.speed * dt * 0.04;
    // score por distância + combo
    this.score += Math.floor(this.speed * dt * 0.12 * (1 + this.combo * 0.15));

    // player control
    const p = this.player;
    let ax = 0;
    if (this.keys.left) ax -= 1;
    if (this.keys.right) ax += 1;
    if (this.pointer.active) {
      const dx = this.pointer.x - p.x;
      ax = clamp(dx / 40, -1.2, 1.2);
    }
    const accel = 2200;
    p.vx += ax * accel * dt;
    p.vx *= Math.exp(-dt * 8); // fricção
    p.x += p.vx * dt;
    p.x = clamp(p.x, ROAD_L + p.w / 2 + 4, ROAD_R - p.w / 2 - 4);
    p.lean = lerp(p.lean, clamp(p.vx / 280, -1, 1), 1 - Math.exp(-dt * 12));

    // exhaust particles
    if (chance(this.nitroActive > 0 ? 0.9 : 0.35)) {
      this.particles.push({
        x: p.x + rand(-6, 6),
        y: p.y + p.h / 2,
        vx: rand(-20, 20),
        vy: 80 + this.speed * 0.15,
        life: 0.25,
        r: this.nitroActive > 0 ? 4 : 2.5,
        color: this.nitroActive > 0 ? "#ffc857" : "#00f0ff",
      });
    }

    // spawn traffic
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this._spawnTraffic();
      const interval = clamp(1.05 - this.dist * 0.00035, 0.32, 1.05);
      this.spawnTimer = interval * rand(0.75, 1.15);
    }

    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      this._spawnPickup();
      this.pickupTimer = rand(3.5, 6.5);
    }

    // move traffic toward player (scroll world)
    for (const c of this.traffic) {
      c.y += (this.speed + c.rel) * dt;
      // slight weaving
      if (c.weave) {
        c.phase += dt * c.weaveSpd;
        c.x = c.baseX + Math.sin(c.phase) * c.weave;
        c.x = clamp(c.x, ROAD_L + c.w / 2 + 6, ROAD_R - c.w / 2 - 6);
      }
    }
    // near-miss before cull
    for (const c of this.traffic) {
      if (c.missed) continue;
      const dy = Math.abs(c.y - p.y);
      const dx = Math.abs(c.x - p.x);
      if (dy < 40 && dx > (c.w + p.w) / 2 && dx < (c.w + p.w) / 2 + 28) {
        if (c.y > p.y - 10 && c.y < p.y + p.h) {
          c.missed = true;
          this._nearMiss();
        }
      }
    }
    this.traffic = this.traffic.filter((c) => c.y < H + 80);

    for (const u of this.pickups) {
      u.y += this.speed * dt;
      u.spin += dt * 4;
    }
    this.pickups = this.pickups.filter((u) => u.y < H + 40);

    // collisions traffic
    for (const c of this.traffic) {
      if (this._aabb(p, c)) {
        this._hitCar(c);
        break;
      }
    }

    // pickups
    for (const u of this.pickups) {
      if (u.taken) continue;
      if (this._aabb(p, { x: u.x, y: u.y, w: 28, h: 28 })) {
        u.taken = true;
        this._collect(u);
      }
    }
    this.pickups = this.pickups.filter((u) => !u.taken);

    // nitro regen slow
    if (this.nitroActive <= 0) this.nitro = Math.min(1, this.nitro + dt * 0.04);

    this.emit("hud");
  }

  _spawnTraffic() {
    // 1–2 cars, avoid stacking same lane always
    const n = chance(0.25 + Math.min(0.35, this.dist * 0.0002)) ? 2 : 1;
    const used = new Set();
    for (let i = 0; i < n; i++) {
      let lane = (Math.random() * 3) | 0;
      let guard = 0;
      while (used.has(lane) && guard++ < 5) lane = (Math.random() * 3) | 0;
      used.add(lane);
      const w = 34 + Math.random() * 8;
      const h = 52 + Math.random() * 12;
      const x = laneX(lane) + rand(-8, 8);
      this.traffic.push({
        x, y: -h - rand(0, 120),
        baseX: x,
        w, h,
        rel: rand(-40, 60), // relative speed
        color: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0],
        weave: chance(0.2) ? rand(10, 22) : 0,
        weaveSpd: rand(1.5, 3),
        phase: Math.random() * Math.PI * 2,
        missed: false,
      });
    }
  }

  _spawnPickup() {
    const types = ["nitro", "nitro", "shield", "coin", "coin", "coin"];
    if (this.lives < 3 && chance(0.2)) types.push("life");
    const type = types[(Math.random() * types.length) | 0];
    const lane = (Math.random() * 3) | 0;
    this.pickups.push({
      type,
      x: laneX(lane),
      y: -40,
      w: 28, h: 28,
      spin: 0,
      taken: false,
    });
  }

  _nearMiss() {
    this.combo = Math.min(20, this.combo + 1);
    this.comboTimer = 2.2;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const bonus = 50 * this.combo;
    this.score += bonus;
    this.nitro = Math.min(1, this.nitro + 0.08);
    audio.nearMiss();
    this.emit("toast", `NEAR MISS +${bonus}`);
    this.emit("combo");
  }

  _collect(u) {
    if (u.type === "coin") {
      this.score += 100 * (1 + Math.floor(this.combo / 3));
      audio.coin();
      this.emit("toast", "+COIN");
    } else if (u.type === "nitro") {
      this.nitro = Math.min(1, this.nitro + 0.35);
      audio.nitro();
      this.emit("toast", "NITRO +");
    } else if (u.type === "shield") {
      this.shield = 5;
      audio.shield();
      this.emit("toast", "ESCUDO");
    } else if (u.type === "life") {
      this.lives = Math.min(3, this.lives + 1);
      audio.shield();
      this.emit("toast", "VIDA +");
    }
    this._burst(u.x, u.y, u.type === "nitro" ? "#ffc857" : "#00f0ff", 12);
    this.emit("hud");
  }

  _hitCar(c) {
    if (this.invuln > 0) return;
    // remove car
    c.y = H + 200;
    if (this.shield > 0) {
      this.shield = 0;
      this.invuln = 1.2;
      audio.whoosh();
      this.shake = 10;
      this.flash = 0.25;
      this._burst(this.player.x, this.player.y, "#7dffb3", 20);
      this.emit("toast", "ESCUDO QUEBROU");
      return;
    }
    this.lives--;
    this.invuln = 1.6;
    this.combo = 0;
    this.shake = 14;
    this.flash = 0.4;
    audio.crash();
    this._burst(this.player.x, this.player.y, "#ff2bd6", 28);
    this.speed *= 0.55;
    if (this.lives <= 0) {
      this._gameOver();
    } else {
      audio.life();
      this.emit("toast", `CRASH · ${this.lives} vida(s)`);
      this.emit("hud");
    }
  }

  _gameOver() {
    audio.stopEngine();
    audio.gameOver();
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE, String(this.best));
    }
    this.state = "over";
    this.emit("state", {
      title: "CRASH",
      msg: `Combo máx ×${this.maxCombo} · ${Math.floor(this.dist)} m`,
    });
    this.emit("hud");
  }

  _aabb(a, b) {
    const aw = a.w * 0.72, ah = a.h * 0.78;
    const bw = b.w * 0.72, bh = b.h * 0.78;
    return (
      Math.abs(a.x - b.x) < (aw + bw) / 2 &&
      Math.abs(a.y - b.y) < (ah + bh) / 2
    );
  }

  _burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 200;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.35, r: 2 + Math.random() * 3, color,
      });
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    // night sky
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a0e1c");
    bg.addColorStop(1, "#12101f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // stars parallax
    for (const s of this.stars) {
      let y = (s.y + this.scroll * 0.12 * s.s) % H;
      if (y < 0) y += H;
      ctx.fillStyle = `rgba(200,220,255,${s.a})`;
      ctx.fillRect(s.x, y, s.s, s.s);
    }

    // roadside glow strips
    ctx.fillStyle = "#0d1220";
    ctx.fillRect(0, 0, ROAD_L, H);
    ctx.fillRect(ROAD_R, 0, W - ROAD_R, H);

    // neon curb
    const curbGradL = ctx.createLinearGradient(ROAD_L - 8, 0, ROAD_L + 4, 0);
    curbGradL.addColorStop(0, "rgba(0,240,255,0)");
    curbGradL.addColorStop(1, "rgba(0,240,255,0.7)");
    ctx.fillStyle = curbGradL;
    ctx.fillRect(ROAD_L - 6, 0, 10, H);
    const curbGradR = ctx.createLinearGradient(ROAD_R - 4, 0, ROAD_R + 8, 0);
    curbGradR.addColorStop(0, "rgba(255,43,214,0.7)");
    curbGradR.addColorStop(1, "rgba(255,43,214,0)");
    ctx.fillStyle = curbGradR;
    ctx.fillRect(ROAD_R - 4, 0, 10, H);

    // road
    const roadGrad = ctx.createLinearGradient(ROAD_L, 0, ROAD_R, 0);
    roadGrad.addColorStop(0, "#141a2c");
    roadGrad.addColorStop(0.5, "#1a2238");
    roadGrad.addColorStop(1, "#141a2c");
    ctx.fillStyle = roadGrad;
    ctx.fillRect(ROAD_L, 0, ROAD_W, H);

    // lane dashes
    const dashH = 36;
    const gap = 28;
    const period = dashH + gap;
    const off = this.scroll % period;
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (let lane = 1; lane <= 2; lane++) {
      const x = ROAD_L + lane * LANE_W - 2;
      for (let y = -period + off; y < H; y += period) {
        ctx.fillRect(x, y, 4, dashH);
      }
    }

    // center glow line subtle
    ctx.fillStyle = "rgba(0,240,255,0.06)";
    ctx.fillRect(W / 2 - 1, 0, 2, H);

    // pickups
    for (const u of this.pickups) this._drawPickup(ctx, u);

    // traffic
    for (const c of this.traffic) this._drawCar(ctx, c, false);

    // player
    if (this.invuln <= 0 || Math.floor(this.time * 20) % 2 === 0) {
      this._drawCar(ctx, {
        x: this.player.x,
        y: this.player.y,
        w: this.player.w,
        h: this.player.h,
        color: "#00f0ff",
        player: true,
        lean: this.player.lean,
      }, true);
    }

    // shield ring
    if (this.shield > 0) {
      ctx.strokeStyle = `rgba(125,255,179,${0.4 + 0.4 * Math.sin(this.time * 8)})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = "#7dffb3";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(this.player.x, this.player.y, this.player.w * 0.85, this.player.h * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / 0.4, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // speed lines when nitro
    if (this.nitroActive > 0 && this.state === "playing") {
      ctx.strokeStyle = "rgba(255,200,87,0.25)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const x = ROAD_L + Math.random() * ROAD_W;
        const y = Math.random() * H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 30 + Math.random() * 40);
        ctx.stroke();
      }
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,80,120,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }

    // vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // title idle road animation
    if (this.state === "title") {
      this.scroll += 120 * 0.016;
    }

    ctx.restore();
  }

  _drawCar(ctx, c, isPlayer) {
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.lean) ctx.rotate(c.lean * 0.12);
    const w = c.w, h = c.h;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.42, w * 0.55, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.15, c.color);
    g.addColorStop(1, "#1a1020");
    ctx.fillStyle = g;
    ctx.shadowColor = c.color;
    ctx.shadowBlur = isPlayer ? 16 : 8;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    // cockpit
    ctx.fillStyle = isPlayer ? "rgba(0,20,40,0.75)" : "rgba(10,10,20,0.7)";
    ctx.beginPath();
    ctx.roundRect(-w * 0.28, -h * 0.18, w * 0.56, h * 0.28, 4);
    ctx.fill();

    // headlights / taillights
    if (isPlayer) {
      ctx.fillStyle = "#fff6a0";
      ctx.shadowColor = "#ffc857";
      ctx.shadowBlur = 10;
      ctx.fillRect(-w * 0.35, -h / 2 + 2, 8, 5);
      ctx.fillRect(w * 0.35 - 8, -h / 2 + 2, 8, 5);
      ctx.shadowBlur = 0;
      // rear
      ctx.fillStyle = "#ff2bd6";
      ctx.fillRect(-w * 0.32, h / 2 - 7, 7, 5);
      ctx.fillRect(w * 0.32 - 7, h / 2 - 7, 7, 5);
    } else {
      ctx.fillStyle = "#ff5d7a";
      ctx.fillRect(-w * 0.3, h / 2 - 6, 7, 4);
      ctx.fillRect(w * 0.3 - 7, h / 2 - 6, 7, 4);
      ctx.fillStyle = "rgba(255,255,200,0.8)";
      ctx.fillRect(-w * 0.3, -h / 2 + 2, 7, 4);
      ctx.fillRect(w * 0.3 - 7, -h / 2 + 2, 7, 4);
    }

    // stripe
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(-2, -h * 0.35, 4, h * 0.55);

    ctx.restore();
  }

  _drawPickup(ctx, u) {
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.rotate(Math.sin(u.spin) * 0.2);
    const colors = {
      coin: "#ffc857",
      nitro: "#ff8f5a",
      shield: "#7dffb3",
      life: "#ff2bd6",
    };
    const col = colors[u.type] || "#fff";
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    ctx.fillStyle = col;
    ctx.beginPath();
    if (u.type === "coin") {
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.font = "bold 12px Orbitron,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 0, 1);
    } else {
      ctx.roundRect(-12, -12, 24, 24, 6);
      ctx.fill();
      ctx.fillStyle = "#0a0e18";
      ctx.font = "bold 11px Orbitron,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = u.type === "nitro" ? "N" : u.type === "shield" ? "S" : "+";
      ctx.fillText(icon, 0, 1);
    }
    ctx.restore();
  }
}
