/**
 * NEON SERPENT — Snake arcade com fases, poderes e boss
 */
import { audio } from "./audio.js";
import { DEV_FLAGS } from "./dev.js";
import { LEVELS, POWER_DEFS, DEFAULT_THEME } from "./levels.js";

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
      // Dev: N pula fase (só se DEV_FLAGS.infiniteContinue)
      if (k === "n" && DEV_FLAGS.infiniteContinue) {
        if (this.state === "playing" || this.state === "pause" || this.state === "over" || this.state === "inter") {
          this.skipLevelDev();
          return;
        }
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
    this.snake = [];
    this.grow = 0;

    // Ordem: boss → hazards → snake segura → comida
    // (snake precisa nascer fora de braços/hub/espinhos)
    if (cfg.boss) this._initBoss();
    this._placeHazards();
    this._spawnSnakeSafe();
    this._spawnFood();
    this.emit("hud");
  }

  _placeHazards() {
    this.hazards = [];
    const seen = new Set();
    const add = (x, y) => {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
      const k = key(x, y);
      if (seen.has(k)) return;
      // nunca colocar espinho em cima do hub/braços iniciais da Hidra
      if (this.boss) {
        for (const c of this._bossCells()) {
          if (c.x === x && c.y === y) return;
        }
      }
      seen.add(k);
      this.hazards.push({ x, y });
    };

    for (const shape of this.cfg.terrain || []) {
      for (const c of this._expandShape(shape)) add(c.x, c.y);
    }

    // extras aleatórios opcionais (layouts manuais preferem hazards: 0)
    const n = this.cfg.hazards || 0;
    for (let i = 0; i < n; i++) {
      const p = this._emptyCell();
      if (p) {
        const k = key(p.x, p.y);
        if (!seen.has(k)) {
          seen.add(k);
          this.hazards.push(p);
        }
      }
    }
  }

  /**
   * Expande primitivas de terreno em células.
   * Formas pensadas para layouts manuais legíveis (não ruído aleatório).
   */
  _expandShape(shape) {
    const cells = [];
    const push = (x, y) => cells.push({ x, y });
    const t = shape.t;

    if (t === "h") {
      for (let i = 0; i < shape.len; i++) push(shape.x + i, shape.y);
    } else if (t === "v") {
      for (let i = 0; i < shape.len; i++) push(shape.x, shape.y + i);
    } else if (t === "L") {
      const w = shape.w || 3;
      const h = shape.h || 3;
      const fx = !!shape.flipX;
      const fy = !!shape.flipY;
      const x0 = shape.x;
      const y0 = shape.y;
      // barra horizontal
      const hy = fy ? y0 + h - 1 : y0;
      const hx0 = fx ? x0 : x0;
      for (let i = 0; i < w; i++) push(hx0 + i, hy);
      // barra vertical
      const vx = fx ? x0 + w - 1 : x0;
      for (let j = 0; j < h; j++) push(vx, y0 + j);
    } else if (t === "cross") {
      const arm = shape.arm || 2;
      const { x, y } = shape;
      push(x, y);
      for (let i = 1; i <= arm; i++) {
        push(x + i, y);
        push(x - i, y);
        push(x, y + i);
        push(x, y - i);
      }
    } else if (t === "ring") {
      const { cx, cy, r } = shape;
      const gap = (shape.gap || "").toLowerCase();
      for (let a = 0; a < 360; a += 6) {
        const rad = (a * Math.PI) / 180;
        const x = Math.round(cx + Math.cos(rad) * r);
        const y = Math.round(cy + Math.sin(rad) * r);
        // aberturas cardeais (~60°). ângulo 0 = leste
        if (gap === "e" && (a < 30 || a > 330)) continue;
        if (gap === "w" && a > 150 && a < 210) continue;
        if (gap === "s" && a > 60 && a < 120) continue;
        if (gap === "n" && a > 240 && a < 300) continue;
        push(x, y);
      }
    } else if (t === "rect") {
      const { x, y, w, h } = shape;
      if (shape.fill) {
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) push(x + i, y + j);
        }
      } else {
        for (let i = 0; i < w; i++) {
          push(x + i, y);
          push(x + i, y + h - 1);
        }
        for (let j = 1; j < h - 1; j++) {
          push(x, y + j);
          push(x + w - 1, y + j);
        }
      }
    } else if (t === "dots" && Array.isArray(shape.cells)) {
      for (const [x, y] of shape.cells) push(x, y);
    }

    return cells;
  }

  /**
   * Hidra no terço superior + braços em diagonal no ângulo inicial.
   * Deixa corredores livres embaixo/lados para spawn seguro.
   */
  _initBoss() {
    const cx = COLS / 2;
    // hub acima do centro — não compartilha célula com spawn típico
    const cy = Math.floor(ROWS * 0.32);
    this.boss = {
      cx,
      cy,
      angle: Math.PI / 4, // diagonal: eixos cardeais mais legíveis
      arms: 4,
      radius: 4.2,
      spin: 1.1 + this.levelIndex * 0.08,
      pulse: 0,
    };
    this._spawnBossCore();
  }

  /**
   * Coloca a cobra em células 100% seguras no frame 0 e no 1º passo.
   * Prioriza zona inferior (longe do hub) em fases boss.
   */
  _spawnSnakeSafe() {
    const len = 3;
    const candidates = [];

    if (this.cfg.boss) {
      // Preferência: base do mapa, corredores laterais e faixas livres
      for (let y = ROWS - 4; y >= Math.floor(ROWS * 0.55); y--) {
        for (let x = 3; x <= COLS - 4; x++) {
          candidates.push({ hx: x, hy: y, dir: "right" });
          candidates.push({ hx: x, hy: y, dir: "left" });
        }
      }
      for (let y = 3; y <= ROWS - 4; y++) {
        candidates.push({ hx: 3, hy: y, dir: "up" });
        candidates.push({ hx: 3, hy: y, dir: "down" });
        candidates.push({ hx: COLS - 4, hy: y, dir: "up" });
        candidates.push({ hx: COLS - 4, hy: y, dir: "down" });
      }
    } else {
      // Fases normais: centro, com fallbacks
      const cx = Math.floor(COLS / 2);
      const cy = Math.floor(ROWS / 2);
      candidates.push({ hx: cx, hy: cy, dir: "right" });
      candidates.push({ hx: cx, hy: cy + 3, dir: "right" });
      candidates.push({ hx: cx, hy: cy - 3, dir: "right" });
      candidates.push({ hx: 4, hy: cy, dir: "right" });
      candidates.push({ hx: COLS - 5, hy: cy, dir: "left" });
      for (let y = 4; y < ROWS - 4; y += 2) {
        for (let x = 4; x < COLS - 4; x += 2) {
          candidates.push({ hx: x, hy: y, dir: "right" });
        }
      }
    }

    for (const c of candidates) {
      const body = this._buildSnakeBody(c.hx, c.hy, c.dir, len);
      if (!body) continue;
      if (!this._isSpawnLayoutSafe(body, c.dir)) continue;
      this.snake = body;
      this.dir = c.dir;
      this.queue = [];
      return;
    }

    // Último recurso: varredura exaustiva
    for (let hy = 2; hy < ROWS - 2; hy++) {
      for (let hx = 2; hx < COLS - 2; hx++) {
        for (const dir of ["right", "left", "up", "down"]) {
          const body = this._buildSnakeBody(hx, hy, dir, len);
          if (!body) continue;
          if (!this._isSpawnLayoutSafe(body, dir)) continue;
          this.snake = body;
          this.dir = dir;
          this.queue = [];
          return;
        }
      }
    }

    // Fallback absoluto (não deve ocorrer com grid 20×28)
    this.snake = [
      { x: 2, y: ROWS - 3 },
      { x: 1, y: ROWS - 3 },
      { x: 0, y: ROWS - 3 },
    ];
    this.dir = "right";
    this.queue = [];
  }

  _buildSnakeBody(hx, hy, dir, len) {
    const d = DIRS[dir];
    // corpo atrás da cabeça (oposto à direção)
    const body = [];
    for (let i = 0; i < len; i++) {
      const x = hx - d.x * i;
      const y = hy - d.y * i;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
      body.push({ x, y });
    }
    return body;
  }

  /** Corpo inteiro + célula do 1º passo livres de boss/hazards/paredes letais. */
  _isSpawnLayoutSafe(body, dir) {
    for (const p of body) {
      if (this._isLethalCell(p.x, p.y)) return false;
    }
    const d = DIRS[dir];
    let nx = body[0].x + d.x;
    let ny = body[0].y + d.y;
    if (this.cfg.wrap) {
      if (nx < 0) nx = COLS - 1;
      if (ny < 0) ny = ROWS - 1;
      if (nx >= COLS) nx = 0;
      if (ny >= ROWS) ny = 0;
    } else if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      return false;
    }
    if (this._isLethalCell(nx, ny)) return false;
    // 1º passo não pode ser o próprio corpo
    for (let i = 0; i < body.length - 1; i++) {
      if (body[i].x === nx && body[i].y === ny) return false;
    }
    return true;
  }

  /** Célula letal para a cobra (sem poder fantasma). */
  _isLethalCell(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return !this.cfg?.wrap;
    for (const h of this.hazards) {
      if (h.x === x && h.y === y) return true;
    }
    if (this.boss) {
      for (const c of this._bossCells()) {
        if (c.x === x && c.y === y) return true;
      }
    }
    return false;
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
    // Braços/hub da Hidra ocupam grade (spawn e comida evitam)
    if (this.boss) {
      for (const c of this._bossCells()) s.add(key(c.x, c.y));
    }
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
          this.shake = 0.4;
          this.flash = 0.5;
          audio.hit();
          this._burst(nx, ny, "#ffc857", 16);
          this._burst(nx, ny, "#ff2bd6", 14);
          this.emit("toast", `NÚCLEO · ${this.bossHits}/${this.cfg.bossHits || 3}`);
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
    this._burst(this.food.x, this.food.y, "#00f0ff", 14);
    this.shake = Math.max(this.shake, 0.12);
    this.flash = Math.max(this.flash, 0.15);
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
    this.shake = 0.35;
    this.flash = 0.65;
    // confete no centro da cabeça
    if (this.snake[0]) {
      this._burst(this.snake[0].x, this.snake[0].y, "#00f0ff", 20);
      this._burst(this.snake[0].x, this.snake[0].y, "#ffc857", 12);
      this._burst(this.snake[0].x, this.snake[0].y, "#ff2bd6", 10);
    }
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

  /**
   * Dev / QA: pula a fase atual (marca como limpa ou avança).
   * Só funciona com DEV_FLAGS.infiniteContinue === true.
   */
  skipLevelDev() {
    if (!DEV_FLAGS.infiniteContinue) return;
    audio.unlock();
    // Na tela inter, só avança; senão força clear da fase atual
    if (this.state === "inter") {
      this._continueCampaign();
      return;
    }
    if (this.state === "win") {
      // loop de teste: recomeça campanha
      this.start(0);
      return;
    }
    // over / playing / pause → trata como fase limpa
    this.alive = true;
    this._clearLevel();
  }

  /** Expõe flags de dev para a UI (sem import circular). */
  getDevFlags() {
    return { ...DEV_FLAGS };
  }

  /** Rótulo curto do modo de borda da fase. */
  wallModeLabel() {
    if (!this.cfg) return "";
    return this.cfg.wrap ? "BORDA · PORTAL" : "BORDA · ELÉTRICA";
  }

  isWallLethal() {
    return !!(this.cfg && !this.cfg.wrap);
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
  _theme() {
    return this.cfg?.theme || DEFAULT_THEME;
  }

  /**
   * Desenha a borda do campo de forma legível:
   * - wrap: portal suave + setas (atravessa)
   * - !wrap: cerca elétrica pulsante (letal)
   */
  _drawBoardBorder(theme) {
    const ctx = this.ctx;
    const x = OX - 1;
    const y = OY - 1;
    const w = COLS * CELL + 2;
    const h = ROWS * CELL + 2;
    const lethal = this.cfg && !this.cfg.wrap;

    if (!lethal) {
      // Portal: traço tracejado ciano + setas nos meios
      ctx.save();
      ctx.strokeStyle = theme.border || "rgba(0, 240, 255, 0.35)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -this.time * 18;
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      // brilho interno suave
      ctx.strokeStyle = "rgba(0, 240, 255, 0.12)";
      ctx.lineWidth = 5;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      // setas “passa”
      ctx.fillStyle = "rgba(0, 240, 255, 0.55)";
      ctx.font = "700 9px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const midx = x + w / 2;
      const midy = y + h / 2;
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(this.time * 3);
      ctx.fillText("⇄", midx, y - 6);
      ctx.fillText("⇄", midx, y + h + 7);
      ctx.fillText("⇅", x - 8, midy);
      ctx.fillText("⇅", x + w + 8, midy);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // Cerca elétrica letal
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.time * 10));
    const col = theme.borderLethal || "rgba(255, 93, 122, 0.85)";
    ctx.save();
    // glow externo
    ctx.shadowColor = "rgba(255, 60, 90, 0.85)";
    ctx.shadowBlur = 12 + pulse * 10;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;

    // segundo anel interno “carregado”
    ctx.strokeStyle = `rgba(255, 200, 80, ${0.25 + pulse * 0.35})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);

    // faíscas ao longo das 4 arestas
    this._drawElectricEdge(x, y, w, 0, true);       // top
    this._drawElectricEdge(x, y + h, w, 0, true);   // bottom
    this._drawElectricEdge(x, y, 0, h, false);      // left
    this._drawElectricEdge(x + w, y, 0, h, false);  // right

    // selo de perigo
    ctx.fillStyle = `rgba(255, 93, 122, ${0.75 + pulse * 0.2})`;
    ctx.font = "800 8px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255, 40, 70, 0.9)";
    ctx.shadowBlur = 8;
    ctx.fillText("⚡ LETAL ⚡", x + w / 2, y - 8);
    ctx.restore();
  }

  /** Segmentos em zigue-zague + pontos de faísca numa aresta. */
  _drawElectricEdge(x0, y0, w, h, horizontal) {
    const ctx = this.ctx;
    const len = horizontal ? w : h;
    const segs = Math.max(6, Math.floor(len / 28));
    const t = this.time;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 220, 120, ${0.35 + 0.35 * Math.sin(t * 14)})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const zig = ((i % 2) * 2 - 1) * (2 + Math.sin(t * 20 + i) * 1.5);
      const px = horizontal ? x0 + u * w : x0 + zig;
      const py = horizontal ? y0 + zig : y0 + u * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // faíscas pontuais
    for (let i = 0; i < 3; i++) {
      const u = (Math.sin(t * 7 + i * 2.1) * 0.5 + 0.5);
      const jolt = Math.sin(t * 18 + i * 5) > 0.4;
      if (!jolt) continue;
      const px = horizontal ? x0 + u * w : x0;
      const py = horizontal ? y0 : y0 + u * h;
      ctx.fillStyle = "#fff6c8";
      ctx.shadowColor = "#ff5d7a";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, 1.6 + Math.random(), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  draw() {
    const ctx = this.ctx;
    const theme = this._theme();
    ctx.save();
    const shx = this.shake ? (Math.random() - 0.5) * 8 * this.shake : 0;
    const shy = this.shake ? (Math.random() - 0.5) * 8 * this.shake : 0;
    ctx.translate(shx, shy);

    // bg + atmosfera da fase
    ctx.fillStyle = theme.bg || "#05070f";
    ctx.fillRect(-10, -10, W + 20, H + 20);
    if (theme.ambience) {
      ctx.fillStyle = theme.ambience;
      ctx.fillRect(OX - 4, OY - 4, COLS * CELL + 8, ROWS * CELL + 8);
    }

    // stars
    for (const s of this.stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = theme.star || "#a8c4ff";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // grid soft (cor por fase)
    ctx.strokeStyle = theme.grid || "rgba(0, 240, 255, 0.04)";
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

    // borda do tabuleiro: portal (atravessa) vs cerca elétrica (mata)
    this._drawBoardBorder(theme);

    // hazards / terreno
    const hazardColor = theme.hazard || "#ff5d7a";
    for (const h of this.hazards) {
      this._cell(h.x, h.y, hazardColor, 0.85, true);
    }

    // boss — braços magenta (hitbox) vs hub mais denso (âncora visual)
    if (this.boss) {
      const hubX = Math.round(this.boss.cx);
      const hubY = Math.round(this.boss.cy);
      const pulse = 0.55 + 0.2 * Math.sin(this.boss.pulse);
      for (const c of this._bossCells()) {
        const isHub = c.x === hubX && c.y === hubY;
        if (isHub) continue; // hub desenhado à parte
        this._cell(c.x, c.y, "#ff2bd6", pulse, true);
      }
      // hub: núcleo denso + anel — distinto dos braços e dos orbs dourados
      this._cell(hubX, hubY, "#ff4de8", 0.9 + 0.1 * Math.sin(this.boss.pulse * 1.3), true);
      const hx = OX + hubX * CELL + CELL / 2;
      const hy = OY + hubY * CELL + CELL / 2;
      const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, CELL * 2.4);
      g.addColorStop(0, "rgba(255, 80, 220, 0.55)");
      g.addColorStop(0.45, "rgba(255, 43, 214, 0.2)");
      g.addColorStop(1, "rgba(255, 43, 214, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, CELL * 2.4, 0, Math.PI * 2);
      ctx.fill();
      // contorno do hub para leitura da hitbox central
      ctx.strokeStyle = "rgba(255, 220, 255, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        OX + hubX * CELL + 2,
        OY + hubY * CELL + 2,
        CELL - 4,
        CELL - 4
      );
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
