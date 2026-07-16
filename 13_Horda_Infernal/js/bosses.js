/**
 * AI e execução de ataques dos chefões.
 * game.js despacha; este módulo especializa por bossId.
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
  // fases por HP (compartilhado)
  const hpPct = e.hp / e.maxHp;
  e.bossPhase = hpPct < 0.33 ? 2 : hpPct < 0.66 ? 1 : 0;
  announcePhase(game, e);

  if (e.bossWindup > 0) {
    e.bossWindup -= dt;
    if (Math.random() < 0.18) {
      game.particles.embers?.(
        e.x + (Math.random() - 0.5) * 40,
        e.y + (Math.random() - 0.5) * 40,
        1,
      ) || game.particles.burst(e.x, e.y, {
        count: 1, color: e.accent, speed: 30, life: 0.15, size: 2,
      });
    }
    if (e.bossWindup <= 0 && e.bossTelegraph) {
      executeBoss(game, e, e.bossTelegraph);
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
    game.ui.showBanner(phaseBanner(e, 1));
    game.audio.bossPhase();
    game.particles.ring(e.x, e.y, e.accent || "#ffb347", 100, 0.5);
    game._addFlash(0.3);
  } else if (e.bossPhase === 2) {
    game.ui.showBanner(phaseBanner(e, 2));
    game.audio.bossPhase();
    game.audio.furyActivate();
    game.particles.furyBurst(e.x, e.y);
    game._addFlash(0.4);
    game.shake.add(8, 0.3);
  }
}

function phaseBanner(e, phase) {
  const id = e.bossId || "senhor";
  if (phase === 1) {
    if (id === "mother") return "NINHO ABERTO";
    if (id === "jailer") return "CORRENTES";
    if (id === "echo") return "ECO II";
    return "FASE II";
  }
  if (id === "mother") return "PARTO EM CHAMAS";
  if (id === "jailer") return "PRISÃO TOTAL";
  if (id === "echo") return "O PORTAL GRITA";
  return "FÚRIA DO TRONO";
}

// ─── Senhor da Horda (original) ───
function updateSenhor(game, e, dt) {
  const p = game.player;
  e.bossAtkCd -= dt;
  const d = norm(p.x - e.x, p.y - e.y);
  e.x += d.x * e.moveSpeed * (1 + e.bossPhase * 0.18) * dt;
  e.y += d.y * e.moveSpeed * (1 + e.bossPhase * 0.18) * dt;

  if (e.bossAtkCd > 0) return;
  const roll = Math.random();
  let atk = "slam";
  if (e.bossPhase >= 1 && roll < 0.42) atk = "ring";
  if (e.bossPhase >= 2 && roll < 0.58) atk = "charge";
  if (e.bossPhase >= 2 && roll > 0.75) atk = "slam";
  startTelegraph(game, e, atk, atk === "charge" ? 0.5 : atk === "ring" ? 0.85 : 0.7);
  e.bossAtkCd = 2.0 - e.bossPhase * 0.35;
}

// ─── Mãe das Brasas ───
function updateMother(game, e, dt) {
  const p = game.player;
  e.bossAtkCd -= dt;
  // lenta, orbita um pouco
  const d = norm(p.x - e.x, p.y - e.y);
  const side = Math.sin(e.pulse * 0.5) * 0.35;
  const spd = e.moveSpeed * (1 + e.bossPhase * 0.12);
  e.x += (d.x * 0.7 + -d.y * side) * spd * dt;
  e.y += (d.y * 0.7 + d.x * side) * spd * dt;

  // cura leve se muitos adds vivos (fase 2+)
  if (e.bossPhase >= 2) {
    e._healTick = (e._healTick || 0) - dt;
    if (e._healTick <= 0) {
      e._healTick = 1.2;
      const adds = game.enemies.filter((o) => !o.dead && o !== e && o.kind !== "boss").length;
      if (adds >= 3) {
        const heal = Math.round(e.maxHp * 0.012 * Math.min(6, adds));
        e.hp = Math.min(e.maxHp, e.hp + heal);
        game.particles.burst(e.x, e.y, {
          count: 6, color: "#ff6a20", speed: 60, life: 0.3, size: 2, gravity: -30,
        });
      }
    }
  }

  if (e.bossAtkCd > 0) return;
  const roll = Math.random();
  let atk = "spit";
  if (e.bossPhase >= 0 && roll < 0.4) atk = "spawn";
  if (e.bossPhase >= 1 && roll < 0.55) atk = "embrace";
  if (e.bossPhase >= 1 && roll > 0.7) atk = "nest";
  if (e.bossPhase >= 2 && roll < 0.35) atk = "spawn";
  startTelegraph(game, e, atk, atk === "embrace" ? 0.75 : atk === "nest" ? 0.9 : 0.55);
  e.bossAtkCd = 1.85 - e.bossPhase * 0.28;
}

// ─── Carcereiro ───
function updateJailer(game, e, dt) {
  const p = game.player;
  e.bossAtkCd -= dt;
  const d = norm(p.x - e.x, p.y - e.y);
  e.x += d.x * e.moveSpeed * (1 + e.bossPhase * 0.1) * dt;
  e.y += d.y * e.moveSpeed * (1 + e.bossPhase * 0.1) * dt;

  if (e.bossAtkCd > 0) return;
  const roll = Math.random();
  let atk = "whip";
  if (roll < 0.35) atk = "stomp";
  if (e.bossPhase >= 1 && roll < 0.5) atk = "hook";
  if (e.bossPhase >= 2 && roll < 0.4) atk = "prison";
  if (e.bossPhase >= 2 && roll > 0.75) atk = "whip";
  startTelegraph(
    game, e, atk,
    atk === "prison" ? 1.0 : atk === "hook" ? 0.55 : atk === "whip" ? 0.65 : 0.7,
  );
  e.bossAtkCd = 1.95 - e.bossPhase * 0.3;
}

// ─── Eco do Portal ───
function updateEcho(game, e, dt) {
  const p = game.player;
  e.bossAtkCd -= dt;
  const d = norm(p.x - e.x, p.y - e.y);
  // gravidade leve no player (fase 1+)
  if (e.bossPhase >= 1 && p && !p.dead) {
    const pull = 28 + e.bossPhase * 18;
    const pd = norm(e.x - p.x, e.y - p.y);
    p.x += pd.x * pull * dt;
    p.y += pd.y * pull * dt;
  }
  e.x += d.x * e.moveSpeed * (1 + e.bossPhase * 0.15) * dt;
  e.y += d.y * e.moveSpeed * (1 + e.bossPhase * 0.15) * dt;

  if (e.bossAtkCd > 0) return;
  const roll = Math.random();
  let atk = "slam";
  if (e.bossPhase === 0) {
    atk = roll < 0.45 ? "ring" : "slam";
  } else if (e.bossPhase === 1) {
    atk = roll < 0.4 ? "nest" : roll < 0.7 ? "spawn" : "spit";
  } else {
    atk = roll < 0.3 ? "ring" : roll < 0.55 ? "prison" : roll < 0.8 ? "ghost" : "charge";
  }
  startTelegraph(
    game, e, atk,
    atk === "ghost" ? 0.4 : atk === "prison" ? 0.9 : atk === "charge" ? 0.45 : 0.7,
  );
  e.bossAtkCd = 1.7 - e.bossPhase * 0.25;
}

function startTelegraph(game, e, atk, windup) {
  e.bossTelegraph = atk;
  e.bossWindup = windup;
  // guarda aim para whip/hook
  const p = game.player;
  e._aimX = p.x;
  e._aimY = p.y;
  e._aimAng = ang(p.x - e.x, p.y - e.y);

  const col =
    atk === "ring" || atk === "ghost" ? "#b44dff"
      : atk === "nest" || atk === "spit" || atk === "embrace" ? "#ff6a20"
        : atk === "whip" || atk === "hook" || atk === "prison" ? "#c8b8a0"
          : e.accent || "#ff3b5c";

  const r =
    atk === "ring" ? 150
      : atk === "slam" || atk === "stomp" ? 95
        : atk === "embrace" ? 110
          : atk === "prison" ? 120
            : atk === "nest" ? 70
              : 55;
  game.particles.ring(e.x, e.y, col, r, windup);
  game.audio.bossTelegraph();

  // hazard preview para linha / cone
  if (atk === "whip" || atk === "hook") {
    game.hazards.push({
      type: "line_preview",
      x: e.x,
      y: e.y,
      ang: e._aimAng,
      len: atk === "hook" ? 280 : 320,
      width: atk === "hook" ? 18 : 22,
      life: windup,
      maxLife: windup,
      color: "rgba(200,184,160,0.45)",
    });
  }
  if (atk === "embrace") {
    game.hazards.push({
      type: "cone_preview",
      x: e.x,
      y: e.y,
      ang: e._aimAng,
      range: 130,
      halfArc: 0.7,
      life: windup,
      maxLife: windup,
      color: "rgba(255,106,32,0.35)",
    });
  }
  if (atk === "prison") {
    game.hazards.push({
      type: "ring_preview",
      x: e.x,
      y: e.y,
      r: 130,
      life: windup,
      maxLife: windup,
      color: "rgba(200,184,160,0.4)",
    });
  }
}

export function executeBoss(game, e, atk) {
  const p = game.player;
  const id = e.bossId || "senhor";

  if (atk === "slam" || atk === "stomp") {
    game.shake.add(8, 0.25);
    game.audio.bossHit();
    game.particles.burst(e.x, e.y, {
      count: 20, color: e.accent, speed: 260, life: 0.4, size: 4,
    });
    const rad = atk === "stomp" ? 100 : 95;
    if (dist(e, p) < rad) {
      game._hurtPlayer(e.damage * 1.3, ang(p.x - e.x, p.y - e.y));
    }
  } else if (atk === "ring") {
    game.shake.add(6, 0.3);
    game.audio.bossHit();
    game.particles.ring(e.x, e.y, e.accent, 160, 0.4);
    const n = 10 + e.bossPhase * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      game.projectiles.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * 180, vy: Math.sin(a) * 180,
        damage: Math.round(e.damage * 0.55),
        radius: 7, life: 2.5,
        color: e.accent, fromEnemy: true,
      });
    }
  } else if (atk === "charge") {
    const dir = norm(p.x - e.x, p.y - e.y);
    e.x += dir.x * 140;
    e.y += dir.y * 140;
    e.x = clamp(e.x, game.arena.x + e.radius, game.arena.x + game.arena.w - e.radius);
    e.y = clamp(e.y, game.arena.y + e.radius, game.arena.y + game.arena.h - e.radius);
    game.particles.burst(e.x, e.y, {
      count: 14, color: e.accent, speed: 200, life: 0.3, size: 3,
    });
    game.shake.add(7, 0.2);
    game.audio.dash();
    if (dist(e, p) < e.radius + p.radius + 30) {
      game._hurtPlayer(e.damage * 1.1, ang(p.x - e.x, p.y - e.y));
    }
  } else if (atk === "spit") {
    // 3 bolas de magma
    const base = e._aimAng ?? ang(p.x - e.x, p.y - e.y);
    for (let i = -1; i <= 1; i++) {
      const a = base + i * 0.18;
      game.projectiles.push({
        x: e.x + Math.cos(a) * 30,
        y: e.y + Math.sin(a) * 30,
        vx: Math.cos(a) * 240,
        vy: Math.sin(a) * 240,
        damage: Math.round(e.damage * 0.7),
        radius: 9,
        life: 2.2,
        color: "#ff6a20",
        fromEnemy: true,
        magma: true,
      });
    }
    if (typeof game.audio.castFire === "function") game.audio.castFire(false);
    else game.audio.bossHit();
    game.particles.burst(e.x, e.y, {
      count: 10, color: "#ff6a20", speed: 160, life: 0.3, size: 3,
    });
  } else if (atk === "spawn") {
    const n = e.bossPhase >= 2 ? 4 : e.bossPhase >= 1 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const sx = e.x + Math.cos(a) * 50;
      const sy = e.y + Math.sin(a) * 50;
      game._spawnEnemyAt("imp", sx, sy, false);
    }
    game.ui.toast(id === "echo" ? "ECOS" : "NINHADA");
    game.particles.ring(e.x, e.y, "#ff6a20", 70, 0.35);
    game.audio.bossHit();
  } else if (atk === "nest") {
    // 2–3 zonas de brasa no chão
    const count = e.bossPhase >= 2 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 120;
      const hx = clamp(e.x + Math.cos(a) * d, game.arena.x + 40, game.arena.x + game.arena.w - 40);
      const hy = clamp(e.y + Math.sin(a) * d, game.arena.y + 40, game.arena.y + game.arena.h - 40);
      game.hazards.push({
        type: "ember",
        x: hx,
        y: hy,
        r: 48,
        life: 5.5,
        maxLife: 5.5,
        damage: Math.round(e.damage * 0.35),
        tick: 0.35,
        cd: 0,
        color: "#ff5a1f",
      });
      game.particles.ring(hx, hy, "#ff6a20", 48, 0.4);
    }
    game.audio.bossTelegraph();
  } else if (atk === "embrace") {
    const a0 = e._aimAng ?? ang(p.x - e.x, p.y - e.y);
    const half = 0.75;
    const range = 135;
    game.shake.add(7, 0.22);
    game.audio.cleaveHit(3);
    game.particles.burst(
      e.x + Math.cos(a0) * 40,
      e.y + Math.sin(a0) * 40,
      { count: 18, color: "#ff6a20", speed: 220, life: 0.35, size: 3.5, angle: a0, spread: 1.2 },
    );
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < range + p.radius) {
      let da = Math.atan2(dy, dx) - a0;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) < half) {
        game._hurtPlayer(e.damage * 1.4, a0);
      }
    }
  } else if (atk === "whip") {
    const a0 = e._aimAng ?? ang(p.x - e.x, p.y - e.y);
    const len = 320;
    game.shake.add(5, 0.15);
    game.audio.dash();
    game.hazards.push({
      type: "line_hit",
      x: e.x,
      y: e.y,
      ang: a0,
      len,
      width: 24,
      life: 0.18,
      maxLife: 0.18,
      damage: Math.round(e.damage * 1.15),
      hit: false,
      color: "#e8dcc8",
    });
  } else if (atk === "hook") {
    const a0 = e._aimAng ?? ang(p.x - e.x, p.y - e.y);
    // hit se player alinhado
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    const dir = norm(Math.cos(a0), Math.sin(a0));
    const along = dx * dir.x + dy * dir.y;
    const perp = Math.abs(dx * -dir.y + dy * dir.x);
    game.audio.dash();
    game.particles.burst(e.x + dir.x * 40, e.y + dir.y * 40, {
      count: 10, color: "#c8b8a0", speed: 180, life: 0.25, size: 2.5, angle: a0, spread: 0.2,
    });
    if (along > 0 && along < 290 && perp < 28) {
      // puxão curto (não stun longo)
      const pull = Math.min(110, along * 0.55);
      p.x -= dir.x * pull;
      p.y -= dir.y * pull;
      p.x = clamp(p.x, game.arena.x + p.radius, game.arena.x + game.arena.w - p.radius);
      p.y = clamp(p.y, game.arena.y + p.radius, game.arena.y + game.arena.h - p.radius);
      game._hurtPlayer(Math.round(e.damage * 0.85), a0);
      game.ui.toast("GANCHO");
      game.shake.add(6, 0.18);
    }
  } else if (atk === "prison") {
    game.shake.add(9, 0.3);
    game.audio.bossHit();
    game.hazards.push({
      type: "prison",
      x: e.x,
      y: e.y,
      r: 125,
      life: 3.2,
      maxLife: 3.2,
      damage: Math.round(e.damage * 0.45),
      tick: 0.45,
      cd: 0.2,
      color: "#c8b8a0",
    });
    // reforços fora
    if (Math.random() < 0.7) game._spawnEnemyAt("spitter", e.x + 160, e.y, false);
    if (Math.random() < 0.7) game._spawnEnemyAt("spitter", e.x - 160, e.y, false);
    game.ui.toast("PRISÃO");
  } else if (atk === "ghost") {
    // clone atraso: projéteis no anel com delay visual
    game.audio.bossPhase();
    game.particles.ring(e.x, e.y, "#b44dff", 80, 0.5);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      game.projectiles.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * 160, vy: Math.sin(a) * 160,
        damage: Math.round(e.damage * 0.5),
        radius: 6, life: 2.2,
        color: "#9b8cff", fromEnemy: true, ghost: true,
      });
    }
    // segundo anel com atraso (via hazard que spawna projéteis)
    game.hazards.push({
      type: "delayed_ring",
      x: e.x,
      y: e.y,
      life: 0.55,
      maxLife: 0.55,
      damage: Math.round(e.damage * 0.5),
      fired: false,
    });
  }
}

/** Atualiza hazards de arena (brasas, prisão, linhas) */
export function updateHazards(game, dt) {
  const p = game.player;
  if (!game.hazards) return;
  for (let i = game.hazards.length - 1; i >= 0; i--) {
    const h = game.hazards[i];
    h.life -= dt;
    if (h.life <= 0) {
      game.hazards.splice(i, 1);
      continue;
    }

    if (h.type === "ember" && p && !p.dead) {
      h.cd = (h.cd || 0) - dt;
      if (h.cd <= 0 && dist(p, h) < h.r + p.radius) {
        h.cd = h.tick || 0.35;
        game._hurtPlayer(h.damage, ang(p.x - h.x, p.y - h.y));
        game.particles.burst(p.x, p.y, {
          count: 3, color: "#ff6a20", speed: 50, life: 0.2, size: 2,
        });
      }
    } else if (h.type === "prison" && p && !p.dead) {
      // empurra para dentro se estiver na borda saindo
      const d = dist(p, h);
      if (d > h.r - 8 && d < h.r + 40) {
        const dir = norm(h.x - p.x, h.y - p.y);
        // se player tenta sair, puxa de volta
        if (d > h.r - 4) {
          p.x += dir.x * 120 * dt;
          p.y += dir.y * 120 * dt;
        }
      }
      h.cd = (h.cd || 0) - dt;
      if (h.cd <= 0 && d < h.r) {
        h.cd = h.tick || 0.45;
        // dano só perto do carcereiro se existir
        const boss = game.bossRef;
        if (boss && !boss.dead && dist(p, boss) < 90) {
          game._hurtPlayer(h.damage, ang(p.x - boss.x, p.y - boss.y));
        }
      }
    } else if (h.type === "line_hit" && p && !p.dead && !h.hit) {
      const dir = { x: Math.cos(h.ang), y: Math.sin(h.ang) };
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const along = dx * dir.x + dy * dir.y;
      const perp = Math.abs(dx * -dir.y + dy * dir.x);
      if (along > 0 && along < h.len && perp < h.width) {
        h.hit = true;
        game._hurtPlayer(h.damage, h.ang);
        game.shake.add(4, 0.12);
      }
    } else if (h.type === "delayed_ring" && !h.fired && h.life < 0.08) {
      h.fired = true;
      const n = 10;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + 0.2;
        game.projectiles.push({
          x: h.x, y: h.y,
          vx: Math.cos(a) * 170, vy: Math.sin(a) * 170,
          damage: h.damage,
          radius: 6, life: 2.0,
          color: "#c4a0ff", fromEnemy: true, ghost: true,
        });
      }
      game.particles.ring(h.x, h.y, "#b44dff", 90, 0.3);
    }
  }
}

