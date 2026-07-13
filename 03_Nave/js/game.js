/**
 * NEON STRIKE — Elite Shoot 'em Up
 * Canvas engine: player, enemies, bosses, powerups, particles, waves, HUD
 */
(() => {
  "use strict";

  // ─── Constants ───────────────────────────────────────────
  const W = 480;
  const H = 720;
  /** Versão do jogo — subir a cada release visível ao jogador */
  const GAME_VERSION = "1.5.0";
  const HS_KEY = "neonstrike_hiscore";
  const ACH_KEY = "neonstrike_achievements";
  const MISSION_WAVE = 10; // limpar o setor

  // Qualidade: só mobile/celular reduz FX — PC (mesmo com touchscreen) fica full
  const IS_MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const IS_TOUCH = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const IS_NARROW = Math.min(window.innerWidth, window.innerHeight) < 700;
  const LOW_FX = IS_MOBILE_UA || (IS_TOUCH && IS_NARROW);
  const FX = {
    stars: LOW_FX ? 48 : 120,
    particleScale: LOW_FX ? 0.4 : 1,
    maxParticles: LOW_FX ? 90 : 320,
    thrusterChance: LOW_FX ? 0.35 : 1,
    shadows: !LOW_FX,
    nebula: !LOW_FX,
    innerRails: !LOW_FX,
  };

  const WEAPON = {
    PULSE: "PULSE",
    SPREAD: "SPREAD",
    LASER: "LASER",
    PLASMA: "PLASMA",
  };

  const POWER = {
    SPREAD: "spread",
    LASER: "laser",
    PLASMA: "plasma",
    SHIELD: "shield",
    SPEED: "speed",
    BOMB: "bomb",
    MULTI: "multi",
    HEALTH: "health",
  };

  // ─── DOM ─────────────────────────────────────────────────
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  const screens = {
    title: $("screen-title"),
    how: $("screen-how"),
    pause: $("screen-pause"),
    over: $("screen-over"),
    victory: $("screen-victory"),
    intro: $("screen-intro"),
  };
  const hud = $("hud");

  // Conquistas pensadas para o modo FÁCIL (fáceis de desbloquear)
  // Dificuldade normal/hard no futuro = regras separadas, não mexer nisto.
  const ACH_META = {
    first_blood: { id: "first_blood", name: "Primeiro abate" },
    first_boss: { id: "first_boss", name: "Primeiro boss" },
    max_power: { id: "max_power", name: "Arma L3" },
    combo_10: { id: "combo_10", name: "Combo ×10" },
    overdrive: { id: "overdrive", name: "Overdrive" },
    bomber: { id: "bomber", name: "Bomba usada" },
    scavenger: { id: "scavenger", name: "5 power-ups" },
    wave_5: { id: "wave_5", name: "Wave 5" },
    sector_clear: { id: "sector_clear", name: "Setor limpo" },
    ace: { id: "ace", name: "25 mil pts" },
    endless_pilot: { id: "endless_pilot", name: "Endless 15" },
  };

  function loadAchievements() {
    try {
      return JSON.parse(localStorage.getItem(ACH_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function saveAchievements(map) {
    localStorage.setItem(ACH_KEY, JSON.stringify(map));
  }

  let achievements = loadAchievements();
  let unlockedThisRun = [];

  // ─── State ───────────────────────────────────────────────
  let state = "title"; // title | intro | playing | pause | over | victory
  let lastTime = 0;
  let shake = 0;
  let flash = 0;
  let flashColor = "rgba(255,255,255,0.5)";

  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false, // segurando FOGO (espaço / botão / mouse)
    bomb: false,
    mx: W / 2,
    my: H * 0.75,
    pointer: false,
    // Toque/mouse: arraste RELATIVO (nave não vai para o dedo)
    dragActive: false,
    lastPx: 0,
    lastPy: 0,
    dragLean: 0,
    /** Tiro automático: default OFF — jogador liga se quiser */
    autoFire: false,
  };

  const game = {
    score: 0,
    hiscore: Number(localStorage.getItem(HS_KEY) || 0),
    lives: 3,
    bombs: 3,
    wave: 1,
    kills: 0,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    mult: 1,
    multTimer: 0,
    weapon: WEAPON.PULSE,
    weaponLevel: 1, // 1–3, sobe com power-ups da mesma arma
    speedBoost: 0,
    invuln: 0,
    shield: 0,
    fireCooldown: 0,
    waveTimer: 0,
    waveClearing: false,
    spawnQueue: [],
    boss: null,
    statsKills: 0,
    // Energia / especial (foco diversão)
    hp: 100,
    maxHp: 100,
    special: 0,
    specialMax: 100,
    overdrive: 0,
    // Missão / run stats
    missionWave: MISSION_WAVE,
    missionComplete: false,
    endless: false,
    runStart: 0,
    maxWeaponLevel: 1,
    bombsUsed: 0,
    bossesKilled: 0,
    pickups: 0,
  };

  // Entities
  let player = null;
  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let powerups = [];
  let stars = [];
  let trails = [];

  // ─── Utils ───────────────────────────────────────────────
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const chance = (p) => Math.random() < p;
  const lerp = (a, b, t) => a + (b - a) * t;

  function circleHit(a, b) {
    const r = (a.r || 0) + (b.r || 0);
    return dist(a, b) < r;
  }

  // ─── Stars ───────────────────────────────────────────────
  function initStars() {
    stars = [];
    for (let i = 0; i < FX.stars; i++) {
      stars.push({
        x: rand(0, W),
        y: rand(0, H),
        z: rand(0.3, 1.5),
        s: rand(0.5, 2.2),
        tw: rand(0, Math.PI * 2),
      });
    }
  }

  function updateStars(dt) {
    for (const s of stars) {
      s.y += (40 + s.z * 140) * dt;
      s.tw += dt * 4;
      if (s.y > H) {
        s.y = -2;
        s.x = rand(0, W);
      }
    }
  }

  function drawStars() {
    for (const s of stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.tw));
      ctx.fillStyle = `rgba(180, 220, 255, ${a * s.z})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s * s.z * 0.6, 0, Math.PI * 2);
      ctx.fill();
      if (!LOW_FX && s.z > 1.1) {
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.15 * a})`;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, s.y - s.z * 8);
        ctx.stroke();
      }
    }
  }

  // ─── Particles ───────────────────────────────────────────
  function capParticles() {
    if (particles.length > FX.maxParticles) {
      particles.splice(0, particles.length - FX.maxParticles);
    }
  }

  function burst(x, y, color, n = 14, speed = 180, life = 0.5) {
    n = Math.max(2, Math.floor(n * FX.particleScale));
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(speed * 0.3, speed);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(life * 0.5, life),
        max: life,
        r: rand(1.5, 4),
        color,
        drag: 0.92,
        glow: FX.shadows,
      });
    }
    capParticles();
  }

  function spark(x, y, color, n = 6) {
    n = Math.max(1, Math.floor(n * FX.particleScale));
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: rand(-80, 80),
        vy: rand(-120, -20),
        life: rand(0.2, 0.45),
        max: 0.45,
        r: rand(1, 2.5),
        color,
        drag: 0.96,
        glow: FX.shadows,
      });
    }
    capParticles();
  }

  function thruster(x, y) {
    if (FX.thrusterChance < 1 && Math.random() > FX.thrusterChance) return;
    particles.push({
      x: x + rand(-3, 3),
      y: y + rand(0, 4),
      vx: rand(-15, 15),
      vy: rand(60, 140),
      life: rand(0.12, 0.28),
      max: 0.28,
      r: rand(1.5, 3.5),
      color: chance(0.5) ? "#00f0ff" : "#7dff6b",
      drag: 0.9,
      glow: FX.shadows,
    });
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.glow && FX.shadows) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
      if (FX.shadows) ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  // ─── Floating scores ─────────────────────────────────────
  function floatScore(x, y, pts, big) {
    const el = document.createElement("div");
    el.className = "float-score" + (big ? " big" : "");
    el.textContent = `+${pts}`;
    const rect = canvas.getBoundingClientRect();
    const sx = (x / W) * rect.width;
    const sy = (y / H) * rect.height;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    $("float-scores").appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ─── Player ──────────────────────────────────────────────
  function createPlayer() {
    player = {
      x: W / 2,
      y: H * 0.78,
      r: 7, // hitbox justa (núcleo da nave) — visual é maior
      speed: 300,
      w: 28,
      h: 32,
      angle: 0,
    };
  }

  function playerHurtbox() {
    return player ? { x: player.x, y: player.y + 2, r: player.r } : null;
  }

  function updatePlayer(dt) {
    if (!player) return;
    let dx = 0;
    let dy = 0;

    // Teclado sempre funciona. Toque/mouse move a nave no handler de drag
    // (relativo) — NÃO atrai a nave para a posição do dedo.
    if (!input.dragActive) {
      if (input.left) dx -= 1;
      if (input.right) dx += 1;
      if (input.up) dy -= 1;
      if (input.down) dy += 1;
      if (dx || dy) {
        const l = Math.hypot(dx, dy);
        dx /= l;
        dy /= l;
      }
      const spd = player.speed * (game.speedBoost > 0 ? 1.45 : 1);
      player.x = clamp(player.x + dx * spd * dt, 18, W - 18);
      player.y = clamp(player.y + dy * spd * dt, 40, H - 24);
      player.angle = lerp(player.angle, dx * 0.35, 0.2);
    } else {
      // Inclinação visual suave no arraste
      player.angle = lerp(player.angle, clamp(input.dragLean, -0.4, 0.4), 0.25);
      input.dragLean *= 0.85;
    }

    thruster(player.x, player.y + 14);
    if (game.speedBoost > 0 && !LOW_FX) thruster(player.x + 6, player.y + 12);

    // Tiro: AUTO ligado OU segurando FOGO (espaço / botão / clique)
    game.fireCooldown -= dt;
    const wantFire = input.autoFire || input.fire;
    if (wantFire && game.fireCooldown <= 0 && game.invuln < 1.2) {
      firePlayer();
    }

    if (game.invuln > 0) game.invuln -= dt;
    if (game.shield > 0) game.shield -= dt;
    if (game.speedBoost > 0) game.speedBoost -= dt;
    if (game.overdrive > 0) {
      game.overdrive -= dt;
      if (game.overdrive <= 0) {
        $("overdrive-fx").classList.add("hidden");
      }
    }
    if (game.multTimer > 0) {
      game.multTimer -= dt;
      if (game.multTimer <= 0) game.mult = 1;
    }
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) {
        game.combo = 0;
        updateComboHUD();
      }
    }

    // Regeneração leve de energia em overdrive
    if (game.overdrive > 0 && game.hp < game.maxHp) {
      game.hp = Math.min(game.maxHp, game.hp + 8 * dt);
      updateHpHUD();
    }
  }

  function firePlayer() {
    const w = game.weapon;
    const lv = game.weaponLevel;
    const od = game.overdrive > 0;
    const y = player.y - 16;
    const x = player.x;
    const dmgMul = od ? 1.35 : 1;

    if (w === WEAPON.SPREAD) {
      game.fireCooldown = od ? 0.09 : 0.15 - lv * 0.012;
      const ways = lv === 1 ? 3 : lv === 2 ? 5 : 7;
      const spread = 0.22 + lv * 0.04;
      for (let i = 0; i < ways; i++) {
        const t = ways === 1 ? 0 : (i / (ways - 1) - 0.5) * 2;
        const ang = -Math.PI / 2 + t * spread * (ways - 1) * 0.55;
        const sp = 500 + lv * 20;
        spawnBullet(
          x,
          y,
          Math.cos(ang) * sp,
          Math.sin(ang) * sp,
          5 + lv,
          i % 2 ? "#ff88dd" : "#ff2bd6",
          true,
          { dmg: (0.9 + lv * 0.15) * dmgMul }
        );
      }
      AudioSys.shoot("spread");
    } else if (w === WEAPON.LASER) {
      game.fireCooldown = od ? 0.04 : 0.07 - lv * 0.008;
      spawnBullet(x, y, 0, -920 - lv * 30, 4 + lv, "#7dff6b", true, {
        laser: true,
        dmg: (1 + lv * 0.35) * dmgMul,
      });
      if (lv >= 2) {
        spawnBullet(x - 9, y + 3, 0, -900, 3, "#b6ff9a", true, {
          laser: true,
          dmg: 0.7 * dmgMul,
        });
        spawnBullet(x + 9, y + 3, 0, -900, 3, "#b6ff9a", true, {
          laser: true,
          dmg: 0.7 * dmgMul,
        });
      }
      if (lv >= 3) {
        spawnBullet(x - 16, y + 6, -40, -860, 2.5, "#d4ffc4", true, {
          laser: true,
          dmg: 0.45 * dmgMul,
        });
        spawnBullet(x + 16, y + 6, 40, -860, 2.5, "#d4ffc4", true, {
          laser: true,
          dmg: 0.45 * dmgMul,
        });
      }
      AudioSys.shoot("laser");
    } else if (w === WEAPON.PLASMA) {
      game.fireCooldown = od ? 0.14 : 0.24 - lv * 0.02;
      const r = 10 + lv * 3;
      spawnBullet(x, y, 0, -380 - lv * 20, r, "#8b5cff", true, {
        dmg: (2.2 + lv * 0.9) * dmgMul,
        plasma: true,
      });
      if (lv >= 3) {
        spawnBullet(x - 14, y + 4, -30, -360, r * 0.55, "#b48cff", true, {
          dmg: 1.2 * dmgMul,
          plasma: true,
        });
        spawnBullet(x + 14, y + 4, 30, -360, r * 0.55, "#b48cff", true, {
          dmg: 1.2 * dmgMul,
          plasma: true,
        });
      }
      spark(x, y, "#8b5cff", 3 + lv);
      AudioSys.shoot("spread");
    } else {
      // PULSE L1 dual · L2 triple · L3 quint + mais rápido
      game.fireCooldown = od ? 0.07 : 0.13 - lv * 0.015;
      const dmg = (1 + (lv - 1) * 0.2) * dmgMul;
      if (lv === 1) {
        spawnBullet(x - 7, y, 0, -560, 5, "#00f0ff", true, { dmg });
        spawnBullet(x + 7, y, 0, -560, 5, "#00f0ff", true, { dmg });
      } else if (lv === 2) {
        spawnBullet(x, y, 0, -580, 6, "#00f0ff", true, { dmg: dmg * 1.1 });
        spawnBullet(x - 10, y + 2, -20, -560, 5, "#7af7ff", true, { dmg });
        spawnBullet(x + 10, y + 2, 20, -560, 5, "#7af7ff", true, { dmg });
      } else {
        spawnBullet(x, y, 0, -600, 6, "#fff", true, { dmg: dmg * 1.2 });
        spawnBullet(x - 8, y, -15, -580, 5, "#00f0ff", true, { dmg });
        spawnBullet(x + 8, y, 15, -580, 5, "#00f0ff", true, { dmg });
        spawnBullet(x - 16, y + 4, -55, -540, 4, "#7af7ff", true, { dmg: dmg * 0.85 });
        spawnBullet(x + 16, y + 4, 55, -540, 4, "#7af7ff", true, { dmg: dmg * 0.85 });
      }
      AudioSys.shoot("pulse");
    }
  }

  function spawnBullet(x, y, vx, vy, r, color, friendly, extra = {}) {
    const list = friendly ? bullets : enemyBullets;
    list.push({
      x,
      y,
      vx,
      vy,
      r,
      color,
      friendly,
      dmg: extra.dmg || 1,
      laser: !!extra.laser,
      plasma: !!extra.plasma,
      life: extra.life || 3,
    });
  }

  function drawPlayer() {
    if (!player) return;
    const blink = game.invuln > 0 && Math.floor(game.invuln * 12) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Shield
    if (game.shield > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.35 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      if (FX.shadows) {
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 15;
      }
      ctx.beginPath();
      ctx.arc(0, 0, 22 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      if (FX.shadows) ctx.shadowBlur = 0;
    }

    // Engine glow
    ctx.fillStyle = "rgba(0, 240, 255, 0.35)";
    ctx.beginPath();
    ctx.moveTo(-6, 10);
    ctx.lineTo(0, 22 + Math.sin(performance.now() / 40) * 4);
    ctx.lineTo(6, 10);
    ctx.fill();

    // Body
    const g = ctx.createLinearGradient(0, -16, 0, 16);
    g.addColorStop(0, "#e8fbff");
    g.addColorStop(0.4, "#00d4ff");
    g.addColorStop(1, "#005a88");
    ctx.fillStyle = g;
    if (FX.shadows) {
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 16;
    }
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(12, 6);
    ctx.lineTo(8, 12);
    ctx.lineTo(0, 8);
    ctx.lineTo(-8, 12);
    ctx.lineTo(-12, 6);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    if (FX.shadows) ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff8";
    ctx.beginPath();
    ctx.ellipse(0, -2, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings accent
    ctx.fillStyle = "#ff2bd6";
    ctx.fillRect(-14, 2, 5, 2);
    ctx.fillRect(9, 2, 5, 2);

    // Nível da arma — marcas nas asas
    ctx.fillStyle = game.weaponLevel >= 2 ? "#ffd166" : "#ffffff33";
    ctx.fillRect(-10, 6, 3, 3);
    ctx.fillRect(7, 6, 3, 3);
    if (game.weaponLevel >= 3) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-3, 10, 6, 2);
    }

    // Overdrive glow
    if (game.overdrive > 0) {
      ctx.strokeStyle = `rgba(255, 209, 102, ${0.4 + 0.4 * Math.sin(performance.now() / 80)})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = "#ffd166";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Fumaça se energia baixa
    if (game.hp < 35 && chance(0.4)) {
      particles.push({
        x: player.x + rand(-6, 6),
        y: player.y + rand(0, 6),
        vx: rand(-20, 20),
        vy: rand(30, 80),
        life: rand(0.2, 0.4),
        max: 0.4,
        r: rand(2, 4),
        color: chance(0.5) ? "#555" : "#884422",
        drag: 0.94,
        glow: false,
      });
    }
  }

  // ─── Bullets ─────────────────────────────────────────────
  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20 || b.life <= 0) {
        bullets.splice(i, 1);
      }
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20 || b.life <= 0) {
        enemyBullets.splice(i, 1);
      }
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      ctx.save();
      if (FX.shadows) {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = b.plasma ? 20 : 12;
      }
      ctx.fillStyle = b.color;
      if (b.laser) {
        ctx.fillRect(b.x - b.r * 0.4, b.y - 10, b.r * 0.8, 18);
        ctx.fillStyle = "#fff";
        ctx.fillRect(b.x - 1, b.y - 8, 2, 14);
      } else if (b.plasma) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r * 0.6, b.r * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const b of enemyBullets) {
      ctx.save();
      if (FX.shadows) {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ─── Enemies ─────────────────────────────────────────────
  function enemyDefs(wave) {
    // Modo fácil: cada tipo com identidade (movimento/tiro), ainda generoso
    const scale = 0.75 + (wave - 1) * 0.035;
    return {
      // Desce devagar em coluna — “soldado de linha”
      grunt: {
        hp: 2.2 * scale,
        speed: 48 + wave * 1.5,
        score: 100,
        r: 14,
        color: "#ff5c7a",
        kind: "grunt",
      },
      // Zigzag largo — difícil de mirar no spray
      zigzag: {
        hp: 2 * scale,
        speed: 75 + wave * 2,
        score: 150,
        r: 12,
        color: "#ffd166",
        kind: "zigzag",
      },
      // Lento, tanque, ocasionalmente um tiro lento
      tank: {
        hp: 9 * scale,
        speed: 28 + wave * 0.5,
        score: 320,
        r: 20,
        color: "#8b5cff",
        kind: "tank",
      },
      // Fica no meio e atira (cadência mansa no fácil)
      shooter: {
        hp: 3.5 * scale,
        speed: 38 + wave,
        score: 260,
        r: 15,
        color: "#ff2bd6",
        kind: "shooter",
      },
      // Persegue o jogador
      kamikaze: {
        hp: 1.8 * scale,
        speed: 100 + wave * 2.5,
        score: 200,
        r: 11,
        color: "#ff8844",
        kind: "kamikaze",
      },
      // Rápido, órbita lateral
      drone: {
        hp: 1.4 * scale,
        speed: 65 + wave * 1.5,
        score: 80,
        r: 10,
        color: "#00f0ff",
        kind: "drone",
      },
    };
  }

  function spawnEnemy(type, x, y, opts = {}) {
    const defs = enemyDefs(game.wave);
    const d = defs[type] || defs.grunt;
    const e = {
      ...d,
      x: x ?? rand(30, W - 30),
      y: y ?? -30,
      maxHp: d.hp,
      hp: d.hp,
      t: rand(0, Math.PI * 2),
      fireCd: rand(0.8, 2),
      phase: rand(0, Math.PI * 2),
      hitFlash: 0,
      swarm: !!opts.swarm,
    };

    // Enxame: mais vida, hitbox menor, desce mais devagar, cor própria
    // Ainda dá para limpar — só não some em 1 segundo de spray
    if (e.swarm) {
      e.hp = e.maxHp = 4.2 + game.wave * 0.15;
      e.r = 8;
      e.speed = (d.speed || 60) * 0.55;
      e.score = 55;
      e.color = type === "grunt" ? "#9dff8a" : "#5dffc8";
      e.kind = type; // mantém AI base + flag swarm no update
    }

    enemies.push(e);
  }

  function buildWave(n) {
    const q = [];
    const isBoss = n % 5 === 0;

    if (isBoss) {
      // mini wave then boss
      for (let i = 0; i < 6; i++) {
        q.push({ delay: i * 0.35, type: "drone", x: 60 + (i % 6) * 60 });
      }
      q.push({ delay: 3.5, boss: true });
      return q;
    }

    // Menos inimigos, spawns mais espaçados (fácil de ler e avançar)
    const count = 6 + Math.floor(n * 1.05);
    for (let i = 0; i < count; i++) {
      let type = "grunt";
      const r = Math.random();
      if (n >= 2 && r < 0.18) type = "zigzag";
      else if (n >= 3 && r < 0.3) type = "shooter";
      else if (n >= 5 && r < 0.4) type = "kamikaze";
      else if (n >= 6 && r < 0.5) type = "tank";
      else if (r < 0.72) type = "drone";

      const formation = i % 7;
      let x;
      if (formation < 3) x = W * 0.2 + formation * 50 + rand(-10, 10);
      else if (formation < 5) x = W * 0.55 + (formation - 3) * 50;
      else x = rand(40, W - 40);

      q.push({ delay: i * (0.55 - Math.min(0.15, n * 0.01)), type, x });
    }

    // mid-wave squad (menor)
    if (n >= 3) {
      const base = count * 0.5 + 1.2;
      for (let i = 0; i < 3; i++) {
        q.push({ delay: base + i * 0.28, type: n >= 5 ? "shooter" : "zigzag", x: 120 + i * 90 });
      }
    }

    // ENXAME: de vez em quando ~40–55 drones fracos (modo fácil = espetáculo, não punição)
    // Waves 2+ com chance; wave 4, 7, 9 quase garantido
    const swarmChance = n >= 9 ? 0.85 : n >= 4 ? 0.55 : n >= 2 ? 0.35 : 0;
    if (swarmChance > 0 && Math.random() < swarmChance) {
      // Mobile: enxame um pouco menor (performance)
      const swarmCount = LOW_FX ? 28 + randi(0, 10) : 42 + randi(0, 12);
      const swarmStart = count * 0.55 + 2.2;
      q.push({ delay: swarmStart - 0.05, banner: "⚠ ENXAME!" });
      for (let i = 0; i < swarmCount; i++) {
        const col = i % 10;
        const row = Math.floor(i / 10);
        q.push({
          delay: swarmStart + row * 0.22 + col * 0.04,
          type: chance(0.7) ? "drone" : "grunt",
          x: 36 + col * 44 + rand(-8, 8),
          swarm: true,
        });
      }
    }

    return q;
  }

  function spawnBoss() {
    // HP generoso no fácil — boss é espetáculo, não parede
    const hp = 50 + game.wave * 14;
    game.boss = {
      x: W / 2,
      y: -80,
      r: 44,
      hp,
      maxHp: hp,
      phase: 0,
      phaseNum: 1,
      t: 0,
      fireCd: 1.4,
      telegraph: 0,
      telegraphKind: 1,
      enter: true,
      score: 5000 + game.wave * 500,
      name: bossName(game.wave),
      hitFlash: 0,
      kind: "boss",
      aura: 0,
    };
    enemies.push(game.boss);
    $("boss-bar-wrap").classList.remove("hidden");
    $("boss-name").textContent = game.boss.name;
    $("boss-hp").style.width = "100%";
    AudioSys.bossAlert();
    showBanner(`⚠ ${game.boss.name}`);
    shake = 0.55;
    flash = 0.35;
    flashColor = "rgba(255, 43, 214, 0.3)";
  }

  function bossName(wave) {
    const names = [
      "VOID SERPENT",
      "PLASMA HYDRA",
      "NEON COLOSSUS",
      "STAR REAPER",
      "QUANTUM WRAITH",
      "OMEGA CARRIER",
    ];
    return names[((wave / 5) | 0) % names.length];
  }

  function updateEnemies(dt) {
    // Spawn queue
    if (!game.waveClearing && game.spawnQueue.length) {
      game.waveTimer += dt;
      while (game.spawnQueue.length && game.spawnQueue[0].delay <= game.waveTimer) {
        const s = game.spawnQueue.shift();
        if (s.banner) {
          showBanner(s.banner);
          continue;
        }
        if (s.boss) spawnBoss();
        else
          spawnEnemy(s.type, s.x, s.swarm ? -15 - rand(0, 50) : -20, {
            swarm: !!s.swarm,
          });
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.t += dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;

      if (e.kind === "boss") {
        updateBoss(e, dt);
        continue;
      }

      // Identidade por tipo (+ comportamento extra se for enxame)
      if (e.swarm) {
        // Nuvem viva: sobe/desce pouco, oscila forte — exige varredura
        e.x += Math.sin(e.t * 5.5 + e.phase) * 160 * dt;
        e.y += e.speed * dt + Math.sin(e.t * 3 + e.phase) * 25 * dt;
      } else {
        switch (e.kind) {
          case "zigzag":
            e.x += Math.sin(e.t * 4.2) * 140 * dt;
            e.y += e.speed * dt;
            break;
          case "tank":
            e.y += e.speed * dt;
            e.x += Math.sin(e.t * 1.1) * 22 * dt;
            e.fireCd -= dt;
            // tiro raro e lento (fácil de desviar)
            if (e.fireCd <= 0 && e.y > 40 && e.y < H * 0.55) {
              e.fireCd = 2.4;
              spawnBullet(e.x, e.y + 12, 0, 120, 7, "#b48cff", false);
            }
            break;
          case "shooter":
            e.y += e.speed * 0.55 * dt;
            e.x += Math.sin(e.t * 1.6) * 40 * dt;
            e.fireCd -= dt;
            if (e.fireCd <= 0 && e.y > 30 && e.y < H * 0.6) {
              e.fireCd = Math.max(1.35, 2.1 - game.wave * 0.03);
              // leque de 3 tiros lentos (identidade) — ainda fácil
              for (let a = -1; a <= 1; a++) {
                const ang = Math.PI / 2 + a * 0.22;
                spawnBullet(
                  e.x,
                  e.y + 10,
                  Math.cos(ang) * 140,
                  Math.sin(ang) * 140,
                  5,
                  "#ff4d6d",
                  false
                );
              }
            }
            break;
          case "kamikaze":
            if (player) {
              const a = Math.atan2(player.y - e.y, player.x - e.x);
              e.x += Math.cos(a) * e.speed * 0.9 * dt;
              e.y += Math.sin(a) * e.speed * 0.75 * dt + 35 * dt;
            } else {
              e.y += e.speed * dt;
            }
            break;
          case "drone":
            e.y += e.speed * 0.85 * dt;
            e.x += Math.cos(e.t * 4.5 + e.phase) * 95 * dt;
            break;
          default:
            // grunt: desce em leve “S”
            e.y += e.speed * dt;
            e.x += Math.sin(e.t * 1.5 + e.phase) * 28 * dt;
        }
      }

      e.x = clamp(e.x, e.r, W - e.r);

      if (e.y > H + 40) {
        enemies.splice(i, 1);
      }
    }

    // Wave clear?
    if (
      !game.waveClearing &&
      game.spawnQueue.length === 0 &&
      enemies.length === 0 &&
      state === "playing"
    ) {
      onWaveClear();
    }
  }

  function updateBoss(e, dt) {
    e.t += dt;
    e.aura += dt;

    // Entrada dramática (sem atirar)
    if (e.enter) {
      e.y = lerp(e.y, 118, 1 - Math.pow(0.0008, dt));
      if (chance(0.4)) spark(e.x + rand(-30, 30), e.y + rand(-10, 20), "#ff2bd6", 2);
      if (Math.abs(e.y - 118) < 3) {
        e.enter = false;
        e.fireCd = 1.5; // fôlego fácil antes do 1º ataque
        e.phaseNum = 1;
        showBanner("FASE 1 · LEIA OS TIROS");
        shake = 0.35;
      }
      return;
    }

    // Movimento suave (fácil de acompanhar)
    e.x = W / 2 + Math.sin(e.t * 0.7) * (120 + Math.sin(e.t * 0.25) * 16);
    e.y = 118 + Math.sin(e.t * 1.2) * 14;

    const hpRatio = e.hp / e.maxHp;
    const phase = hpRatio > 0.66 ? 1 : hpRatio > 0.33 ? 2 : 3;

    // Troca de fase: pausa + anúncio (legível, não punitivo)
    if (phase !== e.phaseNum) {
      e.phaseNum = phase;
      e.telegraph = 0;
      e.fireCd = 1.35;
      enemyBullets = []; // limpa balas na troca — generoso no fácil
      flash = 0.3;
      flashColor = phase === 3 ? "rgba(255,59,92,0.35)" : "rgba(255,209,102,0.28)";
      burst(e.x, e.y, phase === 3 ? "#ff3b5c" : "#ffd166", 28, 220, 0.5);
      showBanner(phase === 2 ? "FASE 2 · ANÉIS" : "FASE FINAL · ABANICO");
      AudioSys.bossAlert();
    }

    // Telegraph: avisa ANTES de atirar (modo fácil = tempo para reagir)
    if (e.telegraph > 0) {
      e.telegraph -= dt;
      if (e.telegraph <= 0) {
        bossFirePattern(e, e.telegraphKind);
        // cooldown generoso por fase
        e.fireCd = e.telegraphKind === 1 ? 1.05 : e.telegraphKind === 2 ? 0.85 : 0.7;
      }
      return;
    }

    e.fireCd -= dt;
    if (e.fireCd <= 0) {
      e.telegraphKind = phase;
      // tempos de aviso generosos
      e.telegraph = phase === 1 ? 0.7 : phase === 2 ? 0.6 : 0.5;
    }
  }

  function bossFirePattern(e, phase) {
    // Padrões legíveis — fácil. Hard no futuro terá mais densidade/menos aviso.
    if (phase === 1) {
      for (let a = -1; a <= 1; a++) {
        const ang = Math.PI / 2 + a * 0.3;
        spawnBullet(e.x, e.y + 22, Math.cos(ang) * 155, Math.sin(ang) * 155, 6, "#ff2bd6", false);
      }
    } else if (phase === 2) {
      const rings = 7;
      for (let i = 0; i < rings; i++) {
        const ang = (i / rings) * Math.PI * 2 + e.t * 0.5;
        spawnBullet(e.x, e.y, Math.cos(ang) * 125, Math.sin(ang) * 125, 5, "#ffd166", false);
      }
    } else {
      for (let a = -2; a <= 2; a++) {
        const ang = Math.PI / 2 + a * 0.22;
        spawnBullet(e.x, e.y + 12, Math.cos(ang) * 190, Math.sin(ang) * 190, 5, "#ff3b5c", false);
      }
      if (player && chance(0.35)) aimShoot(e, 200, "#fff");
    }
    spark(e.x, e.y + 16, "#fff", 8);
  }

  function aimShoot(e, speed, color) {
    if (!player) return;
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    spawnBullet(e.x, e.y + 8, Math.cos(a) * speed, Math.sin(a) * speed, 5, color, false);
  }

  function drawEnemies() {
    for (const e of enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.hitFlash > 0) ctx.globalAlpha = 0.5 + 0.5 * Math.sin(e.hitFlash * 40);

      if (e.kind === "boss") {
        drawBoss(e);
      } else {
        drawEnemyShip(e);
      }
      ctx.restore();
    }
  }

  function drawEnemyShip(e) {
    if (FX.shadows) {
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = e.color;

    if (e.kind === "tank") {
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(18, -8);
      ctx.lineTo(10, -16);
      ctx.lineTo(-10, -16);
      ctx.lineTo(-18, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1a0a2e";
      ctx.fillRect(-6, -8, 12, 10);
    } else if (e.kind === "zigzag") {
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(12, -4);
      ctx.lineTo(0, -12);
      ctx.lineTo(-12, -4);
      ctx.closePath();
      ctx.fill();
    } else if (e.kind === "shooter") {
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a0020";
      ctx.beginPath();
      ctx.arc(0, 2, 6, 0, Math.PI * 2);
      ctx.fill();
      // turrets
      ctx.fillStyle = e.color;
      ctx.fillRect(-12, 4, 4, 8);
      ctx.fillRect(8, 4, 4, 8);
    } else if (e.kind === "kamikaze") {
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(10, -10);
      ctx.lineTo(0, -4);
      ctx.lineTo(-10, -10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff2200";
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === "drone") {
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff6";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // grunt
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(14, -10);
      ctx.lineTo(0, -6);
      ctx.lineTo(-14, -10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#300010";
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(5, -4);
      ctx.lineTo(-5, -4);
      ctx.fill();
    }

    // HP pip for tanks
    if (e.kind === "tank" || e.hp > e.maxHp * 0.5) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(-12, -e.r - 8, 24, 3);
      ctx.fillStyle = "#7dff6b";
      ctx.fillRect(-12, -e.r - 8, 24 * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
  }

  function drawBoss(e) {
    const phase = e.phaseNum || 1;
    const pulse = 1 + Math.sin(e.t * 4) * 0.04;
    const threat =
      e.telegraph > 0 ? 0.55 + 0.45 * Math.sin(performance.now() / 50) : 0;

    // Aura de fase
    ctx.save();
    const auraCol =
      phase === 3 ? "255,59,92" : phase === 2 ? "255,209,102" : "255,43,214";
    ctx.strokeStyle = `rgba(${auraCol},${0.2 + 0.15 * Math.sin(e.aura * 3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 52 + Math.sin(e.aura * 2) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Telegraph: linhas de aviso (fácil de ler)
    if (e.telegraph > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + threat * 0.4;
      ctx.strokeStyle = phase === 2 ? "#ffd166" : phase === 3 ? "#ff3b5c" : "#ff2bd6";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      if (phase === 1 || phase === 3) {
        const n = phase === 1 ? 3 : 5;
        for (let a = -(n - 1) / 2; a <= (n - 1) / 2; a++) {
          const ang = Math.PI / 2 + a * (phase === 1 ? 0.3 : 0.22);
          ctx.beginPath();
          ctx.moveTo(0, 10);
          ctx.lineTo(Math.cos(ang) * 220, Math.sin(ang) * 220);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 40 + (1 - e.telegraph) * 30, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.scale(pulse, pulse);
    if (FX.shadows) {
      ctx.shadowColor = phase === 3 ? "#ff3b5c" : "#ff2bd6";
      ctx.shadowBlur = 22 + threat * 12;
    }

    // Core body
    const g = ctx.createRadialGradient(0, 0, 5, 0, 0, 48);
    g.addColorStop(0, phase === 3 ? "#ffaabb" : "#ff88cc");
    g.addColorStop(0.4, phase === 3 ? "#ff3b5c" : "#ff2bd6");
    g.addColorStop(1, "#4a0050");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(36, 10);
    ctx.lineTo(48, -20);
    ctx.lineTo(20, -36);
    ctx.lineTo(0, -28);
    ctx.lineTo(-20, -36);
    ctx.lineTo(-48, -20);
    ctx.lineTo(-36, 10);
    ctx.closePath();
    ctx.fill();

    // Plates / armor detail
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(0, -4, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = e.telegraph > 0 ? "#ffee00" : "#ff0033";
    ctx.beginPath();
    ctx.arc(0, -2, 5 + threat * 2, 0, Math.PI * 2);
    ctx.fill();

    // Wings energy
    ctx.strokeStyle = `rgba(${auraCol}, ${0.45 + 0.45 * Math.sin(e.t * 6)})`;
    ctx.lineWidth = 2 + threat;
    ctx.beginPath();
    ctx.moveTo(-40, -10);
    ctx.quadraticCurveTo(-70 - threat * 10, 0, -40, 20);
    ctx.moveTo(40, -10);
    ctx.quadraticCurveTo(70 + threat * 10, 0, 40, 20);
    ctx.stroke();

    // Phase pips under boss
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-18, 44, 36, 5);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < phase ? `rgba(${auraCol},0.95)` : "rgba(255,255,255,0.15)";
      ctx.fillRect(-16 + i * 12, 45, 10, 3);
    }

    // HP bar update
    $("boss-hp").style.width = `${(e.hp / e.maxHp) * 100}%`;
    $("boss-name").textContent = `${e.name} · F${phase}`;
  }

  // ─── Powerups ────────────────────────────────────────────
  function dropPowerup(x, y) {
    // Drops generosos no modo diversão
    if (!chance(0.42)) return;
    const pool = [
      POWER.SPREAD,
      POWER.SPREAD,
      POWER.LASER,
      POWER.LASER,
      POWER.PLASMA,
      POWER.SHIELD,
      POWER.SPEED,
      POWER.BOMB,
      POWER.MULTI,
      POWER.HEALTH,
      POWER.HEALTH,
    ];
    const type = pool[randi(0, pool.length - 1)];
    powerups.push({
      x,
      y,
      r: 14,
      type,
      vy: 65,
      t: 0,
      life: 12,
    });
  }

  function updatePowerups(dt) {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.t += dt;
      p.life -= dt;
      p.y += p.vy * dt;
      p.x += Math.sin(p.t * 3) * 30 * dt;
      if (p.life <= 0 || p.y > H + 20) {
        powerups.splice(i, 1);
        continue;
      }
      // Coleta generosa (hitbox de pickup maior que a de dano)
      if (player && circleHit(p, { x: player.x, y: player.y, r: 22 })) {
        applyPowerup(p.type);
        burst(p.x, p.y, powerColor(p.type), 16, 160, 0.4);
        powerups.splice(i, 1);
        AudioSys.powerup();
      }
    }
  }

  function powerColor(type) {
    const map = {
      spread: "#ff2bd6",
      laser: "#7dff6b",
      plasma: "#8b5cff",
      shield: "#00f0ff",
      speed: "#ffd166",
      bomb: "#ff8844",
      multi: "#ffd166",
      health: "#ff3b5c",
    };
    return map[type] || "#fff";
  }

  function powerLabel(type) {
    const map = {
      spread: "SPREAD",
      laser: "LASER",
      plasma: "PLASMA",
      shield: "SHIELD",
      speed: "SPEED",
      bomb: "BOMB +1",
      multi: "×2 SCORE",
      health: "+ENERGIA",
    };
    return map[type] || type;
  }

  function upgradeWeapon(newWeapon) {
    if (game.weapon === newWeapon) {
      const prev = game.weaponLevel;
      game.weaponLevel = Math.min(3, game.weaponLevel + 1);
      game.maxWeaponLevel = Math.max(game.maxWeaponLevel, game.weaponLevel);
      if (game.weaponLevel >= 3) unlockAchievement("max_power");
      return game.weaponLevel > prev
        ? `${newWeapon} · L${game.weaponLevel}!`
        : `${newWeapon} MAX`;
    }
    game.weapon = newWeapon;
    // Trocar arma mantém nível (generoso) no mín. 1
    game.weaponLevel = Math.max(1, game.weaponLevel);
    game.maxWeaponLevel = Math.max(game.maxWeaponLevel, game.weaponLevel);
    if (game.weaponLevel >= 3) unlockAchievement("max_power");
    return `${newWeapon} · L${game.weaponLevel}`;
  }

  function unlockAchievement(id) {
    if (!ACH_META[id]) return;
    if (achievements[id]) return;
    achievements[id] = true;
    saveAchievements(achievements);
    unlockedThisRun.push(ACH_META[id].name);
    refreshAchievementsUI();
    if (state === "playing" || state === "victory") {
      showBanner(`★ ${ACH_META[id].name.toUpperCase()}`);
    }
    AudioSys.powerup();
  }

  function checkScoreAchievements() {
    if (game.score >= 25000) unlockAchievement("ace");
  }

  function refreshAchievementsUI() {
    document.querySelectorAll(".ach-pip[data-ach]").forEach((el) => {
      const id = el.getAttribute("data-ach");
      el.classList.toggle("locked", !achievements[id]);
    });
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function runElapsed() {
    if (!game.runStart) return 0;
    return (performance.now() - game.runStart) / 1000;
  }

  /** Rank da run — modo fácil: limiares generosos + bônus de missão */
  function calcRank() {
    let score = game.score;
    if (game.missionComplete) score += 12000;
    score += game.maxCombo * 80;
    score += game.maxWeaponLevel * 1500;
    score += game.bossesKilled * 3000;
    if (score >= 55000) return "S";
    if (score >= 28000) return "A";
    if (score >= 12000) return "B";
    if (game.missionComplete) return "B";
    return "C";
  }

  function setRankEl(el, rank) {
    if (!el) return;
    el.textContent = rank;
    el.className = "rank-letter rank-" + rank;
  }

  function applyPowerup(type) {
    let label = powerLabel(type);
    switch (type) {
      case POWER.SPREAD:
        label = upgradeWeapon(WEAPON.SPREAD);
        break;
      case POWER.LASER:
        label = upgradeWeapon(WEAPON.LASER);
        break;
      case POWER.PLASMA:
        label = upgradeWeapon(WEAPON.PLASMA);
        break;
      case POWER.SHIELD:
        game.shield = 10;
        break;
      case POWER.SPEED:
        game.speedBoost = 10;
        break;
      case POWER.BOMB:
        game.bombs = Math.min(9, game.bombs + 1);
        updateBombsHUD();
        break;
      case POWER.MULTI:
        game.mult = 2;
        game.multTimer = 12;
        break;
      case POWER.HEALTH:
        game.hp = Math.min(game.maxHp, game.hp + 40);
        updateHpHUD();
        // chance de vida extra se já cheio
        if (game.hp >= game.maxHp && chance(0.35)) {
          game.lives = Math.min(6, game.lives + 1);
          updateLivesHUD();
          label = "+VIDA!";
        }
        break;
    }
    game.pickups++;
    if (game.pickups >= 5) unlockAchievement("scavenger");
    updateWeaponHUD();
    if (player) floatScore(player.x, player.y - 30, label, true);
  }

  function drawPowerups() {
    for (const p of powerups) {
      const c = powerColor(p.type);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.t * 2);
      ctx.shadowColor = c;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const letter = {
        spread: "S",
        laser: "L",
        plasma: "P",
        shield: "U",
        speed: "V",
        bomb: "B",
        multi: "×",
        health: "+",
      }[p.type];
      ctx.shadowBlur = 0;
      ctx.fillText(letter, 0, 1);
      ctx.restore();
    }
  }

  // ─── Collisions ──────────────────────────────────────────
  function resolveCollisions() {
    // Player bullets vs enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      let hit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        // Hitbox inimigo um pouco generosa para o jogador
        if (circleHit(b, { x: e.x, y: e.y, r: e.r + 2 })) {
          e.hp -= b.dmg;
          e.hitFlash = 0.1;
          spark(b.x, b.y, b.color, 4);
          AudioSys.hit();
          hit = true;
          if (e.hp <= 0) killEnemy(e, j);
          break;
        }
      }
      if (hit) bullets.splice(i, 1);
    }

    if (!player || game.invuln > 0) return;
    const hurt = playerHurtbox();

    // Enemy bullets vs player (hitbox justa)
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (circleHit(b, hurt)) {
        enemyBullets.splice(i, 1);
        damagePlayer(14); // tiro = dano parcial
        return;
      }
    }

    // Enemies vs player
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (circleHit({ x: e.x, y: e.y, r: e.r * 0.85 }, hurt)) {
        if (e.kind !== "boss") {
          killEnemy(e, j);
        } else {
          e.hp -= 2;
        }
        damagePlayer(28); // colisão = mais dano, mas não mata sozinho de full
        return;
      }
    }
  }

  function killEnemy(e, index) {
    const comboBonus = 1 + Math.floor(game.combo / 5) * 0.25;
    const pts = Math.floor(e.score * game.mult * comboBonus);
    game.score += pts;
    game.kills++;
    game.statsKills++;
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.comboTimer = 2.4;
    unlockAchievement("first_blood");
    if (game.combo >= 10) unlockAchievement("combo_10");
    // Especial enche com abates
    const charge = e.kind === "boss" ? 40 : e.kind === "tank" ? 14 : 10;
    addSpecial(charge);
    updateScoreHUD();
    updateComboHUD();
    checkScoreAchievements();
    floatScore(e.x, e.y, pts, e.kind === "boss" || pts >= 500);

    const big = e.kind === "boss" || e.kind === "tank";
    burst(e.x, e.y, e.color || "#ff2bd6", big ? 40 : 18, big ? 280 : 200, big ? 0.7 : 0.45);
    burst(e.x, e.y, "#fff", big ? 12 : 6, 120, 0.3);
    AudioSys.explosion(big);
    shake = Math.max(shake, big ? 0.55 : 0.18);
    if (big) {
      flash = 0.25;
      flashColor = "rgba(255, 43, 214, 0.25)";
    }

    if (e.kind === "boss") {
      game.boss = null;
      game.bossesKilled++;
      unlockAchievement("first_boss");
      $("boss-bar-wrap").classList.add("hidden");
      // reward bombs + weapon
      game.bombs = Math.min(9, game.bombs + 1);
      dropPowerup(e.x - 20, e.y);
      dropPowerup(e.x + 20, e.y);
      updateBombsHUD();
    } else {
      dropPowerup(e.x, e.y);
    }

    enemies.splice(index, 1);
  }

  function damagePlayer(amount) {
    if (!player) return;
    if (game.overdrive > 0) {
      // Overdrive absorve parte do dano
      amount *= 0.35;
    }
    if (game.shield > 0) {
      game.shield = Math.max(0, game.shield - 2.5);
      burst(player.x, player.y, "#00f0ff", 14, 160, 0.3);
      AudioSys.hit();
      game.invuln = 0.7;
      shake = 0.2;
      return;
    }

    game.hp = Math.max(0, game.hp - amount);
    updateHpHUD();
    game.invuln = 1.1;
    game.combo = 0;
    updateComboHUD();
    burst(player.x, player.y, "#00f0ff", 18, 200, 0.4);
    AudioSys.playerHit();
    shake = 0.35;
    flash = 0.2;
    flashColor = "rgba(255, 59, 92, 0.3)";

    if (game.hp > 0) return;

    // Energia zerou → perde uma vida e recarrega
    game.lives--;
    updateLivesHUD();
    if (game.lives <= 0) {
      game.lives = 0;
      updateLivesHUD();
      endGame();
      return;
    }

    game.hp = game.maxHp;
    updateHpHUD();
    game.invuln = 2.2;
    game.weaponLevel = Math.max(1, game.weaponLevel - 1);
    if (game.weaponLevel === 1 && chance(0.4)) game.weapon = WEAPON.PULSE;
    updateWeaponHUD();
    burst(player.x, player.y, "#ff3b5c", 36, 280, 0.6);
    flash = 0.35;
    showBanner("ENERGIA RESTAURADA");
  }

  function addSpecial(n) {
    if (game.overdrive > 0) return;
    game.special = Math.min(game.specialMax, game.special + n);
    updateSpecialHUD();
  }

  function useSpecial() {
    if (state !== "playing" || !player) return;
    if (game.overdrive > 0) return;
    if (game.special < game.specialMax) return;

    game.special = 0;
    game.overdrive = 4.5;
    unlockAchievement("overdrive");
    updateSpecialHUD();
    $("overdrive-fx").classList.remove("hidden");
    AudioSys.bomb();
    shake = 0.45;
    flash = 0.3;
    flashColor = "rgba(255, 209, 102, 0.35)";
    game.invuln = Math.max(game.invuln, 1.5);

    // Limpa balas inimigas próximas e dano leve em todos
    enemyBullets = [];
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.hp -= e.kind === "boss" ? e.maxHp * 0.12 : 2.5;
      spark(e.x, e.y, "#ffd166", 6);
      if (e.hp <= 0) killEnemy(e, i);
    }
    for (let a = 0; a < Math.PI * 2; a += 0.25) {
      particles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(a) * 320,
        vy: Math.sin(a) * 320,
        life: 0.4,
        max: 0.4,
        r: 2.5,
        color: "#ffd166",
        drag: 0.93,
        glow: true,
      });
    }
    floatScore(player.x, player.y - 40, "OVERDRIVE!", true);
  }

  function useBomb() {
    if (state !== "playing" || game.bombs <= 0 || !player) return;
    game.bombs--;
    game.bombsUsed++;
    unlockAchievement("bomber");
    updateBombsHUD();
    AudioSys.bomb();
    shake = 0.8;
    flash = 0.45;
    flashColor = "rgba(255, 200, 80, 0.4)";

    // Clear bullets, damage all enemies
    enemyBullets = [];
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.hp -= e.kind === "boss" ? e.maxHp * 0.28 : e.maxHp;
      burst(e.x, e.y, "#ffd166", 20, 220, 0.5);
      if (e.hp <= 0) killEnemy(e, i);
    }
    // ring particles
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      particles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(a) * 400,
        vy: Math.sin(a) * 400,
        life: 0.5,
        max: 0.5,
        r: 3,
        color: "#ffd166",
        drag: 0.94,
        glow: true,
      });
    }
    game.invuln = Math.max(game.invuln, 1.4);
    addSpecial(20);
  }

  // ─── Waves ───────────────────────────────────────────────
  function updateMissionHUD() {
    const label = $("hud-mission-label");
    const waveEl = $("hud-wave");
    if (!waveEl) return;
    if (game.endless || game.missionComplete) {
      if (label) label.textContent = "ENDLESS";
      waveEl.textContent = String(game.wave);
    } else {
      if (label) label.textContent = "MISSÃO";
      waveEl.textContent = `${game.wave}/${MISSION_WAVE}`;
    }
  }

  function startWave(n) {
    game.wave = n;
    game.waveTimer = 0;
    game.waveClearing = false;
    game.spawnQueue = buildWave(n);
    updateMissionHUD();
    if (n >= 5) unlockAchievement("wave_5");
    if (game.endless && n >= 15) unlockAchievement("endless_pilot");
    if (!game.endless && n === MISSION_WAVE) {
      showBanner(`WAVE ${n} · FINAL DO SETOR`);
    } else {
      showBanner(n % 5 === 0 ? `BOSS WAVE ${n}` : `WAVE ${n}`);
    }
  }

  function onWaveClear() {
    game.waveClearing = true;
    AudioSys.waveClear();
    const bonus = game.wave * 500 * game.mult;
    game.score += bonus;
    // Recompensa de wave: energia + especial (modo diversão)
    game.hp = Math.min(game.maxHp, game.hp + 25);
    addSpecial(25);
    updateHpHUD();
    updateScoreHUD();

    // Missão: limpar wave 10 = setor limpo
    if (!game.missionComplete && game.wave >= MISSION_WAVE) {
      game.missionComplete = true;
      unlockAchievement("sector_clear");
      const missionBonus = 10000;
      game.score += missionBonus;
      updateScoreHUD();
      showBanner(`SETOR LIMPO  +${missionBonus}`);
      setTimeout(() => {
        if (state === "playing") showVictory();
      }, 2000);
      return;
    }

    showBanner(`WAVE ${game.wave} CLEAR  +${bonus}`);
    setTimeout(() => {
      if (state === "playing") startWave(game.wave + 1);
    }, 2200);
  }

  function showVictory() {
    state = "victory";
    AudioSys.waveClear();
    const rank = calcRank();
    setRankEl($("victory-rank"), rank);
    $("victory-score").textContent = game.score.toLocaleString("pt-BR");
    $("victory-kills").textContent = String(game.statsKills);
    $("victory-combo").textContent = String(game.maxCombo);
    $("victory-time").textContent = formatTime(runElapsed());

    if (game.score > Number(localStorage.getItem(HS_KEY) || 0)) {
      localStorage.setItem(HS_KEY, String(game.score));
      game.hiscore = game.score;
    }

    hud.classList.add("hidden");
    $("boss-bar-wrap").classList.add("hidden");
    showScreen("victory");
  }

  function continueEndless() {
    AudioSys.uiClick();
    game.endless = true;
    game.waveClearing = false;
    state = "playing";
    showScreen(null);
    hud.classList.remove("hidden");
    updateMissionHUD();
    showBanner("ENDLESS MODE");
    AudioSys.startMusic();
    startWave(game.wave + 1);
  }

  function showBanner(text) {
    const el = $("wave-banner");
    const span = $("wave-banner-text");
    span.textContent = text;
    el.classList.remove("hidden");
    // restart animation
    span.style.animation = "none";
    void span.offsetWidth;
    span.style.animation = "";
    setTimeout(() => el.classList.add("hidden"), 2200);
  }

  // ─── HUD ─────────────────────────────────────────────────
  function updateScoreHUD() {
    $("hud-score").textContent = game.score.toLocaleString("pt-BR");
    if (game.score > game.hiscore) {
      game.hiscore = game.score;
      $("hud-hiscore").textContent = game.hiscore.toLocaleString("pt-BR");
    }
    checkScoreAchievements();
  }

  function updateLivesHUD() {
    const box = $("hud-lives");
    box.innerHTML = "";
    const maxShow = Math.max(3, game.lives);
    for (let i = 0; i < maxShow; i++) {
      const pip = document.createElement("div");
      pip.className = "life-pip" + (i < game.lives ? "" : " empty");
      box.appendChild(pip);
    }
  }

  function updateBombsHUD() {
    $("hud-bombs").textContent = String(game.bombs);
  }

  function updateWeaponHUD() {
    $("hud-weapon").textContent = `${game.weapon} · L${game.weaponLevel}`;
  }

  function updateHpHUD() {
    const el = $("hud-hp");
    const txt = $("hud-hp-text");
    if (!el) return;
    const pct = clamp((game.hp / game.maxHp) * 100, 0, 100);
    el.style.width = `${pct}%`;
    el.classList.toggle("low", game.hp <= 35);
    if (txt) txt.textContent = String(Math.ceil(game.hp));
  }

  function updateSpecialHUD() {
    const el = $("hud-special");
    const ready = $("hud-special-ready");
    if (!el) return;
    const pct = clamp((game.special / game.specialMax) * 100, 0, 100);
    el.style.width = `${pct}%`;
    const full = game.special >= game.specialMax && game.overdrive <= 0;
    el.classList.toggle("full", full);
    if (ready) ready.classList.toggle("hidden", !full);
  }

  function updateComboHUD() {
    const el = $("hud-combo");
    if (game.combo >= 3) {
      el.textContent = `×${game.combo}`;
      el.classList.remove("hidden");
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "";
    } else {
      el.classList.add("hidden");
    }
  }

  function refreshTitleHi() {
    $("title-hiscore").textContent = game.hiscore.toLocaleString("pt-BR");
    $("hud-hiscore").textContent = game.hiscore.toLocaleString("pt-BR");
  }

  // ─── Game flow ───────────────────────────────────────────
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    if (name && screens[name]) screens[name].classList.remove("hidden");
  }

  function resetGame() {
    game.score = 0;
    game.lives = 3;
    game.bombs = 3;
    game.wave = 1;
    game.kills = 0;
    game.statsKills = 0;
    game.combo = 0;
    game.maxCombo = 0;
    game.comboTimer = 0;
    game.mult = 1;
    game.multTimer = 0;
    game.weapon = WEAPON.PULSE;
    game.weaponLevel = 1;
    game.speedBoost = 0;
    game.invuln = 2;
    game.shield = 0;
    game.fireCooldown = 0;
    input.autoFire = false;
    input.fire = false;
    updateAutoFireUI();
    game.waveTimer = 0;
    game.waveClearing = false;
    game.spawnQueue = [];
    game.boss = null;
    game.hp = game.maxHp;
    game.special = 0;
    game.overdrive = 0;
    game.missionComplete = false;
    game.endless = false;
    game.runStart = performance.now();
    game.maxWeaponLevel = 1;
    game.bombsUsed = 0;
    game.bossesKilled = 0;
    game.pickups = 0;
    unlockedThisRun = [];
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    powerups = [];
    shake = 0;
    flash = 0;
    createPlayer();
    updateScoreHUD();
    updateLivesHUD();
    updateBombsHUD();
    updateWeaponHUD();
    updateComboHUD();
    updateHpHUD();
    updateSpecialHUD();
    updateMissionHUD();
    $("boss-bar-wrap").classList.add("hidden");
    $("overdrive-fx").classList.add("hidden");
    $("float-scores").innerHTML = "";
  }

  async function startGame() {
    await AudioSys.unlock();
    AudioSys.uiClick();
    resetGame();
    // Abertura da missão (pode pular)
    state = "intro";
    hud.classList.add("hidden");
    showScreen("intro");
    // reinicia animação das linhas
    const lines = document.querySelectorAll("#intro-lines .intro-line");
    lines.forEach((el) => {
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "";
    });
  }

  async function beginMissionFromIntro() {
    await AudioSys.unlock();
    AudioSys.uiClick();
    AudioSys.startMusic();
    state = "playing";
    showScreen(null);
    hud.classList.remove("hidden");
    showBanner("MISSÃO: LIMPE O SETOR 7");
    startWave(1);
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "pause";
    showScreen("pause");
    AudioSys.uiClick();
  }

  function resumeGame() {
    if (state !== "pause") return;
    state = "playing";
    showScreen(null);
    AudioSys.uiClick();
  }

  function quitToMenu() {
    state = "title";
    AudioSys.stopMusic();
    hud.classList.add("hidden");
    $("boss-bar-wrap").classList.add("hidden");
    showScreen("title");
    refreshTitleHi();
    refreshAchievementsUI();
    AudioSys.uiClick();
  }

  function endGame() {
    state = "over";
    AudioSys.stopMusic();
    AudioSys.gameOver();
    if (player) burst(player.x, player.y, "#00f0ff", 50, 300, 0.8);
    player = null;

    const isNew = game.score >= game.hiscore && game.score > 0;
    if (game.score > Number(localStorage.getItem(HS_KEY) || 0)) {
      localStorage.setItem(HS_KEY, String(game.score));
      game.hiscore = game.score;
    }

    const rank = calcRank();
    setRankEl($("over-rank"), rank);
    $("over-score").textContent = game.score.toLocaleString("pt-BR");
    $("over-wave").textContent = String(game.wave);
    $("over-kills").textContent = String(game.statsKills);
    $("over-combo").textContent = String(game.maxCombo);
    $("over-weapon").textContent = `L${game.maxWeaponLevel}`;
    $("over-time").textContent = formatTime(runElapsed());
    $("over-bombs").textContent = String(game.bombsUsed);
    $("over-new-record").classList.toggle("hidden", !isNew);

    const achEl = $("over-ach-new");
    if (achEl) {
      if (unlockedThisRun.length) {
        achEl.textContent = "NOVA CONQUISTA: " + unlockedThisRun.join(" · ");
        achEl.classList.remove("hidden");
      } else {
        achEl.classList.add("hidden");
      }
    }

    const title = document.querySelector("#screen-over .over-title");
    if (title) {
      title.textContent = game.missionComplete ? "FIM DA RUN" : "MISSÃO FALHOU";
      title.classList.toggle("victory-title", game.missionComplete);
    }

    setTimeout(() => {
      hud.classList.add("hidden");
      $("boss-bar-wrap").classList.add("hidden");
      showScreen("over");
    }, 900);
  }

  // ─── Render ──────────────────────────────────────────────
  function drawBackground() {
    // Deep space gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#05061a");
    g.addColorStop(0.5, "#0a0520");
    g.addColorStop(1, "#02030a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Nebula blobs (desliga no mobile fraco)
    const t = performance.now() / 1000;
    if (FX.nebula) {
      drawNebula(W * 0.2, H * 0.3 + Math.sin(t * 0.2) * 20, 120, "rgba(0, 100, 180, 0.08)");
      drawNebula(W * 0.75, H * 0.55 + Math.cos(t * 0.15) * 30, 150, "rgba(140, 0, 120, 0.07)");
      drawNebula(W * 0.5, H * 0.15, 90, "rgba(0, 180, 160, 0.05)");
    }

    drawStars();

    // Grid floor perspective (subtle) — menos linhas no mobile
    if (!LOW_FX) {
      ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
      ctx.lineWidth = 1;
      const horizon = H * 0.35;
      for (let i = 0; i < 10; i++) {
        const y = horizon + Math.pow(i / 10, 1.5) * (H - horizon);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }

    // Filetes internos laterais (design de cockpit no campo de jogo)
    if (FX.innerRails) drawInnerRails(t);
  }

  function drawInnerRails(t) {
    const scroll = (t * 60) % 28;
    for (const side of [0, 1]) {
      const x0 = side === 0 ? 0 : W - 10;
      const col = side === 0 ? "rgba(0, 240, 255," : "rgba(255, 43, 214,";
      ctx.fillStyle = `${col}0.06)`;
      ctx.fillRect(x0, 0, 10, H);
      ctx.strokeStyle = `${col}0.35)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(side === 0 ? 9.5 : W - 9.5, 0);
      ctx.lineTo(side === 0 ? 9.5 : W - 9.5, H);
      ctx.stroke();
      for (let y = -28 + scroll; y < H; y += 28) {
        ctx.fillStyle = `${col}0.4)`;
        ctx.fillRect(side === 0 ? 2 : W - 8, y, 6, 3);
      }
      // nodes
      for (let i = 0; i < 5; i++) {
        const yy = 80 + i * 130 + Math.sin(t * 2 + i) * 4;
        const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3 + i));
        ctx.fillStyle = `${col}${pulse})`;
        ctx.beginPath();
        ctx.arc(side === 0 ? 5 : W - 5, yy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawNebula(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function render(dt) {
    ctx.save();
    // Screen shake
    if (shake > 0) {
      const mag = shake * 10;
      ctx.translate(rand(-mag, mag), rand(-mag, mag));
      shake = Math.max(0, shake - dt * 2.5);
    }

    drawBackground();
    drawPowerups();
    drawBullets();
    drawEnemies();
    drawPlayer();
    drawParticles();

    // Vignette (pesado em GPU fraca — só no PC)
    if (!LOW_FX) {
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    }

    // Flash overlay
    if (flash > 0) {
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = clamp(flash * 2, 0, 0.6);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      flash = Math.max(0, flash - dt);
    }

    // Mult indicator
    if (state === "playing" && game.mult > 1) {
      ctx.font = "bold 12px Orbitron, sans-serif";
      ctx.fillStyle = "#ffd166";
      ctx.textAlign = "center";
      ctx.shadowColor = "#ffd166";
      ctx.shadowBlur = 8;
      ctx.fillText(`SCORE ×${game.mult}`, W / 2, H - 50);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // ─── Loop ────────────────────────────────────────────────
  function loop(ts) {
    const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0.016);
    lastTime = ts;

    updateStars(dt);

    if (state === "playing") {
      updatePlayer(dt);
      updateBullets(dt);
      updateEnemies(dt);
      updatePowerups(dt);
      updateParticles(dt);
      resolveCollisions();
    } else if (state === "over" || state === "title") {
      updateParticles(dt);
      // idle enemies drift on title? just particles/stars
    }

    render(dt);
    requestAnimationFrame(loop);
  }

  // ─── Input ───────────────────────────────────────────────
  const keyMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    W: "up",
    s: "down",
    S: "down",
    a: "left",
    A: "left",
    d: "right",
    D: "right",
  };

  window.addEventListener("keydown", (e) => {
    if (keyMap[e.key] != null) {
      input[keyMap[e.key]] = true;
      e.preventDefault();
    }
    if (e.key === " " || e.code === "Space") {
      input.fire = true;
      e.preventDefault();
      if (state === "title") startGame();
      else if (state === "intro") beginMissionFromIntro();
    }
    if (e.key === "t" || e.key === "T") {
      if (state === "playing") toggleAutoFire();
      e.preventDefault();
    }
    if (e.key === "m" || e.key === "M") {
      toggleMuteUI();
      e.preventDefault();
    }
    if (e.key === "b" || e.key === "B" || e.key === "Shift") {
      if (state === "playing") useBomb();
      e.preventDefault();
    }
    if (e.key === "v" || e.key === "V" || e.key === "f" || e.key === "F") {
      if (state === "playing") useSpecial();
      e.preventDefault();
    }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      if (state === "playing") pauseGame();
      else if (state === "pause") resumeGame();
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (keyMap[e.key] != null) input[keyMap[e.key]] = false;
    if (e.key === " " || e.code === "Space") input.fire = false;
  });

  /** Coordenadas do ponteiro no espaço do jogo (0..W, 0..H). */
  function pointerCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const t =
      e.touches && e.touches[0]
        ? e.touches[0]
        : e.changedTouches && e.changedTouches[0]
          ? e.changedTouches[0]
          : e;
    return {
      x: ((t.clientX - rect.left) / rect.width) * W,
      y: ((t.clientY - rect.top) / rect.height) * H,
    };
  }

  /**
   * Toque/arraste RELATIVO:
   * - ao tocar, a nave NÃO vai para o dedo (fica onde está)
   * - ao arrastar, a nave se desloca pelo mesmo delta do dedo
   */
  function onPointerDown(e) {
    const p = pointerCoords(e);
    input.pointer = true;
    // Mouse: segurar botão esquerdo = FOGO (além do arraste)
    // Touch no canvas: só move (fogo é o botão FOGO ou AUTO)
    if (!e.touches) input.fire = true;
    input.dragActive = true;
    input.lastPx = p.x;
    input.lastPy = p.y;
    input.mx = p.x;
    input.my = p.y;
    input.dragLean = 0;
    if (state === "title") startGame();
    else if (state === "intro") beginMissionFromIntro();
  }

  function onPointerMove(e) {
    if (!input.dragActive) return;
    const p = pointerCoords(e);
    const dx = p.x - input.lastPx;
    const dy = p.y - input.lastPy;
    input.lastPx = p.x;
    input.lastPy = p.y;
    input.mx = p.x;
    input.my = p.y;
    input.dragLean = lerp(input.dragLean, dx * 0.12, 0.5);

    if (player && state === "playing") {
      player.x = clamp(player.x + dx, 18, W - 18);
      player.y = clamp(player.y + dy, 40, H - 24);
    }
  }

  function onPointerUp() {
    input.pointer = false;
    input.fire = false;
    input.dragActive = false;
    input.dragLean = 0;
  }

  canvas.addEventListener("mousedown", (e) => {
    onPointerDown(e);
  });
  window.addEventListener("mouseup", onPointerUp);
  canvas.addEventListener("mousemove", (e) => {
    if (input.dragActive) onPointerMove(e);
  });

  canvas.addEventListener(
    "touchstart",
    (e) => {
      onPointerDown(e);
      e.preventDefault();
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      onPointerMove(e);
      e.preventDefault();
    },
    { passive: false }
  );
  // touchend no window: dedo pode sair do canvas e ainda soltar
  window.addEventListener(
    "touchend",
    (e) => {
      if (!input.dragActive) return;
      onPointerUp();
      e.preventDefault();
    },
    { passive: false }
  );
  window.addEventListener("touchcancel", onPointerUp);

  // UI buttons
  $("btn-start").addEventListener("click", startGame);
  $("btn-how").addEventListener("click", () => {
    AudioSys.uiClick();
    showScreen("how");
  });
  $("btn-back").addEventListener("click", () => {
    AudioSys.uiClick();
    showScreen("title");
  });
  $("btn-resume").addEventListener("click", resumeGame);
  $("btn-quit").addEventListener("click", quitToMenu);
  $("btn-retry").addEventListener("click", startGame);
  $("btn-menu").addEventListener("click", quitToMenu);
  $("btn-endless")?.addEventListener("click", continueEndless);
  $("btn-victory-menu")?.addEventListener("click", quitToMenu);
  $("btn-intro-go")?.addEventListener("click", beginMissionFromIntro);
  $("btn-intro-skip")?.addEventListener("click", beginMissionFromIntro);

  function toggleAutoFire() {
    input.autoFire = !input.autoFire;
    updateAutoFireUI();
    AudioSys.uiClick();
    if (state === "playing") {
      showBanner(input.autoFire ? "AUTO-TIRO ON" : "AUTO-TIRO OFF");
    }
  }

  function toggleMuteUI() {
    const muted = AudioSys.toggleMute();
    updateMuteUI();
    if (!muted) AudioSys.uiClick();
  }

  function updateMuteUI() {
    const muted = AudioSys.isMuted();
    const menu = $("btn-mute");
    const hud = $("btn-mute-hud");
    if (menu) menu.textContent = muted ? "SOM: OFF" : "SOM: ON";
    if (hud) {
      hud.textContent = muted ? "🔇" : "🔊";
      hud.classList.toggle("off", muted);
    }
    // reaplica gain se contexto já existe
    AudioSys.setMuted(muted);
  }

  function updateAutoFireUI() {
    const on = !!input.autoFire;
    const hudBtn = $("btn-autofire");
    const hudState = $("autofire-state");
    const touchAuto = $("btn-touch-auto");
    const touchLabel = $("touch-auto-label");
    if (hudBtn) hudBtn.classList.toggle("on", on);
    if (hudState) hudState.textContent = on ? "ON" : "OFF";
    if (touchAuto) touchAuto.classList.toggle("on", on);
    if (touchLabel) touchLabel.textContent = on ? "AUTO·ON" : "AUTO";
  }

  // Botões touch: bomba / especial / auto (tap)
  function bindTouchAction(btn, fn) {
    if (!btn) return;
    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state === "playing") fn();
    };
    btn.addEventListener("touchstart", fire, { passive: false });
    btn.addEventListener("click", fire);
  }
  bindTouchAction($("btn-touch-bomb"), useBomb);
  bindTouchAction($("btn-touch-special"), useSpecial);
  bindTouchAction($("btn-touch-auto"), toggleAutoFire);
  $("btn-autofire")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (state === "playing" || state === "pause") toggleAutoFire();
  });

  function applyVersionLabels() {
    const label = `v${GAME_VERSION}`;
    const titleVer = $("title-version");
    const footer = $("footer-version");
    if (titleVer) titleVer.textContent = label;
    if (footer) footer.textContent = label;
    document.title = `NEON STRIKE ${label}`;
  }

  // Força botões em mobile / toque em tela estreita
  if (IS_MOBILE_UA || (IS_TOUCH && IS_NARROW)) {
    $("touch-controls")?.classList.add("force-show");
  }

  // ─── Boot ────────────────────────────────────────────────
  $("btn-mute")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMuteUI();
  });
  $("btn-mute-hud")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMuteUI();
  });

  applyVersionLabels();
  updateAutoFireUI();
  updateMuteUI();
  initStars();
  refreshTitleHi();
  refreshAchievementsUI();
  showScreen("title");
  // idle ambient particles on title
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: rand(0, W),
      y: rand(0, H),
      vx: rand(-10, 10),
      vy: rand(-20, 20),
      life: 999,
      max: 999,
      r: rand(0.5, 1.5),
      color: chance(0.5) ? "#00f0ff" : "#ff2bd6",
      drag: 1,
      glow: true,
    });
  }
  requestAnimationFrame(loop);
})();
