/**
 * Estilos de ataque por classe — game.js só despacha.
 * melee  → bárbaro
 * ranged → arqueiro
 * caster → mago (bola de fogo + splash)
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * @param {object} game
 * @param {number} dt
 */
export function updateClassAttack(game, dt) {
  const cls = game.classDef;
  if (!cls) return;
  if (cls.style === "melee") updateMelee(game, dt);
  else if (cls.style === "caster") updateCaster(game, dt);
  else updateRanged(game, dt);
}

function stats(game) {
  return game.classDef.stats;
}

function wantAttack(game) {
  return game.mouse.down || game.keys["KeyJ"] || game.touchAttack
    || (game.touchAim?.active && Math.hypot(game.touchAim.x, game.touchAim.y) > 0.35);
}

function updateMelee(game, dt) {
  const p = game.player;
  const s = stats(game);
  const wantAtk = wantAttack(game);
  const res = game.classDef.resource;
  const furyOn = game.isResourceActive();
  const cdMult = (furyOn ? res.atkSpeed : 1) * (p.mods?.atkCdMult || 1);

  if (p.atkPhase === "idle") {
    if (wantAtk && p.atkCd <= 0 && p.dashing <= 0) {
      game.updateFacing?.(game.touchMove.x, game.touchMove.y, true);
      p.atkPhase = "windup";
      p.atkTimer = s.attackWindup * (furyOn ? 0.7 : 1);
      p.hitSet = new Set();
      p.lastHitCount = 0;
      p.swingCount = (p.swingCount || 0) + 1;
      const lx = Math.cos(p.facing) * s.attackLunge * 0.45;
      const ly = Math.sin(p.facing) * s.attackLunge * 0.45;
      p.x += lx;
      p.y += ly;
      const ar = game.arena;
      p.x = clamp(p.x, ar.x + p.radius, ar.x + ar.w - p.radius);
      p.y = clamp(p.y, ar.y + p.radius, ar.y + ar.h - p.radius);
      game.audio.swingMelee(furyOn);
    }
    return;
  }

  p.atkTimer -= dt;

  if (p.atkPhase === "windup" && p.atkTimer <= 0) {
    p.atkPhase = "active";
    p.atkTimer = s.attackActive;
    p.x += Math.cos(p.facing) * s.attackLunge * 0.35;
    p.y += Math.sin(p.facing) * s.attackLunge * 0.35;
    const a = game.arena;
    p.x = clamp(p.x, a.x + p.radius, a.x + a.w - p.radius);
    p.y = clamp(p.y, a.y + p.radius, a.y + a.h - p.radius);

    const range = game.getAttackRange();
    const arc = game.getAttackArc();
    game.effects.push({
      type: "slash",
      x: p.x,
      y: p.y,
      facing: p.facing,
      life: furyOn ? 0.2 : 0.16,
      maxLife: furyOn ? 0.2 : 0.16,
      range,
      arc,
      fury: furyOn,
    });
    game.particles.slashDebris(
      p.x + Math.cos(p.facing) * 40,
      p.y + Math.sin(p.facing) * 40,
      p.facing,
    );
  } else if (p.atkPhase === "active") {
    resolveMeleeHits(game);
    if (p.atkTimer <= 0) {
      p.atkPhase = "recover";
      p.atkTimer = s.attackRecover;
      if (p.lastHitCount >= 3) {
        game.ui.toast(p.lastHitCount >= 5 ? "ANIquilaÇÃO" : "CLEAVE");
        game.shake.punch(0.03);
        game.audio.cleaveHit(p.lastHitCount);
      }
      p.atkCd = s.attackCooldown * cdMult;
    }
  } else if (p.atkPhase === "recover" && p.atkTimer <= 0) {
    p.atkPhase = "idle";
  }
}

function resolveMeleeHits(game) {
  const p = game.player;
  const dmg = game.getPlayerDamage();
  const range = game.getAttackRange();
  const halfArc = game.getAttackArc() / 2;

  for (const e of game.enemies) {
    if (e.dead || p.hitSet.has(e.id)) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > range + e.radius) continue;
    let da = Math.atan2(dy, dx) - p.facing;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > halfArc) continue;

    p.hitSet.add(e.id);
    p.lastHitCount++;
    game._damageEnemy(e, dmg, p.facing);
  }
}

