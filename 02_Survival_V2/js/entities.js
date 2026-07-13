import {
  PLAYER, ORBIT, PULSE, ENEMY, COLORS, WORLD,
} from "./config.js";
import { clamp, dist, dist2, normalize, randRange } from "./utils.js";

/* ─────────────────── Player ─────────────────── */

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    radius: PLAYER.radius,
    speed: PLAYER.baseSpeed,
    maxHp: PLAYER.maxHp,
    hp: PLAYER.maxHp,
    invuln: 0,
    flash: 0,
    build: "tank",
    facing: 0,
    // Órbitas (Tanque)
    orbitCount: ORBIT.count,
    orbitRadius: ORBIT.radius,
    orbitSize: ORBIT.size,
    orbitSpeed: ORBIT.speed,
    orbitDamage: ORBIT.damage,
    orbitAngle: 0,
    orbitHitCd: new Map(), // enemyId -> remaining cd
    // Pulso (Tanque)
    pulseInterval: PULSE.interval,
    pulseTimer: PULSE.interval * 0.6,
    pulseMaxRadius: PULSE.maxRadius,
    pulseDuration: PULSE.duration,
    pulseDamage: PULSE.damage,
    pulseActive: null, // { t, r, hit: Set }
    // Melee (Batedor)
    meleeRange: 0,
    meleeDamage: 0,
    meleeInterval: 999,
    meleeTimer: 999,
    meleeKnockback: 0,
    meleeArc: 0,
    meleeSwing: null, // { t, duration, angle, hit: Set }
    combo: 0,
    comboBonus: 0,
    comboCap: 0,
    // Magnet / life
    magnetRadius: PLAYER.magnetBase,
    lifestealOnKill: 0,
    // XP
    level: 1,
    xp: 0,
    xpToNext: 10,
    kills: 0,
  };
}

export function updatePlayer(p, input, dt) {
  let mx = 0, my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;

  if (mx || my) {
    const n = normalize(mx, my);
    p.vx = n.x * p.speed;
    p.vy = n.y * p.speed;
    p.facing = Math.atan2(n.y, n.x);
  } else {
    p.vx *= 0.75;
    p.vy *= 0.75;
    if (Math.abs(p.vx) < 1) p.vx = 0;
    if (Math.abs(p.vy) < 1) p.vy = 0;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, p.radius, WORLD.width - p.radius);
  p.y = clamp(p.y, p.radius, WORLD.height - p.radius);

  if (p.invuln > 0) p.invuln -= dt;
  if (p.flash > 0) p.flash -= dt;

  // Órbitas giram (Tanque)
  if (p.orbitCount > 0) {
    p.orbitAngle += p.orbitSpeed * dt;
  }

  // Cooldown de hit por órbita
  for (const [id, t] of p.orbitHitCd) {
    const nt = t - dt;
    if (nt <= 0) p.orbitHitCd.delete(id);
    else p.orbitHitCd.set(id, nt);
  }

  // Pulso (Tanque)
  if (p.build === "tank") {
    p.pulseTimer -= dt;
    if (p.pulseTimer <= 0) {
      p.pulseTimer = p.pulseInterval;
      p.pulseActive = { t: 0, r: 0, hit: new Set() };
    }
  }
  if (p.pulseActive) {
    p.pulseActive.t += dt;
    const k = clamp(p.pulseActive.t / p.pulseDuration, 0, 1);
    // ease-out
    p.pulseActive.r = p.pulseMaxRadius * (1 - (1 - k) * (1 - k));
    if (p.pulseActive.t >= p.pulseDuration) p.pulseActive = null;
  }

  // Swing melee visual
  if (p.meleeSwing) {
    p.meleeSwing.t += dt;
    if (p.meleeSwing.t >= p.meleeSwing.duration) p.meleeSwing = null;
  }
}

export function getOrbitPositions(p) {
  const positions = [];
  const n = p.orbitCount;
  for (let i = 0; i < n; i++) {
    const a = p.orbitAngle + (i / n) * Math.PI * 2;
    positions.push({
      x: p.x + Math.cos(a) * p.orbitRadius,
      y: p.y + Math.sin(a) * p.orbitRadius,
      r: p.orbitSize,
    });
  }
  return positions;
}

export function hurtPlayer(p, dmg, fromX, fromY) {
  if (p.invuln > 0 || p.hp <= 0) return false;
  p.hp = Math.max(0, p.hp - dmg);
  p.invuln = PLAYER.invulnTime;
  p.flash = 0.35;
  // Knockback — empurrão limpo, sem grudar
  const n = normalize(p.x - fromX, p.y - fromY);
  p.x += n.x * 28;
  p.y += n.y * 28;
  p.vx = n.x * PLAYER.knockbackForce;
  p.vy = n.y * PLAYER.knockbackForce;
  p.x = clamp(p.x, p.radius, WORLD.width - p.radius);
  p.y = clamp(p.y, p.radius, WORLD.height - p.radius);
  return true;
}

