/**
 * Combinação — engine Match-3
 * Specials: row/col (4-line), bomb (T/L), rainbow (5-line)
 */

import { sfx, resumeAudio } from "./audio.js";

export const ROWS = 8;
export const COLS = 8;
export const COLORS = 6;
export const GOAL_SCORE = 2500;
export const START_MOVES = 28;
const STORAGE_KEY = "combinacao_best_v1";

let uid = 1;
function nextId() {
  return uid++;
}

function randColor() {
  return Math.floor(Math.random() * COLORS);
}

function makeOrb(color, special = null) {
  return { id: nextId(), color, special };
}

export class Game {
  constructor(ui) {
    this.ui = ui;
    this.grid = [];
    this.score = 0;
    this.moves = START_MOVES;
    this.combo = 0;
    this.best = Number((typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) || 0);
    this.busy = false;
    this.selected = null;
    this.running = false;
    this.dragStart = null;
  }

  get goal() {
    return GOAL_SCORE;
  }

  get startMoves() {
    return START_MOVES;
  }

  inBounds(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
  }

  adjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  /** Board without immediate matches */
  generateBoard() {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let color;
        let guard = 0;
        do {
          color = randColor();
          guard++;
        } while (guard < 40 && this.wouldMatchAt(r, c, color));
        this.grid[r][c] = makeOrb(color);
      }
    }
    if (!this.hasAnyMove()) this.shuffleSilent();
  }

  wouldMatchAt(r, c, color) {
    // horizontal
    let left = 0;
    for (let k = c - 1; k >= 0; k--) {
      const cell = this.grid[r][k];
      if (cell && cell.color === color && cell.special !== "rainbow") left++;
      else break;
    }
    let right = 0;
    for (let k = c + 1; k < COLS; k++) {
      const cell = this.grid[r][k];
      if (cell && cell.color === color && cell.special !== "rainbow") right++;
      else break;
    }
    if (left + right >= 2) return true;

    // vertical
    let up = 0;
    for (let k = r - 1; k >= 0; k--) {
      const cell = this.grid[k][c];
      if (cell && cell.color === color && cell.special !== "rainbow") up++;
      else break;
    }
    let down = 0;
    for (let k = r + 1; k < ROWS; k++) {
      const cell = this.grid[k][c];
      if (cell && cell.color === color && cell.special !== "rainbow") down++;
      else break;
    }
    return up + down >= 2;
  }

  start() {
    resumeAudio();
    this.score = 0;
    this.moves = START_MOVES;
    this.combo = 0;
    this.busy = false;
    this.selected = null;
    this.running = true;
    this.generateBoard();
    this.ui.renderAll(this);
    this.ui.showScreen("game");
  }

  pause() {
    if (!this.running || this.busy) return;
    this.ui.showScreen("pause");
  }

  resume() {
    if (!this.running) return;
    this.ui.showScreen("game");
  }

  quitToMenu() {
    this.running = false;
    this.busy = false;
    this.selected = null;
    this.ui.showScreen("title");
    this.ui.updateTitle(this);
  }

  posKey(r, c) {
    return `${r},${c}`;
  }

  /**
   * Find match groups + special creation plan.
   * Returns { remove: Set<"r,c">, create: Map<"r,c", specialType> }
   */
  findMatches() {
    const hRuns = [];
    const vRuns = [];

    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const cell = this.grid[r][c];
        if (!cell || cell.special === "rainbow") {
          c++;
          continue;
        }
        const color = cell.color;
        let end = c + 1;
        while (end < COLS) {
          const n = this.grid[r][end];
          if (n && n.special !== "rainbow" && n.color === color) end++;
          else break;
        }
        const len = end - c;
        if (len >= 3) {
          const cells = [];
          for (let k = c; k < end; k++) cells.push({ r, c: k });
          hRuns.push({ color, cells, len });
        }
        c = end;
      }
    }

    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const cell = this.grid[r][c];
        if (!cell || cell.special === "rainbow") {
          r++;
          continue;
        }
        const color = cell.color;
        let end = r + 1;
        while (end < ROWS) {
          const n = this.grid[end][c];
          if (n && n.special !== "rainbow" && n.color === color) end++;
          else break;
        }
        const len = end - r;
        if (len >= 3) {
          const cells = [];
          for (let k = r; k < end; k++) cells.push({ r: k, c });
          vRuns.push({ color, cells, len });
        }
        r = end;
      }
    }

    const remove = new Set();
    const create = new Map();
    const covered = new Map(); // key -> list of run tags

    for (const run of hRuns) {
      for (const p of run.cells) {
        const k = this.posKey(p.r, p.c);
        remove.add(k);
        if (!covered.has(k)) covered.set(k, []);
        covered.get(k).push({ dir: "h", len: run.len, color: run.color, cells: run.cells });
      }
    }
    for (const run of vRuns) {
      for (const p of run.cells) {
        const k = this.posKey(p.r, p.c);
        remove.add(k);
        if (!covered.has(k)) covered.set(k, []);
        covered.get(k).push({ dir: "v", len: run.len, color: run.color, cells: run.cells });
      }
    }

    if (remove.size === 0) return { remove, create };

    // Prefer special creation at intersection (T/L) or longest run center
    const usedForCreate = new Set();

    // T/L / cross: cell in both h and v
    for (const [k, runs] of covered) {
      const hasH = runs.some((x) => x.dir === "h");
      const hasV = runs.some((x) => x.dir === "v");
      if (hasH && hasV && !usedForCreate.has(k)) {
        create.set(k, { special: "bomb", color: runs[0].color });
        usedForCreate.add(k);
      }
    }

    // 5+ line → rainbow
    for (const run of [...hRuns, ...vRuns]) {
      if (run.len >= 5) {
        const mid = run.cells[Math.floor(run.cells.length / 2)];
        const k = this.posKey(mid.r, mid.c);
        if (!usedForCreate.has(k)) {
          create.set(k, { special: "rainbow", color: run.color });
          usedForCreate.add(k);
        }
      }
    }

    // 4 line → row/col
    for (const run of hRuns) {
      if (run.len === 4) {
        const mid = run.cells[Math.floor(run.cells.length / 2)];
        const k = this.posKey(mid.r, mid.c);
        if (!usedForCreate.has(k) && !create.has(k)) {
          create.set(k, { special: "row", color: run.color });
          usedForCreate.add(k);
        }
      }
    }
    for (const run of vRuns) {
      if (run.len === 4) {
        const mid = run.cells[Math.floor(run.cells.length / 2)];
        const k = this.posKey(mid.r, mid.c);
        if (!usedForCreate.has(k) && !create.has(k)) {
          create.set(k, { special: "col", color: run.color });
          usedForCreate.add(k);
        }
      }
    }

    return { remove, create };
  }

  expandSpecials(seedKeys) {
    const remove = new Set(seedKeys);
    const queue = [...seedKeys];
    const activated = new Set();

    while (queue.length) {
      const k = queue.shift();
      if (activated.has(k)) continue;
      const [r, c] = k.split(",").map(Number);
      const cell = this.grid[r]?.[c];
      if (!cell || !cell.special) continue;
      activated.add(k);

      if (cell.special === "row") {
        for (let cc = 0; cc < COLS; cc++) {
          const nk = this.posKey(r, cc);
          if (!remove.has(nk)) {
            remove.add(nk);
            queue.push(nk);
          }
        }
      } else if (cell.special === "col") {
        for (let rr = 0; rr < ROWS; rr++) {
          const nk = this.posKey(rr, c);
          if (!remove.has(nk)) {
            remove.add(nk);
            queue.push(nk);
          }
        }
      } else if (cell.special === "bomb") {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (!this.inBounds(rr, cc)) continue;
            const nk = this.posKey(rr, cc);
            if (!remove.has(nk)) {
              remove.add(nk);
              queue.push(nk);
            }
          }
        }
      } else if (cell.special === "rainbow") {
        // alone in match shouldn't happen often; clear same color if any neighbor color known
        // handled at swap time mostly
      }
    }

    return { remove, activatedSpecials: activated.size > 0 };
  }

  async resolveBoard(fromSwap = null) {
    let chain = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let { remove, create } = this.findMatches();
      if (remove.size === 0) break;

      chain++;
      this.combo = chain;
      const expanded = this.expandSpecials(remove);
      remove = expanded.remove;

      // Prefer special at swap position if applicable
      if (fromSwap && chain === 1) {
        const sk = this.posKey(fromSwap.r, fromSwap.c);
        if (remove.has(sk) && create.size) {
          // if create not at swap, move one create to swap if same color run
          // keep algorithm simple: already mid-based
        }
      }

      const pts = this.scoreRemoval(remove.size, chain, expanded.activatedSpecials);
      this.score += pts;
      this.maybeBest();

      sfx.match(chain);
      if (chain > 1) sfx.cascade(chain);
      if (expanded.activatedSpecials) sfx.special();
      if (chain >= 3) this.ui.shake(chain >= 5 ? "hard" : "soft");

      await this.ui.animateRemove(this, remove, pts, create);
      this.applyRemoval(remove, create);
      this.ui.syncOrbs(this, { spawn: false });

      const fell = this.applyGravity();
      await this.ui.animateFall(this, fell);

      const spawned = this.fillEmpty();
      await this.ui.animateSpawn(this, spawned);

      this.ui.updateHud(this);
      fromSwap = null;
    }

    this.combo = 0;
    this.ui.updateHud(this);
  }

  scoreRemoval(count, chain, hadSpecial) {
    const base = count * 40;
    const mult = 1 + (chain - 1) * 0.65;
    const bonus = hadSpecial ? 80 : 0;
    return Math.round(base * mult + bonus + chain * 15);
  }

  applyRemoval(remove, create) {
    const created = [];
    for (const [k, info] of create) {
      if (!remove.has(k)) continue;
      const [r, c] = k.split(",").map(Number);
      created.push({ r, c, special: info.special, color: info.color });
    }

    for (const k of remove) {
      const [r, c] = k.split(",").map(Number);
      this.grid[r][c] = null;
    }

    for (const item of created) {
      this.grid[item.r][item.c] = makeOrb(item.color, item.special);
    }
  }

  applyGravity() {
    const moves = [];
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r][c]) {
          if (r !== write) {
            this.grid[write][c] = this.grid[r][c];
            this.grid[r][c] = null;
            moves.push({ id: this.grid[write][c].id, fromR: r, fromC: c, toR: write, toC: c });
          }
          write--;
        }
      }
    }
    return moves;
  }

  fillEmpty() {
    const spawned = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (!this.grid[r][c]) {
          const orb = makeOrb(randColor());
          this.grid[r][c] = orb;
          spawned.push({ r, c, id: orb.id });
        }
      }
    }
    return spawned;
  }

  maybeBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(STORAGE_KEY, String(this.best));
        }
      } catch {
        /* private mode / blocked storage */
      }
    }
  }

  hasAnyMove() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // try right
        if (c + 1 < COLS && this.swapCreatesMatch(r, c, r, c + 1)) return true;
        // try down
        if (r + 1 < ROWS && this.swapCreatesMatch(r, c, r + 1, c)) return true;
      }
    }
    return false;
  }

  swapCreatesMatch(r1, c1, r2, c2) {
    const a = this.grid[r1][c1];
    const b = this.grid[r2][c2];
    if (!a || !b) return false;

    // rainbow always "works" when swapped
    if (a.special === "rainbow" || b.special === "rainbow") return true;
    // two specials
    if (a.special && b.special) return true;

    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;
    const { remove } = this.findMatches();
    this.grid[r1][c1] = a;
    this.grid[r2][c2] = b;
    return remove.size > 0;
  }

  shuffleSilent() {
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        cells.push(this.grid[r][c]);
      }
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.grid[r][c] = cells[i++];
      }
    }
  }

  async ensureMovesOrShuffle() {
    let tries = 0;
    while (!this.hasAnyMove() && tries < 30) {
      tries++;
      this.ui.showShuffleToast(true);
      sfx.shuffle();
      this.shuffleSilent();
      this.ui.syncOrbs(this, { spawn: true });
      await wait(450);
      // resolve accidental matches after shuffle
      await this.resolveBoard();
    }
    this.ui.showShuffleToast(false);
    if (!this.hasAnyMove()) {
      // extremely rare: end as loss if still stuck
      this.endGame(false, "Sem movimentos possíveis após embaralhar.");
    }
  }

  swapCells(r1, c1, r2, c2) {
    const t = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = t;
  }

  async trySwap(r1, c1, r2, c2) {
    if (this.busy || !this.running) return;
    if (!this.inBounds(r1, c1) || !this.inBounds(r2, c2)) return;
    if (!this.adjacent({ r: r1, c: c1 }, { r: r2, c: c2 })) return;
    if (!this.grid[r1][c1] || !this.grid[r2][c2]) return;

    this.busy = true;
    this.selected = null;
    this.ui.setSelected(null);

    const a = this.grid[r1][c1];
    const b = this.grid[r2][c2];

    // Rainbow swap
    if (a.special === "rainbow" || b.special === "rainbow") {
      this.swapCells(r1, c1, r2, c2);
      await this.ui.animateSwap(this, r1, c1, r2, c2);
      sfx.swap();
      this.moves--;
      this.ui.updateHud(this);

      const rainbowPos = this.grid[r1][c1]?.special === "rainbow" ? { r: r1, c: c1 } : { r: r2, c: c2 };
      const otherPos = this.grid[r1][c1]?.special === "rainbow" ? { r: r2, c: c2 } : { r: r1, c: c1 };
      const other = this.grid[otherPos.r][otherPos.c];
      const color = other?.special === "rainbow" ? randColor() : other.color;

      const remove = new Set();
      remove.add(this.posKey(rainbowPos.r, rainbowPos.c));
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = this.grid[r][c];
          if (cell && (cell.color === color || cell.special === "rainbow")) {
            remove.add(this.posKey(r, c));
          }
        }
      }
      // if other is special, expand
      const expanded = this.expandSpecials(remove);
      const finalRemove = expanded.remove;

      this.combo = 1;
      const pts = this.scoreRemoval(finalRemove.size, 1, true) + 200;
      this.score += pts;
      this.maybeBest();
      sfx.special();
      sfx.match(2);
      this.ui.shake("hard");
      await this.ui.animateRemove(this, finalRemove, pts, new Map());
      this.applyRemoval(finalRemove, new Map());
      this.ui.syncOrbs(this, { spawn: false });
      const fell = this.applyGravity();
      await this.ui.animateFall(this, fell);
      const spawned = this.fillEmpty();
      await this.ui.animateSpawn(this, spawned);
      this.ui.updateHud(this);
      await this.resolveBoard();
      await this.afterMove();
      this.busy = false;
      return;
    }

    // Two specials combo: activate both areas
    if (a.special && b.special) {
      this.swapCells(r1, c1, r2, c2);
      await this.ui.animateSwap(this, r1, c1, r2, c2);
      sfx.swap();
      this.moves--;
      this.ui.updateHud(this);
      let remove = new Set([this.posKey(r1, c1), this.posKey(r2, c2)]);
      remove = this.expandSpecials(remove).remove;
      this.combo = 1;
      const pts = this.scoreRemoval(remove.size, 1, true) + 120;
      this.score += pts;
      this.maybeBest();
      sfx.special();
      this.ui.shake("hard");
      await this.ui.animateRemove(this, remove, pts, new Map());
      this.applyRemoval(remove, new Map());
      this.ui.syncOrbs(this, { spawn: false });
      const fell = this.applyGravity();
      await this.ui.animateFall(this, fell);
      const spawned = this.fillEmpty();
      await this.ui.animateSpawn(this, spawned);
      this.ui.updateHud(this);
      await this.resolveBoard();
      await this.afterMove();
      this.busy = false;
      return;
    }

    this.swapCells(r1, c1, r2, c2);
    await this.ui.animateSwap(this, r1, c1, r2, c2);
    sfx.swap();

    const { remove } = this.findMatches();
    if (remove.size === 0) {
      // invalid
      sfx.invalid();
      this.ui.markInvalid(r1, c1, r2, c2);
      this.swapCells(r1, c1, r2, c2);
      await this.ui.animateSwap(this, r1, c1, r2, c2);
      this.busy = false;
      return;
    }

    this.moves--;
    this.ui.updateHud(this);
    await this.resolveBoard({ r: r2, c: c2 });
    await this.afterMove();
    this.busy = false;
  }

  async afterMove() {
    if (this.score >= GOAL_SCORE) {
      this.endGame(true, "Você atingiu a meta de pontos. Excelente!");
      return;
    }
    if (this.moves <= 0) {
      this.endGame(false, "Movimentos esgotados. Tente novamente!");
      return;
    }
    await this.ensureMovesOrShuffle();
  }

  endGame(won, message) {
    this.running = false;
    this.busy = false;
    this.maybeBest();
    if (won) sfx.levelClear();
    else sfx.gameOver();
    this.ui.showEnd(won, message, this);
  }

  onOrbPointerDown(r, c, e) {
    if (this.busy || !this.running) return;
    resumeAudio();
    this.dragStart = { r, c, x: e.clientX, y: e.clientY };
  }

  onOrbPointerUp(r, c) {
    if (this.busy || !this.running) return;
    if (!this.dragStart) return;
    if (this.dragStart.swiped) {
      this.dragStart = null;
      return;
    }
    const start = this.dragStart;
    this.dragStart = null;
    // Tap: select / swap via click-click flow
    if (start.r === r && start.c === c) {
      this.handleTap(r, c);
    }
  }

  onPointerMoveGlobal(e) {
    if (!this.dragStart || this.busy || !this.running) return;
    if (this.dragStart.swiped) return;
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    const th = 22;
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;

    let tr = this.dragStart.r;
    let tc = this.dragStart.c;
    if (Math.abs(dx) > Math.abs(dy)) {
      tc += dx > 0 ? 1 : -1;
    } else {
      tr += dy > 0 ? 1 : -1;
    }
    const sr = this.dragStart.r;
    const sc = this.dragStart.c;
    this.dragStart.swiped = true;
    this.dragStart = null;
    this.trySwap(sr, sc, tr, tc);
  }

  handleTap(r, c) {
    if (!this.grid[r][c]) return;
    if (!this.selected) {
      this.selected = { r, c };
      this.ui.setSelected(this.selected);
      sfx.select();
      return;
    }
    if (this.selected.r === r && this.selected.c === c) {
      this.selected = null;
      this.ui.setSelected(null);
      return;
    }
    if (this.adjacent(this.selected, { r, c })) {
      const s = this.selected;
      this.selected = null;
      this.ui.setSelected(null);
      this.trySwap(s.r, s.c, r, c);
    } else {
      this.selected = { r, c };
      this.ui.setSelected(this.selected);
      sfx.select();
    }
  }
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
