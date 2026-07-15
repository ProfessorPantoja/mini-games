/**
 * NEON SERPENT — Snake arcade com fases, poderes e boss
 */
import { audio } from "./audio.js";
import { LEVELS, POWER_DEFS } from "./levels.js";

const W = 480;
const H = 720;
const COLS = 20;
const ROWS = 28;
const CELL = Math.floor(Math.min(W / COLS, (H - 48) / ROWS));
const OX = Math.floor((W - COLS * CELL) / 2);
const OY = Math.floor((H - ROWS * CELL) / 2) + 8;
const STORAGE = "neonserpent.best.v1";
const STORAGE_LVL = "neonserpent.maxlvl.v1";

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPP = { up: "down", down: "up", left: "right", right: "left" };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const key = (x, y) => `${x},${y}`;
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "title"; // title | playing | pause | over | win | inter
    this.best = Number(localStorage.getItem(STORAGE) || 0);
    this.maxLevelReached = Number(localStorage.getItem(STORAGE_LVL) || 1);
    this.listeners = {};
    this.keys = {};
    this.queue = [];
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.banner = "";
    this.bannerTimer = 0;
    this.particles = [];
    this.stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: 0.4 + Math.random() * 1.3,
      a: 0.15 + Math.random() * 0.45,
    }));
    this._bind();
    this._initRun(0);
  }

  on(e, fn) { (this.listeners[e] ||= []).push(fn); }
  emit(e, d) { (this.listeners[e] || []).forEach((f) => f(d)); }

  _bind() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(k) || e.code === "Space") {
        e.preventDefault();
      }
      if (k === "escape") {
        if (this.state === "playing") this.pause();
        else if (this.state === "pause") this.resume();
        return;
      }
      if (k === "r" && (this.state === "playing" || this.state === "pause")) {
        this.start(this.levelIndex);
        return;
      }
      if (this.state === "title" && (k === "enter" || k === " ")) {
        this.start(0);
        return;
      }
      if (this.state === "inter" && (k === "enter" || k === " ")) {
        this._continueCampaign();
        return;
      }
      if (this.state !== "playing") return;

      if (k === "arrowup" || k === "w") this._queueDir("up");
      if (k === "arrowdown" || k === "s") this._queueDir("down");
      if (k === "arrowleft" || k === "a") this._queueDir("left");
      if (k === "arrowright" || k === "d") this._queueDir("right");
    });

    // Swipe / pointer
    let sx = 0, sy = 0, down = false;
    const onDown = (x, y) => { down = true; sx = x; sy = y; };
    const onUp = (x, y) => {
      if (!down || this.state !== "playing") { down = false; return; }
      down = false;
      const dx = x - sx;
      const dy = y - sy;
      if (Math.hypot(dx, dy) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) this._queueDir(dx > 0 ? "right" : "left");
      else this._queueDir(dy > 0 ? "down" : "up");
    };
    this.canvas.addEventListener("pointerdown", (e) => {
      this.canvas.setPointerCapture?.(e.pointerId);
      onDown(e.clientX, e.clientY);
    });
    this.canvas.addEventListener("pointerup", (e) => onUp(e.clientX, e.clientY));
    this.canvas.addEventListener("pointercancel", () => { down = false; });
  }

  _queueDir(dir) {
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (OPP[last] === dir) return;
    if (last === dir) return;
    if (this.queue.length < 2) this.queue.push(dir);
    audio.turn();
  }

  _initRun(levelIndex) {
    this.levelIndex = levelIndex;
    this.score = 0;
    this.levelScore = 0;
    this.eaten = 0;
    this.bossHits = 0;
    this._loadLevel();
  }

  _loadLevel() {
    const cfg = LEVELS[this.levelIndex] || LEVELS[LEVELS.length - 1];
    this.cfg = cfg;
    this.dir = "right";
    this.queue = [];
    this.stepAcc = 0;
    this.eaten = 0;
    this.bossHits = 0;
    this.power = null; // { type, turns }
    this.turboBoost = 1;
    this.hazards = [];
    this.food = null;
    this.special = null;
    this.boss = null;
    this.bossCores = [];
    this.particles = [];
    this.alive = true;
    this.levelClear = false;

    // snake center
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    this.snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    this.grow = 0;

    this._placeHazards();
    if (cfg.boss) this._initBoss();
    this._spawnFood();
    this.emit("hud");
  }

  _placeHazards() {
    this.hazards = [];
    const n = this.cfg.hazards || 0;
    for (let i = 0; i < n; i++) {
      const p = this._emptyCell();
      if (p) this.hazards.push(p);
    }
  }

  _initBoss() {
    const cx = COLS / 2;
    const cy = ROWS / 2 - 2;
    this.boss = {
      cx, cy,
      angle: 0,
      arms: 4,
      radius: 4.2,
      spin: 1.1 + this.levelIndex * 0.08,
      pulse: 0,
    };
    this._spawnBossCore();
  }

  _spawnBossCore() {
    if (!this.cfg.boss) return;
    // cores on free cells near edges
    const candidates = [];
    for (let x = 1; x < COLS - 1; x++) {
      for (let y of [1, 2, ROWS - 3, ROWS - 2]) {
        if (this._isFree(x, y)) candidates.push({ x, y });
      }
      for (let y = 3; y < ROWS - 3; y++) {
        if (x === 1 || x === COLS - 2) {
          if (this._isFree(x, y)) candidates.push({ x, y });
        }
      }
    }
    if (!candidates.length) return;
    const c = pick(candidates);
    this.bossCores = [c];
  }

  _occupiedSet() {
    const s = new Set();
    for (const p of this.snake) s.add(key(p.x, p.y));
    for (const h of this.hazards) s.add(key(h.x, h.y));
    if (this.food) s.add(key(this.food.x, this.food.y));
    if (this.special) s.add(key(this.special.x, this.special.y));
    for (const c of this.bossCores) s.add(key(c.x, c.y));
    return s;
  }

  _isFree(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    return !this._occupiedSet().has(key(x, y));
  }

  _emptyCell() {
    for (let tries = 0; tries < 200; tries++) {
      const x = randInt(0, COLS - 1);
      const y = randInt(0, ROWS - 1);
      if (this._isFree(x, y)) return { x, y };
    }
    return null;
  }

  _spawnFood() {
    const p = this._emptyCell();
    if (!p) return;
    this.food = { ...p, t: 0 };

    // special power-up chance
    if (Math.random() < (this.cfg.specialChance || 0) && !this.special) {
      const types = ["ghost", "magnet", "turbo", "shrink"];
      const sp = this._emptyCell();
      if (sp) this.special = { ...sp, type: pick(types), t: 0 };
    }
  }

  start(levelIndex = 0) {
    audio.unlock();
    this._initRun(levelIndex);
    this.state = "playing";
    this._showBanner(this.cfg.boss ? `BOSS · ${this.cfg.name}` : `FASE ${this.cfg.id} · ${this.cfg.name}`, 1.4);
    if (this.cfg.boss) audio.boss();
    else audio.level();
    this.emit("state");
    this.emit("hud");
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "pause";
    this.emit("state");
  }

  resume() {
    if (this.state !== "pause") return;
    audio.unlock();
    this.state = "playing";
    this.emit("state");
  }

  toMenu() {
    this.state = "title";
    this.emit("state");
    this.emit("hud");
  }

  _showBanner(text, sec = 1.2) {
    this.banner = text;
    this.bannerTimer = sec;
    this.emit("banner", { text, boss: !!this.cfg?.boss });
  }

  _goalProgress() {
    if (this.cfg.boss) {
      const need = this.cfg.bossHits || 3;
      return clamp(this.bossHits / need, 0, 1);
    }
    return clamp(this.eaten / this.cfg.goal, 0, 1);
  }

  _goalLabel() {
    if (this.cfg.boss) {
      return `${this.bossHits}/${this.cfg.bossHits || 3}`;
    }
    return `${this.eaten}/${this.cfg.goal}`;
  }

  _powerLabel() {
    if (!this.power) return "";
    const def = POWER_DEFS[this.power.type];
    if (!def) return "";
    return `${def.label} · ${this.power.turns}`;
  }

  update(dt) {
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 8);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.emit("banner", { text: "", boss: false });
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // stars drift
    for (const s of this.stars) {
      s.y += s.s * 8 * dt;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    }

    if (this.state !== "playing" || !this.alive) return;

    // boss spin
    if (this.boss) {
      this.boss.angle += this.boss.spin * dt;
      this.boss.pulse += dt * 4;
    }

    if (this.food) this.food.t += dt;
    if (this.special) this.special.t += dt;

    // magnet pull food slightly (visual + teleport when adjacent enough)
    if (this.power?.type === "magnet" && this.food) {
      // only helps by auto-eating when within 1.5 of head on step — handled in step
    }

    let stepMs = this.cfg.stepMs;
    if (this.power?.type === "turbo") stepMs *= 0.62;

    this.stepAcc += dt * 1000;
    while (this.stepAcc >= stepMs) {
      this.stepAcc -= stepMs;
      this._step();
      if (this.state !== "playing") break;
    }
  }

  _bossCells() {
    if (!this.boss) return [];
    const cells = [];
    const b = this.boss;
    const arms = b.arms;
    for (let a = 0; a < arms; a++) {
      const ang = b.angle + (Math.PI * 2 * a) / arms;
      for (let r = 1; r <= Math.floor(b.radius); r++) {
        const x = Math.round(b.cx + Math.cos(ang) * r);
        const y = Math.round(b.cy + Math.sin(ang) * r);
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS) cells.push({ x, y });
      }
      // center hub
      cells.push({ x: Math.round(b.cx), y: Math.round(b.cy) });
    }
    // unique
    const seen = new Set();
    return cells.filter((c) => {
      const k = key(c.x, c.y);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  _step() {
    if (this.queue.length) this.dir = this.queue.shift();
    const d = DIRS[this.dir];
    let nx = this.snake[0].x + d.x;
    let ny = this.snake[0].y + d.y;

    // wrap or wall
    if (this.cfg.wrap || this.power?.type === "ghost") {
      if (nx < 0) nx = COLS - 1;
      if (ny < 0) ny = ROWS - 1;
      if (nx >= COLS) nx = 0;
      if (ny >= ROWS) ny = 0;
    } else {
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
        this._die("Bateu na parede");
        return;
      }
    }

    // hazards
    for (const h of this.hazards) {
      if (h.x === nx && h.y === ny && this.power?.type !== "ghost") {
        this._die("Espinho neon");
        return;
      }
    }

    // boss arms
    if (this.boss && this.power?.type !== "ghost") {
      for (const c of this._bossCells()) {
        if (c.x === nx && c.y === ny) {
          this._die("Braço da Hidra");
          return;
        }
      }
    }

    // self collision (ignore tail if not growing)
    const willGrow = this.grow > 0;
    for (let i = 0; i < this.snake.length - (willGrow ? 0 : 1); i++) {
      const s = this.snake[i];
      if (s.x === nx && s.y === ny && this.power?.type !== "ghost") {
        this._die("Mordeu a si mesma");
        return;
      }
    }

    // magnet: if food is adjacent to new head, pull it
    if (this.power?.type === "magnet" && this.food) {
      const dist = Math.abs(this.food.x - nx) + Math.abs(this.food.y - ny);
      if (dist === 1) {
        this.food.x = nx;
        this.food.y = ny;
      }
    }

    this.snake.unshift({ x: nx, y: ny });
    if (this.grow > 0) this.grow--;
    else this.snake.pop();

    // eat food
    if (this.food && this.food.x === nx && this.food.y === ny) {
      this._eatFood();
    }

    // eat special
    if (this.special && this.special.x === nx && this.special.y === ny) {
      this._eatSpecial(this.special.type);
      this.special = null;
    }

    // eat boss core
    if (this.bossCores.length) {
      for (let i = this.bossCores.length - 1; i >= 0; i--) {
        const c = this.bossCores[i];
        if (c.x === nx && c.y === ny) {
          this.bossCores.splice(i, 1);
          this.bossHits++;
          this.score += 50 + this.levelIndex * 10;
          this.grow += 1;
          this.shake = 0.35;
          this.flash = 0.4;
          audio.hit();
          this._burst(nx, ny, "#ff2bd6", 18);
          this.emit("toast", "NÚCLEO · -1");
          if (this.bossHits >= (this.cfg.bossHits || 3)) {
            this._clearLevel();
            return;
          }
          this._spawnBossCore();
          this.emit("hud");
        }
      }
    }

    // tick power
    if (this.power && this.power.turns > 0) {
      this.power.turns--;
      if (this.power.turns <= 0) {
        this.power = null;
        this.emit("toast", "PODER ACABOU");
      }
    }

    this.emit("hud");
  }

  _eatFood() {
    this.eaten++;
    this.grow += 1;
    const pts = 10 + this.levelIndex * 2;
    this.score += pts;
    this.levelScore += pts;
    audio.eat();
    this._burst(this.food.x, this.food.y, "#00f0ff", 12);
    this.food = null;

    if (!this.cfg.boss && this.eaten >= this.cfg.goal) {
      this._clearLevel();
      return;
    }
    this._spawnFood();
  }

  _eatSpecial(type) {
    audio.power();
    const def = POWER_DEFS[type];
    this._burst(this.snake[0].x, this.snake[0].y, def?.color || "#fff", 16);
    if (type === "shrink") {
      // cut tail
      const cut = Math.min(3, Math.max(0, this.snake.length - 3));
      for (let i = 0; i < cut; i++) this.snake.pop();
      this.score += 15;
      this.emit("toast", "ENCOLHEU");
      this.power = null;
      return;
    }
    this.power = { type, turns: def.turns };
    this.emit("toast", def.label);
  }

  _clearLevel() {
    this.levelClear = true;
    audio.level();
    this.shake = 0.25;
    this.flash = 0.5;
    const next = this.levelIndex + 1;
    if (next >= LEVELS.length) {
      this.state = "win";
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem(STORAGE, String(this.best));
      }
      this.maxLevelReached = Math.max(this.maxLevelReached, LEVELS.length);
      localStorage.setItem(STORAGE_LVL, String(this.maxLevelReached));
      audio.win();
      this.emit("state", { title: "SERPENTE COMPLETA", msg: "Você devorou o circuito inteiro." });
      return;
    }

    this.maxLevelReached = Math.max(this.maxLevelReached, next + 1);
    localStorage.setItem(STORAGE_LVL, String(this.maxLevelReached));
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE, String(this.best));
    }

    this.state = "inter";
    this.emit("state", {
      title: `FASE ${this.cfg.id} LIMPA`,
      msg: this.cfg.boss ? "Hidra abatida. Próximo setor..." : "Meta batida. Continue a corrente.",
      nextName: LEVELS[next].name,
      nextId: LEVELS[next].id,
      isBoss: !!LEVELS[next].boss,
    });
  }

  _continueCampaign() {
    if (this.state !== "inter") return;
    this.levelIndex++;
    this._loadLevel();
    this.state = "playing";
    this.stepAcc = 0;
    this._showBanner(this.cfg.boss ? `BOSS · ${this.cfg.name}` : `FASE ${this.cfg.id} · ${this.cfg.name}`, 1.3);
    if (this.cfg.boss) audio.boss();
    else audio.level();
    this.emit("state");
    this.emit("hud");
  }

  _die(reason) {
    this.alive = false;
    audio.die();
    this.shake = 0.55;
    this.flash = 0.7;
    this._burst(this.snake[0].x, this.snake[0].y, "#ff5d7a", 22);
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORAGE, String(this.best));
    }
    this.state = "over";
    this.emit("state", {
      title: "FIM DE LINHA",
      msg: reason || "A corrente se partiu.",
    });
  }

  _burst(gx, gy, color, n = 10) {
    const px = OX + gx * CELL + CELL / 2;
    const py = OY + gy * CELL + CELL / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      this.particles.push({
        x: px, y: py,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.4,
        color,
        r: 1.5 + Math.random() * 2.5,
      });
    }
  }

  // ─── DRAW ───────────────────────────────────────────
  draw() {
    const ctx = this.ctx;
    ctx.save();
    const shx = this.shake ? (Math.random() - 0.5) * 8 * this.shake : 0;
    const shy = this.shake ? (Math.random() - 0.5) * 8 * this.shake : 0;
    ctx.translate(shx, shy);

    // bg
    ctx.fillStyle = "#05070f";
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // stars
    for (const s of this.stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#a8c4ff";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // grid soft
    ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(OX + x * CELL, OY);
      ctx.lineTo(OX + x * CELL, OY + ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(OX, OY + y * CELL);
      ctx.lineTo(OX + COLS * CELL, OY + y * CELL);
      ctx.stroke();
    }

    // board border
    ctx.strokeStyle = this.cfg?.wrap ? "rgba(0, 240, 255, 0.2)" : "rgba(255, 93, 122, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(OX - 1, OY - 1, COLS * CELL + 2, ROWS * CELL + 2);

    // hazards
    for (const h of this.hazards) {
      this._cell(h.x, h.y, "#ff5d7a", 0.85, true);
    }

    // boss
    if (this.boss) {
      for (const c of this._bossCells()) {
        this._cell(c.x, c.y, "#ff2bd6", 0.55 + 0.2 * Math.sin(this.boss.pulse), true);
      }
      // hub glow
      const hx = OX + Math.round(this.boss.cx) * CELL + CELL / 2;
      const hy = OY + Math.round(this.boss.cy) * CELL + CELL / 2;
      const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, CELL * 2.2);
      g.addColorStop(0, "rgba(255, 43, 214, 0.45)");
      g.addColorStop(1, "rgba(255, 43, 214, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, CELL * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // food
    if (this.food) {
      const pulse = 0.75 + 0.25 * Math.sin(this.food.t * 8);
      this._orb(this.food.x, this.food.y, "#00f0ff", pulse);
    }

    // special
    if (this.special) {
      const def = POWER_DEFS[this.special.type];
      const pulse = 0.7 + 0.3 * Math.sin(this.special.t * 10);
      this._orb(this.special.x, this.special.y, def?.color || "#fff", pulse);
    }

    // boss cores
    for (const c of this.bossCores) {
      this._orb(c.x, c.y, "#ffc857", 0.85 + 0.15 * Math.sin(this.time * 10));
    }

    // snake
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const s = this.snake[i];
      const t = i / Math.max(1, this.snake.length - 1);
      const isHead = i === 0;
      let color = isHead ? "#eef6ff" : this._lerpColor("#00f0ff", "#ff2bd6", t);
      if (this.power?.type === "ghost") color = "#8b7cff";
      if (this.power?.type === "turbo") color = isHead ? "#fff" : "#ff2bd6";
      this._cell(s.x, s.y, color, isHead ? 1 : 0.75 + 0.25 * (1 - t), isHead);
      if (isHead) {
        // eyes
        const d = DIRS[this.dir];
        const cx = OX + s.x * CELL + CELL / 2;
        const cy = OY + s.y * CELL + CELL / 2;
        const ox = d.x * 3;
        const oy = d.y * 3;
        ctx.fillStyle = "#041018";
        ctx.beginPath();
        ctx.arc(cx + ox - d.y * 3.5, cy + oy + d.x * 3.5, 2.1, 0, Math.PI * 2);
        ctx.arc(cx + ox + d.y * 3.5, cy + oy - d.x * 3.5, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }

    // title idle snake trail hint
    if (this.state === "title") {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  _cell(gx, gy, color, alpha = 1, glow = false) {
    const ctx = this.ctx;
    const x = OX + gx * CELL;
    const y = OY + gy * CELL;
    const pad = 1.5;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = 4;
    const w = CELL - pad * 2;
    const h = CELL - pad * 2;
    const px = x + pad;
    const py = y + pad;
    ctx.moveTo(px + r, py);
    ctx.arcTo(px + w, py, px + w, py + h, r);
    ctx.arcTo(px + w, py + h, px, py + h, r);
    ctx.arcTo(px, py + h, px, py, r);
    ctx.arcTo(px, py, px + w, py, r);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  _orb(gx, gy, color, scale = 1) {
    const ctx = this.ctx;
    const cx = OX + gx * CELL + CELL / 2;
    const cy = OY + gy * CELL + CELL / 2;
    const r = (CELL * 0.32) * scale;
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r * 1.6);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _lerpColor(a, b, t) {
    const pa = this._hex(a);
    const pb = this._hex(b);
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
    const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  _hex(h) {
    const n = h.replace("#", "");
    return [
      parseInt(n.slice(0, 2), 16),
      parseInt(n.slice(2, 4), 16),
      parseInt(n.slice(4, 6), 16),
    ];
  }
}
