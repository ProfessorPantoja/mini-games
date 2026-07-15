/**
 * NEON RALLY — remake espiritual de Rally-X (v2)
 *
 * Feel arcade, não simulador:
 *  - Mapa inteiro na tela + radar
 *  - Movimento 4 direções (estilo Namco)
 *  - Fumaça que manda o caçador girar de verdade
 *  - 3 caçadores com pathfinding + flags pra limpar
 */
(() => {
  "use strict";

  const TILE = 32;
  const CAR_R = 11;
  const SPEED = 172;
  const ENEMY_SPEED = 142;
  const TURN_WIN = 0.48; // fração do tile pra encaixar curva
  const SMOKE_COST = 20; // /s segurando
  const SMOKE_MAX = 100;
  const SMOKE_REGEN = 12;
  const SMOKE_R = 17;
  const SMOKE_LIFE = 4.0;
  const SPIN_TIME = 1.65;
  const HIT_R = 13;
  const FLAG_R = 11;

  // # parede · . estrada · S humano · E caçador · F flag
  // Compacto, aberto, 100% conectado — cabe na tela.
  const MAP_SRC = [
    "########################",
    "#S....#......#........E#",
    "#.##..#..##..#..####..##",
    "#.....#......#.........#",
    "#..####..##..####..##..#",
    "#........##........##..#",
    "##..###......###.......#",
    "#...#...F....#...F..##.#",
    "#...#..####..#..###....#",
    "#......#........#......#",
    "###....#..####..#....###",
    "#......#..#F.#..#......#",
    "#..##.....#..#.....##..#",
    "#..##..####..####..##..#",
    "#........F........E....#",
    "##..####....####..####.#",
    "#.......#..#...........#",
    "#..###..#..#..###..##..#",
    "#E......#..#......F...S#",
    "########################",
  ];

  const DIRS = {
    up: { x: 0, y: -1, a: -Math.PI / 2 },
    down: { x: 0, y: 1, a: Math.PI / 2 },
    left: { x: -1, y: 0, a: Math.PI },
    right: { x: 1, y: 0, a: 0 },
  };

  // ─── DOM ──────────────────────────────────────────────────
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const bannerEl = document.getElementById("banner");
  const hudFlags = document.getElementById("hud-flags");
  const hudOil = document.getElementById("hud-oil");
  const hudP1 = document.getElementById("hud-p1");
  const hudP2 = document.getElementById("hud-p2");
  const statP2 = document.getElementById("stat-p2");
  const statScore = document.getElementById("stat-score");

  const keys = Object.create(null);

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "KeyP" && (state.phase === "play" || state.phase === "pause")) togglePause();
    if (e.code === "KeyR") goMenu();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => startGame(btn.dataset.mode));
  });

  const state = {
    phase: "menu",
    mode: "ai",
    maze: null,
    cars: [],
    smokes: [],
    flags: [],
    particles: [],
    floats: [],
    time: 0,
    totalFlags: 0,
    shake: 0,
    flash: 0,
    ox: 0,
    oy: 0,
    ended: false,
  };

  // ─── Maze ─────────────────────────────────────────────────
  function parseMaze() {
    const rows = MAP_SRC.length;
    const cols = MAP_SRC[0].length;
    const grid = [];
    const playerSpawns = [];
    const enemySpawns = [];
    const flags = [];

    for (let r = 0; r < rows; r++) {
      const line = MAP_SRC[r];
      if (line.length !== cols) throw new Error(`Map row ${r}: width ${line.length}`);
      const row = [];
      for (let c = 0; c < cols; c++) {
        const ch = line[c];
        row.push(ch === "#" ? 1 : 0);
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2;
        if (ch === "S") playerSpawns.push({ x, y });
        if (ch === "E") enemySpawns.push({ x, y });
        if (ch === "F") flags.push(makeFlag(x, y));
      }
      grid.push(row);
    }

    scatterFlags(grid, flags, rows, cols, 7);
    return {
      grid,
      rows,
      cols,
      w: cols * TILE,
      h: rows * TILE,
      playerSpawns,
      enemySpawns,
      flags,
    };
  }

  function makeFlag(x, y) {
    return { x, y, taken: false, pulse: Math.random() * 6.28 };
  }

  function scatterFlags(grid, flags, rows, cols, n) {
    const cand = [];
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (grid[r][c]) continue;
        let open = 0;
        if (!grid[r - 1][c]) open++;
        if (!grid[r + 1][c]) open++;
        if (!grid[r][c - 1]) open++;
        if (!grid[r][c + 1]) open++;
        if (open >= 2) cand.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
      }
    }
    for (let i = cand.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [cand[i], cand[j]] = [cand[j], cand[i]];
    }
    let add = 0;
    for (const p of cand) {
      if (add >= n) break;
      if (flags.some((f) => Math.hypot(f.x - p.x, f.y - p.y) < TILE * 2.6)) continue;
      flags.push(makeFlag(p.x, p.y));
      add++;
    }
  }

  function makeCar(opts) {
    return {
      id: opts.id,
      x: opts.x,
      y: opts.y,
      dir: opts.dir || "right",
      want: opts.dir || "right",
      baseSpeed: opts.speed || SPEED,
      smoke: SMOKE_MAX,
      spin: 0,
      score: 0,
      isAI: !!opts.isAI,
      isP1: !!opts.isP1,
      isP2: !!opts.isP2,
      color: opts.color,
      path: [],
      pathTimer: 0,
      smokeCd: 0,
      trail: [],
      alive: true,
    };
  }

  // ─── Flow ─────────────────────────────────────────────────
  function goMenu() {
    state.phase = "menu";
    state.ended = false;
    overlay.classList.remove("hidden");
    bannerEl.classList.add("hidden");
    bannerEl.textContent = "";
  }

  function startGame(mode) {
    state.mode = mode === "duo" ? "duo" : "ai";
    state.maze = parseMaze();
    state.flags = state.maze.flags.map((f) => ({ ...f, taken: false }));
    state.totalFlags = state.flags.length;
    state.smokes = [];
    state.particles = [];
    state.floats = [];
    state.time = 0;
    state.shake = 0;
    state.flash = 0;
    state.ended = false;

    const ps = state.maze.playerSpawns;
    const es = state.maze.enemySpawns;
    const cars = [];

    cars.push(
      makeCar({
        id: "p1",
        x: ps[0].x,
        y: ps[0].y,
        dir: "right",
        color: "#00f0ff",
        isP1: true,
        speed: SPEED,
      })
    );

    if (state.mode === "duo") {
      const p2s = ps[1] || es[0];
      cars.push(
        makeCar({
          id: "p2",
          x: p2s.x,
          y: p2s.y,
          dir: "left",
          color: "#ff2bd6",
          isP2: true,
          speed: SPEED,
        })
      );
      if (es[1]) {
        cars.push(
          makeCar({
            id: "ai0",
            x: es[1].x,
            y: es[1].y,
            dir: "up",
            color: "#ff5d7a",
            isAI: true,
            speed: ENEMY_SPEED,
          })
        );
      }
      statP2.classList.remove("hidden");
      if (statScore) statScore.querySelector(".lbl").textContent = "P1";
    } else {
      const n = Math.min(3, es.length);
      const colors = ["#ff5d7a", "#ff8a5c", "#ff3d9a"];
      for (let i = 0; i < n; i++) {
        cars.push(
          makeCar({
            id: "ai" + i,
            x: es[i].x,
            y: es[i].y,
            dir: i % 2 ? "left" : "up",
            color: colors[i],
            isAI: true,
            speed: ENEMY_SPEED * (0.94 + i * 0.04),
          })
        );
      }
      statP2.classList.add("hidden");
      if (statScore) statScore.querySelector(".lbl").textContent = "SCORE";
    }

    state.cars = cars;
    state.phase = "play";
    overlay.classList.add("hidden");
    bannerEl.classList.add("hidden");
    fitCamera();
    updateHud();
  }

  function togglePause() {
    if (state.phase === "play") {
      state.phase = "pause";
      showBanner("PAUSA", "");
    } else if (state.phase === "pause") {
      state.phase = "play";
      bannerEl.classList.add("hidden");
    }
  }

  function showBanner(text, cls) {
    bannerEl.textContent = text;
    bannerEl.className = "banner" + (cls ? " " + cls : "");
  }

  function endGame(win, msg) {
    if (state.ended) return;
    state.ended = true;
    state.phase = win ? "win" : "lose";
    showBanner(msg, win ? "win" : "lose");
    state.shake = 12;
    setTimeout(() => {
      if (state.phase === "win" || state.phase === "lose") goMenu();
    }, 2800);
  }

  // ─── Grid ─────────────────────────────────────────────────
  function tileOf(x, y) {
    return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
  }

  function isWall(c, r) {
    const m = state.maze;
    if (!m || r < 0 || c < 0 || r >= m.rows || c >= m.cols) return true;
    return m.grid[r][c] === 1;
  }

  function isWallAt(x, y) {
    const t = tileOf(x, y);
    return isWall(t.c, t.r);
  }

  function centerOf(c, r) {
    return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
  }

  function nearCenter(car) {
    const t = tileOf(car.x, car.y);
    const mid = centerOf(t.c, t.r);
    const lim = TILE * TURN_WIN;
    return Math.abs(car.x - mid.x) < lim && Math.abs(car.y - mid.y) < lim;
  }

  function canGo(car, dirName) {
    const d = DIRS[dirName];
    const t = tileOf(car.x, car.y);
    return !isWall(t.c + d.x, t.r + d.y);
  }

  function snapLane(car) {
    const t = tileOf(car.x, car.y);
    const mid = centerOf(t.c, t.r);
    const d = DIRS[car.dir];
    if (d.x !== 0) car.y += (mid.y - car.y) * 0.5;
    if (d.y !== 0) car.x += (mid.x - car.x) * 0.5;
  }

  // ─── Input ────────────────────────────────────────────────
  function readWant(car) {
    if (car.isP1) {
      const arrows = state.mode === "ai";
      if (keys.KeyW || (arrows && keys.ArrowUp)) return "up";
      if (keys.KeyS || (arrows && keys.ArrowDown)) return "down";
      if (keys.KeyA || (arrows && keys.ArrowLeft)) return "left";
      if (keys.KeyD || (arrows && keys.ArrowRight)) return "right";
    } else if (car.isP2) {
      if (keys.ArrowUp) return "up";
      if (keys.ArrowDown) return "down";
      if (keys.ArrowLeft) return "left";
      if (keys.ArrowRight) return "right";
    }
    return null;
  }

  function smokeHeld(car) {
    if (car.isP1) return !!keys.Space;
    if (car.isP2) return !!(keys.Enter || keys.NumpadEnter);
    return false;
  }

  // ─── AI BFS ───────────────────────────────────────────────
  function bfsPath(fc, fr, tc, tr) {
    const m = state.maze;
    if (isWall(tc, tr)) return [];
    const key = (c, r) => r * m.cols + c;
    const q = [[fc, fr]];
    const prev = new Map([[key(fc, fr), null]]);
    const order = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    if (Math.random() < 0.5) order.reverse();

    let found = false;
    while (q.length) {
      const [c, r] = q.shift();
      if (c === tc && r === tr) {
        found = true;
        break;
      }
      for (const [dc, dr] of order) {
        const nc = c + dc;
        const nr = r + dr;
        const k = key(nc, nr);
        if (prev.has(k) || isWall(nc, nr)) continue;
        prev.set(k, [c, r]);
        q.push([nc, nr]);
      }
    }
    if (!found) return [];
    const path = [];
    let cur = [tc, tr];
    while (cur) {
      path.push(cur);
      cur = prev.get(key(cur[0], cur[1]));
    }
    path.reverse();
    return path;
  }

  function chaseTarget(car) {
    const humans = state.cars.filter((c) => (c.isP1 || c.isP2) && c.alive);
    if (!humans.length) return null;
    if (humans.length === 1) return humans[0];
    const idx = parseInt(String(car.id).replace(/\D/g, ""), 10) || 0;
    return humans[idx % humans.length];
  }

  // ─── Smoke ────────────────────────────────────────────────
  function emitSmoke(car, dt, burst) {
    if (car.smoke < (burst ? 12 : 3)) return;
    const cost = burst ? 16 : SMOKE_COST * dt;
    car.smoke = Math.max(0, car.smoke - cost);

    const back = DIRS[car.dir];
    const bx = car.x - back.x * (CAR_R + 8);
    const by = car.y - back.y * (CAR_R + 8);

    // reforça nuvem recente
    for (let i = state.smokes.length - 1; i >= Math.max(0, state.smokes.length - 6); i--) {
      const s = state.smokes[i];
      if (s.owner === car.id && Math.hypot(s.x - bx, s.y - by) < 12) {
        s.life = Math.min(SMOKE_LIFE, s.life + dt * 2.5);
        s.r = Math.min(SMOKE_R * 1.35, s.r + dt * 10);
        return;
      }
    }

    state.smokes.push({
      x: bx + (Math.random() - 0.5) * 5,
      y: by + (Math.random() - 0.5) * 5,
      r: SMOKE_R * (0.9 + Math.random() * 0.25),
      life: SMOKE_LIFE,
      max: SMOKE_LIFE,
      owner: car.id,
      phase: Math.random() * 6.28,
    });
  }

  function tryTurn(car) {
    if (car.want === car.dir) return;
    const want = car.want;
    const cur = DIRS[car.dir];
    const nxt = DIRS[want];
    if (!nxt) return;

    // 180° imediato
    if (cur.x + nxt.x === 0 && cur.y + nxt.y === 0) {
      car.dir = want;
      return;
    }
    if (!canGo(car, want) || !nearCenter(car)) return;
    const t = tileOf(car.x, car.y);
    const mid = centerOf(t.c, t.r);
    car.x = mid.x;
    car.y = mid.y;
    car.dir = want;
  }

  // ─── Update ───────────────────────────────────────────────
  function update(dt) {
    if (state.phase !== "play") return;
    state.time += dt;

    for (const car of state.cars) {
      if (!car.alive) continue;

      // spin out
      if (car.spin > 0) {
        car.spin -= dt;
        car.x += (Math.random() - 0.5) * 30 * dt;
        car.y += (Math.random() - 0.5) * 30 * dt;
        if (Math.random() < 0.55) {
          burst(car.x, car.y, "rgba(255,200,87,0.5)", 1, 40);
        }
        continue;
      }

      // direção desejada
      if (car.isAI) {
        car.pathTimer -= dt;
        const target = chaseTarget(car);
        if (target) {
          const me = tileOf(car.x, car.y);
          const tg = tileOf(target.x, target.y);
          if (car.pathTimer <= 0 || car.path.length < 2) {
            car.path = bfsPath(me.c, me.r, tg.c, tg.r);
            car.pathTimer = 0.22 + Math.random() * 0.18;
          }
          while (car.path.length && car.path[0][0] === me.c && car.path[0][1] === me.r) {
            car.path.shift();
          }
          if (car.path.length) {
            const [nc, nr] = car.path[0];
            if (nc > me.c) car.want = "right";
            else if (nc < me.c) car.want = "left";
            else if (nr > me.r) car.want = "down";
            else if (nr < me.r) car.want = "up";
          }
          // fumaça se humano atrás
          car.smokeCd -= dt;
          const d = Math.hypot(target.x - car.x, target.y - car.y);
          const back = DIRS[car.dir];
          const behind =
            (target.x - car.x) * -back.x + (target.y - car.y) * -back.y > 6 && d < 95;
          if (behind && car.smoke > 20 && car.smokeCd <= 0) {
            emitSmoke(car, 0.05, true);
            car.smokeCd = 1.0;
          } else {
            car.smoke = Math.min(SMOKE_MAX, car.smoke + SMOKE_REGEN * 0.5 * dt);
          }
        }
      } else {
        const w = readWant(car);
        if (w) car.want = w;
        if (smokeHeld(car)) emitSmoke(car, dt, false);
        else car.smoke = Math.min(SMOKE_MAX, car.smoke + SMOKE_REGEN * dt);
      }

      tryTurn(car);

      const d = DIRS[car.dir];
      const sp = car.baseSpeed;
      const nx = car.x + d.x * sp * dt;
      const ny = car.y + d.y * sp * dt;
      const look = CAR_R + 1;
      if (isWallAt(nx + d.x * look, ny + d.y * look)) {
        const t = tileOf(car.x, car.y);
        const mid = centerOf(t.c, t.r);
        car.x = mid.x;
        car.y = mid.y;
      } else {
        car.x = nx;
        car.y = ny;
        snapLane(car);
      }

      if (Math.random() < 0.4) {
        car.trail.push({
          x: car.x - d.x * 9,
          y: car.y - d.y * 9,
          life: 0.16,
          color: car.color,
        });
      }
      for (const t of car.trail) t.life -= dt;
      car.trail = car.trail.filter((t) => t.life > 0);
    }

    // fumaça → spin
    for (const car of state.cars) {
      if (!car.alive || car.spin > 0) continue;
      for (const s of state.smokes) {
        if (s.owner === car.id) continue;
        if (Math.hypot(car.x - s.x, car.y - s.y) < s.r + CAR_R * 0.35) {
          car.spin = SPIN_TIME;
          car.path = [];
          state.shake = Math.max(state.shake, 6);
          state.flash = 0.12;
          burst(car.x, car.y, "#ffc857", 14, 120);
          floatTxt(car.x, car.y - 18, "DERRAPA!", "#ffc857");
          const owner = state.cars.find((c) => c.id === s.owner);
          if (owner && !owner.isAI && car.isAI) {
            owner.score += 50;
            floatTxt(owner.x, owner.y - 22, "+50", "#7dffb3");
          }
          break;
        }
      }
    }

    // flags
    for (const f of state.flags) {
      if (f.taken) continue;
      f.pulse += 0.1;
      for (const car of state.cars) {
        if (!car.alive || car.isAI || car.spin > 0) continue;
        if (Math.hypot(car.x - f.x, car.y - f.y) < FLAG_R + CAR_R) {
          f.taken = true;
          car.score += 100;
          state.flash = 0.14;
          state.shake = Math.max(state.shake, 3);
          burst(f.x, f.y, "#ffc857", 14, 100);
          floatTxt(f.x, f.y - 16, "+100", "#ffc857");
          break;
        }
      }
    }

    // pega
    const humans = state.cars.filter((c) => (c.isP1 || c.isP2) && c.alive);
    const enemies = state.cars.filter((c) => c.isAI && c.alive && c.spin <= 0);
    for (const h of humans) {
      if (h.spin > 0) continue;
      for (const e of enemies) {
        if (Math.hypot(h.x - e.x, h.y - e.y) < HIT_R * 1.45) {
          if (state.mode === "ai") {
            burst(h.x, h.y, h.color, 22, 140);
            endGame(false, "PEGARAM VOCÊ!");
            updateHud();
            return;
          }
          h.spin = 0.9;
          state.shake = 8;
          burst(h.x, h.y, e.color, 10, 100);
          floatTxt(h.x, h.y - 16, "AI!", "#ff5d7a");
        }
      }
    }

    // duo bounce
    if (state.mode === "duo") {
      const p1 = state.cars.find((c) => c.isP1);
      const p2 = state.cars.find((c) => c.isP2);
      if (p1 && p2 && Math.hypot(p1.x - p2.x, p1.y - p2.y) < HIT_R * 1.5) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        p1.x -= (dx / d) * 6;
        p1.y -= (dy / d) * 6;
        p2.x += (dx / d) * 6;
        p2.y += (dy / d) * 6;
      }
    }

    // win
    if (!state.flags.some((f) => !f.taken)) {
      if (state.mode === "ai") {
        const p1 = state.cars.find((c) => c.isP1);
        endGame(true, `MAPA LIMPO!  ${p1 ? p1.score : 0} pts`);
      } else {
        const p1 = state.cars.find((c) => c.isP1);
        const p2 = state.cars.find((c) => c.isP2);
        if (p1 && p2) {
          if (p1.score > p2.score) endGame(true, `P1 VENCE!  ${p1.score}–${p2.score}`);
          else if (p2.score > p1.score) endGame(true, `P2 VENCE!  ${p2.score}–${p1.score}`);
          else endGame(true, `EMPATE!  ${p1.score}`);
        }
      }
    }

    // FX decay
    for (const s of state.smokes) {
      s.life -= dt;
      s.phase += dt * 4;
      s.r += dt * 1.2;
    }
    state.smokes = state.smokes.filter((s) => s.life > 0);

    for (const p of state.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
    }
    state.particles = state.particles.filter((p) => p.life > 0);

    for (const f of state.floats) {
      f.life -= dt;
      f.y -= 30 * dt;
    }
    state.floats = state.floats.filter((f) => f.life > 0);

    if (state.shake > 0) state.shake = Math.max(0, state.shake - 7 * dt);
    if (state.flash > 0) state.flash -= dt;

    updateHud();
  }

  function burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.4 + Math.random() * 0.7) * spd;
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.3 + Math.random() * 0.3,
        max: 0.6,
        color,
        size: 2 + Math.random() * 2.5,
      });
    }
  }

  function floatTxt(x, y, text, color) {
    state.floats.push({ x, y, text, color, life: 0.85, max: 0.85 });
  }

  function updateHud() {
    if (!state.flags.length) return;
    const left = state.flags.filter((f) => !f.taken).length;
    hudFlags.textContent = `${state.totalFlags - left}/${state.totalFlags}`;
    const p1 = state.cars.find((c) => c.isP1);
    if (p1) {
      hudOil.textContent = `${Math.round(p1.smoke)}%`;
      hudP1.textContent = String(p1.score);
    }
    const p2 = state.cars.find((c) => c.isP2);
    if (p2 && state.mode === "duo") hudP2.textContent = String(p2.score);
  }

  // ─── Camera ───────────────────────────────────────────────
  function fitCamera() {
    if (!state.maze) return;
    const stage = document.getElementById("stage");
    const pad = 10;
    const iw = state.maze.w + pad * 2;
    const ih = state.maze.h + pad * 2;
    canvas.width = iw;
    canvas.height = ih;
    const scale = Math.min(stage.clientWidth / iw, stage.clientHeight / ih) * 0.98;
    canvas.style.width = `${iw * scale}px`;
    canvas.style.height = `${ih * scale}px`;
    state.ox = pad;
    state.oy = pad;
  }

  // ─── Draw ─────────────────────────────────────────────────
  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);

    if (!state.maze) {
      drawMenuBG(w, h);
      return;
    }

    const sx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const sy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;

    ctx.save();
    ctx.translate(state.ox + sx, state.oy + sy);
    drawMaze();
    drawSmokes();
    drawFlags();
    for (const c of state.cars) drawTrail(c);
    for (const c of state.cars) drawCar(c);
    drawParticles();
    drawFloats();
    ctx.restore();

    drawRadar();

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,200,87,${state.flash * 0.4})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawMenuBG(w, h) {
    ctx.strokeStyle = "rgba(0,240,255,0.05)";
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(w / 2 + Math.cos(state.time) * 30, h * 0.55);
    drawCarBody(0, 0, "right", "#00f0ff", 0);
    ctx.restore();
    ctx.save();
    ctx.translate(w / 2 - 70, h * 0.55 + 8);
    drawCarBody(0, 0, "left", "#ff5d7a", 0);
    ctx.restore();
  }

  function drawMaze() {
    const { grid, rows, cols } = state.maze;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * TILE;
        const y = r * TILE;
        if (grid[r][c]) {
          ctx.fillStyle = "#100828";
          ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          ctx.strokeStyle = "rgba(140, 95, 255, 0.75)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
        } else {
          ctx.fillStyle = "#0a0d18";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = "rgba(0,240,255,0.04)";
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        }
      }
    }
  }

  function drawSmokes() {
    for (const s of state.smokes) {
      const t = s.life / s.max;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(255, 90, 210, ${0.5 * t})`);
      g.addColorStop(0.45, `rgba(30, 15, 40, ${0.7 * t})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 200, 87, ${0.4 * t})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.65 + Math.sin(s.phase) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawFlags() {
    for (const f of state.flags) {
      if (f.taken) continue;
      const bob = Math.sin(f.pulse) * 2.5;
      ctx.save();
      ctx.translate(f.x, f.y + bob);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
      g.addColorStop(0, "rgba(255,200,87,0.55)");
      g.addColorStop(1, "rgba(255,200,87,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffc857";
      ctx.shadowColor = "#ffc857";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  function drawTrail(car) {
    for (const t of car.trail) {
      ctx.globalAlpha = (t.life / 0.16) * 0.4;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawCar(car) {
    if (!car.alive) return;
    drawCarBody(car.x, car.y, car.dir, car.color, car.spin);
  }

  function drawCarBody(x, y, dir, color, spin) {
    const spinning = spin > 0;
    const a = spinning ? spin * 16 + state.time * 12 : DIRS[dir].a;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.shadowColor = color;
    ctx.shadowBlur = spinning ? 18 : 11;
    ctx.fillStyle = color;
    rr(-13, -8, 26, 16, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(6,10,20,0.9)";
    rr(-2, -5, 10, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#eef6ff";
    ctx.beginPath();
    ctx.arc(11, -4, 2.2, 0, Math.PI * 2);
    ctx.arc(11, 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (spinning) {
      ctx.strokeStyle = "rgba(255,200,87,0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats() {
    ctx.font = "bold 12px Orbitron, sans-serif";
    ctx.textAlign = "center";
    for (const f of state.floats) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawRadar() {
    if (!state.maze || state.phase === "menu") return;
    const rw = 108;
    const rh = (rw * state.maze.h) / state.maze.w;
    const x = canvas.width - rw - 12;
    const y = 12;

    ctx.fillStyle = "rgba(4,6,14,0.85)";
    ctx.strokeStyle = "rgba(0,240,255,0.45)";
    ctx.lineWidth = 1.5;
    rr(x - 4, y - 4, rw + 8, rh + 18, 6);
    ctx.fill();
    ctx.stroke();

    const sx = rw / state.maze.w;
    const sy = rh / state.maze.h;
    ctx.fillStyle = "rgba(130,90,255,0.4)";
    for (let r = 0; r < state.maze.rows; r++) {
      for (let c = 0; c < state.maze.cols; c++) {
        if (!state.maze.grid[r][c]) continue;
        ctx.fillRect(x + c * TILE * sx, y + r * TILE * sy, TILE * sx + 0.4, TILE * sy + 0.4);
      }
    }
    ctx.fillStyle = "#ffc857";
    for (const f of state.flags) {
      if (f.taken) continue;
      ctx.fillRect(x + f.x * sx - 1.5, y + f.y * sy - 1.5, 3, 3);
    }
    for (const car of state.cars) {
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.arc(x + car.x * sx, y + car.y * sy, car.isAI ? 2.2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0,240,255,0.75)";
    ctx.font = "10px Rajdhani, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("RADAR", x, y + rh + 11);
  }

  // ─── Loop ─────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (state.phase === "menu") state.time += dt;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => {
    if (state.maze) fitCamera();
  });

  canvas.width = 800;
  canvas.height = 500;
  requestAnimationFrame(frame);

  window.NeonRally = { state, startGame, goMenu };
})();