export function healPlayer(p, amount) {
  p.hp = Math.min(p.maxHp, p.hp + amount);
}

/* ─────────────────── Enemies ─────────────────── */

let _eid = 1;

export function createEnemy(type, x, y, extras = {}) {
  const def = ENEMY[type];
  if (!def) throw new Error(`Unknown enemy: ${type}`);
  return {
    id: _eid++,
    type,
    x, y,
    radius: def.radius * (extras.scale || 1),
    speed: def.speed * (extras.speedMul || 1),
    hp: Math.round(def.hp * (extras.hpMul || 1)),
    maxHp: Math.round(def.hp * (extras.hpMul || 1)),
    damage: def.damage,
    color: def.color,
    xp: Math.round(def.xp * (extras.xpMul || 1)),
    mass: def.mass,
    showHp: !!def.showHp || !!extras.showHp,
    isElite: !!def.isElite || !!extras.isElite,
    isBoss: !!def.isBoss || !!extras.isBoss,
    // feedback
    hitFlash: 0,
    squash: 0,
    alive: true,
    eliteZoneId: extras.eliteZoneId ?? null,
  };
}

export function updateEnemy(e, player, dt) {
  if (!e.alive) return;
  const n = normalize(player.x - e.x, player.y - e.y);
  e.x += n.x * e.speed * dt;
  e.y += n.y * e.speed * dt;
  e.x = clamp(e.x, e.radius, WORLD.width - e.radius);
  e.y = clamp(e.y, e.radius, WORLD.height - e.radius);
  if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.squash > 0) e.squash -= dt * 4;
}

export function damageEnemy(e, amount) {
  if (!e.alive) return false;
  e.hp -= amount;
  e.hitFlash = 0.12;
  e.squash = 1;
  if (e.hp <= 0) {
    e.alive = false;
    e.hp = 0;
    return true; // morreu
  }
  return false;
}

/* ─────────────────── Gems ─────────────────── */

export function createGem(x, y, value) {
  return {
    x, y,
    value,
    r: 5,
    vx: randRange(-40, 40),
    vy: randRange(-60, -20),
    life: 0,
    collected: false,
  };
}

export function updateGem(g, player, dt) {
  if (g.collected) return;
  g.life += dt;

  // bounce inicial
  if (g.life < 0.35) {
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.vy += 180 * dt;
  } else {
    const d = dist(g.x, g.y, player.x, player.y);
    if (d < player.magnetRadius) {
      const n = normalize(player.x - g.x, player.y - g.y);
      const pull = 280 + (1 - d / player.magnetRadius) * 420;
      g.x += n.x * pull * dt;
      g.y += n.y * pull * dt;
    }
  }

  if (dist2(g.x, g.y, player.x, player.y) < (player.radius + g.r + 4) ** 2) {
    g.collected = true;
  }
}

/* ─────────────────── Particles & floating text ─────────────────── */

export function createParticles(x, y, color, count, speed = 120) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = randRange(speed * 0.3, speed);
    list.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: randRange(0.25, 0.7),
      maxLife: 0.7,
      r: randRange(2, 5),
      color,
    });
  }
  return list;
}

/** Faíscas direcionais de impacto (juice). */
export function createSparks(x, y, angle, color, count = 6) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const a = angle + randRange(-0.7, 0.7);
    const s = randRange(80, 220);
    list.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: randRange(0.12, 0.32),
      maxLife: 0.32,
      r: randRange(1.5, 3.5),
      color,
    });
  }
  return list;
}

/** Anel de morte que se expande e some. */
export function createBurstRing(x, y, color, maxR = 40) {
  return {
    kind: "ring",
    x, y,
    r: 4,
    maxR,
    life: 0.35,
    maxLife: 0.35,
    color,
  };
}

export function updateBurstRing(r, dt) {
  r.life -= dt;
  const k = 1 - r.life / r.maxLife;
  r.r = r.maxR * k;
}

export function updateParticle(p, dt) {
  p.life -= dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vx *= 0.96;
  p.vy *= 0.96;
}

export function createFloatText(x, y, text, color = "#fff") {
  return {
    x, y: y - 10,
    text,
    color,
    life: 0.7,
    maxLife: 0.7,
    vy: -40,
  };
}

export function updateFloatText(t, dt) {
  t.life -= dt;
  t.y += t.vy * dt;
}

/* ─────────────────── Draw helpers ─────────────────── */