function updateRanged(game, dt) {
  const p = game.player;
  const s = stats(game);
  const wantAtk =
    game.mouse.down || game.keys["KeyJ"] || game.touchAttack
    || (game.touchAim?.active && Math.hypot(game.touchAim.x, game.touchAim.y) > 0.35);
  const res = game.classDef.resource;
  const active = game.isResourceActive();
  const cdMult = (active ? res.atkSpeed : 1) * (p.mods?.atkCdMult || 1);

  p.atkCd = Math.max(0, p.atkCd - dt);

  // phase machine simplificada: idle dispara
  if (p.atkPhase !== "idle") {
    p.atkTimer -= dt;
    if (p.atkTimer <= 0) p.atkPhase = "idle";
    return;
  }

  if (!wantAtk || p.atkCd > 0 || p.dashing > 0) return;

  // tiro (auto-mira no celular se não houver stick de mira)
  game.updateFacing?.(game.touchMove.x, game.touchMove.y, true);
  p.atkPhase = "active";
  p.atkTimer = s.attackActive + s.attackRecover;
  p.atkCd = s.attackCooldown * cdMult;
  p.swingCount = (p.swingCount || 0) + 1;

  const spd = (s.projectileSpeed || 500) * (p.mods?.projSpeedMult || 1);
  const ang = p.facing;
  const rangeMult = p.mods?.rangeMult || 1;
  // vida do projétil ≈ alcance relativo (base 1.4s a speed base)
  const life = 1.4 * rangeMult;
  const bonusShots = p.mods?.extraShots || 0;
  const shots = (active ? 2 : 1) + bonusShots;
  const pierce = p.mods?.pierce || 0;
  const spreadStep = shots <= 1 ? 0 : (active ? 0.05 : 0.04) + (shots - 2) * 0.02;

  for (let i = 0; i < shots; i++) {
    const offset = shots === 1 ? 0 : (i - (shots - 1) / 2) * spreadStep;
    const aim = ang + offset;
    game.projectiles.push({
      x: p.x + Math.cos(aim) * 18,
      y: p.y + Math.sin(aim) * 18,
      vx: Math.cos(aim) * spd,
      vy: Math.sin(aim) * spd,
      damage: game.getPlayerDamage(),
      radius: 4, // hitbox; visual é flecha alongada
      life,
      color: game.classDef.colors?.accent || "#7dffb3",
      fromEnemy: false,
      fromPlayer: true,
      critBoost: active,
      arrow: true,
      pierceLeft: pierce,
      hitIds: pierce > 0 ? new Set() : null,
    });
  }

  game.audio.swingBow(active);
  game.particles.burst(
    p.x + Math.cos(ang) * 20,
    p.y + Math.sin(ang) * 20,
    {
      count: 4,
      color: game.classDef.colors?.accent || "#7dffb3",
      speed: 80,
      life: 0.15,
      size: 2,
      angle: ang,
      spread: 0.4,
    },
  );
}

/**
 * Mago: cast curto → bola de fogo com splash legível.
 * Com MANA: leque de 3 orbes + splash maior.
 * Durante windup continua mirando no mouse (responsivo).
 */
function updateCaster(game, dt) {
  const p = game.player;
  const s = stats(game);
  const wantAtk = wantAttack(game);
  const res = game.classDef.resource;
  const active = game.isResourceActive();
  const cdMult = (active ? res.atkSpeed : 1) * (p.mods?.atkCdMult || 1);

  // mira contínua (touch stick / mouse / auto-aim)
  if (p.atkPhase === "windup" || p.atkPhase === "active" || wantAtk) {
    game.updateFacing?.(game.touchMove.x, game.touchMove.y, true);
  }

  if (p.atkPhase === "idle") {
    if (wantAtk && p.atkCd <= 0 && p.dashing <= 0) {
      game.updateFacing?.(game.touchMove.x, game.touchMove.y, true);
      p.atkPhase = "windup";
      p.atkTimer = s.attackWindup * (active ? 0.55 : 1);
      p.swingCount = (p.swingCount || 0) + 1;
      const accent = game.classDef.colors?.accent || "#b44dff";
      game.particles.burst(p.x, p.y, {
        count: 8,
        color: accent,
        speed: 60,
        life: 0.22,
        size: 2.5,
        gravity: -40,
      });
      // anel de cast no chão (leitura clara)
      game.particles.ring(p.x, p.y, accent, 28, s.attackWindup + 0.05);
      game.audio.castStart(active);
    }
    return;
  }

  p.atkTimer -= dt;

  // partículas leves no windup (orbe carregando)
  if (p.atkPhase === "windup" && Math.random() < 0.5) {
    const a = p.facing;
    game.particles.burst(
      p.x + Math.cos(a) * 24,
      p.y + Math.sin(a) * 24,
      {
        count: 1,
        color: game.classDef.colors?.flame || "#ff6bcb",
        speed: 30,
        life: 0.2,
        size: 2,
        gravity: -20,
      },
    );
  }

  if (p.atkPhase === "windup" && p.atkTimer <= 0) {
    p.atkPhase = "active";
    p.atkTimer = s.attackActive;
    fireMageOrbs(game, active);
    p.atkCd = s.attackCooldown * cdMult;
  } else if (p.atkPhase === "active" && p.atkTimer <= 0) {
    p.atkPhase = "recover";
    p.atkTimer = s.attackRecover;
  } else if (p.atkPhase === "recover" && p.atkTimer <= 0) {
    p.atkPhase = "idle";
  }
}

