/** Desenho do player por classe — game.js só chama drawPlayer() */

import { rarityColor } from "../loot.js";
import { COLORS } from "../config.js";

export function drawPlayer(game, ctx) {
  const p = game.player;
  const cls = game.classDef;
  if (!p || !cls) return;

  if (cls.style === "ranged" || cls.style === "caster") {
    drawRangedHero(game, ctx);
  } else {
    drawMeleeHero(game, ctx);
  }
}

function drawMeleeHero(game, ctx) {
  const p = game.player;
  const cls = game.classDef;
  const colors = cls.colors || {};
  const active = game.isResourceActive();

  for (const t of p.trail) {
    ctx.globalAlpha = (t.life / 0.22) * 0.4;
    ctx.fillStyle = active ? colors.accent || "#ff5a1f" : "#ffb347";
    ctx.beginPath();
    ctx.arc(t.x, t.y, p.radius * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(p.x, p.y);

  if (active) {
    const pulse = 1 + Math.sin(game.time * 12) * 0.08;
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, p.radius * 2.4 * pulse);
    g.addColorStop(0, "rgba(255,90,31,0.45)");
    g.addColorStop(0.5, "rgba(255,90,31,0.15)");
    g.addColorStop(1, "rgba(255,90,31,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 2.4 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.invuln > 0 && Math.floor(game.time * 20) % 2 === 0 && p.dashing <= 0) {
    ctx.globalAlpha = 0.45;
  }

  const flash = p.flash > 0;
  ctx.fillStyle = flash ? "#fff" : active ? "#ffe0c8" : (colors.body || COLORS.player);
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = flash ? "#ccc" : active ? "#8a2a18" : (colors.armor || COLORS.playerArmor);
  ctx.beginPath();
  ctx.ellipse(0, 2, p.radius * 0.75, p.radius * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = flash ? "#fff" : "#c4a88a";
  ctx.beginPath();
  ctx.arc(0, -4, p.radius * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // barba
  ctx.fillStyle = flash ? "#ddd" : "#5a3a28";
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(6, 0);
  ctx.fill();

  const ex = Math.cos(p.facing) * 4;
  const ey = Math.sin(p.facing) * 4;
  ctx.fillStyle = active ? "#ff3b5c" : "#1a0a08";
  if (active) {
    ctx.shadowColor = "#ff3b5c";
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.arc(ex - 3, -5 + ey * 0.3, 2, 0, Math.PI * 2);
  ctx.arc(ex + 3, -5 + ey * 0.3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.rotate(p.facing);
  const swing =
    p.atkPhase === "windup" ? -0.75 :
    p.atkPhase === "active" ? 1.05 :
    p.atkPhase === "recover" ? 0.35 : 0;
  ctx.rotate(swing);

  ctx.strokeStyle = "#3a2a20";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(30, 0);
  ctx.stroke();

  if (active) {
    ctx.shadowColor = colors.accent || "#ff5a1f";
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = p.weapon ? rarityColor(p.weapon.rarity) : COLORS.playerBlade;
  ctx.beginPath();
  ctx.moveTo(28, -12);
  ctx.lineTo(42, 0);
  ctx.lineTo(28, 12);
  ctx.lineTo(24, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  if (p.atkPhase === "windup" || p.atkPhase === "active") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);
    ctx.globalAlpha = p.atkPhase === "active" ? (active ? 0.32 : 0.24) : 0.12;
    ctx.fillStyle = active ? "#ff5a1f" : "#ffb347";
    const range = game.getAttackRange();
    const arc = game.getAttackArc();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, range, -arc / 2, arc / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawRangedHero(game, ctx) {
  const p = game.player;
  const cls = game.classDef;
  const colors = cls.colors || {};
  const active = game.isResourceActive();

  for (const t of p.trail) {
    ctx.globalAlpha = (t.life / 0.22) * 0.4;
    ctx.fillStyle = active ? colors.accent || "#7dffb3" : "#a8d4c0";
    ctx.beginPath();
    ctx.arc(t.x, t.y, p.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(p.x, p.y);

  if (active) {
    const pulse = 1 + Math.sin(game.time * 14) * 0.07;
    const g = ctx.createRadialGradient(0, 0, 3, 0, 0, p.radius * 2.2 * pulse);
    g.addColorStop(0, "rgba(125,255,179,0.4)");
    g.addColorStop(1, "rgba(125,255,179,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 2.2 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.invuln > 0 && Math.floor(game.time * 20) % 2 === 0 && p.dashing <= 0) {
    ctx.globalAlpha = 0.45;
  }

  const flash = p.flash > 0;
  ctx.fillStyle = flash ? "#fff" : (colors.body || "#d4c4a8");
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = flash ? "#ccc" : (colors.armor || "#3a4a38");
  ctx.beginPath();
  ctx.ellipse(0, 2, p.radius * 0.7, p.radius * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  // capuz leve
  ctx.fillStyle = flash ? "#ddd" : "#2a3a28";
  ctx.beginPath();
  ctx.ellipse(0, -6, p.radius * 0.55, p.radius * 0.4, 0, Math.PI, 0);
  ctx.fill();

  const ex = Math.cos(p.facing) * 4;
  const ey = Math.sin(p.facing) * 4;
  ctx.fillStyle = active ? colors.accent || "#7dffb3" : "#1a0a08";
  ctx.beginPath();
  ctx.arc(ex - 2.5, -4 + ey * 0.3, 1.8, 0, Math.PI * 2);
  ctx.arc(ex + 2.5, -4 + ey * 0.3, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // arco
  ctx.rotate(p.facing);
  const pull = p.atkPhase === "active" ? 1 : 0;
  ctx.strokeStyle = p.weapon ? rarityColor(p.weapon.rarity) : "#8a7060";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(14, 0, 16, -1.1, 1.1);
  ctx.stroke();
  // corda
  ctx.strokeStyle = "#c8b8a0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(14 + Math.cos(-1.1) * 16, Math.sin(-1.1) * 16);
  ctx.lineTo(10 - pull * 4, 0);
  ctx.lineTo(14 + Math.cos(1.1) * 16, Math.sin(1.1) * 16);
  ctx.stroke();
  // flecha
  if (game.mouse.down || p.atkPhase === "active") {
    ctx.strokeStyle = colors.accent || "#7dffb3";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();
    ctx.fillStyle = colors.accent || "#7dffb3";
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(22, -3);
    ctx.lineTo(22, 3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function drawPlayerBody(game, ctx) {
  const p = game.player;
  if (!p) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#5a3a38";
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
