/**
 * Chefões — cada um é um JOGO diferente, não reskin.
 *
 * mother  → fábrica: ovos no chão, cura se ninhada viva, erupções
 * jailer  → espaço: correntes no chão, gancho, prisão (quase sem chase)
 * echo    → ilusão: blink, decoys, afterimages (não é tanque)
 * senhor  → clássico: persegue + slam/ring/charge
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
const ang = (x, y) => Math.atan2(y, x);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function updateBoss(game, e, dt) {
  const id = e.bossId || "senhor";
  const hpPct = e.hp / e.maxHp;
  e.bossPhase = hpPct < 0.33 ? 2 : hpPct < 0.66 ? 1 : 0;
  announcePhase(game, e);

  if (e.bossWindup > 0) {
    e.bossWindup -= dt;
    if (Math.random() < 0.15) {
      game.particles.burst(e.x + (Math.random() - 0.5) * 30, e.y + (Math.random() - 0.5) * 30, {
        count: 1, color: e.accent, speed: 25, life: 0.15, size: 2,
      });
    }
    if (e.bossWindup <= 0 && e.bossTelegraph) {
      execute(game, e, e.bossTelegraph);
      e.bossTelegraph = null;
    }
    return;
  }

  if (id === "mother") updateMother(game, e, dt);
  else if (id === "jailer") updateJailer(game, e, dt);
  else if (id === "echo") updateEcho(game, e, dt);
  else updateSenhor(game, e, dt);
}

function announcePhase(game, e) {
  if (e.bossPhase === e.lastPhase) return;
  e.lastPhase = e.bossPhase;
  if (e.bossPhase === 1) {
    game.ui.showBanner(banner(e, 1));
    game.audio.bossPhase();
    game.particles.ring(e.x, e.y, e.accent, 110, 0.5);
    game._addFlash(0.3);
  } else if (e.bossPhase === 2) {
    game.ui.showBanner(banner(e, 2));
    game.audio.bossPhase();
    game.audio.furyActivate();
    game.particles.furyBurst(e.x, e.y);
    game._addFlash(0.45);
    game.shake.add(10, 0.35);
  }
}

function banner(e, phase) {
  const id = e.bossId || "senhor";
  if (phase === 1) {
    if (id === "mother") return "POSTURA DE NINHO";
    if (id === "jailer") return "CORRENTES NO CHÃO";
    if (id === "echo") return "MULTIPLICAÇÃO";
    return "FASE II";
  }
  if (id === "mother") return "ERUPÇÃO MATERNA";
  if (id === "jailer") return "NENHUMA FUGA";
  if (id === "echo") return "VOCÊ É O ECO";
  return "FÚRIA DO TRONO";
}

function telegraph(game, e, atk, windup, opts = {}) {
  e.bossTelegraph = atk;
  e.bossWindup = windup;
  const p = game.player;
  e._aimX = p?.x ?? e.x;
  e._aimY = p?.y ?? e.y;
  e._aimAng = p ? ang(p.x - e.x, p.y - e.y) : 0;
  Object.assign(e, opts);

  const col = opts.color || e.accent || "#ff3b5c";
  const r = opts.ringR || 60;
  game.particles.ring(e.x, e.y, col, r, windup);
  game.audio.bossTelegraph();

  if (opts.preview === "line") {
    game.hazards.push({
      type: "line_preview",
      x: e.x, y: e.y,
      ang: e._aimAng,
      len: opts.len || 300,
      width: opts.width || 20,
      life: windup, maxLife: windup,
      color: opts.previewColor || "rgba(200,184,160,0.5)",
    });
  }
  if (opts.preview === "ring") {
    game.hazards.push({
      type: "ring_preview",
      x: opts.hx ?? e.x, y: opts.hy ?? e.y,
      r: opts.ringR || 100,
      life: windup, maxLife: windup,
      color: opts.previewColor || "rgba(255,106,32,0.4)",
    });
  }
  if (opts.preview === "expand") {
    game.hazards.push({
      type: "expand_preview",
      x: e.x, y: e.y,
      r0: 30, r1: opts.ringR || 160,
      life: windup, maxLife: windup,
      color: opts.previewColor || "rgba(255,90,31,0.45)",
    });
  }
}

// ═══════════════════════════════════════════
// SENHOR — chase clássico (Mundo 1, intacto)
// ═══════════════════════════════════════════
function updateSenhor(game, e, dt) {
  const p = game.player;
  e.bossAtkCd = (e.bossAtkCd ?? 1.5) - dt;
  const d = norm(p.x - e.x, p.y - e.y);
  e.x += d.x * e.moveSpeed * (1 + e.bossPhase * 0.18) * dt;
  e.y += d.y * e.moveSpeed * (1 + e.bossPhase * 0.18) * dt;
  if (e.bossAtkCd > 0) return;
  const roll = Math.random();
  let atk = "slam";
  if (e.bossPhase >= 1 && roll < 0.42) atk = "ring";
  if (e.bossPhase >= 2 && roll < 0.55) atk = "charge";
  telegraph(game, e, atk, atk === "charge" ? 0.5 : atk === "ring" ? 0.85 : 0.7, {
    ringR: atk === "ring" ? 150 : atk === "slam" ? 95 : 55,
    color: atk === "ring" ? "#b44dff" : "#ff3b5c",
  });
  e.bossAtkCd = 2.0 - e.bossPhase * 0.35;
}

// ═══════════════════════════════════════════
// MÃE — FÁBRICA (quase parada, ovos = ameaça)
// ═══════════════════════════════════════════
function updateMother(game, e, dt) {
  const p = game.player;
  e.bossAtkCd = (e.bossAtkCd ?? 1.2) - dt;

  // Move POUCO: orbita o centro / se afasta se o player cola
  const cx = game.arena.x + game.arena.w / 2;
  const cy = game.arena.y + game.arena.h * 0.38;
  const toHome = norm(cx - e.x, cy - e.y);
  const toP = norm(p.x - e.x, p.y - e.y);
  const dP = dist(e, p);
  if (dP < 90) {
    e.x -= toP.x * e.moveSpeed * 1.4 * dt;
    e.y -= toP.y * e.moveSpeed * 1.4 * dt;
  } else {
    e.x += toHome.x * e.moveSpeed * 0.55 * dt;
    e.y += toHome.y * e.moveSpeed * 0.55 * dt;
    // deriva lateral lenta
    e.x += -toP.y * e.moveSpeed * 0.25 * Math.sin(e.pulse * 0.4) * dt;
  }
  clampBoss(game, e);

  // Cura se ninhada (ovos + imps) estiver grande — PRESSÃO DE PRIORIDADE
  e._healTick = (e._healTick || 0) - dt;
  if (e._healTick <= 0) {
    e._healTick = 1.0;
    const brood = countBrood(game, e);
    if (brood >= 3) {
      const heal = Math.round(e.maxHp * (0.008 + brood * 0.003));
      e.hp = Math.min(e.maxHp, e.hp + heal);
      game.particles.burst(e.x, e.y - e.radius, {
        count: 5, color: "#ff8a40", speed: 50, life: 0.35, size: 2.5, gravity: -40,
      });
      if (brood >= 5) game.ui.toast("A NINHADA A ALIMENTA");
    }
  }

  if (e.bossAtkCd > 0) return;

  // Kit: lay_eggs (principal) | erupt (anel expansivo) | spit (secundário)
  const roll = Math.random();
  let atk = "lay_eggs";
  if (e.bossPhase === 0) {
    atk = roll < 0.7 ? "lay_eggs" : "spit";
  } else if (e.bossPhase === 1) {
    atk = roll < 0.45 ? "lay_eggs" : roll < 0.75 ? "erupt" : "spit";
  } else {
    atk = roll < 0.4 ? "lay_eggs" : roll < 0.75 ? "erupt" : "spit";
  }

  if (atk === "lay_eggs") {
    telegraph(game, e, atk, 0.85, {
      ringR: 70, color: "#ff6a20", preview: "ring",
      previewColor: "rgba(255,106,32,0.35)",
    });
    e.bossAtkCd = 2.4 - e.bossPhase * 0.25;
  } else if (atk === "erupt") {
    telegraph(game, e, atk, 1.05, {
      ringR: 170, color: "#ff3b1f", preview: "expand",
      previewColor: "rgba(255,60,20,0.4)",
    });
    e.bossAtkCd = 3.0 - e.bossPhase * 0.3;
  } else {
    telegraph(game, e, atk, 0.55, { ringR: 40, color: "#ff8a30" });
    e.bossAtkCd = 1.9;
  }
}

function countBrood(game, e) {
  let n = 0;
  for (const o of game.enemies) {
    if (o.dead || o === e) continue;
    if (o.kind === "egg" || o.kind === "fodder") n++;
  }
  return n;
}

// ═══════════════════════════════════════════
// CARCEREIRO — ESPAÇO (correntes, gancho)
// ═══════════════════════════════════════════
function updateJailer(game, e, dt) {
  const p = game.player;
  e.bossAtkCd = (e.bossAtkCd ?? 1.4) - dt;

  // Anda LENTO; não chase agressivo
  const dP = dist(e, p);
  if (dP > 140) {
    const d = norm(p.x - e.x, p.y - e.y);
    e.x += d.x * e.moveSpeed * 0.7 * dt;
    e.y += d.y * e.moveSpeed * 0.7 * dt;
  } else if (dP < 70) {
    const d = norm(p.x - e.x, p.y - e.y);
    e.x -= d.x * e.moveSpeed * 0.5 * dt;
    e.y -= d.y * e.moveSpeed * 0.5 * dt;
  }
  clampBoss(game, e);

  if (e.bossAtkCd > 0) return;

  const roll = Math.random();
  let atk = "chain_floor";
  if (e.bossPhase === 0) {
    atk = roll < 0.55 ? "chain_floor" : roll < 0.85 ? "whip" : "stomp";
  } else if (e.bossPhase === 1) {
    atk = roll < 0.35 ? "chain_floor" : roll < 0.7 ? "hook" : "whip";
  } else {
    atk = roll < 0.3 ? "prison" : roll < 0.6 ? "hook" : roll < 0.85 ? "chain_floor" : "whip";
  }

  if (atk === "chain_floor") {
    telegraph(game, e, atk, 0.7, {
      ringR: 50, color: "#c8b8a0",
    });
    e.bossAtkCd = 2.2 - e.bossPhase * 0.2;
  } else if (atk === "whip") {
    telegraph(game, e, atk, 0.6, {
      preview: "line", len: 340, width: 22, color: "#e8dcc8",
    });
    e.bossAtkCd = 2.0;
  } else if (atk === "hook") {
    telegraph(game, e, atk, 0.5, {
      preview: "line", len: 300, width: 18, color: "#f0e6d0",
      previewColor: "rgba(240,200,120,0.55)",
    });
    e.bossAtkCd = 2.5;
  } else if (atk === "stomp") {
    telegraph(game, e, atk, 0.65, { ringR: 100, color: "#a09080" });
    e.bossAtkCd = 2.3;
  } else if (atk === "prison") {
    telegraph(game, e, atk, 1.0, {
      preview: "ring", ringR: 120, color: "#c8b8a0",
      previewColor: "rgba(200,184,160,0.5)",
    });
    e.bossAtkCd = 3.4;
  }
}

// ═══════════════════════════════════════════
// ECO — ILUSÃO (blink, decoys, afterimages)
// ═══════════════════════════════════════════
function updateEcho(game, e, dt) {
  const p = game.player;
  e.bossAtkCd = (e.bossAtkCd ?? 1.0) - dt;

  // Strafe rápido, NÃO tank chase
  const d = norm(p.x - e.x, p.y - e.y);
  const side = Math.sin(e.pulse * 1.2) * 0.9;
  const prefer = 150;
  const dP = dist(e, p);
  if (dP > prefer + 30) {
    e.x += (d.x + -d.y * side) * e.moveSpeed * dt;
    e.y += (d.y + d.x * side) * e.moveSpeed * dt;
  } else if (dP < prefer - 40) {
    e.x -= d.x * e.moveSpeed * 1.1 * dt;
    e.y -= d.y * e.moveSpeed * 1.1 * dt;
  } else {
    e.x += -d.y * e.moveSpeed * 1.15 * dt;
    e.y += d.x * e.moveSpeed * 1.15 * dt;
  }
  clampBoss(game, e);

  if (e.bossAtkCd > 0) return;

  const roll = Math.random();
  let atk = "blink";
  if (e.bossPhase === 0) {
    atk = roll < 0.55 ? "blink" : "afterimage";
  } else if (e.bossPhase === 1) {
    atk = roll < 0.35 ? "blink" : roll < 0.7 ? "decoys" : "afterimage";
  } else {
    atk = roll < 0.3 ? "blink" : roll < 0.55 ? "decoys" : roll < 0.8 ? "afterimage" : "split_burst";
  }

  if (atk === "blink") {
    // mirar ponto perto do player
    const a = Math.random() * Math.PI * 2;
    e._blinkX = clamp(p.x + Math.cos(a) * 70, game.arena.x + 50, game.arena.x + game.arena.w - 50);
    e._blinkY = clamp(p.y + Math.sin(a) * 70, game.arena.y + 50, game.arena.y + game.arena.h - 50);
    telegraph(game, e, atk, 0.45, {
      ringR: 40, color: "#b44dff",
      hx: e._blinkX, hy: e._blinkY, preview: "ring",
      previewColor: "rgba(180,77,255,0.5)",
    });
    // preview no destino
    game.hazards.push({
      type: "ring_preview",
      x: e._blinkX, y: e._blinkY,
      r: 45, life: 0.45, maxLife: 0.45,
      color: "rgba(180,77,255,0.55)",
    });
    e.bossAtkCd = 1.8 - e.bossPhase * 0.15;
  } else if (atk === "afterimage") {
    telegraph(game, e, atk, 0.35, { ringR: 35, color: "#9b8cff" });
    e.bossAtkCd = 1.6;
  } else if (atk === "decoys") {
    telegraph(game, e, atk, 0.7, { ringR: 55, color: "#c4a0ff" });
    e.bossAtkCd = 2.8;
  } else {
    telegraph(game, e, atk, 0.8, {
      preview: "expand", ringR: 140, color: "#b44dff",
      previewColor: "rgba(180,77,255,0.4)",
    });
    e.bossAtkCd = 2.6;
  }
}

function clampBoss(game, e) {
  const a = game.arena;
  e.x = clamp(e.x, a.x + e.radius, a.x + a.w - e.radius);
  e.y = clamp(e.y, a.y + e.radius, a.y + a.h - e.radius);
}

// ═══════════════════════════════════════════
// EXECUTE
// ═══════════════════════════════════════════
function execute(game, e, atk) {
  const p = game.player;
  if (!p || p.dead) return;

  // ── Senhor ──
  if (atk === "slam" || atk === "stomp") {
    game.shake.add(8, 0.25);
    game.audio.bossHit();
    game.particles.burst(e.x, e.y, { count: 20, color: e.accent, speed: 250, life: 0.4, size: 4 });
    if (dist(e, p) < (atk === "stomp" ? 100 : 95)) {
      game._hurtPlayer(e.damage * 1.3, ang(p.x - e.x, p.y - e.y));
    }
    return;
  }
  if (atk === "ring") {
    game.shake.add(6, 0.3);
    game.audio.bossHit();
    radialShots(game, e, 10 + e.bossPhase * 2, 180, e.accent, 0.55);
    return;
  }
  if (atk === "charge") {
    const dir = norm(p.x - e.x, p.y - e.y);
    e.x += dir.x * 140;
    e.y += dir.y * 140;
    clampBoss(game, e);
    game.audio.dash();
    game.shake.add(7, 0.2);
    if (dist(e, p) < e.radius + p.radius + 30) {
      game._hurtPlayer(e.damage * 1.1, ang(p.x - e.x, p.y - e.y));
    }
    return;
  }

  // ── Mãe ──
  if (atk === "lay_eggs") {
    const n = e.bossPhase >= 2 ? 4 : e.bossPhase >= 1 ? 3 : 2;
    game.audio.bossHit();
    game.ui.toast("OVOS");
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const d = 70 + Math.random() * 90;
      const ex = clamp(e.x + Math.cos(a) * d, game.arena.x + 40, game.arena.x + game.arena.w - 40);
      const ey = clamp(e.y + Math.sin(a) * d, game.arena.y + 40, game.arena.y + game.arena.h - 40);
      game._spawnEnemyAt("ember_egg", ex, ey, false);
      game.particles.ring(ex, ey, "#ff6a20", 22, 0.35);
    }
    return;
  }
  if (atk === "erupt") {
    // Anel expansivo: 3 pulsos de dano em raios crescentes
    game.shake.add(10, 0.35);
    game.audio.bossHit();
    game.ui.toast("ERUPÇÃO");
    for (let wave = 0; wave < 3; wave++) {
      game.hazards.push({
        type: "erupt_wave",
        x: e.x, y: e.y,
        r: 40 + wave * 55,
        life: 0.22 + wave * 0.18,
        maxLife: 0.22 + wave * 0.18,
        damage: Math.round(e.damage * (0.7 + wave * 0.15)),
        hit: false,
        color: "#ff5a1f",
      });
    }
    game.particles.ring(e.x, e.y, "#ff6a20", 160, 0.5);
    return;
  }
  if (atk === "spit") {
    const base = e._aimAng ?? ang(p.x - e.x, p.y - e.y);
    for (let i = -1; i <= 1; i++) {
      const a = base + i * 0.2;
      game.projectiles.push({
        x: e.x + Math.cos(a) * 28, y: e.y + Math.sin(a) * 28,
        vx: Math.cos(a) * 250, vy: Math.sin(a) * 250,
        damage: Math.round(e.damage * 0.65),
        radius: 8, life: 2.0,
        color: "#ff6a20", fromEnemy: true,
      });
    }
    if (typeof game.audio.castFire === "function") game.audio.castFire(false);
    else game.audio.bossHit();
    return;
  }

  // ── Carcereiro ──
  if (atk === "chain_floor") {
    // 2–3 segmentos de corrente no chão (persistentes)
    const n = e.bossPhase >= 2 ? 3 : 2;
    game.audio.dash();
    game.ui.toast("CORRENTES");
    for (let i = 0; i < n; i++) {
      const a = e._aimAng + (i - (n - 1) / 2) * 0.55 + (Math.random() - 0.5) * 0.2;
      const len = 220 + Math.random() * 80;
      game.hazards.push({
        type: "chain",
        x: e.x, y: e.y,
        ang: a, len,
        width: 16,
        life: 4.5 + e.bossPhase * 0.8,
        maxLife: 4.5 + e.bossPhase * 0.8,
        damage: Math.round(e.damage * 0.4),
        tick: 0.3, cd: 0,
        color: "#c8b8a0",
      });
    }
    return;
  }
  if (atk === "whip") {
    game.shake.add(5, 0.15);
    game.audio.dash();
    game.hazards.push({
      type: "line_hit",
      x: e.x, y: e.y,
      ang: e._aimAng, len: 340, width: 24,
      life: 0.16, maxLife: 0.16,
      damage: Math.round(e.damage * 1.2),
      hit: false, color: "#e8dcc8",
    });
    return;
  }
  if (atk === "hook") {
    const a0 = e._aimAng;
    const dir = { x: Math.cos(a0), y: Math.sin(a0) };
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const along = dx * dir.x + dy * dir.y;
    const perp = Math.abs(dx * -dir.y + dy * dir.x);
    game.audio.dash();
    game.particles.burst(e.x + dir.x * 50, e.y + dir.y * 50, {
      count: 12, color: "#f0c14b", speed: 160, life: 0.25, size: 2.5, angle: a0, spread: 0.25,
    });
    // linha visual do gancho
    game.hazards.push({
      type: "line_hit",
      x: e.x, y: e.y, ang: a0, len: 300, width: 14,
      life: 0.12, maxLife: 0.12, damage: 0, hit: true, color: "#f0c14b",
    });
    if (along > 20 && along < 300 && perp < 32) {
      const pull = Math.min(130, along * 0.6);
      p.x -= dir.x * pull;
      p.y -= dir.y * pull;
      p.x = clamp(p.x, game.arena.x + p.radius, game.arena.x + game.arena.w - p.radius);
      p.y = clamp(p.y, game.arena.y + p.radius, game.arena.y + game.arena.h - p.radius);
      game._hurtPlayer(Math.round(e.damage * 0.8), a0);
      game.ui.toast("GANCHO!");
      game.shake.add(7, 0.2);
    }
    return;
  }
  if (atk === "prison") {
    game.shake.add(9, 0.3);
    game.audio.bossHit();
    game.ui.toast("PRISÃO");
    game.hazards.push({
      type: "prison",
      x: e.x, y: e.y,
      r: 115,
      life: 3.6, maxLife: 3.6,
      damage: Math.round(e.damage * 0.5),
      tick: 0.4, cd: 0.15,
      color: "#c8b8a0",
    });
    return;
  }

  // ── Eco ──
  if (atk === "blink") {
    // afterimage explode onde ESTAVA
    game.hazards.push({
      type: "afterimage_bomb",
      x: e.x, y: e.y,
      r: 55,
      life: 0.55, maxLife: 0.55,
      damage: Math.round(e.damage * 0.9),
      hit: false,
      color: "#b44dff",
    });
    game.particles.burst(e.x, e.y, {
      count: 14, color: "#b44dff", speed: 140, life: 0.3, size: 3,
    });
    e.x = e._blinkX ?? e.x;
    e.y = e._blinkY ?? e.y;
    clampBoss(game, e);
    e.invulnFlash = 0.25;
    game.audio.dash();
    game.particles.ring(e.x, e.y, "#c4a0ff", 40, 0.3);
    // dano se pisou no destino
    if (dist(e, p) < e.radius + p.radius + 20) {
      game._hurtPlayer(Math.round(e.damage * 0.7), ang(p.x - e.x, p.y - e.y));
    }
    return;
  }
  if (atk === "afterimage") {
    // deixa 2 bombas no caminho do player
    game.ui.toast("ECO");
    for (let i = 0; i < 2; i++) {
      const t = 0.35 + i * 0.25;
      const ax = e.x + (p.x - e.x) * t + (Math.random() - 0.5) * 40;
      const ay = e.y + (p.y - e.y) * t + (Math.random() - 0.5) * 40;
      game.hazards.push({
        type: "afterimage_bomb",
        x: ax, y: ay,
        r: 48,
        life: 0.85 + i * 0.15,
        maxLife: 0.85 + i * 0.15,
        damage: Math.round(e.damage * 0.75),
        hit: false,
        color: "#9b8cff",
      });
      game.particles.ring(ax, ay, "#9b8cff", 30, 0.4);
    }
    game.audio.bossTelegraph();
    return;
  }
  if (atk === "decoys") {
    game.ui.toast("FALSOS ECOS");
    game.audio.bossPhase();
    const n = e.bossPhase >= 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const d = 100 + Math.random() * 40;
      const dx = clamp(e.x + Math.cos(a) * d, game.arena.x + 40, game.arena.x + game.arena.w - 40);
      const dy = clamp(e.y + Math.sin(a) * d, game.arena.y + 40, game.arena.y + game.arena.h - 40);
      game._spawnEnemyAt("echo_decoy", dx, dy, false);
    }
    // o real pisca para outro lugar
    const a = Math.random() * Math.PI * 2;
    e.x = clamp(p.x + Math.cos(a) * 120, game.arena.x + 50, game.arena.x + game.arena.w - 50);
    e.y = clamp(p.y + Math.sin(a) * 120, game.arena.y + 50, game.arena.y + game.arena.h - 50);
    game.particles.ring(e.x, e.y, "#b44dff", 50, 0.35);
    return;
  }
  if (atk === "split_burst") {
    game.shake.add(8, 0.28);
    game.audio.bossHit();
    radialShots(game, e, 12, 200, "#b44dff", 0.5);
    // decoys no anel
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      game._spawnEnemyAt(
        "echo_decoy",
        e.x + Math.cos(a) * 90,
        e.y + Math.sin(a) * 90,
        false,
      );
    }
  }
}

function radialShots(game, e, n, spd, color, dmgMult) {
  game.particles.ring(e.x, e.y, color, 140, 0.35);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    game.projectiles.push({
      x: e.x, y: e.y,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      damage: Math.round(e.damage * dmgMult),
      radius: 7, life: 2.4,
      color, fromEnemy: true,
    });
  }
}

// ═══════════════════════════════════════════
// HAZARDS + EGGS (chamado pelo game)
// ═══════════════════════════════════════════
export function updateHazards(game, dt) {
  const p = game.player;
  if (!game.hazards) return;

  for (let i = game.hazards.length - 1; i >= 0; i--) {
    const h = game.hazards[i];
    h.life -= dt;
    if (h.life <= 0) {
      // afterimage explode no fim
      if (h.type === "afterimage_bomb" && !h.hit && p && !p.dead) {
        explodeAt(game, h, p);
      }
      game.hazards.splice(i, 1);
      continue;
    }

    if (!p || p.dead) continue;

    if (h.type === "ember") {
      h.cd = (h.cd || 0) - dt;
      if (h.cd <= 0 && dist(p, h) < h.r + p.radius) {
        h.cd = h.tick || 0.35;
        game._hurtPlayer(h.damage, ang(p.x - h.x, p.y - h.y));
      }
    } else if (h.type === "chain") {
      // corrente no chão: dano se pisar na linha
      h.cd = (h.cd || 0) - dt;
      if (h.cd <= 0 && pointNearSegment(p.x, p.y, h.x, h.y, h.ang, h.len, h.width)) {
        h.cd = h.tick || 0.3;
        game._hurtPlayer(h.damage, h.ang);
        game.particles.burst(p.x, p.y, {
          count: 3, color: "#c8b8a0", speed: 40, life: 0.15, size: 2,
        });
      }
    } else if (h.type === "prison") {
      const d = dist(p, h);
      if (d > h.r - 6 && d < h.r + 50) {
        const dir = norm(h.x - p.x, h.y - p.y);
        if (d > h.r - 2) {
          p.x += dir.x * 140 * dt;
          p.y += dir.y * 140 * dt;
        }
      }
      h.cd = (h.cd || 0) - dt;
      if (h.cd <= 0 && d < h.r) {
        const boss = game.bossRef;
        if (boss && !boss.dead && dist(p, boss) < 95) {
          h.cd = h.tick || 0.4;
          game._hurtPlayer(h.damage, ang(p.x - boss.x, p.y - boss.y));
        }
      }
    } else if (h.type === "line_hit" && !h.hit) {
      if (pointNearSegment(p.x, p.y, h.x, h.y, h.ang, h.len, h.width)) {
        h.hit = true;
        if (h.damage > 0) {
          game._hurtPlayer(h.damage, h.ang);
          game.shake.add(4, 0.12);
        }
      }
    } else if (h.type === "erupt_wave" && !h.hit) {
      // anel fino: dano se player está na “borda” do raio
      const d = dist(p, h);
      if (Math.abs(d - h.r) < 22 + p.radius) {
        h.hit = true;
        game._hurtPlayer(h.damage, ang(p.x - h.x, p.y - h.y));
        game.shake.add(5, 0.12);
      }
    } else if (h.type === "afterimage_bomb") {
      // telegrapha e explode no final (handled on life<=0) ou se player colar cedo
      if (!h.hit && dist(p, h) < h.r * 0.35) {
        // ainda não explode cedo — só visual
      }
    } else if (h.type === "delayed_ring" && !h.fired && h.life < 0.08) {
      h.fired = true;
      radialShots(game, { x: h.x, y: h.y, damage: h.damage / 0.5, accent: "#b44dff" }, 10, 170, "#c4a0ff", 0.5);
    }
  }
}

function explodeAt(game, h, p) {
  h.hit = true;
  game.particles.burst(h.x, h.y, {
    count: 18, color: h.color || "#b44dff", speed: 200, life: 0.35, size: 3.5,
  });
  game.particles.ring(h.x, h.y, h.color || "#b44dff", h.r, 0.3);
  game.shake.add(5, 0.15);
  game.audio.bossHit();
  if (dist(p, h) < h.r + p.radius) {
    game._hurtPlayer(h.damage, ang(p.x - h.x, p.y - h.y));
  }
}

function pointNearSegment(px, py, x, y, ang0, len, width) {
  const dirx = Math.cos(ang0);
  const diry = Math.sin(ang0);
  const dx = px - x;
  const dy = py - y;
  const along = dx * dirx + dy * diry;
  if (along < 0 || along > len) return false;
  const perp = Math.abs(dx * -diry + dy * dirx);
  return perp < width;
}

export function drawHazards(game, ctx) {
  if (!game.hazards?.length) return;
  const tnow = game.time || 0;

  for (const h of game.hazards) {
    const t = h.maxLife ? 1 - h.life / h.maxLife : 0;
    ctx.save();

    if (h.type === "chain") {
      const x2 = h.x + Math.cos(h.ang) * h.len;
      const y2 = h.y + Math.sin(h.ang) * h.len;
      ctx.strokeStyle = "rgba(40,30,28,0.85)";
      ctx.lineWidth = h.width + 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(200,184,160,${0.55 + Math.sin(tnow * 8) * 0.1})`;
      ctx.lineWidth = h.width;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      // elos
      ctx.fillStyle = "#a89880";
      const steps = Math.floor(h.len / 28);
      for (let s = 1; s < steps; s++) {
        const lx = h.x + Math.cos(h.ang) * (s * 28);
        const ly = h.y + Math.sin(h.ang) * (s * 28);
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (h.type === "ember") {
      const pulse = 1 + Math.sin(tnow * 6 + h.x) * 0.06;
      const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.r * pulse);
      g.addColorStop(0, "rgba(255,120,40,0.45)");
      g.addColorStop(0.6, "rgba(200,40,20,0.22)");
      g.addColorStop(1, "rgba(100,10,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    } else if (h.type === "prison" || h.type === "ring_preview") {
      ctx.strokeStyle = h.type === "prison" ? "rgba(200,184,160,0.8)" : (h.color || "rgba(255,255,255,0.4)");
      ctx.lineWidth = h.type === "prison" ? 3.5 : 2;
      ctx.setLineDash(h.type === "prison" ? [] : [6, 5]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r || 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (h.type === "prison") {
        ctx.fillStyle = "rgba(30,25,30,0.15)";
        ctx.fill();
      }
    } else if (h.type === "line_preview" || h.type === "line_hit") {
      ctx.strokeStyle = h.type === "line_hit"
        ? "rgba(232,220,200,0.9)"
        : (h.color || "rgba(200,184,160,0.45)");
      ctx.lineWidth = h.width || 20;
      ctx.lineCap = "round";
      ctx.globalAlpha = h.type === "line_hit" ? 0.9 : 0.45 + t * 0.35;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.x + Math.cos(h.ang) * h.len, h.y + Math.sin(h.ang) * h.len);
      ctx.stroke();
    } else if (h.type === "expand_preview") {
      const r = h.r0 + (h.r1 - h.r0) * t;
      ctx.strokeStyle = h.color || "rgba(255,90,31,0.5)";
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (h.type === "erupt_wave") {
      ctx.strokeStyle = `rgba(255,90,31,${0.85 - t * 0.5})`;
      ctx.lineWidth = 8;
      ctx.shadowColor = "#ff5a1f";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (h.type === "afterimage_bomb") {
      const pulse = 0.5 + t * 0.5;
      ctx.globalAlpha = 0.35 + t * 0.5;
      ctx.fillStyle = h.color || "#b44dff";
      ctx.beginPath();
      ctx.arc(h.x, h.y, 16 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = h.color || "#b44dff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * (0.4 + t * 0.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (h.type === "cone_preview") {
      ctx.fillStyle = h.color || "rgba(255,106,32,0.3)";
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.arc(h.x, h.y, h.range, h.ang - h.halfArc, h.ang + h.halfArc);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
