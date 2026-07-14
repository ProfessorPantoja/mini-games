import { ROWS, COLS, GOAL_SCORE } from "./game.js";
import { sfx, resumeAudio } from "./audio.js";

export class UI {
  constructor() {
    this.board = document.getElementById("board");
    this.canvas = document.getElementById("fx-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.floatLayer = document.getElementById("float-scores");
    this.shakeLayer = document.getElementById("shake-layer");
    this.orbEls = new Map(); // id -> element
    this.particles = [];
    this.raf = null;
    this.cellSize = 0;
    this.gap = 0;
    this.pad = 0;

    this.screens = {
      title: document.getElementById("screen-title"),
      howto: document.getElementById("screen-howto"),
      game: document.getElementById("screen-game"),
      pause: document.getElementById("screen-pause"),
      end: document.getElementById("screen-end"),
    };

    this.measure();
    window.addEventListener("resize", () => {
      this.measure();
      // reposition without full rebuild if game provides grid later via lastGame
      if (this.lastGame) this.syncOrbs(this.lastGame, { spawn: false });
    });
    this.loopFx();
  }

  measure() {
    const styles = getComputedStyle(document.documentElement);
    this.cellSize = parseFloat(styles.getPropertyValue("--cell")) || 48;
    this.gap = parseFloat(styles.getPropertyValue("--gap")) || 4;
    this.pad = parseFloat(styles.getPropertyValue("--board-pad")) || 10;
    const w = this.board.clientWidth || this.cellSize * COLS + this.gap * (COLS - 1) + this.pad * 2;
    const h = this.board.clientHeight || this.cellSize * ROWS + this.gap * (ROWS - 1) + this.pad * 2;
    this.canvas.width = w * devicePixelRatio;
    this.canvas.height = h * devicePixelRatio;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  cellPos(r, c) {
    const x = this.pad + c * (this.cellSize + this.gap);
    const y = this.pad + r * (this.cellSize + this.gap);
    return { x, y };
  }

  showScreen(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      if (!el) continue;
      const on = key === name;
      if (on) {
        el.hidden = false;
        requestAnimationFrame(() => el.classList.add("active"));
      } else {
        el.classList.remove("active");
        // keep overlay removals clean
        setTimeout(() => {
          if (!el.classList.contains("active")) el.hidden = true;
        }, 280);
      }
    }
    // overlays on top of game
    if (name === "pause" || name === "end") {
      this.screens.game.hidden = false;
      this.screens.game.classList.add("active");
    }
  }

  updateTitle(game) {
    document.getElementById("title-best").textContent = formatNum(game.best);
    document.getElementById("title-goal").textContent = formatNum(GOAL_SCORE);
    document.getElementById("title-moves").textContent = String(game.startMoves);
  }

  updateHud(game) {
    document.getElementById("hud-score").textContent = formatNum(game.score);
    document.getElementById("hud-goal").textContent = formatNum(GOAL_SCORE);
    document.getElementById("hud-moves").textContent = String(game.moves);
    document.getElementById("hud-combo").textContent = `×${Math.max(1, game.combo || 1)}`;
    const pct = Math.min(100, (game.score / GOAL_SCORE) * 100);
    document.getElementById("progress-bar").style.width = `${pct}%`;
    document.getElementById("best-inline").textContent = `Recorde: ${formatNum(game.best)}`;
  }

  renderAll(game) {
    this.lastGame = game;
    this.bindBoard(game);
    this.measure();
    this.board.innerHTML = "";
    this.orbEls.clear();
    this.floatLayer.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = game.grid[r][c];
        if (!cell) continue;
        const el = this.createOrbEl(cell, r, c);
        this.board.appendChild(el);
        this.orbEls.set(cell.id, el);
      }
    }
    this.updateHud(game);
  }

  createOrbEl(cell, r, c) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = this.orbClass(cell);
    el.dataset.id = String(cell.id);
    el.dataset.r = String(r);
    el.dataset.c = String(c);
    el.setAttribute("aria-label", `Orbe linha ${r + 1} coluna ${c + 1}`);
    const { x, y } = this.cellPos(r, c);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    return el;
  }

  bindBoard(game) {
    if (this._boardBound) return;
    this._boardBound = true;
    this.board.addEventListener("pointerdown", (e) => {
      const el = e.target.closest(".orb");
      if (!el || !this.board.contains(el)) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      game.onOrbPointerDown(r, c, e);
    });
    this.board.addEventListener("pointerup", (e) => {
      const el = e.target.closest(".orb");
      if (!el || !this.board.contains(el)) return;
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      game.onOrbPointerUp(r, c);
    });
  }

  orbClass(cell) {
    let cls = `orb c${cell.color}`;
    if (cell.special) cls += ` special ${cell.special}`;
    return cls;
  }

  syncOrbs(game, { spawn = false } = {}) {
    this.lastGame = game;
    this.measure();
    const live = new Set();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = game.grid[r][c];
        if (!cell) continue;
        live.add(cell.id);
        let el = this.orbEls.get(cell.id);
        const { x, y } = this.cellPos(r, c);
        if (!el) {
          el = this.createOrbEl(cell, r, c);
          this.board.appendChild(el);
          this.orbEls.set(cell.id, el);
          if (spawn) {
            el.classList.add("spawning");
            el.addEventListener("animationend", () => el.classList.remove("spawning"), { once: true });
          }
        } else {
          el.className = this.orbClass(cell);
          if (game.selected && game.selected.r === r && game.selected.c === c) {
            el.classList.add("selected");
          }
          el.dataset.r = String(r);
          el.dataset.c = String(c);
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.opacity = "1";
          el.style.transform = "";
        }
      }
    }

    for (const [id, el] of [...this.orbEls.entries()]) {
      if (!live.has(id)) {
        el.remove();
        this.orbEls.delete(id);
      }
    }
  }

  setSelected(sel) {
    for (const el of this.orbEls.values()) el.classList.remove("selected");
    if (!sel || !this.lastGame) return;
    const cell = this.lastGame.grid[sel.r][sel.c];
    if (!cell) return;
    const el = this.orbEls.get(cell.id);
    if (el) el.classList.add("selected");
  }

  markInvalid(r1, c1, r2, c2) {
    const g = this.lastGame;
    if (!g) return;
    for (const [r, c] of [
      [r1, c1],
      [r2, c2],
    ]) {
      const cell = g.grid[r][c];
      if (!cell) continue;
      const el = this.orbEls.get(cell.id);
      if (!el) continue;
      el.classList.remove("invalid");
      // reflow
      void el.offsetWidth;
      el.classList.add("invalid");
      el.addEventListener("animationend", () => el.classList.remove("invalid"), { once: true });
    }
  }

  async animateSwap(game, r1, c1, r2, c2) {
    // After logical swap, positions in grid already swapped — sync animates via CSS left/top
    this.syncOrbs(game, { spawn: false });
    await wait(280);
  }

  async animateRemove(game, removeSet, points, createMap) {
    const centers = [];
    for (const k of removeSet) {
      const [r, c] = k.split(",").map(Number);
      // skip cells that become specials (they stay visually as new orb)
      if (createMap.has(k)) continue;
      const cell = game.grid[r][c];
      if (!cell) continue;
      const el = this.orbEls.get(cell.id);
      if (el) {
        el.classList.add("removing");
        const { x, y } = this.cellPos(r, c);
        centers.push({
          x: x + this.cellSize / 2,
          y: y + this.cellSize / 2,
          color: cell.color,
        });
      }
    }

    // float score at average center
    if (centers.length) {
      const ax = centers.reduce((s, p) => s + p.x, 0) / centers.length;
      const ay = centers.reduce((s, p) => s + p.y, 0) / centers.length;
      this.spawnFloat(ax, ay, points, points >= 300);
      for (const p of centers) this.burst(p.x, p.y, p.color);
    }

    await wait(300);
  }

  async animateFall(game) {
    this.syncOrbs(game, { spawn: false });
    await wait(320);
  }

  async animateSpawn(game, spawned) {
    this.syncOrbs(game, { spawn: true });
    await wait(280);
  }

  spawnFloat(x, y, points, big) {
    const el = document.createElement("div");
    el.className = "float-score" + (big ? " big" : "");
    el.textContent = `+${formatNum(points)}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.floatLayer.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  colorCss(i) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--c${i}`).trim() || "#fff";
  }

  burst(x, y, colorIdx) {
    const color = this.colorCss(colorIdx);
    const n = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = 1.2 + Math.random() * 2.8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 0.5,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  loopFx() {
    const tick = () => {
      const w = this.canvas.width / devicePixelRatio;
      const h = this.canvas.height / devicePixelRatio;
      this.ctx.clearRect(0, 0, w, h);
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.life -= p.decay;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        this.ctx.globalAlpha = Math.max(0, p.life);
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.globalAlpha = 1;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  shake(level = "soft") {
    this.shakeLayer.classList.remove("shake");
    void this.shakeLayer.offsetWidth;
    this.shakeLayer.classList.add("shake");
    setTimeout(() => this.shakeLayer.classList.remove("shake"), 400);
  }

  showShuffleToast(show) {
    const el = document.getElementById("shuffle-toast");
    el.hidden = !show;
  }

  showEnd(won, message, game) {
    const panel = document.querySelector(".end-panel");
    panel.classList.toggle("win", won);
    panel.classList.toggle("lose", !won);
    document.getElementById("end-eyebrow").textContent = won ? "Missão concluída" : "Fim de partida";
    document.getElementById("end-title").textContent = won ? "Vitória!" : "Quase lá";
    document.getElementById("end-message").textContent = message;
    document.getElementById("end-score").textContent = formatNum(game.score);
    document.getElementById("end-best").textContent = formatNum(game.best);
    this.showScreen("end");
  }
}

function formatNum(n) {
  return Number(n).toLocaleString("pt-BR");
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

export function wireControls(game, ui) {
  const start = () => {
    resumeAudio();
    sfx.ui();
    game.start();
  };

  document.getElementById("btn-start").addEventListener("click", start);
  document.getElementById("btn-howto").addEventListener("click", () => {
    resumeAudio();
    sfx.ui();
    ui.showScreen("howto");
  });
  document.getElementById("btn-howto-back").addEventListener("click", () => {
    sfx.ui();
    ui.showScreen("title");
  });
  document.getElementById("btn-pause").addEventListener("click", () => {
    sfx.ui();
    game.pause();
  });
  document.getElementById("btn-resume").addEventListener("click", () => {
    sfx.ui();
    game.resume();
  });
  document.getElementById("btn-restart-pause").addEventListener("click", () => {
    sfx.ui();
    game.start();
  });
  document.getElementById("btn-quit-pause").addEventListener("click", () => {
    sfx.ui();
    game.quitToMenu();
  });
  document.getElementById("btn-again").addEventListener("click", () => {
    sfx.ui();
    game.start();
  });
  document.getElementById("btn-menu").addEventListener("click", () => {
    sfx.ui();
    game.quitToMenu();
  });

  window.addEventListener("pointermove", (e) => game.onPointerMoveGlobal(e));

  document.querySelectorAll("[data-sfx]").forEach((btn) => {
    btn.addEventListener("pointerdown", () => resumeAudio());
  });
}
