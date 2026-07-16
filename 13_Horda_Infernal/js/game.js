/** Horda Infernal — loop principal de combate (orquestrador) */

import { W, H, SHARED, COLORS, STORAGE_KEY } from "./config.js";
import { ParticleSystem, CameraShake } from "./particles.js";
import {
  starterWeapon, starterArmor, rollDropForKill, createLootDrop,
  rarityColor, generateItem,
} from "./loot.js";
import { STAGES, ENEMY_DEFS, scaleEnemyStats } from "./stages.js";
import {
  createEmptyMods, recomputeMods, rollPowerChoices, applyPower, listOwnedPowers,
} from "./powers.js";
import { getClass } from "./classes/registry.js";
import { updateClassAttack, updatePlayerProjectiles } from "./combat/styles.js";
import { drawPlayer, drawPlayerBody } from "./combat/playerDraw.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len = (x, y) => Math.hypot(x, y);
const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
const ang = (x, y) => Math.atan2(y, x);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class Game {
  constructor(canvas, audio, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio = audio;
    this.ui = ui;

    this.particles = new ParticleSystem();
    this.shake = new CameraShake();

    this.state = "title"; // title | playing | loot | levelup | pause | victory | defeat
    this.keys = Object.create(null);
    this.mouse = { x: W / 2, y: H / 2, down: false, used: false };
    this.touchMove = { x: 0, y: 0 };
    /** Stick direito: mira independente do movimento (celular) */
    this.touchAim = { x: 0, y: 0, active: false };
    this.touchAttack = false;
    this.touchDash = false;
    /** true quando controles touch estão ativos */
    this.mobileTouch = false;

    this.time = 0;
    this.arena = { x: 48, y: 48, w: W - 96, h: H - 96 };

    // juice global
    this.hitstop = 0;
    this.screenFlash = 0;
    this.slowMo = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.spawnMarks = [];
    this.selectedClassId = "barbarian";
    this.classDef = getClass("barbarian");

    this._bindInput();
    this._loadBest();
  }

  /** Stats da classe ativa (atalho) */
  cs() {
    return this.classDef?.stats || getClass("barbarian").stats;
  }

  /** Recurso especial da classe (fúria / foco / mana) */
  res() {
    return this.classDef?.resource || getClass("barbarian").resource;
  }

  setClass(classId) {
    const c = getClass(classId);
    if (!c.unlocked) return false;
    this.selectedClassId = c.id;
    this.classDef = c;
    return true;
  }

  _loadBest() {
    try {
      this.bestKills = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
    } catch {
      this.bestKills = 0;
    }
  }

  _saveBest() {
    if (this.kills > this.bestKills) {
      this.bestKills = this.kills;
      try { localStorage.setItem(STORAGE_KEY, String(this.bestKills)); } catch { /* ignore */ }
    }
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "Escape" && this.state === "playing") {
        this.state = "pause";
        this.ui.showPause(true);
      } else if (e.code === "Escape" && this.state === "pause") {
        this.resume();
      }
      if (e.code === "Space") e.preventDefault();
      if (e.code === "KeyE" && this.state === "playing") this._tryPickupNearest(true);
    });
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });

    this.canvas.addEventListener("mousemove", (e) => {
      // em touch não usa mouse como mira
      if (this.mobileTouch) return;
      const r = this.canvas.getBoundingClientRect();
      const sx = this.canvas.width / r.width;
      const sy = this.canvas.height / r.height;
      this.mouse.x = (e.clientX - r.left) * sx;
      this.mouse.y = (e.clientY - r.top) * sy;
      this.mouse.used = true;
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (this.mobileTouch) return;
      if (e.button === 0) this.mouse.down = true;
    });
    window.addEventListener("mouseup", () => { this.mouse.down = false; });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /**
   * Inimigo vivo mais próximo (auto-mira no celular).
   * @param {number} [maxDist]
   */
  nearestEnemy(maxDist = 9999) {
    if (!this.player || !this.enemies?.length) return null;
    let best = null;
    let bestD = maxDist;
    for (const e of this.enemies) {
      if (e.dead || (e.spawnGrace || 0) > 0) continue;
      const d = dist(this.player, e);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * Atualiza facing: mira touch > mouse desktop > auto-mira se atacando > movimento.
   */
  updateFacing(ix, iy, attacking) {
    const p = this.player;
    if (!p) return;

    // 1) Stick de mira (celular) — prioridade máxima
    if (this.touchAim.active) {
      const m = Math.hypot(this.touchAim.x, this.touchAim.y);
      if (m > 0.2) {
        p.facing = ang(this.touchAim.x, this.touchAim.y);
        return;
      }
    }

    // 2) Mouse (desktop)
    if (!this.mobileTouch && this.mouse.used) {
      const toMouse = { x: this.mouse.x - p.x, y: this.mouse.y - p.y };
      if (Math.hypot(toMouse.x, toMouse.y) > 8) {
        p.facing = ang(toMouse.x, toMouse.y);
        return;
      }
    }

    // 3) Ao atacar no celular sem mira: auto-aim no mais próximo
    if (attacking && this.mobileTouch) {
      const e = this.nearestEnemy(420);
      if (e) {
        p.facing = ang(e.x - p.x, e.y - p.y);
        return;
      }
    }

    // 4) Direção do movimento
    if (ix || iy) {
      p.facing = ang(ix, iy);
    }
  }

  startRun(classId = null) {
    if (classId) this.setClass(classId);
    this.classDef = getClass(this.selectedClassId);

    this.audio.unlock();
    this.audio.startAmbience();
    this.audio.uiClick();

    this.state = "playing";
    this.time = 0;
    this.stageIndex = 0;
    this.kills = 0;
    this.damageDealt = 0;
    this.pendingLoot = null;
    this.pendingPowerChoices = null;
    this.levelUpQueue = 0;
    this.runStartedAt = performance.now();
    this.healDone = 0;

    this.particles.clear();
    this.enemies = [];
    this.projectiles = [];
    this.loot = [];
    this.spawnQueue = [];
    this.effects = []; // slash arcs etc
    this.spawnMarks = [];
    this.pickupCd = 0;
    this.hitstop = 0;
    this.screenFlash = 0;
    this.slowMo = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;

    this.player = this._createPlayer();
    this._startStage(0);
    this.ui.hideAllScreens();
    this.ui.showHud(true);
    this.ui.updateHud(this);
  }

  _createPlayer() {
    const cls = this.classDef;
    const s = cls.stats;
    const weapon = starterWeapon(cls);
    const armor = starterArmor(cls);
    const player = {
      x: W / 2,
      y: H / 2,
      radius: s.radius,
      facing: -Math.PI / 2,
      vx: 0,
      vy: 0,
      weapon,
      armor,
      classId: cls.id,
      level: 1,
      xp: 0,
      xpToLevel: SHARED.xpBase,
      maxHp: s.maxHp + (armor.hpBonus || 0),
      hp: 0,
      invuln: 0,
      atkCd: 0,
      atkPhase: "idle",
      atkTimer: 0,
      hitSet: new Set(),
      dashCd: 0,
      dashing: 0,
      dashDir: { x: 0, y: -1 },
      trail: [],
      flash: 0,
      dead: false,
      // recurso genérico (fúria/foco/mana) — UI lê como fury*
      fury: 0,
      furyActive: 0,
      swingCount: 0,
      lastHitCount: 0,
      powerStacks: Object.create(null),
      mods: createEmptyMods(),
    };
    player.hp = player.maxHp;
    recomputeMods(player);
    player.maxHp = this._calcMaxHp(player);
    player.hp = player.maxHp;
    return player;
  }

  _calcMaxHp(p = this.player) {
    const base = this.classDef?.stats?.maxHp || 130;
    return base
      + (p.armor?.hpBonus || 0)
      + (p.level - 1) * 12
      + (p.mods?.hpFlat || 0);
  }

  /** Recurso especial ativo (Fúria / Foco / etc.) */
  isResourceActive() {
    return this.player && this.player.furyActive > 0;
  }

  /** alias legado usado em vários pontos */
  isFury() {
    return this.isResourceActive();
  }

  getPlayerDamage() {
    const s = this.cs();
    const res = this.res();
    const base = s.damage + (this.player.weapon?.damage || 0);
    return Math.round(base * (this.isResourceActive() ? res.dmgMult : 1));
  }

  getPlayerDefense() {
    return this.cs().defense
      + (this.player.armor?.defense || 0)
      + (this.player.mods?.defenseFlat || 0);
  }

  getPlayerMaxHp() {
    return this._calcMaxHp(this.player);
  }

  getAttackRange() {
    const s = this.cs();
    const boost = this.isResourceActive() && this.classDef.style === "melee" ? 1.12 : 1;
    return s.attackRange * (this.player.mods?.rangeMult || 1) * boost;
  }

  getAttackArc() {
    const s = this.cs();
    const boost = this.isResourceActive() && this.classDef.style === "melee" ? 1.08 : 1;
    return (s.attackArc || 0) * (this.player.mods?.arcMult || 1) * boost;
  }

  getRunRecap() {
    const p = this.player;
    const secs = Math.max(1, Math.round((performance.now() - (this.runStartedAt || performance.now())) / 1000));
    const powers = listOwnedPowers(p);
    return {
      kills: this.kills,
      level: p?.level || 1,
      stage: `${(this.stageIndex || 0) + 1}/${STAGES.length}`,
      damage: this.damageDealt,
      maxCombo: this.maxCombo,
      heal: Math.round(this.healDone || 0),
      time: secs,
      className: this.classDef?.name || "—",
      weapon: p?.weapon?.name || "—",
      weaponRarity: p?.weapon?.rarity || "common",
      armor: p?.armor?.name || "—",
      armorRarity: p?.armor?.rarity || "common",
      powers: powers.map((pw) => `${pw.icon} ${pw.name} ×${pw.stacks}`).join(" · ") || "Nenhum",
    };
  }

  _addHitstop(t) {
    this.hitstop = Math.max(this.hitstop, t);
  }

  _addFlash(a = 0.35) {
    this.screenFlash = Math.max(this.screenFlash, a);
  }

  _addFury(amount) {
    // nome legado — enche o recurso da classe
    const p = this.player;
    const res = this.res();
    if (!p || p.furyActive > 0) return;
    const gain = amount * (p.mods?.furyGainMult || 1);
    p.fury = clamp(p.fury + gain, 0, res.max);
    if (p.fury >= res.max) this._activateFury();
  }

  _activateFury() {
    const p = this.player;
    const res = this.res();
    p.fury = res.max;
    p.furyActive = res.duration * (p.mods?.furyDurationMult || 1);
    this.audio.furyActivate();
    this.particles.furyBurst(p.x, p.y);
    this.shake.add(7, 0.25);
    this.shake.punch(0.06);
    this._addFlash(0.45);
    const label = res.label || "PODER";
    this.ui.toast(`${label}!`);
    this.ui.showBanner(label);
  }

  _startStage(idx) {
    this.stageIndex = idx;
    this.stage = STAGES[idx];
    this.waveIndex = -1;
    this.waveTimer = 0.4;
    this.stageClear = false;
    this.portalOpen = false;
    this.portalPulse = 0;
    this.bossSpawned = false;
    this.bossRef = null;
    this.supportTimer = 0;
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.spawnQueue.length = 0;
    // keep loot from previous? clear soft
    this.loot = this.loot.filter(() => false);

    this.player.x = W / 2;
    this.player.y = H / 2;
    this.player.invuln = 1.0;
    this.player.flash = 0.5;

    this.ui.showBanner(this.stage.name.toUpperCase());
    this.audio.waveStart();
    this.ui.updateHud(this);
  }

  resume() {
    if (this.state !== "pause") return;
    this.state = "playing";
    this.ui.showPause(false);
    this.audio.uiClick();
  }

  // ─── Main loop ───
  update(dt) {
    // slow-mo (boss death etc.)
    let simDt = dt;
    if (this.slowMo > 0) {
      this.slowMo -= dt;
      simDt = dt * 0.35;
    }

    // hitstop: congela gameplay, anima só flash/shake
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.screenFlash = Math.max(0, this.screenFlash - dt * 2.5);
      this.shake.update(dt);
      // partículas em câmera lenta no hitstop
      this.particles.update(dt * 0.15);
      this.ui.updateHud(this);
      return;
    }

    this.time += simDt;
    this.shake.update(dt);
    this.particles.update(simDt);
    this.screenFlash = Math.max(0, this.screenFlash - dt * 2.2);
    this.comboTimer = Math.max(0, this.comboTimer - simDt);
    if (this.comboTimer <= 0 && this.combo > 0) this.combo = 0;

    if (this.state === "playing") {
      this._updatePlaying(simDt);
    } else if (this.state === "loot" || this.state === "levelup") {
      // combate congelado; partículas seguem
    }

    this.ui.updateHud(this);
  }

  _updatePlaying(dt) {
    const p = this.player;
    if (p.dead) return;

    p.invuln = Math.max(0, p.invuln - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    this.pickupCd = Math.max(0, this.pickupCd - dt);

    // fúria
    const res = this.res();
    if (p.furyActive > 0) {
      p.furyActive -= dt;
      const maxDur = res.duration * (p.mods?.furyDurationMult || 1);
      p.fury = (p.furyActive / maxDur) * res.max;
      if (p.furyActive <= 0) {
        p.furyActive = 0;
        p.fury = 0;
        this.ui.toast(`${res.label} esgotado`);
      }
      if (Math.random() < 0.35) {
        this.particles.embers(p.x + (Math.random() - 0.5) * 20, p.y + (Math.random() - 0.5) * 20, 1);
      }
    } else if (p.fury > 0) {
      p.fury = Math.max(0, p.fury - res.decay * dt);
    }

    this._updatePlayerMove(dt);
    this._updatePlayerAttack(dt);
    this._updateSpawns(dt);
    this._updateEnemies(dt);
    this._updateProjectiles(dt);
    this._updateLoot(dt);
    this._updateEffects(dt);
    this._updateStageFlow(dt);
    this._updateSpawnMarks(dt);

    // auto pickup ao pisar; E força raio maior
    if (this.pickupCd <= 0) this._tryPickupNearest(false);
  }

  _updatePlayerMove(dt) {
    const p = this.player;
    let ix = 0;
    let iy = 0;

    if (this.keys["KeyW"] || this.keys["ArrowUp"]) iy -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) iy += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) ix -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) ix += 1;

    ix += this.touchMove.x;
    iy += this.touchMove.y;

    const attacking =
      this.mouse.down || this.keys["KeyJ"] || this.touchAttack || this.touchAim.active;
    this.updateFacing(ix, iy, attacking);

    // Dash
    const wantDash = this.keys["Space"] || this.keys["ShiftLeft"] || this.touchDash;
    if (wantDash && p.dashCd <= 0 && p.dashing <= 0) {
      let dx = ix;
      let dy = iy;
      if (!dx && !dy) {
        dx = Math.cos(p.facing);
        dy = Math.sin(p.facing);
      }
      const d = norm(dx, dy);
      p.dashDir = d;
      const s = this.cs();
      p.dashing = s.dashDuration;
      p.dashCd = s.dashCooldown * (p.mods?.dashCdMult || 1);
      p.invuln = Math.max(p.invuln, s.dashDuration + 0.05);
      this.audio.dash();
      this.particles.burst(p.x, p.y, {
        count: 10, color: "#ffb347", speed: 180, life: 0.25, size: 3,
        angle: ang(-d.x, -d.y), spread: 0.8,
      });
      this.touchDash = false;
    }

    if (p.dashing > 0) {
      p.dashing -= dt;
      p.x += p.dashDir.x * this.cs().dashSpeed * dt;
      p.y += p.dashDir.y * this.cs().dashSpeed * dt;
      p.trail.push({ x: p.x, y: p.y, life: 0.22 });
      if (Math.random() < 0.5) {
        this.particles.burst(p.x, p.y, {
          count: 1, color: this.isFury() ? "#ff5a1f" : "#ffb347",
          speed: 40, life: 0.2, size: 2.5,
        });
      }
    } else {
      const n = norm(ix, iy);
      let speed = this.cs().moveSpeed * (ix || iy ? 1 : 0);
      if (this.isResourceActive()) speed *= this.res().moveMult;
      // slight slow while attacking; lunge overrides below
      const atkSlow = p.atkPhase === "active" || p.atkPhase === "windup" ? 0.5 : 1;
      p.x += n.x * speed * atkSlow * dt;
      p.y += n.y * speed * atkSlow * dt;
    }

    // clamp arena
    const a = this.arena;
    p.x = clamp(p.x, a.x + p.radius, a.x + a.w - p.radius);
    p.y = clamp(p.y, a.y + p.radius, a.y + a.h - p.radius);

    // trail decay
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].life -= dt;
      if (p.trail[i].life <= 0) p.trail.splice(i, 1);
    }

    // portal enter
    if (this.portalOpen) {
      const pc = { x: W / 2, y: this.arena.y + 36 };
      if (dist(p, pc) < 36) {
        this._enterPortal();
      }
    }
  }

  _updatePlayerAttack(dt) {
    updateClassAttack(this, dt);
  }

  _damageEnemy(e, rawDmg, knockDir) {
    const p = this.player;
    const s = this.cs();
    const res = this.res();
    const critChance = s.critChance + (p.mods?.critChance || 0) + (this.isResourceActive() ? 0.08 : 0);
    const critMult = s.critMult + (p.mods?.critMult || 0);
    const isCrit = Math.random() < critChance;
    const dmg = Math.round(
      rawDmg * (isCrit ? critMult : 1) * (0.94 + Math.random() * 0.12),
    );
    e.hp -= dmg;
    e.flash = 0.14;
    e.hitStun = isCrit ? 0.12 : 0.09;
    this.damageDealt += dmg;

    // lifesteal
    const ls = p.mods?.lifesteal || 0;
    if (ls > 0 && p.hp > 0) {
      const heal = dmg * ls;
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.healDone += Math.max(0, p.hp - before);
    }

    const knock = (e.kind === "boss" ? 5 : 14) * (isCrit ? 1.3 : 1) * (this.isFury() ? 1.2 : 1);
    e.x += Math.cos(knockDir) * knock;
    e.y += Math.sin(knockDir) * knock;

    this.particles.blood(e.x, e.y, knockDir);
    this.particles.sparks(e.x, e.y);
    this.particles.floatText(
      e.x, e.y - e.radius,
      isCrit ? `${dmg}!` : `${dmg}`,
      isCrit ? "#ffb347" : this.isFury() ? "#ff8a5a" : "#fff5ec",
      isCrit ? 1.4 : 1,
    );

    this._addFury(res.perHit + (isCrit ? res.perCrit : 0));

    if (e.kind === "boss") {
      this.audio.bossHit();
      this.shake.add(5.5, 0.12);
      this._addHitstop(SHARED.hitstopBoss);
    } else if (isCrit) {
      this.audio.crit();
      this.shake.add(4, 0.1);
      this.shake.punch(0.035);
      this._addHitstop(SHARED.hitstopCrit);
      this._addFlash(0.2);
    } else {
      if (this.isFury()) this.audio.furyHit();
      else this.audio.hit();
      this.shake.add(2.2, 0.08);
      this._addHitstop(SHARED.hitstopHit);
    }

    if (e.hp <= 0) this._killEnemy(e);
  }

  _killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;

    // combo
    if (this.comboTimer > 0) this.combo++;
    else this.combo = 1;
    this.comboTimer = SHARED.comboWindow;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    this.audio.kill();
    if (this.combo >= 2) this.audio.multiKill(this.combo);

    this.particles.death(e.x, e.y, e.accent || e.color);
    this.shake.add(e.kind === "boss" ? 12 : e.kind === "elite" ? 6 : 3.2, 0.2);
    this.shake.punch(e.kind === "boss" ? 0.08 : 0.03);
    this._addHitstop(e.kind === "boss" ? 0.12 : SHARED.hitstopKill);
    this._addFlash(e.kind === "boss" ? 0.55 : 0.15);

    this._addFury(this.res().perKill);
    this._grantXp(e.xp);

    if (this.combo === 3) this.ui.toast("TRIPLO!");
    else if (this.combo === 5) this.ui.toast("MASSACRE");
    else if (this.combo === 8) this.ui.toast("LENDA DA HORDA");
    else if (this.combo > 8 && this.combo % 3 === 0) this.ui.toast(`COMBO ×${this.combo}`);

    const drop = rollDropForKill(e, this.stageIndex);
    if (drop) {
      this.loot.push(createLootDrop(e.x, e.y, drop));
    }

    if (e.kind === "boss") {
      this.bossRef = null;
      this.audio.setBossAmbience(false);
      this.slowMo = 1.1;
      this.loot.push(createLootDrop(e.x + 20, e.y, generateItem("weapon", this.stageIndex, 1, "legendary")));
      this.loot.push(createLootDrop(e.x - 20, e.y, generateItem("armor", this.stageIndex, 1, "epic")));
      this.ui.toast("SENHOR DA HORDA DERROTADO");
      this.ui.showBanner("CAIU");
    }
  }

  _grantXp(amount) {
    const p = this.player;
    p.xp += amount;
    let leveled = 0;
    while (p.xp >= p.xpToLevel) {
      p.xp -= p.xpToLevel;
      p.level++;
      leveled++;
      p.xpToLevel = Math.round(SHARED.xpBase * Math.pow(SHARED.xpGrowth, p.level - 1));
      const newMax = this.getPlayerMaxHp();
      const heal = newMax - p.maxHp + 20;
      p.maxHp = newMax;
      p.hp = Math.min(newMax, p.hp + Math.max(20, heal));
      this.audio.levelUp();
      this.particles.levelUp(p.x, p.y);
      this.ui.toast(`NÍVEL ${p.level}`);
      this.shake.add(5, 0.22);
      this.shake.punch(0.05);
      this._addFlash(0.25);
      this._addFury(25);
    }
    if (leveled > 0) {
      this.levelUpQueue += leveled;
      this._openPowerSelectIfNeeded();
    }
  }

  _openPowerSelectIfNeeded() {
    if (this.levelUpQueue <= 0) return;
    if (this.state === "loot" || this.state === "levelup") return;
    if (this.state !== "playing") return;

    const choices = rollPowerChoices(
      this.player,
      3,
      this.player?.classId || this.selectedClassId || this.classDef?.id,
    );
    if (choices.length === 0) {
      this.levelUpQueue = 0;
      return;
    }
    this.pendingPowerChoices = choices;
    this.state = "levelup";
    this.ui.showPowerSelect(choices, this.player.level);
  }

  pickPower(powerId) {
    if (this.state !== "levelup" || !this.pendingPowerChoices) return;
    const ok = applyPower(this.player, powerId);
    if (!ok) return;

    // reaplicar HP se pegou vitalidade
    const newMax = this.getPlayerMaxHp();
    if (newMax > this.player.maxHp) {
      const gain = newMax - this.player.maxHp;
      this.player.maxHp = newMax;
      this.player.hp = Math.min(newMax, this.player.hp + gain);
    }

    this.audio.equip();
    this.particles.levelUp(this.player.x, this.player.y);
    this.ui.hidePowerSelect();
    this.pendingPowerChoices = null;
    this.levelUpQueue = Math.max(0, this.levelUpQueue - 1);
    this.state = "playing";
    this.ui.toast(this.player.powerStacks[powerId] > 1 ? "PODER REFORÇADO" : "PODER ADQUIRIDO");
    this.ui.updateHud(this);

    // se subiu vários níveis de uma vez
    if (this.levelUpQueue > 0) {
      this._openPowerSelectIfNeeded();
    }
  }

  // ─── Spawns ───
  _updateSpawns(dt) {
    // process queue
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      s.t -= dt;
      if (s.t <= 0) {
        this._spawnEnemy(s.type);
        this.spawnQueue.splice(i, 1);
      }
    }

    if (this.stageClear || this.portalOpen) return;

    // advance waves when queue empty and no enemies
    const living = this.enemies.some((e) => !e.dead);
    if (living || this.spawnQueue.length > 0 || this.spawnMarks.length > 0) {
      // boss support adds
      if (this.bossRef && !this.bossRef.dead) {
        this.supportTimer -= dt;
        if (this.supportTimer <= 0) {
          this.supportTimer = 4.5;
          this._spawnEnemy("imp");
          if (Math.random() < 0.5) this._spawnEnemy("imp");
        }
      }
      return;
    }

    // next wave
    this.waveTimer -= dt;
    if (this.waveTimer > 0) return;

    this.waveIndex++;
    const waves = this.stage.waves.filter((w) => !w.supportOnly);
    if (this.waveIndex >= waves.length) {
      this.stageClear = true;
      this.waveTimer = 0.8;
      return;
    }

    const wave = waves[this.waveIndex];
    this.ui.showBanner(
      this.stage.boss && this.waveIndex === waves.length - 1
        ? "BOSS"
        : `ONDA ${this.waveIndex + 1}`,
    );
    this.audio.waveStart();

    let t = 0;
    for (const g of wave.groups) {
      for (let n = 0; n < g.count; n++) {
        this.spawnQueue.push({ type: g.type, t: t });
        t += g.interval || 0.3;
      }
    }
    this.waveTimer = 0.5;
  }

  _spawnEnemy(type) {
    const base = ENEMY_DEFS[type];
    if (!base) return;
    const def = scaleEnemyStats(base, this.stageIndex);

    // boss spawna direto no centro
    if (def.isBoss) {
      this._spawnEnemyAt(type, W / 2, this.arena.y + 100, true);
      return;
    }

    // telegraph no chão, depois nasce
    const edge = this._randomEdgeInside();
    this.spawnMarks.push({
      x: edge.x,
      y: edge.y,
      type,
      life: 0.55,
      maxLife: 0.55,
      radius: def.radius,
      color: def.accent || "#ff3b5c",
    });
  }

  _randomEdgeInside() {
    const a = this.arena;
    const m = 28;
    const side = (Math.random() * 4) | 0;
    if (side === 0) return { x: a.x + m + Math.random() * (a.w - m * 2), y: a.y + m + Math.random() * 40 };
    if (side === 1) return { x: a.x + m + Math.random() * (a.w - m * 2), y: a.y + a.h - m - Math.random() * 40 };
    if (side === 2) return { x: a.x + m + Math.random() * 40, y: a.y + m + Math.random() * (a.h - m * 2) };
    return { x: a.x + a.w - m - Math.random() * 40, y: a.y + m + Math.random() * (a.h - m * 2) };
  }

  _updateSpawnMarks(dt) {
    for (let i = this.spawnMarks.length - 1; i >= 0; i--) {
      const m = this.spawnMarks[i];
      m.life -= dt;
      if (m.life <= 0) {
        this._spawnEnemyAt(m.type, m.x, m.y, false);
        this.spawnMarks.splice(i, 1);
      }
    }
  }

  _spawnEnemyAt(type, x, y, isBossSpawn) {
    const base = ENEMY_DEFS[type];
    if (!base) return;
    const def = scaleEnemyStats(base, this.stageIndex);

    const e = {
      id: Math.random().toString(36).slice(2),
      type,
      kind: def.kind,
      name: def.name,
      x,
      y,
      radius: def.radius,
      maxHp: def.maxHp,
      hp: def.maxHp,
      damage: def.damage,
      moveSpeed: def.moveSpeed,
      xp: def.xp,
      color: def.color,
      accent: def.accent,
      contactInterval: def.contactInterval,
      contactCd: 0.35,
      flash: 0.2,
      hitStun: 0,
      dead: false,
      spawnGrace: 0.35,
      preferRange: def.preferRange || 0,
      shootCooldown: def.shootCooldown || 0,
      shootCd: 0.5 + Math.random(),
      projectileSpeed: def.projectileSpeed || 0,
      projectileDamage: def.projectileDamage || 0,
      bossPhase: 0,
      lastPhase: 0,
      bossAtkCd: 2,
      bossWindup: 0,
      bossTelegraph: null,
      pulse: Math.random() * Math.PI * 2,
    };

    if (def.isBoss || isBossSpawn) {
      e.x = W / 2;
      e.y = this.arena.y + 100;
      e.spawnGrace = 0.8;
      e.contactCd = 1.0;
      this.bossRef = e;
      this.bossSpawned = true;
      this.audio.bossAppear();
      this.audio.setBossAmbience(true);
      this.ui.showBanner("SENHOR DA HORDA");
      this.shake.add(10, 0.45);
      this.shake.punch(0.07);
      this._addFlash(0.4);
      this.particles.ring(e.x, e.y, "#ff3b5c", 140, 0.7);
      this.particles.furyBurst(e.x, e.y);
      this.supportTimer = 5;
    } else {
      this.particles.burst(x, y, {
        count: 8, color: def.accent || "#c41e3a", speed: 90, life: 0.3, size: 2.5,
      });
    }

    this.enemies.push(e);
  }

  _randomEdge() {
    const a = this.arena;
    const side = (Math.random() * 4) | 0;
    const m = 20;
    if (side === 0) return { x: a.x + Math.random() * a.w, y: a.y - m };
    if (side === 1) return { x: a.x + Math.random() * a.w, y: a.y + a.h + m };
    if (side === 2) return { x: a.x - m, y: a.y + Math.random() * a.h };
    return { x: a.x + a.w + m, y: a.y + Math.random() * a.h };
  }

  // ─── Enemies AI ───
  _updateEnemies(dt) {
    const p = this.player;
    const a = this.arena;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        this.enemies.splice(i, 1);
        continue;
      }

      e.flash = Math.max(0, e.flash - dt);
      e.hitStun = Math.max(0, e.hitStun - dt);
      e.contactCd = Math.max(0, e.contactCd - dt);
      e.spawnGrace = Math.max(0, (e.spawnGrace || 0) - dt);
      e.pulse += dt * 3;
      e.shootCd = Math.max(0, e.shootCd - dt);

      if (e.hitStun > 0 || e.spawnGrace > 0.15) continue;

      if (e.kind === "boss") {
        this._updateBoss(e, dt);
      } else if (e.kind === "ranged") {
        this._updateRanged(e, dt);
      } else {
        // chase com leve sidestep pra não empilhar
        const d = norm(p.x - e.x, p.y - e.y);
        const spd = e.moveSpeed * (e.kind === "elite" ? 1.08 : 1);
        const side = Math.sin(e.pulse * 0.7 + e.id.charCodeAt(0)) * 0.25;
        e.x += (d.x + -d.y * side) * spd * dt;
        e.y += (d.y + d.x * side) * spd * dt;
      }

      // soft separation
      for (let j = i + 1; j < this.enemies.length; j++) {
        const o = this.enemies[j];
        if (o.dead) continue;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const d = Math.hypot(dx, dy);
        const min = e.radius + o.radius - 2;
        if (d > 0 && d < min) {
          const push = (min - d) * 0.35;
          const nx = dx / d;
          const ny = dy / d;
          e.x += nx * push;
          e.y += ny * push;
          o.x -= nx * push;
          o.y -= ny * push;
        }
      }

      // keep roughly in playable area (can come from outside)
      e.x = clamp(e.x, a.x - 30, a.x + a.w + 30);
      e.y = clamp(e.y, a.y - 30, a.y + a.h + 30);

      // contact damage (sem graça de spawn)
      if (
        e.spawnGrace <= 0 &&
        e.contactCd <= 0 &&
        dist(e, p) < e.radius + p.radius + 2
      ) {
        this._hurtPlayer(e.damage, ang(p.x - e.x, p.y - e.y));
        e.contactCd = e.contactInterval;
      }
    }
  }

  _updateRanged(e, dt) {
    const p = this.player;
    const d = dist(e, p);
    const dir = norm(p.x - e.x, p.y - e.y);
    const prefer = e.preferRange || 160;

    if (d > prefer + 20) {
      e.x += dir.x * e.moveSpeed * dt;
      e.y += dir.y * e.moveSpeed * dt;
    } else if (d < prefer - 30) {
      e.x -= dir.x * e.moveSpeed * 0.8 * dt;
      e.y -= dir.y * e.moveSpeed * 0.8 * dt;
    } else {
      // strafe
      e.x += -dir.y * e.moveSpeed * 0.5 * dt;
      e.y += dir.x * e.moveSpeed * 0.5 * dt;
    }

    if (e.shootCd <= 0 && d < prefer + 80) {
      e.shootCd = e.shootCooldown;
      this.projectiles.push({
        x: e.x,
        y: e.y,
        vx: dir.x * e.projectileSpeed,
        vy: dir.y * e.projectileSpeed,
        damage: e.projectileDamage,
        radius: 6,
        life: 3,
        color: e.accent,
        fromEnemy: true,
      });
      this.particles.burst(e.x, e.y, { count: 4, color: e.accent, speed: 60, life: 0.2, size: 2 });
    }
  }

  _updateBoss(e, dt) {
    const p = this.player;
    e.bossAtkCd -= dt;

    // phase by hp
    const hpPct = e.hp / e.maxHp;
    e.bossPhase = hpPct < 0.33 ? 2 : hpPct < 0.66 ? 1 : 0;

    // anúncio de fase
    if (e.bossPhase !== e.lastPhase) {
      e.lastPhase = e.bossPhase;
      if (e.bossPhase === 1) {
        this.ui.showBanner("FASE II");
        this.audio.bossPhase();
        this.particles.ring(e.x, e.y, "#ffb347", 100, 0.5);
        this._addFlash(0.3);
      } else if (e.bossPhase === 2) {
        this.ui.showBanner("FÚRIA DO TRONO");
        this.audio.bossPhase();
        this.audio.furyActivate();
        this.particles.furyBurst(e.x, e.y);
        this._addFlash(0.4);
        this.shake.add(8, 0.3);
      }
    }

    if (e.bossWindup > 0) {
      e.bossWindup -= dt;
      // pulso no telegraph
      if (Math.random() < 0.2) {
        this.particles.embers(e.x + (Math.random() - 0.5) * 40, e.y + (Math.random() - 0.5) * 40, 1);
      }
      if (e.bossWindup <= 0 && e.bossTelegraph) {
        this._bossExecute(e, e.bossTelegraph);
        e.bossTelegraph = null;
      }
      return;
    }

    // approach
    const d = norm(p.x - e.x, p.y - e.y);
    e.x += d.x * e.moveSpeed * (1 + e.bossPhase * 0.18) * dt;
    e.y += d.y * e.moveSpeed * (1 + e.bossPhase * 0.18) * dt;

    if (e.bossAtkCd <= 0) {
      const roll = Math.random();
      let atk = "slam";
      if (e.bossPhase >= 1 && roll < 0.42) atk = "ring";
      if (e.bossPhase >= 2 && roll < 0.58) atk = "charge";
      if (e.bossPhase >= 2 && roll > 0.75) atk = "slam";
      e.bossTelegraph = atk;
      e.bossWindup = atk === "charge" ? 0.5 : atk === "ring" ? 0.85 : 0.7;
      e.bossAtkCd = 2.0 - e.bossPhase * 0.35;
      const col = atk === "ring" ? "#b44dff" : atk === "charge" ? "#ffb347" : "#ff3b5c";
      this.particles.ring(e.x, e.y, col, atk === "ring" ? 150 : atk === "slam" ? 95 : 60, e.bossWindup);
      this.audio.bossTelegraph();
    }
  }

  _bossExecute(e, atk) {
    const p = this.player;
    if (atk === "slam") {
      this.shake.add(8, 0.25);
      this.audio.bossHit();
      this.particles.burst(e.x, e.y, { count: 20, color: "#ff3b5c", speed: 260, life: 0.4, size: 4 });
      if (dist(e, p) < 95) {
        this._hurtPlayer(e.damage * 1.3, ang(p.x - e.x, p.y - e.y));
      }
    } else if (atk === "ring") {
      this.shake.add(6, 0.3);
      this.audio.bossHit();
      this.particles.ring(e.x, e.y, "#ff5a1f", 160, 0.4);
      // radial projectiles
      const n = 10 + e.bossPhase * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.projectiles.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * 180,
          vy: Math.sin(a) * 180,
          damage: Math.round(e.damage * 0.55),
          radius: 7,
          life: 2.5,
          color: "#ff5a1f",
          fromEnemy: true,
        });
      }
    } else if (atk === "charge") {
      const dir = norm(p.x - e.x, p.y - e.y);
      // burst move
      e.x += dir.x * 140;
      e.y += dir.y * 140;
      e.x = clamp(e.x, this.arena.x + e.radius, this.arena.x + this.arena.w - e.radius);
      e.y = clamp(e.y, this.arena.y + e.radius, this.arena.y + this.arena.h - e.radius);
      this.particles.burst(e.x, e.y, { count: 14, color: "#c41e3a", speed: 200, life: 0.3, size: 3 });
      this.shake.add(7, 0.2);
      this.audio.dash();
      if (dist(e, p) < e.radius + p.radius + 30) {
        this._hurtPlayer(e.damage * 1.1, ang(p.x - e.x, p.y - e.y));
      }
    }
  }

  _updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      if (pr.life <= 0 ||
          pr.x < 0 || pr.x > W || pr.y < 0 || pr.y > H) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.fromEnemy && dist(pr, p) < pr.radius + p.radius) {
        this._hurtPlayer(pr.damage, ang(pr.vx, pr.vy));
        this.particles.sparks(pr.x, pr.y);
        this.projectiles.splice(i, 1);
      }
    }
    updatePlayerProjectiles(this, dt);
  }

  _hurtPlayer(rawDmg, knockAng) {
    const p = this.player;
    if (p.invuln > 0 || p.dead) return;

    const def = this.getPlayerDefense();
    const takenMult = p.mods?.dmgTakenMult || 1;
    const reduced = Math.max(1, Math.round(rawDmg * (100 / (100 + def * 8)) * takenMult));
    p.hp -= reduced;
    p.invuln = this.cs().invulnAfterHit;
    p.flash = 0.15;
    p.x += Math.cos(knockAng) * 12;
    p.y += Math.sin(knockAng) * 12;
    p.x = clamp(p.x, this.arena.x + p.radius, this.arena.x + this.arena.w - p.radius);
    p.y = clamp(p.y, this.arena.y + p.radius, this.arena.y + this.arena.h - p.radius);

    this.audio.playerHurt();
    this.shake.add(6, 0.18);
    this.particles.blood(p.x, p.y, knockAng);
    this.particles.floatText(p.x, p.y - 20, `-${reduced}`, "#ff3b5c", 1.1);

    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this._onDefeat();
    }
  }

  // ─── Loot ───
  _updateLoot(dt) {
    const p = this.player;
    for (const l of this.loot) {
      l.bob += dt * 3.5;
      l.life -= dt;
      // magnet leve perto do player
      const d = dist(p, l);
      if (d < 90 && d > 1) {
        const pull = (90 - d) / 90 * 110 * dt;
        l.x += ((p.x - l.x) / d) * pull;
        l.y += ((p.y - l.y) / d) * pull;
      }
    }
    this.loot = this.loot.filter((l) => l.life > 0);

    // brasas ambiente
    if (Math.random() < 0.12) {
      const a = this.arena;
      this.particles.embers(
        a.x + Math.random() * a.w,
        a.y + a.h * 0.55 + Math.random() * a.h * 0.4,
        1,
      );
    }
  }

  _tryPickupNearest(force) {
    if (this.state !== "playing" || this.pendingLoot) return;
    if (!force && this.pickupCd > 0) return;
    const p = this.player;
    let best = null;
    let bestD = force ? 52 : 24;
    for (const l of this.loot) {
      if (l.ignoreUntil && this.time < l.ignoreUntil && !force) continue;
      const d = dist(p, l);
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    if (!best) return;
    this.pendingLoot = best;
    this.state = "loot";
    this.ui.showLootCompare(best.item, this.player);
    this.audio.pickup();
  }

  acceptLoot() {
    if (!this.pendingLoot) return;
    const item = this.pendingLoot.item;
    const p = this.player;
    if (item.slot === "weapon") {
      p.weapon = item;
    } else {
      p.armor = item;
      const newMax = this.getPlayerMaxHp();
      const ratio = p.hp / p.maxHp;
      p.maxHp = newMax;
      p.hp = Math.min(newMax, Math.max(p.hp, Math.round(newMax * ratio)));
    }
    this.loot = this.loot.filter((l) => l !== this.pendingLoot);
    this.pendingLoot = null;
    this.pickupCd = 0.25;
    this.state = "playing";
    this.ui.hideLootCompare();
    this.audio.equip();
    this.particles.burst(p.x, p.y, {
      count: 14,
      color: rarityColor(item.rarity),
      speed: 140,
      life: 0.4,
      size: 3,
    });
    this.ui.toast(item.name.toUpperCase());
    this.ui.updateHud(this);
    this._openPowerSelectIfNeeded();
  }

  rejectLoot() {
    if (!this.pendingLoot) return;
    // deixa no chão, empurra e aplica cooldown pra não reabrir na hora
    this.pendingLoot.x += (Math.random() - 0.5) * 50;
    this.pendingLoot.y += (Math.random() - 0.5) * 50;
    this.pendingLoot.ignoreUntil = this.time + 1.4;
    this.pendingLoot = null;
    this.pickupCd = 0.45;
    this.state = "playing";
    this.ui.hideLootCompare();
    this.audio.uiClick();
    this._openPowerSelectIfNeeded();
  }

  // ─── Stage flow ───
  _updateStageFlow(dt) {
    if (!this.stageClear || this.portalOpen) {
      if (this.portalOpen) this.portalPulse += dt * 4;
      return;
    }

    // delay then open portal or win
    this.waveTimer -= dt;
    if (this.waveTimer > 0) return;

    if (this.stage.boss) {
      // victory after boss stage clear
      this._onVictory();
      return;
    }

    this.portalOpen = true;
    this.audio.portal();
    this.ui.toast("PORTAL ABERTO — ENTRE");
    this.particles.ring(W / 2, this.arena.y + 36, "#ff5a1f", 50, 0.6);
  }

  _enterPortal() {
    const next = this.stageIndex + 1;
    if (next >= STAGES.length) {
      this._onVictory();
      return;
    }
    this.audio.portal();
    this.particles.burst(this.player.x, this.player.y, {
      count: 20, color: "#ff5a1f", speed: 200, life: 0.5, size: 3,
    });
    // heal a bit between stages
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.25));
    this._startStage(next);
  }

  _updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].life -= dt;
      if (this.effects[i].life <= 0) this.effects.splice(i, 1);
    }
  }

  _onDefeat() {
    this.state = "defeat";
    this.audio.setBossAmbience(false);
    this.audio.defeat();
    this.audio.stopAmbience();
    this.particles.death(this.player.x, this.player.y, "#e8d5c4");
    this.shake.add(12, 0.4);
    this._saveBest();
    this.ui.showDefeat(this);
  }

  _onVictory() {
    this.state = "victory";
    this.audio.setBossAmbience(false);
    this.audio.victory();
    this.audio.stopAmbience();
    this._saveBest();
    this.ui.showVictory(this);
  }

  // ─── Draw ───
  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // zoom punch from center
    const z = this.shake.zoom || 1;
    if (z !== 1) {
      ctx.translate(W / 2, H / 2);
      ctx.scale(z, z);
      ctx.translate(-W / 2, -H / 2);
    }
    ctx.translate(this.shake.ox, this.shake.oy);

    this._drawArena(ctx);
    this._drawSpawnMarks(ctx);
    this._drawPortal(ctx);
    this._drawLoot(ctx);
    this._drawEnemies(ctx);
    this._drawProjectiles(ctx);
    if (this.player && !this.player.dead) this._drawPlayer(ctx);
    else if (this.player?.dead) this._drawPlayerBody(ctx);
    this._drawEffects(ctx);
    this.particles.draw(ctx);

    // boss hp bar
    if (
      this.bossRef && !this.bossRef.dead &&
      (this.state === "playing" || this.state === "loot" || this.state === "levelup")
    ) {
      this._drawBossBar(ctx);
    }

    // combo floating
    if (this.combo >= 2 && this.state === "playing") {
      this._drawCombo(ctx);
    }

    ctx.restore();

    // screen flash overlay (screen space)
    if (this.screenFlash > 0) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255, 200, 140, ${this.screenFlash * 0.55})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // low HP vignette pulse
    if (this.player && !this.player.dead && this.player.hp / this.player.maxHp < 0.3) {
      const pulse = 0.25 + Math.sin(this.time * 6) * 0.1;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(120, 0, 20, ${pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _drawSpawnMarks(ctx) {
    for (const m of this.spawnMarks) {
      const t = 1 - m.life / m.maxLife;
      const r = m.radius * (0.6 + t * 1.4);
      ctx.save();
      ctx.globalAlpha = 0.35 + t * 0.45;
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.2 + t * 0.35;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      // cross
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(m.x - 6, m.y);
      ctx.lineTo(m.x + 6, m.y);
      ctx.moveTo(m.x, m.y - 6);
      ctx.lineTo(m.x, m.y + 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawCombo(ctx) {
    // canto superior direito, abaixo dos chips de equip
    const x = W - 28;
    const y = this.bossRef && !this.bossRef.dead ? 118 : 92;
    const a = Math.min(1, this.comboTimer / 0.3);
    ctx.save();
    ctx.globalAlpha = 0.5 + a * 0.5;
    ctx.textAlign = "right";
    ctx.font = '700 28px "Cinzel", serif';
    ctx.fillStyle = this.combo >= 5 ? "#ff5a1f" : "#f0c14b";
    ctx.shadowColor = this.combo >= 5 ? "#ff5a1f" : "#f0c14b";
    ctx.shadowBlur = 12;
    ctx.fillText(`×${this.combo}`, x, y);
    ctx.shadowBlur = 0;
    ctx.font = '600 10px "Cinzel", serif';
    ctx.fillStyle = "rgba(245,235,228,0.55)";
    ctx.fillText("COMBO", x, y + 16);
    ctx.restore();
  }

  _drawArena(ctx) {
    const a = this.arena;
    const tint = this.stage?.floorTint ?? 0;

    // paleta por etapa
    const themes = [
      { // Portal Infernal — brasas quentes
        void0: "#1c0c10", void1: "#10080a", floor: "#1a0e10",
        tile: "rgba(255,90,31,0.05)", crack: "rgba(255,90,31,0.1)",
        wall: "rgba(196,30,58,0.5)", glow: "rgba(255,90,31,0.22)",
        accent: "#ff5a1f",
      },
      { // Corredor de Cinzas — cinza quente
        void0: "#14100e", void1: "#0c0a08", floor: "#181410",
        tile: "rgba(180,160,120,0.05)", crack: "rgba(160,140,100,0.12)",
        wall: "rgba(140,110,70,0.4)", glow: "rgba(200,160,80,0.15)",
        accent: "#c4a060",
      },
      { // Fossa das Sombras — roxo abismo
        void0: "#100818", void1: "#080410", floor: "#120a16",
        tile: "rgba(120,60,180,0.06)", crack: "rgba(160,80,220,0.12)",
        wall: "rgba(120,40,160,0.45)", glow: "rgba(140,60,200,0.2)",
        accent: "#b44dff",
      },
      { // Trono do Abismo — sangue e ouro
        void0: "#1a0608", void1: "#0a0204", floor: "#16080c",
        tile: "rgba(200,30,50,0.08)", crack: "rgba(240,193,75,0.1)",
        wall: "rgba(220,40,60,0.55)", glow: "rgba(255,60,80,0.28)",
        accent: "#ff3b5c",
      },
    ];
    const th = themes[clamp(tint, 0, 3)];

    // outer void
    const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 420);
    bg.addColorStop(0, th.void0);
    bg.addColorStop(0.55, th.void1);
    bg.addColorStop(1, "#040204");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // floor
    ctx.fillStyle = th.floor;
    ctx.fillRect(a.x, a.y, a.w, a.h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.w, a.h);
    ctx.clip();

    // tile grid
    const tile = tint === 1 ? 36 : tint === 2 ? 48 : 40;
    for (let y = a.y; y < a.y + a.h; y += tile) {
      for (let x = a.x; x < a.x + a.w; x += tile) {
        const odd = ((x / tile) | 0) + ((y / tile) | 0);
        if (odd % 2 === 0) {
          ctx.fillStyle = th.tile;
          ctx.fillRect(x, y, tile, tile);
        }
      }
    }

    // trono: carpete central
    if (tint === 3) {
      const cx = a.x + a.w / 2;
      ctx.fillStyle = "rgba(120, 10, 25, 0.35)";
      ctx.fillRect(cx - 48, a.y, 96, a.h);
      ctx.strokeStyle = "rgba(240,193,75,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 48, a.y);
      ctx.lineTo(cx - 48, a.y + a.h);
      ctx.moveTo(cx + 48, a.y);
      ctx.lineTo(cx + 48, a.y + a.h);
      ctx.stroke();
      // trono silhueta no fundo
      ctx.fillStyle = "rgba(40, 8, 12, 0.7)";
      ctx.fillRect(cx - 36, a.y + 18, 72, 28);
      ctx.fillStyle = "rgba(240,193,75,0.2)";
      ctx.fillRect(cx - 20, a.y + 10, 40, 10);
    }

    // fossa: poças de sombra
    if (tint === 2) {
      for (let i = 0; i < 5; i++) {
        const px = a.x + 80 + i * 150;
        const py = a.y + 100 + (i % 2) * 160;
        const g = ctx.createRadialGradient(px, py, 4, px, py, 55);
        g.addColorStop(0, "rgba(80,20,120,0.25)");
        g.addColorStop(1, "rgba(80,20,120,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, 55, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // cinzas: linhas de corredor
    if (tint === 1) {
      ctx.strokeStyle = "rgba(180,150,100,0.08)";
      ctx.lineWidth = 1;
      for (let x = a.x + 60; x < a.x + a.w; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, a.y);
        ctx.lineTo(x, a.y + a.h);
        ctx.stroke();
      }
    }

    // portal: runas circulares no centro
    if (tint === 0) {
      ctx.strokeStyle = "rgba(255,90,31,0.12)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 110, 0.2, Math.PI * 1.4);
      ctx.stroke();
    }

    // cracks
    ctx.strokeStyle = th.crack;
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const rx = a.x + ((i * 97 + tint * 40) % a.w);
      const ry = a.y + ((i * 61 + tint * 30) % a.h);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + 28 + tint * 4, ry + 16);
      ctx.lineTo(rx + 10, ry + 38);
      ctx.stroke();
    }
    ctx.restore();

    // walls
    ctx.strokeStyle = th.wall;
    ctx.lineWidth = 3;
    ctx.strokeRect(a.x + 1.5, a.y + 1.5, a.w - 3, a.h - 3);
    ctx.strokeStyle = th.glow;
    ctx.lineWidth = 8;
    ctx.strokeRect(a.x - 2, a.y - 2, a.w + 4, a.h + 4);

    // corner pillars
    const pillarCol = th.accent;
    this._drawPillar(ctx, a.x + 8, a.y + 8, pillarCol);
    this._drawPillar(ctx, a.x + a.w - 8, a.y + 8, pillarCol);
    this._drawPillar(ctx, a.x + 8, a.y + a.h - 8, pillarCol);
    this._drawPillar(ctx, a.x + a.w - 8, a.y + a.h - 8, pillarCol);

    // trono: pilares laterais extras
    if (tint === 3) {
      this._drawPillar(ctx, a.x + 60, a.y + 40, "#f0c14b");
      this._drawPillar(ctx, a.x + a.w - 60, a.y + 40, "#f0c14b");
      this._drawPillar(ctx, a.x + 60, a.y + a.h - 40, "#f0c14b");
      this._drawPillar(ctx, a.x + a.w - 60, a.y + a.h - 40, "#f0c14b");
    }
  }

  _drawPillar(ctx, x, y, accent = "rgba(255,90,31,0.35)") {
    ctx.fillStyle = "#2a1418";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawPortal(ctx) {
    if (!this.portalOpen) return;
    const x = W / 2;
    const y = this.arena.y + 36;
    const pulse = 1 + Math.sin(this.portalPulse) * 0.1;
    const spin = this.portalPulse * 0.8;

    // outer glow
    const g = ctx.createRadialGradient(x, y, 4, x, y, 52 * pulse);
    g.addColorStop(0, "rgba(255,200,100,0.95)");
    g.addColorStop(0.35, "rgba(255,90,31,0.6)");
    g.addColorStop(1, "rgba(100,10,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 52 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // swirling rings
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.strokeStyle = "rgba(255,180,80,0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20 * pulse, 28 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(-spin * 2);
    ctx.strokeStyle = "rgba(255,90,31,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 * pulse, 22 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // arrow hint toward portal from player
    if (this.player && !this.player.dead) {
      const d = dist(this.player, { x, y });
      if (d > 80) {
        const a = ang(x - this.player.x, y - this.player.y);
        const ax = this.player.x + Math.cos(a) * 40;
        const ay = this.player.y + Math.sin(a) * 40;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.globalAlpha = 0.55 + Math.sin(this.time * 5) * 0.2;
        ctx.fillStyle = "#ffb347";
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, -7);
        ctx.lineTo(-6, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.fillStyle = "rgba(255,220,140,0.9)";
    ctx.font = '700 12px "Cinzel", serif';
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff5a1f";
    ctx.shadowBlur = 10;
    ctx.fillText("ENTRE NO PORTAL", x, y + 52);
    ctx.shadowBlur = 0;
  }

  _drawLoot(ctx) {
    for (const l of this.loot) {
      const bob = Math.sin(l.bob) * 4;
      const col = rarityColor(l.item.rarity);
      const y = l.y + bob;
      const rare = ["rare", "epic", "legendary"].includes(l.item.rarity);

      // beam for rare+
      if (rare) {
        const beam = ctx.createLinearGradient(l.x, y - 50, l.x, y + 10);
        beam.addColorStop(0, col + "00");
        beam.addColorStop(0.5, col + "55");
        beam.addColorStop(1, col + "00");
        ctx.fillStyle = beam;
        ctx.fillRect(l.x - 4, y - 52, 8, 60);
      }

      // glow
      const glowR = rare ? 30 : 22;
      const g = ctx.createRadialGradient(l.x, y, 2, l.x, y, glowR);
      g.addColorStop(0, col + "cc");
      g.addColorStop(1, col + "00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // pedestal
      ctx.fillStyle = "#1a1012";
      ctx.beginPath();
      ctx.ellipse(l.x, l.y + 8, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // item shape
      ctx.save();
      ctx.translate(l.x, y);
      if (l.item.slot === "weapon") {
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.shadowColor = col;
        ctx.shadowBlur = rare ? 10 : 0;
        ctx.beginPath();
        ctx.moveTo(-2, 10);
        ctx.lineTo(2, -12);
        ctx.stroke();
        ctx.fillRect(-7, -4, 14, 3);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = col;
        ctx.strokeStyle = "#0a0608";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = col;
        ctx.shadowBlur = rare ? 10 : 0;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(10, -4);
        ctx.lineTo(8, 8);
        ctx.lineTo(-8, 8);
        ctx.lineTo(-10, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
  }

  _drawEnemies(ctx) {
    // sort by y for depth
    const list = this.enemies.slice().sort((a, b) => a.y - b.y);
    for (const e of list) {
      if (e.dead) continue;
      this._drawEnemy(ctx, e);
    }
  }

  _drawEnemy(ctx, e) {
    const flash = e.flash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);

    // spawn fade-in
    if (e.spawnGrace > 0) {
      ctx.globalAlpha = 1 - e.spawnGrace / 0.5;
      if (ctx.globalAlpha < 0.2) ctx.globalAlpha = 0.2;
    }

    // shadow
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(0, e.radius * 0.7, e.radius * 0.85, e.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    if (e.kind === "boss") {
      this._drawBossBody(ctx, e, flash);
    } else {
      const r = e.radius;
      // body
      ctx.fillStyle = flash ? "#fff5ec" : e.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // accent horns / eyes
      ctx.fillStyle = flash ? "#fff" : e.accent;
      if (e.kind === "elite") {
        // crown
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r * 0.3);
        ctx.lineTo(-r * 0.35, -r * 1.15);
        ctx.lineTo(0, -r * 0.5);
        ctx.lineTo(r * 0.35, -r * 1.15);
        ctx.lineTo(r * 0.6, -r * 0.3);
        ctx.fill();
      } else if (e.kind === "ranged") {
        // spitter mouth
        ctx.beginPath();
        ctx.arc(0, r * 0.2, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // horns
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.4);
        ctx.lineTo(-r * 0.7, -r * 1.1);
        ctx.lineTo(-r * 0.15, -r * 0.55);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(r * 0.5, -r * 0.4);
        ctx.lineTo(r * 0.7, -r * 1.1);
        ctx.lineTo(r * 0.15, -r * 0.55);
        ctx.fill();
      }

      // eyes
      ctx.fillStyle = flash ? "#c41e3a" : "#ffb347";
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.15, r * 0.15, 0, Math.PI * 2);
      ctx.arc(r * 0.3, -r * 0.15, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // hp bar if damaged
    if (e.hp < e.maxHp && e.kind !== "boss") {
      const bw = e.radius * 2.2;
      const bh = 4;
      const pct = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(-bw / 2, -e.radius - 12, bw, bh);
      ctx.fillStyle = e.kind === "elite" ? "#f0c14b" : "#e63946";
      ctx.fillRect(-bw / 2, -e.radius - 12, bw * pct, bh);
    }

    // boss telegraph
    if (e.kind === "boss" && e.bossWindup > 0 && e.bossTelegraph) {
      ctx.strokeStyle = "rgba(255,59,92,0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      const r = e.bossTelegraph === "ring" ? 140 : e.bossTelegraph === "slam" ? 95 : 50;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  _drawBossBody(ctx, e, flash) {
    const r = e.radius;
    const pulse = 1 + Math.sin(e.pulse) * 0.03;

    // aura
    const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.6);
    g.addColorStop(0, "rgba(255,59,92,0.25)");
    g.addColorStop(1, "rgba(255,59,92,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = flash ? "#fff0f0" : e.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05 * pulse, r * pulse, 0, 0, Math.PI * 2);
    ctx.fill();

    // armor plates
    ctx.strokeStyle = flash ? "#fff" : e.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // horns big
    ctx.fillStyle = flash ? "#fff" : "#5a1018";
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.4);
    ctx.lineTo(-r * 0.9, -r * 1.4);
    ctx.lineTo(-r * 0.1, -r * 0.6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.4);
    ctx.lineTo(r * 0.9, -r * 1.4);
    ctx.lineTo(r * 0.1, -r * 0.6);
    ctx.fill();

    // eyes
    ctx.fillStyle = "#ff3b5c";
    ctx.shadowColor = "#ff3b5c";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.1, r * 0.14, 0, Math.PI * 2);
    ctx.arc(r * 0.35, -r * 0.1, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // mouth
    ctx.strokeStyle = "#c41e3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, r * 0.25, r * 0.35, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  _drawBossBar(ctx) {
    // Abaixo do HUD superior (stage-pill / kills / chips) para não sobrepor
    const e = this.bossRef;
    const bw = 420;
    const bh = 16;
    const x = (W - bw) / 2;
    const y = 72;
    const pct = clamp(e.hp / e.maxHp, 0, 1);
    const hpText = `${Math.max(0, Math.ceil(e.hp))} / ${e.maxHp}`;

    // placa de fundo do bloco inteiro (nome + barra)
    const panelX = x - 12;
    const panelY = y - 22;
    const panelW = bw + 24;
    const panelH = bh + 30;
    ctx.fillStyle = "rgba(6, 2, 4, 0.82)";
    ctx.strokeStyle = "rgba(255, 90, 31, 0.4)";
    ctx.lineWidth = 1;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 6);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeRect(panelX, panelY, panelW, panelH);
    }

    // nome do chefe (acima da barra, sem colidir com o fill)
    ctx.fillStyle = "#ff8a6a";
    ctx.font = '700 12px "Cinzel", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.name.toUpperCase(), W / 2, y - 10);

    // track
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
    ctx.fillStyle = "#1a060a";
    ctx.fillRect(x, y, bw, bh);

    // fill
    const g = ctx.createLinearGradient(x, y, x + bw, y);
    g.addColorStop(0, "#6b0f1a");
    g.addColorStop(0.45, "#ff3b5c");
    g.addColorStop(1, "#ff9a6a");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, bw * pct, bh);

    // borda
    ctx.strokeStyle = "rgba(255, 90, 31, 0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, bw, bh);

    // HP numérico DENTRO da barra (legível)
    ctx.font = '600 11px "Share Tech Mono", monospace';
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(hpText, W / 2 + 1, y + bh / 2 + 1);
    ctx.fillStyle = "#fff5ec";
    ctx.fillText(hpText, W / 2, y + bh / 2);

    // fase discreta à direita
    if (e.bossPhase > 0) {
      ctx.textAlign = "right";
      ctx.font = '600 9px "Cinzel", serif';
      ctx.fillStyle = e.bossPhase >= 2 ? "#ffb347" : "rgba(245,235,228,0.65)";
      ctx.fillText(e.bossPhase >= 2 ? "FASE III" : "FASE II", x + bw, y - 10);
      ctx.textAlign = "center";
    }
  }

  _drawProjectiles(ctx) {
    for (const pr of this.projectiles) {
      // flecha alongada (arqueiro)
      if (pr.arrow) {
        const a = Math.atan2(pr.vy, pr.vx);
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(a);
        // haste de madeira
        ctx.strokeStyle = "#8a6a40";
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.lineTo(7, 0);
        ctx.stroke();
        // ponta de aço
        ctx.fillStyle = "#d8dee8";
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(5, -3.2);
        ctx.lineTo(5, 3.2);
        ctx.closePath();
        ctx.fill();
        // penas
        ctx.fillStyle = pr.color || "#7dffb3";
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.lineTo(-15, -4);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.lineTo(-15, 4);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        continue;
      }

      const glow = pr.mageOrb ? pr.radius * 2.8 : pr.radius * 2;
      const g = ctx.createRadialGradient(pr.x, pr.y, 1, pr.x, pr.y, glow);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.35, pr.color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, glow, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
      ctx.fill();
      if (pr.mageOrb) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(pr.x - 1, pr.y - 1, pr.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawPlayer(ctx) {
    drawPlayer(this, ctx);
  }

  _drawPlayerBody(ctx) {
    drawPlayerBody(this, ctx);
  }

  _drawEffects(ctx) {
    for (const fx of this.effects) {
      if (fx.type === "slash") {
        const t = 1 - fx.life / fx.maxLife;
        ctx.save();
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.facing);
        ctx.globalAlpha = (1 - t) * (fx.fury ? 0.75 : 0.55);
        ctx.strokeStyle = fx.fury ? "#ff5a1f" : "#ffb347";
        ctx.lineWidth = (fx.fury ? 6 : 4) - t * 2;
        ctx.shadowColor = fx.fury ? "#ff5a1f" : "#ffb347";
        ctx.shadowBlur = fx.fury ? 16 : 8;
        ctx.beginPath();
        ctx.arc(0, 0, fx.range * (0.7 + t * 0.3), -fx.arc / 2, fx.arc / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#fff5ec";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, fx.range * (0.65 + t * 0.35), -fx.arc / 2 * 0.8, fx.arc / 2 * 0.8);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}
