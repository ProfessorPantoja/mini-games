/**
 * Estoura — core game loop & state machine
 */

import { CFG, STORAGE_KEY, colorById } from './config.js';
import { BubbleGrid } from './grid.js';
import { buildLevelGrid } from './levels.js';
import { ParticleSystem } from './particles.js';
import { Renderer } from './renderer.js';
import { sfx, unlockAudio } from './audio.js';

/** @typedef {'title'|'playing'|'resolving'|'paused'|'gameover'|'win'} GameState */

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} ui — DOM hooks
   */
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.particles = new ParticleSystem();
    this.grid = new BubbleGrid(CFG.cols, CFG.bubbleR);

    /** @type {GameState} */
    this.state = 'title';
    this.levelIndex = 0;
    this.score = 0;
    this.best = loadBest();
    this.combo = 0;

    this.currentColor = 0;
    this.nextColor = 1;
    this.colorPool = [0, 1, 2];

    this.aimAngle = Math.PI / 2;
    this.pointer = { x: 0, y: 0, active: false };
    this.lastAimTick = 0;

    /** Flying shot */
    this.shot = null;

    /** Score popups */
    this.floatTexts = [];

    this.layout = { w: 400, h: 640, dangerY: 0, shooterX: 0, shooterY: 0 };

    this._raf = 0;
    this._lastT = 0;
    this._boundLoop = (t) => this.loop(t);

    this.levelName = '';
    this.pendingResolve = null;
  }

  init() {
    this.fitCanvas();
    window.addEventListener('resize', () => this.fitCanvas());
    this.bindInput();
    this.bindUI();
    this.showScreen('title');
    this.updateHud();
    this._lastT = performance.now();
    this._raf = requestAnimationFrame(this._boundLoop);
  }

  fitCanvas() {
    const app = document.getElementById('app');
    const availW = app?.clientWidth || window.innerWidth || 400;
    const maxW = Math.min(400, Math.max(280, availW - 16));
    // Prefer ~16:10-ish tall playfield
    let h = Math.min((window.innerHeight || 700) - 24, maxW * 1.6);
    h = Math.max(480, h);
    const w = maxW;

    // Scale bubble radius so grid fits width
    const r = w / (CFG.cols * 2);
    this.grid.r = r;
    this.grid.rowH = r * Math.sqrt(3);
    this.grid.cols = CFG.cols;

    this.layout.w = w;
    this.layout.h = h;
    this.layout.dangerY = h * CFG.dangerLineFrac;
    this.layout.shooterX = w / 2;
    this.layout.shooterY = h - CFG.shooterYOffset;

    this.renderer.resize(w, h);
  }

  bindInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    const toLocal = (e) => {
      const rect = c.getBoundingClientRect();
      const touch = e.touches?.[0] || e.changedTouches?.[0];
      const clientX = touch ? touch.clientX : e.clientX;
      const clientY = touch ? touch.clientY : e.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * this.layout.w,
        y: ((clientY - rect.top) / rect.height) * this.layout.h,
      };
    };

    const onMove = (e) => {
      if (this.state !== 'playing') return;
      e.preventDefault();
      const p = toLocal(e);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.active = true;
      this.updateAimFromPointer();
    };

    const onDown = (e) => {
      if (this.state !== 'playing') return;
      e.preventDefault();
      unlockAudio();
      const p = toLocal(e);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.active = true;
      this.updateAimFromPointer();
    };

    const onUp = (e) => {
      if (this.state !== 'playing') return;
      e.preventDefault();
      if (this.pointer.active) {
        this.tryShoot();
      }
      this.pointer.active = false;
    };

    c.addEventListener('mousemove', onMove, { passive: false });
    c.addEventListener('mousedown', onDown, { passive: false });
    window.addEventListener('mouseup', onUp, { passive: false });

    c.addEventListener('touchstart', onDown, { passive: false });
    c.addEventListener('touchmove', onMove, { passive: false });
    c.addEventListener('touchend', onUp, { passive: false });
    c.addEventListener('touchcancel', () => { this.pointer.active = false; });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (e.key === ' ' && this.state === 'playing') {
        e.preventDefault();
        this.tryShoot();
      }
    });
  }

  bindUI() {
    const $ = (id) => document.getElementById(id);
    $('btn-start')?.addEventListener('click', () => {
      unlockAudio();
      sfx.ui();
      this.startGame(0);
    });
    $('btn-pause')?.addEventListener('click', () => this.pause());
    $('btn-resume')?.addEventListener('click', () => {
      sfx.ui();
      this.resume();
    });
    $('btn-restart-pause')?.addEventListener('click', () => {
      sfx.ui();
      this.startGame(this.levelIndex);
    });
    $('btn-menu-pause')?.addEventListener('click', () => {
      sfx.ui();
      this.toTitle();
    });
    $('btn-retry')?.addEventListener('click', () => {
      sfx.ui();
      this.startGame(this.levelIndex);
    });
    $('btn-menu-over')?.addEventListener('click', () => {
      sfx.ui();
      this.toTitle();
    });
    $('btn-next')?.addEventListener('click', () => {
      sfx.ui();
      this.startGame(this.levelIndex + 1);
    });
    $('btn-menu-win')?.addEventListener('click', () => {
      sfx.ui();
      this.toTitle();
    });
  }

  showScreen(name) {
    const screens = ['title', 'pause', 'over', 'win'];
    for (const s of screens) {
      const el = document.getElementById(`screen-${s}`);
      if (!el) continue;
      const active =
        (name === 'title' && s === 'title') ||
        (name === 'paused' && s === 'pause') ||
        (name === 'gameover' && s === 'over') ||
        (name === 'win' && s === 'win');
      if (active) {
        el.hidden = false;
        el.classList.add('active');
      } else {
        el.classList.remove('active');
        el.hidden = true;
      }
    }
    const hud = document.getElementById('hud');
    const next = document.getElementById('next-panel');
    const inGame = name === 'playing' || name === 'resolving' || name === 'paused';
    if (hud) hud.hidden = !inGame || name === 'paused';
    // keep hud visible when paused behind overlay — actually hide during pause is ok
    if (hud) hud.hidden = !(name === 'playing' || name === 'resolving');
    if (next) next.hidden = !(name === 'playing' || name === 'resolving');
  }

  updateHud() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(v);
    };
    set('score', this.score);
    set('level', this.levelIndex + 1);
    set('best', this.best);
  }

  updateNextPreview() {
    this.renderer.drawNextPreview(
      document.getElementById('next-canvas'),
      this.nextColor
    );
  }

  toTitle() {
    this.state = 'title';
    this.shot = null;
    this.particles.clear();
    this.floatTexts = [];
    this.showScreen('title');
  }

  /**
   * Start / restart a level.
   * Score is reset by UI capture handlers on title / retry / pause-restart.
   * Score is kept when advancing via "Próximo nível".
   */
  startGame(levelIndex) {
    this.levelIndex = levelIndex;
    this.fitCanvas();
    const { def, grid } = buildLevelGrid(this.levelIndex, CFG.cols);
    this.levelName = def.name;
    this.grid.loadFromArray(grid);

    this.colorPool = Array.from({ length: def.colorCount }, (_, i) => i);
    this.currentColor = this.pickColor();
    this.nextColor = this.pickColor();
    this.shot = null;
    this.combo = 0;
    this._needFloatCheck = false;
    this.particles.clear();
    this.floatTexts = [];
    this.aimAngle = Math.PI / 2;
    this.pointer.active = false;
    this.state = 'playing';
    this.showScreen('playing');
    this.updateHud();
    this.updateNextPreview();
  }

  pickColor() {
    const active = this.grid.activeColors();
    const pool = active.length ? active : this.colorPool;
    // Bias toward colors on board
    if (Math.random() < 0.75 && active.length) {
      return active[Math.floor(Math.random() * active.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  advanceQueue() {
    this.currentColor = this.nextColor;
    this.nextColor = this.pickColor();
    this.updateNextPreview();
  }

  updateAimFromPointer() {
    const { shooterX, shooterY } = this.layout;
    const dx = this.pointer.x - shooterX;
    const dy = shooterY - this.pointer.y; // up positive
    let angle = Math.atan2(dy, dx);
    // clamp
    if (angle < CFG.minAngle) angle = CFG.minAngle;
    if (angle > CFG.maxAngle) angle = CFG.maxAngle;
    const prev = this.aimAngle;
    this.aimAngle = angle;
    // soft aim tick
    if (Math.abs(angle - prev) > 0.04) {
      const now = performance.now();
      if (now - this.lastAimTick > 80) {
        sfx.aimTick();
        this.lastAimTick = now;
      }
    }
  }

  isAimValid() {
    return this.aimAngle >= CFG.minAngle && this.aimAngle <= CFG.maxAngle;
  }

  tryShoot() {
    if (this.state !== 'playing' || this.shot) return;
    if (!this.isAimValid()) {
      sfx.invalid();
      return;
    }
    const { shooterX, shooterY } = this.layout;
    const a = this.aimAngle;
    this.shot = {
      x: shooterX,
      y: shooterY,
      vx: Math.cos(a) * CFG.shotSpeed,
      vy: -Math.sin(a) * CFG.shotSpeed,
      color: this.currentColor,
      r: this.grid.r * 0.95,
      trailT: 0,
    };
    sfx.shoot();
    this.advanceQueue();
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'resolving') return;
    this._prevState = this.state;
    this.state = 'paused';
    this.showScreen('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this._prevState || 'playing';
    this.showScreen(this.state === 'resolving' ? 'playing' : 'playing');
    this.state = this._prevState === 'resolving' ? 'resolving' : 'playing';
  }

  loop(t) {
    const dt = Math.min(0.033, (t - this._lastT) / 1000) || 0.016;
    this._lastT = t;

    if (this.state === 'playing' || this.state === 'resolving') {
      this.update(dt);
    } else if (this.state === 'title') {
      this.particles.update(dt);
    }

    this.draw();
    this._raf = requestAnimationFrame(this._boundLoop);
  }

  update(dt) {
    // floating score texts
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const f = this.floatTexts[i];
      f.y -= 40 * dt;
      f.life -= dt;
      f.alpha = Math.max(0, f.life / f.maxLife);
      if (f.life <= 0) this.floatTexts.splice(i, 1);
    }

    this.particles.update(dt);

    // update popping
    let stillPopping = false;
    for (const cell of this.grid.all()) {
      if (cell.popping) {
        cell.popT = (cell.popT || 0) + dt / CFG.popDuration;
        stillPopping = true;
        if (cell.popT >= 1) {
          this.grid.remove(cell.row, cell.col);
        }
      }
    }

    // update falling
    let stillFalling = false;
    for (const cell of this.grid.all()) {
      if (cell.falling) {
        stillFalling = true;
        cell.fvy += CFG.fallGravity * dt;
        cell.fx += cell.fvx * dt;
        cell.fy += cell.fvy * dt;
        if (cell.fy > this.layout.h + 40) {
          this.grid.remove(cell.row, cell.col);
        }
      }
    }

    // shot physics
    if (this.shot) {
      this.integrateShot(dt);
    }

    // resolve phase end
    if (this.state === 'resolving' && !stillPopping && !stillFalling && !this.shot) {
      this.onResolveComplete();
    }
  }

  integrateShot(dt) {
    const s = this.shot;
    const steps = 4;
    const sdt = dt / steps;
    const r = s.r;
    const w = this.layout.w;

    for (let i = 0; i < steps; i++) {
      s.x += s.vx * sdt;
      s.y += s.vy * sdt;

      // walls
      if (s.x - r < 0) {
        s.x = r;
        s.vx = Math.abs(s.vx);
      } else if (s.x + r > w) {
        s.x = w - r;
        s.vx = -Math.abs(s.vx);
      }

      // trail particles
      s.trailT += sdt;
      if (s.trailT > 0.02) {
        s.trailT = 0;
        this.particles.trail(s.x, s.y, colorById(s.color).hex);
      }

      // ceiling
      if (this.grid.hitsCeiling(s.y, r)) {
        this.stickShot();
        return;
      }

      // bubble collision
      const hit = this.grid.collideBubble(s.x, s.y, r);
      if (hit) {
        this.stickShot();
        return;
      }

      // fell off bottom — shouldn't normally happen
      if (s.y > this.layout.h + 50) {
        this.shot = null;
        this.state = 'playing';
        return;
      }
    }
  }

  stickShot() {
    const s = this.shot;
    if (!s) return;
    const snap = this.grid.findSnapCell(s.x, s.y, this.grid.r * 2.4);
    this.shot = null;

    let placed = null;
    if (!snap) {
      // emergency: nearest top-row slot by x
      const col = Math.max(
        0,
        Math.min(CFG.cols - 1, Math.round((s.x - this.grid.r) / (this.grid.r * 2)))
      );
      placed = this.grid.set(0, col, s.color) || this.grid.get(0, col);
      sfx.stick();
    } else {
      placed = this.grid.set(snap.row, snap.col, s.color);
      sfx.stick();
      this.particles.sparkle(snap.cx, snap.cy, colorById(s.color).hex, 5);
    }

    if (!placed) {
      this.state = 'playing';
      this.checkDangerAndClear();
      return;
    }

    this.state = 'resolving';
    this.combo = 0;
    this.resolveMatches(placed.row, placed.col);
  }

  resolveMatches(row, col) {
    const group = this.grid.matchGroup(row, col);
    if (group.length >= CFG.minMatch) {
      this.popGroup(group);
      this._needFloatCheck = true;
    } else {
      // Stuck without match — still safe to scan floats (usually none)
      this._needFloatCheck = false;
      this.afterPops();
    }
  }

  popGroup(group) {
    this.combo += 1;
    const mult = 1 + (this.combo - 1) * CFG.comboMult;
    let points = 0;
    let fx = 0;
    let fy = 0;

    group.forEach((cell, i) => {
      cell.popping = true;
      cell.popT = 0;
      const { x, y } = this.grid.cellCenter(cell.row, cell.col);
      fx += x;
      fy += y;
      const pts = Math.round(CFG.popBase * mult);
      points += pts;
      this.particles.burst(x, y, colorById(cell.color).hex, 10 + this.combo * 2);
      sfx.pop(i);
    });

    fx /= group.length;
    fy /= group.length;
    this.addFloatText(fx, fy - 10, `+${points}`, '#ffffff', 16);

    this.score += points;
    if (this.combo >= 2) {
      sfx.combo(this.combo);
      this.showComboToast(this.combo);
    }

    this.updateHud();
    this.saveBest();
  }

  afterPops() {
    // Drop clusters no longer attached to the ceiling
    const floating = this.grid.floatingCells();
    if (!floating.length) {
      this._needFloatCheck = false;
      return false;
    }

    this.combo += 1;
    const mult = 1 + (this.combo - 1) * CFG.comboMult;
    let points = 0;
    sfx.cascade();

    for (const cell of floating) {
      const { x, y } = this.grid.cellCenter(cell.row, cell.col);
      cell.falling = true;
      cell.fx = x;
      cell.fy = y;
      cell.fvx = (Math.random() - 0.5) * 80;
      cell.fvy = 40 + Math.random() * 60;
      points += Math.round(CFG.fallBase * mult);
      this.particles.sparkle(x, y, colorById(cell.color).hex, 4);
    }

    this.score += points;
    const mid = floating[Math.floor(floating.length / 2)];
    const { x, y } = this.grid.cellCenter(mid.row, mid.col);
    this.addFloatText(x, y, `+${points} queda!`, '#fbbf24', 17);

    if (this.combo >= 2) {
      sfx.combo(this.combo);
      this.showComboToast(this.combo);
    }
    this.updateHud();
    this.saveBest();
    this._needFloatCheck = false;
    return true;
  }

  onResolveComplete() {
    if (this._needFloatCheck) {
      const falling = this.afterPops();
      if (falling) return; // wait for fall animation
    }
    this.checkDangerAndClear();
  }

  checkDangerAndClear() {
    // Win: board empty
    const remaining = this.grid.all().filter((c) => !c.popping && !c.falling);
    if (remaining.length === 0) {
      this.winLevel();
      return;
    }

    // Game over: any bubble below danger line
    const maxY = this.grid.maxY();
    if (maxY + this.grid.r >= this.layout.dangerY) {
      this.gameOver();
      return;
    }

    this.state = 'playing';
    this.combo = 0;
  }

  winLevel() {
    const bonus = CFG.clearBonus + this.levelIndex * CFG.levelBonus;
    this.score += bonus;
    this.saveBest();
    this.updateHud();
    this.state = 'win';
    sfx.levelClear();
    this.particles.confetti(
      this.layout.w / 2,
      this.layout.h / 2,
      this.layout.w,
      this.layout.h,
      50
    );

    const title = document.getElementById('win-title');
    const msg = document.getElementById('win-msg');
    const sc = document.getElementById('win-score');
    const bn = document.getElementById('win-bonus');
    if (title) title.textContent = 'Nível limpo!';
    if (msg) msg.textContent = `${this.levelName} concluído`;
    if (sc) sc.textContent = String(this.score);
    if (bn) bn.textContent = `+${bonus}`;
    this.showScreen('win');
  }

  gameOver() {
    this.state = 'gameover';
    sfx.lose();
    this.saveBest();

    const title = document.getElementById('over-title');
    const msg = document.getElementById('over-msg');
    const sc = document.getElementById('over-score');
    const lv = document.getElementById('over-level');
    const be = document.getElementById('over-best');
    if (title) title.textContent = 'Fim de jogo';
    if (msg) msg.textContent = 'As bolinhas chegaram à linha de perigo';
    if (sc) sc.textContent = String(this.score);
    if (lv) lv.textContent = String(this.levelIndex + 1);
    if (be) be.textContent = String(this.best);
    this.showScreen('gameover');
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem(STORAGE_KEY, String(this.best));
      } catch (_) { /* ignore */ }
    }
  }

  addFloatText(x, y, text, color, size) {
    this.floatTexts.push({
      x, y, text, color, size,
      life: 0.9,
      maxLife: 0.9,
      alpha: 1,
    });
  }

  showComboToast(n) {
    const el = document.getElementById('combo-toast');
    if (!el) return;
    el.textContent = n >= 3 ? `COMBO x${n}!` : `Combo x${n}`;
    el.classList.add('show');
    clearTimeout(this._comboTimer);
    this._comboTimer = setTimeout(() => el.classList.remove('show'), 700);
  }

  draw() {
    const r = this.renderer;
    r.clear();

    if (this.state === 'title') {
      this.drawTitleBackground();
      return;
    }

    // danger line
    r.drawDangerLine(this.layout.dangerY);

    // grid
    r.drawGrid(this.grid);

    // aim + shooter
    if (this.state === 'playing' || this.state === 'resolving' || this.state === 'paused') {
      const invalid = !this.isAimValid();
      if (this.state === 'playing' && !this.shot) {
        r.drawAimLine(
          this.layout.shooterX,
          this.layout.shooterY,
          this.aimAngle,
          this.layout.w,
          this.grid.r * 0.9,
          invalid,
          this.grid
        );
      }
      if (!this.shot) {
        r.drawShooterBase(
          this.layout.shooterX,
          this.layout.shooterY,
          this.aimAngle,
          this.currentColor,
          invalid
        );
      } else {
        // pedestal without bubble
        r.drawShooterBase(
          this.layout.shooterX,
          this.layout.shooterY,
          this.aimAngle,
          this.currentColor,
          false
        );
        // hide the drawn current by drawing over — simpler: draw shot only
        r.drawBubble(this.shot.x, this.shot.y, this.shot.r, this.shot.color, { glow: true });
      }
    }

    // when shot in air, still draw next-ready pedestal without double bubble
    // (handled above)

    this.particles.draw(r.ctx);
    r.drawFloatingScore(this.floatTexts);

    // level name subtle
    if (this.state === 'playing' || this.state === 'resolving') {
      const ctx = r.ctx;
      ctx.save();
      ctx.font = '500 11px Outfit, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(139, 147, 176, 0.55)';
      ctx.textAlign = 'left';
      ctx.fillText(this.levelName, 14, this.layout.h - 14);
      ctx.restore();
    }
  }

  drawTitleBackground() {
    const r = this.renderer;
    // decorative idle bubbles
    if (!this._titleOrbs) {
      this._titleOrbs = Array.from({ length: 12 }, (_, i) => ({
        x: Math.random() * this.layout.w,
        y: Math.random() * this.layout.h,
        color: i % 6,
        phase: Math.random() * Math.PI * 2,
        sp: 0.3 + Math.random() * 0.4,
      }));
    }
    const t = performance.now() / 1000;
    for (const o of this._titleOrbs) {
      const y = o.y + Math.sin(t * o.sp + o.phase) * 12;
      r.drawBubble(o.x, y, this.grid.r * 0.7, o.color, { alpha: 0.35, glow: true });
    }
    this.particles.draw(r.ctx);
  }
}

function loadBest() {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}