export function drawPlayer(ctx, p) {
  const invFlash = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0;
  if (invFlash) {
    ctx.globalAlpha = 0.45;
  }

  const isScout = p.build === "scout";
  const body = isScout ? "#ff6a3a" : COLORS.player;
  const border = isScout ? "#ffb090" : COLORS.playerBorder;

  // arco de swing (Batedor)
  if (p.meleeSwing) {
    const sw = p.meleeSwing;
    const k = sw.t / sw.duration;
    const half = (p.meleeArc || Math.PI * 0.8) * 0.5;
    const a0 = sw.angle - half;
    const a1 = sw.angle - half + (p.meleeArc || Math.PI * 0.8) * Math.min(1, k * 1.4);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, p.meleeRange, a0, a1);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 140, 60, ${0.35 * (1 - k)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 220, 160, ${0.7 * (1 - k)})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // “lâmina”
    const bladeA = a1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(
      p.x + Math.cos(bladeA) * p.meleeRange,
      p.y + Math.sin(bladeA) * p.meleeRange
    );
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // corpo
  const fill = p.flash > 0 ? "#ff6666" : body;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = p.flash > 0 ? "#ffaaaa" : border;
  ctx.stroke();

  // direção (olho / capacete)
  const fx = p.x + Math.cos(p.facing || 0) * (p.radius * 0.35);
  const fy = p.y + Math.sin(p.facing || 0) * (p.radius * 0.35);
  ctx.beginPath();
  ctx.arc(fx, fy, p.radius * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();

  ctx.globalAlpha = 1;

  // órbitas (Tanque)
  if (p.orbitCount > 0) {
    const orbs = getOrbitPositions(p);
    for (const o of orbs) {
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.orbit;
      ctx.fill();
      ctx.strokeStyle = "rgba(200,255,220,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // pulso
  if (p.pulseActive) {
    const pr = p.pulseActive.r;
    const alpha = 1 - p.pulseActive.t / p.pulseDuration;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(80, 255, 140, ${0.7 * alpha})`;
    ctx.lineWidth = 6 * alpha + 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, pr * 0.92, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180, 255, 200, ${0.25 * alpha})`;
    ctx.lineWidth = 10;
    ctx.stroke();
  }
}

export function drawBurstRing(ctx, r) {
  if (r.life <= 0) return;
  const a = clamp(r.life / r.maxLife, 0, 1);
  ctx.beginPath();
  ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
  ctx.strokeStyle = r.color;
  ctx.globalAlpha = a * 0.8;
  ctx.lineWidth = 3 * a + 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawEnemy(ctx, e) {
  if (!e.alive) return;
  const sq = e.squash > 0 ? 1 - e.squash * 0.25 : 1;
  const sy = e.squash > 0 ? 1 + e.squash * 0.2 : 1;

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(sq, sy);

  const flash = e.hitFlash > 0;
  ctx.beginPath();
  ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
  ctx.fillStyle = flash ? "#ffffff" : e.color;
  ctx.fill();
  ctx.lineWidth = e.isBoss ? 4 : 2;
  ctx.strokeStyle = e.isBoss
    ? "#ffcc80"
    : e.isElite
      ? "#e0b0ff"
      : "rgba(0,0,0,0.35)";
  ctx.stroke();

  // olhos simples
  if (e.type !== "slime") {
    ctx.fillStyle = flash ? "#333" : "#1a1010";
    ctx.beginPath();
    ctx.arc(-e.radius * 0.3, -e.radius * 0.15, e.radius * 0.12, 0, Math.PI * 2);
    ctx.arc(e.radius * 0.3, -e.radius * 0.15, e.radius * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // barra de HP
  if (e.showHp && e.hp < e.maxHp) {
    const bw = e.radius * 2.2;
    const bh = 4;
    const bx = e.x - bw / 2;
    const by = e.y - e.radius - 10;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = e.isBoss ? "#ff8c2a" : e.isElite ? "#b060ff" : "#e05050";
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
  }
}

export function drawGem(ctx, g) {
  if (g.collected) return;
  const pulse = 1 + Math.sin(g.life * 8) * 0.15;
  ctx.beginPath();
  ctx.arc(g.x, g.y, g.r * pulse, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.gem;
  ctx.fill();
  ctx.strokeStyle = "rgba(200,255,220,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawParticle(ctx, p) {
  const a = clamp(p.life / p.maxLife, 0, 1);
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawFloatText(ctx, t) {
  const a = clamp(t.life / t.maxLife, 0, 1);
  ctx.globalAlpha = a;
  ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
  ctx.fillStyle = t.color;
  ctx.textAlign = "center";
  ctx.fillText(t.text, t.x, t.y);
  ctx.globalAlpha = 1;
}

export { dist };