export function drawHazards(game, ctx) {
  if (!game.hazards?.length) return;
  for (const h of game.hazards) {
    const t = h.maxLife ? 1 - h.life / h.maxLife : 0;
    ctx.save();
    if (h.type === "ember") {
      const pulse = 1 + Math.sin((game.time || 0) * 6 + h.x) * 0.06;
      const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.r * pulse);
      g.addColorStop(0, "rgba(255,120,40,0.45)");
      g.addColorStop(0.6, "rgba(200,40,20,0.22)");
      g.addColorStop(1, "rgba(100,10,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,140,50,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (h.type === "prison" || h.type === "ring_preview") {
      ctx.strokeStyle = h.type === "prison" ? "rgba(200,184,160,0.75)" : h.color;
      ctx.lineWidth = h.type === "prison" ? 3 : 2;
      ctx.setLineDash(h.type === "prison" ? [] : [6, 5]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r || 130, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (h.type === "prison") {
        ctx.fillStyle = "rgba(40,30,40,0.12)";
        ctx.fill();
      }
    } else if (h.type === "line_preview" || h.type === "line_hit") {
      const alpha = h.type === "line_hit" ? 0.9 : 0.4 + t * 0.3;
      ctx.strokeStyle = h.type === "line_hit"
        ? `rgba(232,220,200,${alpha})`
        : h.color || `rgba(200,184,160,${alpha})`;
      ctx.lineWidth = h.width || 20;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.x + Math.cos(h.ang) * h.len, h.y + Math.sin(h.ang) * h.len);
      ctx.stroke();
    } else if (h.type === "cone_preview") {
      ctx.fillStyle = h.color || "rgba(255,106,32,0.3)";
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.arc(h.x, h.y, h.range, h.ang - h.halfArc, h.ang + h.halfArc);
      ctx.closePath();
      ctx.fill();
    } else if (h.type === "delayed_ring") {
      ctx.strokeStyle = "rgba(180,77,255,0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, 70 * (1 - h.life / h.maxLife), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}
