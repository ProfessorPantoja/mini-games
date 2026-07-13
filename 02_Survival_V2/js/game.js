import {
  WORLD, SPAWN, BOSS, AMBUSH, XP, CAMERA, PULSE, MELEE, JUICE,
} from "./config.js";
import { clamp, dist, dist2, normalize, randRange, randInt, pick, lerp } from "./utils.js";
import { rollCards, applyBuildBase } from "./builds.js";
import { audio } from "./audio.js";
import {
  createPlayer, updatePlayer, getOrbitPositions, hurtPlayer, healPlayer,
  createEnemy, updateEnemy, damageEnemy,
  createGem, updateGem,
  createParticles, updateParticle, createSparks, createBurstRing, updateBurstRing,
  createFloatText, updateFloatText,
  drawPlayer, drawEnemy, drawGem, drawParticle, drawFloatText, drawBurstRing,
} from "./entities.js";
import {
  drawGround, drawEliteZones, drawBossZone, drawObjectiveArrow,
  createEliteZoneState,
} from "./world.js";
import * as UI from "./ui.js";

const PHASE = {
  MENU: "menu",
  PLAY: "play",
  LEVELUP: "levelup",
  DEAD: "dead",
  WIN: "win",
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.phase = PHASE.MENU;
    this.input = { up: false, down: false, left: false, right: false };
    this.buildId = "tank";

    this.cam = { x: 0, y: 0, shake: 0 };
    this.hitStop = 0;
    this.vignette = 0;
    this.flashWhite = 0;
    this.rings = [];
    this._pulseFx = false;

    this.time = 0;
    this.spawnTimer = 0;
    this.ambushTimer = AMBUSH.firstAt;
    this.enemies = [];
    this.gems = [];
    this.particles = [];
    this.floatTexts = [];
    this.eliteZones = createEliteZoneState();
    this.clearedElites = new Set();
    this.elitesKilled = 0;
    this.bossUnlocked = false;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.player = createPlayer(WORLD.width / 2, WORLD.height / 2 + 400);

    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._bindInput();

    UI.bindUI({
      onPlay: (buildId) => this.start(buildId || this.buildId),
      onRestart: () => this.start(this.buildId),
      onMenu: () => this.backToMenu(),
    });
    UI.showMenu();
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _bindInput() {
    const map = {
      KeyW: "up", ArrowUp: "up",
      KeyS: "down", ArrowDown: "down",
      KeyA: "left", ArrowLeft: "left",
      KeyD: "right", ArrowRight: "right",
    };
    window.addEventListener("keydown", (e) => {
      if (map[e.code]) {
        this.input[map[e.code]] = true;
        e.preventDefault();
      }
      if (e.code === "KeyR" && (this.phase === PHASE.DEAD || this.phase === PHASE.WIN)) {
        this.start(this.buildId);
      }
      if (e.code === "KeyM" && this.phase === PHASE.MENU) {
        const on = audio.toggle();
        UI.setMuteHint(on);
      }
    });
    window.addEventListener("keyup", (e) => {
      if (map[e.code]) {
        this.input[map[e.code]] = false;
        e.preventDefault();
      }
    });
  }

  backToMenu() {
    this.phase = PHASE.MENU;
    UI.hideCards();
    UI.showMenu();
  }

  start(buildId = "tank") {
    audio.resume();
    audio.play("ui");

    this.buildId = buildId;
    this.phase = PHASE.PLAY;
    this.time = 0;
    this.spawnTimer = 0.5;
    this.ambushTimer = AMBUSH.firstAt;
    this.enemies = [];
    this.gems = [];
    this.particles = [];
    this.floatTexts = [];
    this.rings = [];
    this.eliteZones = createEliteZoneState();
    this.clearedElites = new Set();
    this.elitesKilled = 0;
    this.bossUnlocked = false;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.hitStop = 0;
    this.vignette = 0;
    this.flashWhite = 0;
    this._pulseFx = false;

    this.player = createPlayer(WORLD.width / 2, WORLD.height / 2 + 400);
    applyBuildBase(this.player, buildId);
    this.player.xpToNext = XP.baseToLevel;

    this.cam.x = this.player.x - this.canvas.width / 2;
    this.cam.y = this.player.y - this.canvas.height / 2;
    this.cam.shake = 0;

    UI.hideCards();
    UI.showHud();
    UI.setBuildLabel(buildId);
  }

  // ─── Loop ───

  update(dt) {
    // juice timers sempre correm
    if (this.vignette > 0) this.vignette = Math.max(0, this.vignette - dt * 1.8);
    if (this.flashWhite > 0) this.flashWhite = Math.max(0, this.flashWhite - dt * 3.5);

    if (this.phase !== PHASE.PLAY) return;

    // hit-stop: congela o combate por um instante
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this._updateCamera(dt);
      return;
    }

    this.time += dt;
    const p = this.player;

    // detectar início de pulso (som)
    const hadPulse = !!p.pulseActive;
    updatePlayer(p, this.input, dt);
    if (!hadPulse && p.pulseActive) {
      audio.play("pulse", { throttle: 0.3 });
      this._pulseFx = true;
    }

    this._updateSpawn(dt);
    this._updateEliteZones();
    this._updateAmbush(dt);
    this._updateBoss();

    for (const e of this.enemies) {
      if (!e.alive) continue;
      updateEnemy(e, p, dt);
      this._resolveEnemyCollision(e, p);
    }
    this._softSeparateEnemies();

    // combate por build
    if (p.build === "tank") {
      this._orbitHits();
      this._pulseHits();
    } else if (p.build === "scout") {
      this._meleeUpdate(dt);
    }

    for (const g of this.gems) {
      updateGem(g, p, dt);
      if (g.collected && !g._granted) {
        g._granted = true;
        audio.play("gem", { throttle: 0.03 });
        this._grantXp(g.value);
      }
    }
    this.gems = this.gems.filter((g) => !g.collected);

    for (const pt of this.particles) updateParticle(pt, dt);
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const t of this.floatTexts) updateFloatText(t, dt);
    this.floatTexts = this.floatTexts.filter((t) => t.life > 0);
    for (const r of this.rings) updateBurstRing(r, dt);
    this.rings = this.rings.filter((r) => r.life > 0);

    this.enemies = this.enemies.filter((e) => e.alive || e._keepBrief);

    this._updateCamera(dt);

    if (p.hp <= 0) {
      this.phase = PHASE.DEAD;
      audio.play("gameover");
      UI.showGameOver(this.time, p.kills);
    }
  }

  _updateCamera(dt) {
    const p = this.player;
    const tx = p.x - this.canvas.width / 2;
    const ty = p.y - this.canvas.height / 2;
    this.cam.x = lerp(this.cam.x, tx, CAMERA.lerp);
    this.cam.y = lerp(this.cam.y, ty, CAMERA.lerp);
    this.cam.x = clamp(this.cam.x, 0, Math.max(0, WORLD.width - this.canvas.width));
    this.cam.y = clamp(this.cam.y, 0, Math.max(0, WORLD.height - this.canvas.height));
    if (this.cam.shake > 0) {
      this.cam.shake = Math.max(0, this.cam.shake - CAMERA.shakeDecay * dt);
    }
  }

  _addShake(amount) {
    this.cam.shake = Math.max(this.cam.shake, amount);
  }

  _addHitStop(t = JUICE.hitStopMax) {
    this.hitStop = Math.max(this.hitStop, t);
  }

  // ─── Spawn ───

  _updateSpawn(dt) {
    if (this.enemies.filter((e) => e.alive).length >= SPAWN.maxAlive) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    const t = clamp(this.time / SPAWN.rampTime, 0, 1);
    const interval = lerp(SPAWN.baseInterval, SPAWN.minInterval, t);
    this.spawnTimer = interval;

    const type = this._pickEnemyType();
    const pos = this._spawnAtEdge();
    this.enemies.push(createEnemy(type, pos.x, pos.y));
  }

  _pickEnemyType() {
    const t = this.time;
    if (t < 20) return "slime";
    if (t < 45) return Math.random() < 0.7 ? "slime" : "skeleton";
    if (t < 80) {
      const r = Math.random();
      if (r < 0.5) return "slime";
      if (r < 0.85) return "skeleton";
      return "golem";
    }
    const r = Math.random();
    if (r < 0.35) return "slime";
    if (r < 0.7) return "skeleton";
    return "golem";
  }

  _spawnAtEdge() {
    const m = SPAWN.edgeMargin;
    const p = this.player;
    const side = randInt(0, 3);
    const vw = this.canvas.width;
    const vh = this.canvas.height;
    let x, y;
    if (side === 0) {
      x = this.cam.x + randRange(-m, vw + m);
      y = this.cam.y - m - randRange(0, 40);
    } else if (side === 1) {
      x = this.cam.x + randRange(-m, vw + m);
      y = this.cam.y + vh + m + randRange(0, 40);
    } else if (side === 2) {
      x = this.cam.x - m - randRange(0, 40);
      y = this.cam.y + randRange(-m, vh + m);
    } else {
      x = this.cam.x + vw + m + randRange(0, 40);
      y = this.cam.y + randRange(-m, vh + m);
    }
    x = clamp(x, m, WORLD.width - m);
    y = clamp(y, m, WORLD.height - m);
    if (dist(x, y, p.x, p.y) < 200) {
      const n = normalize(x - p.x, y - p.y);
      x = p.x + n.x * 260;
      y = p.y + n.y * 260;
      x = clamp(x, m, WORLD.width - m);
      y = clamp(y, m, WORLD.height - m);
    }
    return { x, y };
  }

  // ─── Elites ───

  _updateEliteZones() {
    const p = this.player;
    for (const z of this.eliteZones) {
      if (z.cleared || z.spawned) continue;
      if (dist(p.x, p.y, z.x, z.y) < z.r + 40) {
        z.spawned = true;
        this.enemies.push(createEnemy("elite", z.x, z.y, { eliteZoneId: z.id }));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          this.enemies.push(
            createEnemy(
              i % 2 === 0 ? "skeleton" : "slime",
              z.x + Math.cos(a) * 70,
              z.y + Math.sin(a) * 70,
              { eliteZoneId: z.id, xpMul: 1.3 }
            )
          );
        }
        UI.showBanner("ZONA DE ELITE!", 1400);
        audio.play("ambush", { throttle: 1 });
        this._addShake(0.35);
      }
    }
  }

  // ─── Emboscada ───

  _updateAmbush(dt) {
    this.ambushTimer -= dt;
    if (this.ambushTimer > 0) return;
    this.ambushTimer = randRange(AMBUSH.intervalMin, AMBUSH.intervalMax);

    const p = this.player;
    UI.showBanner("EMBOSCADA!");
    audio.play("ambush");
    this._addShake(0.55);
    this.vignette = 0.35;

    for (let i = 0; i < AMBUSH.count; i++) {
      const a = (i / AMBUSH.count) * Math.PI * 2 + randRange(-0.2, 0.2);
      const r = AMBUSH.radius + randRange(-20, 30);
      const type = this.time > 50
        ? pick(["slime", "slime", "skeleton", "golem"])
        : pick(["slime", "slime", "skeleton"]);
      this.enemies.push(
        createEnemy(type, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r)
      );
    }
  }

  // ─── Boss ───

  _updateBoss() {
    if (!this.bossUnlocked) {
      if (this.elitesKilled >= BOSS.unlockElites || this.time >= BOSS.unlockTime) {
        this.bossUnlocked = true;
        UI.showBanner("CHEFÃO DESBLOQUEADO!", 2000);
        audio.play("boss_unlock");
      }
    }
    if (this.bossUnlocked && !this.bossSpawned) {
      const p = this.player;
      const near = dist(p.x, p.y, BOSS.x, BOSS.y) < BOSS.zoneR + 120;
      if (near || (this.time > BOSS.unlockTime + 15 && this.elitesKilled >= BOSS.unlockElites)) {
        this.bossSpawned = true;
        this.enemies.push(createEnemy("boss", BOSS.x, BOSS.y));
        UI.showBanner("O CHEFÃO DESPERTOU!", 2200);
        audio.play("boss");
        this._addShake(0.85);
        this.flashWhite = 0.2;
      }
    }
  }

  _softSeparateEnemies() {
    const list = this.enemies;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 < 0.01) continue;
        const d = Math.sqrt(d2);
        const push = (minD - d) * 0.35;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // ─── Colisão player ↔ inimigo ───

  _resolveEnemyCollision(e, p) {
    const d = dist(e.x, e.y, p.x, p.y);
    const minD = e.radius + p.radius;
    if (d >= minD || d < 0.001) return;

    const n = normalize(p.x - e.x, p.y - e.y);
    const overlap = minD - d;
    const pushP = 0.75;
    const pushE = 0.35 / (e.mass || 1);
    p.x += n.x * overlap * pushP;
    p.y += n.y * overlap * pushP;
    e.x -= n.x * overlap * pushE;
    e.y -= n.y * overlap * pushE;

    if (hurtPlayer(p, e.damage, e.x, e.y)) {
      this._addShake(0.4);
      this.vignette = JUICE.hurtVignette;
      audio.play("hurt");
      this.floatTexts.push(createFloatText(p.x, p.y - 20, `-${e.damage}`, "#ff6a6a"));
      this.particles.push(...createSparks(p.x, p.y, Math.atan2(n.y, n.x), "#ff8888", 8));
    }
  }

  // ─── Combate Tanque ───

  _orbitHits() {
    const p = this.player;
    if (p.orbitCount <= 0) return;
    const orbs = getOrbitPositions(p);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (p.orbitHitCd.has(e.id)) continue;
      for (const o of orbs) {
        if (dist2(o.x, o.y, e.x, e.y) < (o.r + e.radius) ** 2) {
          p.orbitHitCd.set(e.id, 0.28);
          this._hitEnemy(e, p.orbitDamage, { kind: "orbit" });
          break;
        }
      }
    }
  }

  _pulseHits() {
    const p = this.player;
    const pulse = p.pulseActive;
    if (!pulse) return;
    const band = PULSE.width + 6;
    for (const e of this.enemies) {
      if (!e.alive || pulse.hit.has(e.id)) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (Math.abs(d - pulse.r) < band + e.radius * 0.5 && pulse.r > 12) {
        pulse.hit.add(e.id);
        this._hitEnemy(e, p.pulseDamage, { kind: "pulse" });
      }
    }
  }

  // ─── Combate Batedor ───

  _meleeUpdate(dt) {
    const p = this.player;
    p.meleeTimer -= dt;

    // mirar no inimigo mais próximo se parado
    if (Math.hypot(p.vx, p.vy) < 10) {
      let best = null;
      let bestD = p.meleeRange * 1.8;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = dist(p.x, p.y, e.x, e.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best) p.facing = Math.atan2(best.y - p.y, best.x - p.x);
    }

    if (p.meleeTimer <= 0) {
      p.meleeTimer = p.meleeInterval;
      this._meleeSwing();
    }

    // hits durante o swing
    if (p.meleeSwing) {
      const sw = p.meleeSwing;
      const half = (p.meleeArc || MELEE.arc) * 0.5;
      let anyHit = false;
      for (const e of this.enemies) {
        if (!e.alive || sw.hit.has(e.id)) continue;
        const d = dist(p.x, p.y, e.x, e.y);
        if (d > p.meleeRange + e.radius) continue;
        const ang = Math.atan2(e.y - p.y, e.x - p.x);
        let diff = ang - sw.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= half) {
          sw.hit.add(e.id);
          const comboExtra = Math.min(p.combo * (p.comboBonus || 0), p.comboCap || 0);
          const dmg = p.meleeDamage + comboExtra;
          this._hitEnemy(e, dmg, {
            kind: "melee",
            knockback: p.meleeKnockback,
            angle: ang,
          });
          anyHit = true;
        }
      }
      if (anyHit && !sw._sfx) {
        sw._sfx = true;
        audio.play("melee_hit");
      }
    }
  }

  _meleeSwing() {
    const p = this.player;
    p.meleeSwing = {
      t: 0,
      duration: MELEE.swingDuration,
      angle: p.facing || 0,
      hit: new Set(),
    };
    audio.play("melee", { throttle: 0.08 });
  }

  // ─── Hit genérico ───

  _hitEnemy(e, dmg, opts = {}) {
    const dead = damageEnemy(e, dmg);
    const dmgShow = Math.round(dmg * 10) / 10;
    this.floatTexts.push(
      createFloatText(e.x, e.y - e.radius, `-${dmgShow}`, "#ffffff")
    );

    const ang = opts.angle ?? Math.atan2(e.y - this.player.y, e.x - this.player.x);
    this.particles.push(...createSparks(e.x, e.y, ang, "#fff8c0", 5));

    if (opts.kind === "melee") {
      const kb = opts.knockback || 80;
      e.x += Math.cos(ang) * (kb * 0.12);
      e.y += Math.sin(ang) * (kb * 0.12);
      this._addShake(0.22);
      this._addHitStop(0.04);
    } else if (opts.kind === "pulse") {
      this._addShake(0.12);
    } else {
      audio.play("hit", { throttle: 0.05 });
    }

    if (dead) {
      this._onEnemyKilled(e);
    } else {
      const p = this.player;
      const n = normalize(e.x - p.x, e.y - p.y);
      e.x += n.x * (opts.kind === "melee" ? 14 : 6);
      e.y += n.y * (opts.kind === "melee" ? 14 : 6);
    }
  }

  _onEnemyKilled(e) {
    const p = this.player;
    p.kills += 1;

    if (p.build === "scout") {
      p.combo = (p.combo || 0) + 1;
    }

    const count = e.isBoss ? 40 : e.isElite ? 28 : e.type === "golem" ? 22 : e.type === "slime" ? 8 : 14;
    this.particles.push(...createParticles(e.x, e.y, e.color, count, e.isBoss ? 200 : 140));
    this.rings.push(createBurstRing(e.x, e.y, e.color, e.radius * 3 + 20));

    this.gems.push(createGem(e.x, e.y, e.xp));

    if (p.lifestealOnKill > 0) {
      healPlayer(p, p.lifestealOnKill);
      this.floatTexts.push(createFloatText(p.x, p.y - 28, `+${p.lifestealOnKill}`, "#4dff8a"));
    }

    if (e.isBoss) {
      audio.play("kill_big");
      this.bossDefeated = true;
      this._addShake(1.2);
      this.flashWhite = 0.35;
      this.phase = PHASE.WIN;
      audio.play("victory");
      UI.showVictory(this.time, p.kills);
    } else if (e.isElite || e.type === "golem") {
      audio.play("kill_big");
      this._addShake(e.isElite ? 0.5 : 0.28);
      this._addHitStop(0.06);
    } else {
      audio.play("kill", { throttle: 0.04 });
    }

    if (e.isElite) {
      this.elitesKilled += 1;
      if (e.eliteZoneId != null) {
        this.eliteZones[e.eliteZoneId].cleared = true;
        this.clearedElites.add(e.eliteZoneId);
      }
      UI.showBanner("ELITE DERROTADO!", 1400);
    }
  }

  _grantXp(amount) {
    const p = this.player;
    p.xp += amount;
    while (p.xp >= p.xpToNext && this.phase === PHASE.PLAY) {
      p.xp -= p.xpToNext;
      p.level += 1;
      p.xpToNext = Math.ceil(XP.baseToLevel * Math.pow(XP.growth, p.level - 1));
      this._openLevelUp();
    }
  }

  _openLevelUp() {
    this.phase = PHASE.LEVELUP;
    audio.play("levelup");
    this.flashWhite = 0.15;
    const cards = rollCards(this.buildId, 3);
    UI.showCards(cards, (card) => {
      audio.play("card");
      card.apply(this.player);
      this.floatTexts.push(
        createFloatText(this.player.x, this.player.y - 40, card.name, "#3dffa0")
      );
      this.phase = PHASE.PLAY;
      if (this.player.xp >= this.player.xpToNext) {
        this._grantXp(0);
      }
    });
  }

  // ─── Objetivo ───

  _getObjective() {
    if (this.bossDefeated) {
      return { text: "Vitória! Chefão derrotado.", x: BOSS.x, y: BOSS.y };
    }
    if (this.bossUnlocked) {
      return {
        text: this.bossSpawned
          ? "Derrote o CHEFÃO na zona laranja!"
          : "Vá até a zona LARANJA — o Chefão espera.",
        x: BOSS.x,
        y: BOSS.y,
      };
    }
    const next = this.eliteZones.find((z) => !z.cleared);
    if (next) {
      const left = this.eliteZones.filter((z) => !z.cleared).length;
      return {
        text: `Explore · Elite à frente (${this.elitesKilled}/${BOSS.unlockElites} para o chefão) · ${left} zona(s)`,
        x: next.x,
        y: next.y,
      };
    }
    return {
      text: "Aguarde o Chefão ou sobreviva…",
      x: BOSS.x,
      y: BOSS.y,
    };
  }

  get phaseLabel() {
    if (this.phase === PHASE.WIN) return "Vitória";
    if (this.phase === PHASE.DEAD) return "Derrota";
    if (this.bossSpawned && !this.bossDefeated) return "Chefão";
    return "Explorar";
  }

  // ─── Draw ───

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (this.phase === PHASE.MENU) {
      ctx.fillStyle = "#0d1a12";
      ctx.fillRect(0, 0, w, h);
      return;
    }

    let shakeX = 0, shakeY = 0;
    if (this.cam.shake > 0) {
      const mag = this.cam.shake * 16;
      shakeX = (Math.random() - 0.5) * mag;
      shakeY = (Math.random() - 0.5) * mag;
    }

    ctx.save();
    ctx.translate(-this.cam.x + shakeX, -this.cam.y + shakeY);

    drawGround(ctx, this.cam.x - shakeX, this.cam.y - shakeY, w, h);
    drawEliteZones(ctx, this.eliteZones, this.clearedElites);
    drawBossZone(ctx, this.bossUnlocked, this.bossDefeated);

    for (const g of this.gems) drawGem(ctx, g);
    for (const e of this.enemies) drawEnemy(ctx, e);
    drawPlayer(ctx, this.player);

    const obj = this._getObjective();
    if (this.phase === PHASE.PLAY || this.phase === PHASE.LEVELUP) {
      drawObjectiveArrow(ctx, this.player.x, this.player.y, obj.x, obj.y);
    }

    for (const r of this.rings) drawBurstRing(ctx, r);
    for (const pt of this.particles) drawParticle(ctx, pt);
    for (const t of this.floatTexts) drawFloatText(ctx, t);

    ctx.restore();

    // overlays de juice (espaço de tela)
    if (this.vignette > 0.01) {
      const g = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.25,
        w / 2, h / 2, Math.max(w, h) * 0.7
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(180, 20, 20, ${this.vignette * 0.65})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.flashWhite > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashWhite * 0.45})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.phase !== PHASE.MENU) {
      UI.updateHud({
        player: this.player,
        time: this.time,
        phaseLabel: this.phaseLabel,
        objectiveText: obj.text,
      });
      UI.drawMinimap(document.getElementById("minimap"), {
        player: this.player,
        enemies: this.enemies,
        eliteZones: this.eliteZones,
        clearedElites: this.clearedElites,
        bossUnlocked: this.bossUnlocked,
        bossDefeated: this.bossDefeated,
        objective: obj,
      });
    }
  }
}