function fireMageOrbs(game, active) {
  const p = game.player;
  const s = stats(game);
  const ang = p.facing;
  const spd = (s.projectileSpeed || 440) * (p.mods?.projSpeedMult || 1);
  const accent = game.classDef.colors?.accent || "#b44dff";
  const flame = game.classDef.colors?.flame || "#ff6bcb";
  const baseDmg = game.getPlayerDamage();
  const splashR = (s.splashRadius || 58)
    * (active ? 1.4 : 1)
    * (p.mods?.splashRadiusMult || 1);
  const splashM = (s.splashMult || 0.62)
    * (active ? 1.2 : 1)
    * (p.mods?.splashDmgMult || 1);
  const life = 1.5 * (p.mods?.rangeMult || 1);

  const angles = active
    ? [ang - 0.18, ang, ang + 0.18]
    : [ang];

  for (const aim of angles) {
    game.projectiles.push({
      x: p.x + Math.cos(aim) * 22,
      y: p.y + Math.sin(aim) * 22,
      vx: Math.cos(aim) * spd,
      vy: Math.sin(aim) * spd,
      damage: baseDmg,
      radius: (s.projectileRadius || 8) * (active ? 1.2 : 1),
      life,
      color: active ? flame : accent,
      fromEnemy: false,
      fromPlayer: true,
      mageOrb: true,
      splashRadius: splashR,
      splashMult: splashM,
      critBoost: active,
      // wobble mínimo — legibilidade > flair
      wobble: 0,
      wobbleAmt: active ? 0.15 : 0.08,
    });
  }

  game.audio.castFire(active);
  game.particles.burst(
    p.x + Math.cos(ang) * 24,
    p.y + Math.sin(ang) * 24,
    {
      count: active ? 14 : 8,
      color: accent,
      speed: 140,
      life: 0.22,
      size: 3,
      angle: ang,
      spread: 0.55,
    },
  );
  if (active) {
    game.shake.add(3, 0.1);
    game.particles.ring(p.x, p.y, flame, 42, 0.28);
  }
}

/** Resolve colisão de projéteis do player com inimigos */
export function updatePlayerProjectiles(game, dt) {
  const list = game.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const pr = list[i];
    if (!pr.fromPlayer) continue;

    // wobble sutil (não atrapalha mira)
    if (pr.mageOrb && pr.wobbleAmt) {
      pr.wobble = (pr.wobble || 0) + dt * 8;
      const side = Math.sin(pr.wobble) * pr.wobbleAmt * dt;
      const len = Math.hypot(pr.vx, pr.vy) || 1;
      pr.x += (-pr.vy / len) * side * 50;
      pr.y += (pr.vx / len) * side * 50;
    }

    for (const e of game.enemies) {
      if (e.dead || e.spawnGrace > 0) continue;
      if (pr.hitIds?.has(e.id)) continue;
      const d = Math.hypot(e.x - pr.x, e.y - pr.y);
      if (d < e.radius + pr.radius) {
        const dir = Math.atan2(pr.vy, pr.vx);
        const dmg = pr.critBoost ? Math.round(pr.damage * 1.1) : pr.damage;
        game._damageEnemy(e, dmg, dir);

        if (pr.mageOrb && pr.splashRadius > 0) {
          applySplash(game, pr, e);
          list.splice(i, 1);
          break;
        }

        game.particles.sparks(pr.x, pr.y);
        if (pr.fromPlayer && !pr.mageOrb) game.audio.arrowHit();

        // flechas com perfuração atravessam N inimigos
        if (pr.pierceLeft > 0) {
          if (!pr.hitIds) pr.hitIds = new Set();
          pr.hitIds.add(e.id);
          pr.pierceLeft -= 1;
          // leve perda de velocidade após atravessar
          pr.vx *= 0.92;
          pr.vy *= 0.92;
          continue;
        }

        list.splice(i, 1);
        break;
      }
    }
  }
}

function applySplash(game, pr, primary) {
  const r = pr.splashRadius;
  const splashDmg = Math.round(pr.damage * (pr.splashMult || 0.55));
  const col = pr.color || "#b44dff";

  // explosão bem legível
  game.particles.burst(pr.x, pr.y, {
    count: 22,
    color: col,
    speed: 240,
    life: 0.4,
    size: 4,
  });
  game.particles.burst(pr.x, pr.y, {
    count: 10,
    color: "#fff5ec",
    speed: 160,
    life: 0.25,
    size: 2.5,
  });
  game.particles.ring(pr.x, pr.y, col, r, 0.35);
  game.particles.ring(pr.x, pr.y, "#ffffff", r * 0.55, 0.2);
  game.shake.add(3.5, 0.1);
  game.audio.mageExplode(pr.critBoost);

  let splashHits = 0;
  for (const e of game.enemies) {
    if (e.dead || e === primary) continue;
    const d = Math.hypot(e.x - pr.x, e.y - pr.y);
    if (d < r + e.radius) {
      const dir = Math.atan2(e.y - pr.y, e.x - pr.x);
      game._damageEnemy(e, splashDmg, dir);
      splashHits++;
    }
  }
  if (splashHits >= 3) {
    game.ui.toast("EXPLOSÃO");
  }
}
