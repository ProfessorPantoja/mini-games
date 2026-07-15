/**
 * NEON RALLY — remake espiritual de Rally-X
 * Labirinto top-down · coleta · óleo no chão · perseguição
 * PvP local (duo) + VS IA
 */
(() => {
  "use strict";

  // ─── Constantes ───────────────────────────────────────────
  const TILE = 40;
  const CAR_LEN = 22;
  const CAR_WID = 14;
  const MAX_SPEED = 210;
  const ACCEL = 320;
  const BRAKE = 420;
  const FRICTION = 140;
  const TURN_RATE = 3.4; // rad/s at speed
  const OIL_COST = 14;
  const OIL_REGEN = 6; // %/s when not dropping
  const OIL_PATCH_R = 16;
  const OIL_LIFE = 7.5;
  const SLIP_DURATION = 0.85;
  const FLAG_R = 10;
  const HIT_RADIUS = 13;
  const WALL_PAD = 8;
  const AI_LOOK = 55;

  // Mapa: # parede, . estrada, S spawn P1, A spawn IA/P2, F flag
  // Labirinto legível com corredores, cantos e atalhos
  // Todas as linhas = 32 chars. # parede · . estrada · S P1 · A IA/P2 · F flag
  // Labirinto interligado (corredores + atalhos) — validado por BFS.
  const MAP_SRC = [
    "################################",
    "#S........#..........#.........#",
    "#.#######.#.########.#.#######.#",
    "#.#.....#.#.#......#.#.#.....#.#",
    "#.#.###.#.#.#.####.#.#.#.###.#.#",
    "#.#.#...#...#.#..#.#...#.#...#.#",
    "#.#.#.#######.#..#.#####.#.###.#",
    "#...#.........#..F.......#.....#",
    "###.#########.############.###.#",
    "#...#.......#............#...#.#",
    "#.###.#####.#.##########.###.#.#",
    "#.#...#...#.#.#........#.....#.#",
    "#.#.###.#.#.#.#.######.#######.#",
    "#.#.....#.#...#.#....#.........#",
    "#.#######.#####.#.##.#########.#",
    "#.......#.......#.##.....#...#.#",
    "#######.#.#######.######.#.#.#.#",
    "#.....#.#.#.....#......#.#.#...#",
    "#.###.#.#.#.###.######.#.#.###.#",
    "#.#...#...#.#.#......#.#.#...#.#",
    "#.#.#######.#.######.#.#.###.#.#",
    "#.#.........#...F....#.#.....#.#",
    "#.#############.######.#######.#",
    "#.............F..........#...A.#",
    "################################",
  ];

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

  // ─── Input ────────────────────────────────────────────────
  const keys = Object.create(null);
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "KeyP" && state.phase === "play") togglePause();
    if (e.code === "KeyR") goMenu();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => startGame(btn.dataset.mode));
  });

  // ─── Estado ───────────────────────────────────────────────
  const state = {
    phase: "menu", // menu | play | pause | win | lose
    mode: "ai", // ai | duo
    maze: null,
    cars: [],
    oils: [],
    flags: [],
    particles: [],
    cam: { x: 0, y: 0 },
    time: 0,
    totalFlags: 0,
    flash: 0,
  };

  // ─── Maze parse ───────────────────────────────────────────
  function parseMaze() {
    const rows = MAP_SRC.length;
    const cols = MAP_SRC[0].length;
    const grid = [];
    const spawns = { p1: null, p2: null };
    const flags = [];

    for (let r = 0; r < rows; r++) {
      const line = MAP_SRC[r];
      const row = [];
      for (let c = 0; c < cols; c++) {
        const ch = line[c] || "#";
        const wall = ch === "#";
        row.push(wall ? 1 : 0);
        const wx = c * TILE + TILE / 2;
        const wy = r * TILE + TILE / 2;
        if (ch === "S") spawns.p1 = { x: wx, y: wy, a: 0 };
        if (ch === "A") spawns.p2 = { x: wx, y: wy, a: Math.PI };
        if (ch === "F") flags.push({ x: wx, y: wy, taken: false, pulse: Math.random() * Math.PI * 2 });
      }
      grid.push(row);
    }

    // flags extras em cruzamentos abertos (sem poluir)
    placeExtraFlags(grid, flags, rows, cols);

    return {
      grid,
      rows,
      cols,
      w: cols * TILE,
      h: rows * TILE,
      spawns,
      flags,
    };
  }

  function placeExtraFlags(grid, flags, rows, cols) {
    const candidates = [];
    for (let r = 2; r < rows - 2; r++) {
      for (let c = 2; c < cols - 2; c++) {
        if (grid[r][c] !== 0) continue;
        // prefer open cells (degree >= 2)
        let open = 0;
        if (grid[r - 1][c] === 0) open++;
        if (grid[r + 1][c] === 0) open++;
        if (grid[r][c - 1] === 0) open++;
        if (grid[r][c + 1] === 0) open++;
        if (open >= 3) {
          candidates.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
        }
      }
    }
    // espalhar ~8 flags extras sem empilhar
    shuffle(candidates);
    let added = 0;
    for (const p of candidates) {
      if (added >= 8) break;
      const tooClose = flags.some((f) => dist(f, p) < TILE * 3.2);
      if (tooClose) continue;
      flags.push({ x: p.x, y: p.y, taken: false, pulse: Math.random() * Math.PI * 2 });
      added++;
    }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ─── Car factory ──────────────────────────────────────────
  function makeCar(opts) {
    return {
      id: opts.id,
      x: opts.x,
      y: opts.y,
      a: opts.a || 0,
      speed: 0,
      color: opts.color,
      glow: opts.glow,
      oil: 100,
      slip: 0,
      stun: 0,
      score: 0,
      isAI: !!opts.isAI,
      isP1: !!opts.isP1,
      isP2: !!opts.isP2,
      alive: true,
      dropCd: 0,
      trail: [],
      // AI memory
      aiTarget: null,
      aiTurnBias: 0,
      aiDropTimer: 0,
    };
  }

  // ─── Game flow ────────────────────────────────────────────
  function goMenu() {
    state.phase = "menu";
    overlay.classList.remove("hidden");
    bannerEl.classList.add("hidden");
    bannerEl.textContent = "";
  }

  function startGame(mode) {
    state.mode = mode === "duo" ? "duo" : "ai";
    state.maze = parseMaze();
    state.oils = [];
    state.particles = [];
    state.time = 0;
    state.flash = 0;
    state.flags = state.maze.flags.map((f) => ({ ...f, taken: false }));
    state.totalFlags = state.flags.length;

    const s = state.maze.spawns;
    const cars = [];
    cars.push(
      makeCar({
        id: "p1",
        x: s.p1.x,
        y: s.p1.y,
        a: s.p1.a,
        color: "#00f0ff",
        glow: "rgba(0,240,255,0.55)",
        isP1: true,
      })
    );

    if (state.mode === "duo") {
      cars.push(
        makeCar({
          id: "p2",
          x: s.p2.x,
          y: s.p2.y,
          a: s.p2.a,
          color: "#ff2bd6",
          glow: "rgba(255,43,214,0.55)",
          isP2: true,
        })
      );
      statP2.classList.remove("hidden");
    } else {
      cars.push(
        makeCar({
          id: "ai",
          x: s.p2.x,
          y: s.p2.y,
          a: s.p2.a,
          color: "#ff5d7a",
          glow: "rgba(255,93,122,0.55)",
          isAI: true,
        })
      );
      statP2.classList.add("hidden");
    }

    state.cars = cars;
    state.cam.x = s.p1.x;
    state.cam.y = s.p1.y;
    state.phase = "play";
    overlay.classList.add("hidden");
    bannerEl.classList.add("hidden");
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
    state.phase = win ? "win" : "lose";
    showBanner(msg, win ? "win" : "lose");
    setTimeout(() => {
      if (state.phase === "win" || state.phase === "lose") {
        goMenu();
      }
    }, 3200);
  }

  // ─── Collision helpers ────────────────────────────────────
  function cellAt(x, y) {
    const c = (x / TILE) | 0;
    const r = (y / TILE) | 0;
    if (r < 0 || c < 0 || r >= state.maze.rows || c >= state.maze.cols) return 1;
    return state.maze.grid[r][c];
  }

  function solidNear(x, y, pad) {
    // sample box corners + mid edges
    const pts = [
      [x - pad, y - pad],
      [x + pad, y - pad],
      [x - pad, y + pad],
      [x + pad, y + pad],
      [x, y - pad],
      [x, y + pad],
      [x - pad, y],
      [x + pad, y],
    ];
    for (const [px, py] of pts) {
      if (cellAt(px, py) === 1) return true;
    }
    return false;
  }

  function tryMove(car, nx, ny) {
    // slide along walls
    if (!solidNear(nx, ny, WALL_PAD)) {
      car.x = nx;
      car.y = ny;
      return true;
    }
    if (!solidNear(nx, car.y, WALL_PAD)) {
      car.x = nx;
      car.speed *= 0.55;
      return true;
    }
    if (!solidNear(car.x, ny, WALL_PAD)) {
      car.y = ny;
      car.speed *= 0.55;
      return true;
    }
    // full stop + bounce feel
    car.speed *= -0.25;
    spawnSparks(car.x, car.y, car.color, 6);
    return false;
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  // ─── Controls ─────────────────────────────────────────────
  function readInput(car) {
    let throttle = 0;
    let steer = 0;
    let drop = false;

    if (car.isP1) {
      if (keys.KeyW || keys.ArrowUp) throttle += 1;
      if (keys.KeyS || keys.ArrowDown) throttle -= 1;
      // em solo, setas também viram (WASD preferido; setas ok)
      if (state.mode === "ai") {
        if (keys.KeyA || keys.ArrowLeft) steer -= 1;
        if (keys.KeyD || keys.ArrowRight) steer += 1;
        drop = keys.Space;
      } else {
        if (keys.KeyA) steer -= 1;
        if (keys.KeyD) steer += 1;
        drop = keys.Space;
      }
    } else if (car.isP2) {
      if (keys.ArrowUp) throttle += 1;
      if (keys.ArrowDown) throttle -= 1;
      if (keys.ArrowLeft) steer -= 1;
      if (keys.ArrowRight) steer += 1;
      drop = keys.Enter || keys.NumpadEnter;
    }

    return { throttle, steer, drop };
  }

  // ─── AI ───────────────────────────────────────────────────
  function aiControl(car, dt) {
    const player = state.cars.find((c) => c.isP1 && c.alive);
    if (!player) return { throttle: 0, steer: 0, drop: false };

    // alvo: jogador, ou flag se estiver longe e tiver flag perto
    let target = { x: player.x, y: player.y };
    const dPlayer = dist(car, player);

    // ocasionalmente perseguir flag se estiver no caminho
    let nearestFlag = null;
    let bestFd = Infinity;
    for (const f of state.flags) {
      if (f.taken) continue;
      const d = dist(car, f);
      if (d < bestFd) {
        bestFd = d;
        nearestFlag = f;
      }
    }
    // se o player está longe e há flag próxima, pega a flag (pressão de score)
    if (nearestFlag && bestFd < 180 && dPlayer > 220) {
      target = nearestFlag;
    }

    // ângulo desejado
    const desired = Math.atan2(target.y - car.y, target.x - car.x);
    let diff = wrapAngle(desired - car.a);

    // look-ahead wall avoid
    const lx = car.x + Math.cos(car.a) * AI_LOOK;
    const ly = car.y + Math.sin(car.a) * AI_LOOK;
    const leftA = car.a - 0.7;
    const rightA = car.a + 0.7;
    const wallAhead = solidNear(lx, ly, 6);
    const wallL = solidNear(car.x + Math.cos(leftA) * 40, car.y + Math.sin(leftA) * 40, 6);
    const wallR = solidNear(car.x + Math.cos(rightA) * 40, car.y + Math.sin(rightA) * 40, 6);

    let steer = 0;
    if (wallAhead) {
      if (wallL && !wallR) steer = 1;
      else if (wallR && !wallL) steer = -1;
      else steer = car.aiTurnBias || (Math.random() < 0.5 ? -1 : 1);
      car.aiTurnBias = steer;
    } else {
      car.aiTurnBias = 0;
      if (diff > 0.12) steer = 1;
      else if (diff < -0.12) steer = -1;
      if (wallL && steer < 0) steer = 0.3;
      if (wallR && steer > 0) steer = -0.3;
    }

    // throttle: freia um pouco se parede na frente em alta
    let throttle = 1;
    if (wallAhead && car.speed > 80) throttle = -0.4;
    else if (Math.abs(diff) > 1.2) throttle = 0.45;

    // drop oil quando player está atrás e perto
    car.aiDropTimer -= dt;
    let drop = false;
    const behind =
      Math.cos(car.a) * (player.x - car.x) + Math.sin(car.a) * (player.y - car.y) < -10;
    if (dPlayer < 120 && behind && car.oil > 25 && car.aiDropTimer <= 0 && car.slip <= 0) {
      drop = true;
      car.aiDropTimer = 1.4 + Math.random() * 0.8;
    }

    return { throttle, steer, drop };
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  // ─── Oil ──────────────────────────────────────────────────
  function dropOil(car) {
    if (car.oil < OIL_COST || car.dropCd > 0 || car.slip > 0.3) return;
    car.oil = Math.max(0, car.oil - OIL_COST);
    car.dropCd = 0.18;
    const back = car.a + Math.PI;
    const ox = car.x + Math.cos(back) * (CAR_LEN * 0.7);
    const oy = car.y + Math.sin(back) * (CAR_LEN * 0.7);
    state.oils.push({
      x: ox,
      y: oy,
      r: OIL_PATCH_R,
      life: OIL_LIFE,
      maxLife: OIL_LIFE,
      owner: car.id,
      wobble: Math.random() * Math.PI * 2,
    });
    // fumaça
    for (let i = 0; i < 4; i++) {
      state.particles.push({
        x: ox,
        y: oy,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        life: 0.4 + Math.random() * 0.3,
        max: 0.7,
        color: "rgba(40,40,50,0.5)",
        size: 4 + Math.random() * 6,
      });
    }
  }

  function applyOil(car) {
    for (const o of state.oils) {
      if (o.life <= 0) continue;
      // não escorrega no próprio óleo por 0.4s após soltar (evita auto-trap imediato total)
      // mas pode escorregar se voltar — simplificado: afeta todos, dono um pouco menos
      const d = dist(car, o);
      if (d < o.r + 4) {
        const mult = o.owner === car.id ? 0.55 : 1;
        car.slip = Math.max(car.slip, SLIP_DURATION * mult);
        // empurrão lateral aleatório
        car.a += (Math.random() - 0.5) * 0.08 * mult;
        car.speed *= 1 - 0.02 * mult;
      }
    }
  }

  // ─── Particles ────────────────────────────────────────────
  function spawnSparks(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.25 + Math.random() * 0.35,
        max: 0.6,
        color,
        size: 2 + Math.random() * 2,
      });
    }
  }

  function spawnPickup(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * 80,
        vy: Math.sin(a) * 80,
        life: 0.45,
        max: 0.45,
        color: "#ffc857",
        size: 3,
      });
    }
  }

  // ─── Update ───────────────────────────────────────────────
  function updateCar(car, dt) {
    if (!car.alive) return;

    if (car.stun > 0) {
      car.stun -= dt;
      car.speed *= 1 - 2.5 * dt;
      return;
    }

    const input = car.isAI ? aiControl(car, dt) : readInput(car);

    // oil regen / drop
    car.dropCd = Math.max(0, car.dropCd - dt);
    if (input.drop) dropOil(car);
    else car.oil = Math.min(100, car.oil + OIL_REGEN * dt);

    applyOil(car);

    // slip physics
    let grip = 1;
    if (car.slip > 0) {
      car.slip -= dt;
      grip = 0.25;
      car.a += (Math.random() - 0.5) * 4.5 * dt;
      car.speed *= 1 - 0.35 * dt;
      // skid marks feel via trail
      if (Math.random() < 0.4) {
        state.particles.push({
          x: car.x + (Math.random() - 0.5) * 8,
          y: car.y + (Math.random() - 0.5) * 8,
          vx: 0,
          vy: 0,
          life: 0.5,
          max: 0.5,
          color: "rgba(255,200,87,0.35)",
          size: 3,
        });
      }
    }

    // accelerate
    if (input.throttle > 0) car.speed += ACCEL * input.throttle * dt * (0.5 + 0.5 * grip);
    else if (input.throttle < 0) car.speed += BRAKE * input.throttle * dt;
    else {
      // coast friction
      if (car.speed > 0) car.speed = Math.max(0, car.speed - FRICTION * dt);
      else if (car.speed < 0) car.speed = Math.min(0, car.speed + FRICTION * dt);
    }

    car.speed = Math.max(-MAX_SPEED * 0.45, Math.min(MAX_SPEED, car.speed));

    // turn — more turn at mid speed (arcade feel)
    const spdFactor = Math.min(1, Math.abs(car.speed) / 60);
    const turnMul = grip * spdFactor * (car.speed < 0 ? -1 : 1);
    car.a += input.steer * TURN_RATE * turnMul * dt;

    // integrate
    const nx = car.x + Math.cos(car.a) * car.speed * dt;
    const ny = car.y + Math.sin(car.a) * car.speed * dt;
    tryMove(car, nx, ny);

    // trail
    if (Math.abs(car.speed) > 40) {
      car.trail.push({ x: car.x, y: car.y, a: car.a, life: 0.25 });
      if (car.trail.length > 12) car.trail.shift();
    }
    for (const t of car.trail) t.life -= dt;
    car.trail = car.trail.filter((t) => t.life > 0);
  }

  function updateFlags() {
    for (const f of state.flags) {
      if (f.taken) continue;
      f.pulse += 0.08;
      for (const car of state.cars) {
        if (!car.alive) continue;
        if (dist(car, f) < FLAG_R + 10) {
          f.taken = true;
          car.score += 100;
          spawnPickup(f.x, f.y);
          state.flash = 0.12;
          break;
        }
      }
    }
  }

  function updateCarHits() {
    const alive = state.cars.filter((c) => c.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const b = alive[j];
        const d = dist(a, b);
        if (d < HIT_RADIUS * 2) {
          // bounce + stun curto
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          const push = 40;
          tryMove(a, a.x - Math.cos(ang) * push * 0.15, a.y - Math.sin(ang) * push * 0.15);
          tryMove(b, b.x + Math.cos(ang) * push * 0.15, b.y + Math.sin(ang) * push * 0.15);
          const rel = Math.abs(a.speed) + Math.abs(b.speed);
          a.speed *= -0.35;
          b.speed *= -0.35;
          a.stun = Math.max(a.stun, 0.25);
          b.stun = Math.max(b.stun, 0.25);
          spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, "#ffffff", 8);

          // VS IA: se AI colide com player em alta, player "pego"
          if (state.mode === "ai" && rel > 90) {
            const p = a.isP1 ? a : b.isP1 ? b : null;
            const ai = a.isAI ? a : b.isAI ? b : null;
            if (p && ai && d < HIT_RADIUS * 1.6) {
              // caught!
              endGame(false, "PEGARAM VOCÊ!");
              spawnSparks(p.x, p.y, p.color, 20);
              return;
            }
          }
        }
      }
    }
  }

  function checkWin() {
    const remaining = state.flags.filter((f) => !f.taken).length;
    if (remaining > 0) return;

    if (state.mode === "ai") {
      endGame(true, "TODAS AS FLAGS! ★");
    } else {
      const p1 = state.cars.find((c) => c.isP1);
      const p2 = state.cars.find((c) => c.isP2);
      if (!p1 || !p2) return;
      if (p1.score > p2.score) endGame(true, "P1 VENCEU!");
      else if (p2.score > p1.score) endGame(true, "P2 VENCEU!");
      else endGame(true, "EMPATE!");
    }
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function updateOils(dt) {
    for (const o of state.oils) {
      o.life -= dt;
      o.wobble += dt * 3;
    }
    state.oils = state.oils.filter((o) => o.life > 0);
  }

  function updateCamera(dt) {
    const focus = state.cars.filter((c) => c.alive);
    if (!focus.length) return;
    let tx = 0;
    let ty = 0;
    for (const c of focus) {
      tx += c.x;
      ty += c.y;
    }
    tx /= focus.length;
    ty /= focus.length;
    // em solo segue o player
    if (state.mode === "ai") {
      const p = state.cars.find((c) => c.isP1);
      if (p) {
        tx = p.x;
        ty = p.y;
      }
    }
    const k = 1 - Math.pow(0.001, dt);
    state.cam.x += (tx - state.cam.x) * k;
    state.cam.y += (ty - state.cam.y) * k;
  }

  function updateHud() {
    const remaining = state.flags.filter((f) => !f.taken).length;
    const taken = state.totalFlags - remaining;
    hudFlags.textContent = `${taken}/${state.totalFlags}`;
    const p1 = state.cars.find((c) => c.isP1);
    if (p1) {
      hudOil.textContent = `${Math.round(p1.oil)}%`;
      hudP1.textContent = String(p1.score);
    }
    const p2 = state.cars.find((c) => c.isP2 || c.isAI);
    if (p2 && state.mode === "duo") {
      hudP2.textContent = String(p2.score);
    }
  }

  function update(dt) {
    if (state.phase !== "play") return;
    state.time += dt;
    if (state.flash > 0) state.flash -= dt;

    for (const car of state.cars) updateCar(car, dt);
    updateOils(dt);
    updateFlags();
    updateCarHits();
    updateParticles(dt);
    updateCamera(dt);
    updateHud();
    checkWin();
  }

  // ─── Render ───────────────────────────────────────────────
  function resizeCanvas() {
    const stage = document.getElementById("stage");
    const maxW = stage.clientWidth;
    const maxH = stage.clientHeight;
    // internal resolution
    const iw = 960;
    const ih = 640;
    canvas.width = iw;
    canvas.height = ih;
    // CSS size
    const scale = Math.min(maxW / iw, maxH / ih, 1.25);
    canvas.style.width = `${iw * scale}px`;
    canvas.style.height = `${ih * scale}px`;
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);

    if (!state.maze) {
      drawIdle(w, h);
      return;
    }

    // camera transform
    const cx = state.cam.x;
    const cy = state.cam.y;
    ctx.save();
    ctx.translate(w / 2 - cx, h / 2 - cy);

    drawMaze();
    drawOils();
    drawFlags();
    for (const car of state.cars) drawCarTrail(car);
    for (const car of state.cars) drawCar(car);
    drawParticles();

    ctx.restore();

    // vignette + flash
    const grd = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,200,87,${state.flash * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (state.phase === "pause") {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawIdle(w, h) {
    // grid hint no menu
    ctx.strokeStyle = "rgba(0,240,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // mini car decorativo
    ctx.save();
    ctx.translate(w / 2, h / 2 + 40);
    ctx.rotate(state.time * 0.4);
    drawCarBody(0, 0, 0, "#00f0ff", "rgba(0,240,255,0.5)");
    ctx.restore();
  }

  function drawMaze() {
    const { grid, rows, cols } = state.maze;
    // only draw visible tiles roughly
    const viewPad = 3;
    const minC = Math.max(0, (((state.cam.x - canvas.width / 2) / TILE) | 0) - viewPad);
    const maxC = Math.min(cols - 1, (((state.cam.x + canvas.width / 2) / TILE) | 0) + viewPad);
    const minR = Math.max(0, (((state.cam.y - canvas.height / 2) / TILE) | 0) - viewPad);
    const maxR = Math.min(rows - 1, (((state.cam.y + canvas.height / 2) / TILE) | 0) + viewPad);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const x = c * TILE;
        const y = r * TILE;
        if (grid[r][c] === 1) {
          // wall
          ctx.fillStyle = "#120c28";
          ctx.fillRect(x, y, TILE, TILE);
          // neon edge
          ctx.strokeStyle = "rgba(140, 90, 255, 0.55)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
          // inner glow line
          ctx.strokeStyle = "rgba(0, 240, 255, 0.12)";
          ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
        } else {
          // road
          ctx.fillStyle = "#0a0c18";
          ctx.fillRect(x, y, TILE, TILE);
          // subtle dashed center if corridor
          const openH = c > 0 && c < cols - 1 && grid[r][c - 1] === 0 && grid[r][c + 1] === 0;
          const openV = r > 0 && r < rows - 1 && grid[r - 1][c] === 0 && grid[r + 1][c] === 0;
          ctx.fillStyle = "rgba(0,240,255,0.04)";
          if (openH && !openV) {
            ctx.fillRect(x, y + TILE / 2 - 1, TILE, 2);
          } else if (openV && !openH) {
            ctx.fillRect(x + TILE / 2 - 1, y, 2, TILE);
          }
        }
      }
    }
  }

  function drawOils() {
    for (const o of state.oils) {
      const t = o.life / o.maxLife;
      const r = o.r * (0.85 + 0.15 * Math.sin(o.wobble));
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
      g.addColorStop(0, `rgba(255, 200, 87, ${0.35 * t})`);
      g.addColorStop(0.45, `rgba(40, 30, 10, ${0.55 * t})`);
      g.addColorStop(1, `rgba(0,0,0,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, r * 1.2, r * 0.75, o.wobble * 0.2, 0, Math.PI * 2);
      ctx.fill();
      // shine
      ctx.strokeStyle = `rgba(255, 43, 214, ${0.35 * t})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, r * 1.05, r * 0.65, o.wobble * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawFlags() {
    for (const f of state.flags) {
      if (f.taken) continue;
      const bob = Math.sin(f.pulse) * 3;
      const glow = 0.45 + 0.25 * Math.sin(f.pulse * 1.5);

      ctx.save();
      ctx.translate(f.x, f.y + bob);

      // glow
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, FLAG_R * 2.2);
      g.addColorStop(0, `rgba(255, 200, 87, ${glow})`);
      g.addColorStop(1, "rgba(255,200,87,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, FLAG_R * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // flag pole
      ctx.strokeStyle = "#c0d0e8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(0, -10);
      ctx.stroke();

      // pennant
      ctx.fillStyle = "#ffc857";
      ctx.shadowColor = "#ffc857";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(12, -6);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  function drawCarTrail(car) {
    for (let i = 0; i < car.trail.length; i++) {
      const t = car.trail[i];
      const a = t.life / 0.25;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.a);
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = car.color;
      ctx.fillRect(-CAR_LEN / 2, -CAR_WID / 2, CAR_LEN * 0.6, CAR_WID);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawCar(car) {
    if (!car.alive) return;
    drawCarBody(car.x, car.y, car.a, car.color, car.glow, car.slip > 0);
  }

  function drawCarBody(x, y, a, color, glow, slipping) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);

    // glow under
    ctx.shadowColor = glow || color;
    ctx.shadowBlur = slipping ? 22 : 14;

    // body
    ctx.fillStyle = color;
    roundRect(ctx, -CAR_LEN / 2, -CAR_WID / 2, CAR_LEN, CAR_WID, 4);
    ctx.fill();

    // cabin
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(8,12,24,0.85)";
    roundRect(ctx, -2, -CAR_WID / 2 + 2, 10, CAR_WID - 4, 2);
    ctx.fill();

    // nose light
    ctx.fillStyle = "#eef6ff";
    ctx.beginPath();
    ctx.arc(CAR_LEN / 2 - 3, -4, 2, 0, Math.PI * 2);
    ctx.arc(CAR_LEN / 2 - 3, 4, 2, 0, Math.PI * 2);
    ctx.fill();

    // slip indicator
    if (slipping) {
      ctx.strokeStyle = "rgba(255,200,87,0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, CAR_LEN * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawParticles() {
    for (const p of state.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ─── Loop ─────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (state.phase === "menu") state.time += dt;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  requestAnimationFrame(frame);

  // expose for debug
  window.NeonRally = { state, startGame, goMenu };
})();
