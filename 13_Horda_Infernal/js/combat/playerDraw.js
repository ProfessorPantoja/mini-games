/** Desenho do player por classe — game.js só chama drawPlayer() */

import { rarityColor } from "../loot.js";
import { COLORS } from "../config.js";

export function drawPlayer(game, ctx) {
  const p = game.player;
  const cls = game.classDef;
  if (!p || !cls) return;

  if (cls.style === "caster") drawCasterHero(game, ctx);
  else if (cls.style === "ranged") drawRangedHero(game, ctx);
  else drawMeleeHero(game, ctx);
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

  // cabo de madeira (não usa cor de raridade mágica)
  ctx.strokeStyle = "#4a3020";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(24, 0);
  ctx.stroke();
  // anel do cabo
  ctx.fillStyle = active ? "#c47828" : "#6a4a28";
  ctx.fillRect(20, -3, 5, 6);

  // lâmina de aço — metal real, nunca azul mágico
  const steel = meleeBladeColor(p.weapon?.rarity, active);
  if (active) {
    ctx.shadowColor = "rgba(255, 140, 60, 0.55)";
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = steel;
  ctx.beginPath();
  // machado: cabeça larga de metal
  ctx.moveTo(24, -11);
  ctx.lineTo(38, -2);
  ctx.lineTo(40, 0);
  ctx.lineTo(38, 2);
  ctx.lineTo(24, 11);
  ctx.lineTo(26, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // fio da lâmina (brilho aço)
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(28, -7);
  ctx.lineTo(37, 0);
  ctx.lineTo(28, 7);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, -11);
  ctx.lineTo(38, -2);
  ctx.lineTo(40, 0);
  ctx.lineTo(38, 2);
  ctx.lineTo(24, 11);
  ctx.closePath();
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
  // flecha no arco (haste + ponta de aço)
  if (game.mouse.down || game.touchAttack || p.atkPhase === "active" || game.touchAim?.active) {
    ctx.strokeStyle = "#8a6a40";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(26, 0);
    ctx.stroke();
    ctx.fillStyle = "#d8dee8";
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(24, -2.8);
    ctx.lineTo(24, 2.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = colors.accent || "#7dffb3";
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(2, -3);
    ctx.lineTo(9, 0);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawCasterHero(game, ctx) {
  const p = game.player;
  const cls = game.classDef;
  const colors = cls.colors || {};
  const active = game.isResourceActive();
  const accent = colors.accent || "#b44dff";
  const flame = colors.flame || "#ff6bcb";
  const r = p.radius;

  for (const t of p.trail) {
    ctx.globalAlpha = (t.life / 0.22) * 0.35;
    ctx.fillStyle = active ? flame : accent;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(p.x, p.y);

  if (active) {
    const pulse = 1 + Math.sin(game.time * 11) * 0.08;
    const g = ctx.createRadialGradient(0, 0, 3, 0, 0, r * 2.2 * pulse);
    g.addColorStop(0, "rgba(180,77,255,0.35)");
    g.addColorStop(1, "rgba(180,77,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 11, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.invuln > 0 && Math.floor(game.time * 20) % 2 === 0 && p.dashing <= 0) {
    ctx.globalAlpha = 0.45;
  }

  const flash = p.flash > 0;
  const robe = flash ? "#bbb" : (colors.armor || "#3a2a58");
  const skin = flash ? "#fff" : "#c4a890";

  // pernas sob o manto (silhueta humana)
  ctx.fillStyle = flash ? "#999" : "#2a1838";
  ctx.beginPath();
  ctx.ellipse(-4, 9, 3.5, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(4, 9, 3.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // tronco / manto em forma de pessoa (não baú)
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 2);
  ctx.quadraticCurveTo(-r * 0.75, 8, -r * 0.45, r + 2);
  ctx.lineTo(r * 0.45, r + 2);
  ctx.quadraticCurveTo(r * 0.75, 8, r * 0.55, 2);
  ctx.lineTo(r * 0.4, -2);
  ctx.lineTo(-r * 0.4, -2);
  ctx.closePath();
  ctx.fill();
  // gola / abertura do manto
  ctx.fillStyle = flash ? "#aaa" : "#241430";
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(5, 0);
  ctx.closePath();
  ctx.fill();

  // braços
  ctx.strokeStyle = robe;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  const armAng = p.facing;
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-10 + Math.cos(armAng) * 2, 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, 2);
  ctx.lineTo(8 + Math.cos(armAng) * 4, 4);
  ctx.stroke();

  // cabeça (rosto humano)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -5, r * 0.48, 0, Math.PI * 2);
  ctx.fill();

  // capuz atrás da cabeça (não tapa o rosto todo)
  ctx.fillStyle = flash ? "#ccc" : "#2a1a40";
  ctx.beginPath();
  ctx.ellipse(0, -7, r * 0.58, r * 0.42, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  // ponta do capuz
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.lineTo(0, -r * 1.25);
  ctx.lineTo(4, -10);
  ctx.closePath();
  ctx.fill();

  // olhos
  const ex = Math.cos(p.facing) * 3;
  const ey = Math.sin(p.facing) * 2.5;
  ctx.fillStyle = active ? flame : "#1a0a18";
  if (active) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.arc(ex - 2.2, -5 + ey * 0.3, 1.6, 0, Math.PI * 2);
  ctx.arc(ex + 2.2, -5 + ey * 0.3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // cajado de madeira + cristal pequeno (personagem, não baú brilhante)
  ctx.rotate(p.facing);
  const castPull = p.atkPhase === "windup" ? 0.12 : 0;
  ctx.strokeStyle = "#5a3a28";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(6, 6);
  ctx.lineTo(26, -1 - castPull * 6);
  ctx.stroke();
  // mão no cajado
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(10, 5, 2.5, 0, Math.PI * 2);
  ctx.fill();

  const ox = 28;
  const oy = -2 - castPull * 8;
  const orbR = 4 + (active ? Math.sin(game.time * 14) * 0.8 : 0);
  const orbG = ctx.createRadialGradient(ox, oy, 0.5, ox, oy, orbR * 1.8);
  orbG.addColorStop(0, "#fff");
  orbG.addColorStop(0.4, active ? flame : accent);
  orbG.addColorStop(1, "transparent");
  ctx.fillStyle = orbG;
  ctx.beginPath();
  ctx.arc(ox, oy, orbR * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = active ? flame : accent;
  ctx.beginPath();
  ctx.arc(ox, oy, orbR * 0.7, 0, Math.PI * 2);
  ctx.fill();

  if (p.atkPhase === "windup") {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox, oy, 10 + (1 - (p.atkTimer || 0) / 0.08) * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/** Aço / bronze / ouro — nunca azul de item mágico no machado */
function meleeBladeColor(rarity, fury) {
  if (fury) return "#e8b070";
  switch (rarity) {
    case "legendary": return "#e8c050"; // ouro quente
    case "epic": return "#c0b0d0"; // aço acinzentado-lilás sutil
    case "rare": return "#d4c078"; // bronze dourado
    case "magic": return "#b0c0d0"; // aço claro (não azul neon)
    default: return COLORS.playerBlade || "#c8d0dc";
  }
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
