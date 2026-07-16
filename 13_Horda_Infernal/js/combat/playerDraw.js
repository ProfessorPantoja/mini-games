/** Desenho do player por classe — game.js só chama drawPlayer() */

import { rarityColor } from "../loot.js";
import { COLORS } from "../config.js";

export function drawPlayer(game, ctx) {
  const p = game.player;
  const cls = game.classDef;
  if (!p || !cls) return;

  if (cls.style === "caster") drawCasterHero(game, ctx);
  else if (cls.style === "ranged") drawRangedHero(game, ctx);
  else if (cls.id === "monk") drawMonkHero(game, ctx);
  else drawBarbarianHero(game, ctx);
}

/**
 * Monge — corpo leve, manto, punhos (glow no Chi).
 */
function drawMonkHero(game, ctx) {
  const p = game.player;
  const colors = game.classDef?.colors || {};
  const active = game.isResourceActive();
  const r = p.radius;
  const accent = colors.accent || "#c4a0ff";

  for (const t of p.trail) {
    ctx.globalAlpha = (t.life / 0.22) * 0.45;
    ctx.fillStyle = active ? accent : "#d0c0e8";
    ctx.beginPath();
    ctx.arc(t.x, t.y, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (active) {
    const pulse = 1 + Math.sin(game.time * 14) * 0.08;
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 2.2 * pulse);
    g.addColorStop(0, "rgba(196,160,255,0.35)");
    g.addColorStop(1, "rgba(196,160,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  if (p.invuln > 0 && Math.floor(game.time * 20) % 2 === 0 && p.dashing <= 0) {
    ctx.globalAlpha = 0.45;
  }

  const flash = p.flash > 0;
  // torso
  ctx.fillStyle = flash ? "#fff" : (colors.body || "#e8d5c4");
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // manto
  ctx.fillStyle = flash ? "#ccc" : (colors.armor || "#5a4a68");
  ctx.beginPath();
  ctx.ellipse(0, 3, r * 0.8, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  // faixa
  ctx.fillStyle = flash ? "#eee" : accent;
  ctx.fillRect(-r * 0.55, 1, r * 1.1, 3);

  // cabeça
  ctx.fillStyle = flash ? "#fff" : "#c4a88a";
  ctx.beginPath();
  ctx.arc(0, -5, r * 0.52, 0, Math.PI * 2);
  ctx.fill();

  // cabelo raspado / topete
  ctx.fillStyle = flash ? "#ddd" : "#2a1a28";
  ctx.beginPath();
  ctx.ellipse(0, -9, r * 0.4, r * 0.28, 0, Math.PI, 0);
  ctx.fill();

  const ex = Math.cos(p.facing) * 3.5;
  const ey = Math.sin(p.facing) * 3.5;
  ctx.fillStyle = "#1a0a08";
  ctx.beginPath();
  ctx.arc(ex - 2.8, -6 + ey * 0.3, 1.8, 0, Math.PI * 2);
  ctx.arc(ex + 2.8, -6 + ey * 0.3, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // punhos à frente (sem cajado)
  ctx.rotate(p.facing);
  const fistGlow = active || (p.atkPhase === "active");
  const fistCol = fistGlow ? accent : "#d4b898";
  if (fistGlow) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
  }
  // punho principal
  ctx.fillStyle = flash ? "#fff" : fistCol;
  ctx.beginPath();
  ctx.arc(22, -5, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // punho secundário
  ctx.beginPath();
  ctx.arc(16, 7, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // bandagens
  ctx.strokeStyle = "rgba(255,245,236,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(22, -5, 3.5, 0.2, Math.PI);
  ctx.stroke();
  ctx.restore();
}

/**
 * Bárbaro — silhueta bruta, peles, cabelo selvagem, peito largo.
 * (Novo visual; o monge ficou em drawMonkHero.)
 */
function drawBarbarianHero(game, ctx) {
  const p = game.player;
  const colors = game.classDef?.colors || {};
  const active = game.isResourceActive();
  const r = p.radius;

  for (const t of p.trail) {
    ctx.globalAlpha = (t.life / 0.22) * 0.4;
    ctx.fillStyle = active ? "#ff6a2a" : "#c47840";
    ctx.beginPath();
    ctx.arc(t.x, t.y, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(p.x, p.y);

  if (active) {
    const pulse = 1 + Math.sin(game.time * 12) * 0.08;
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 2.5 * pulse);
    g.addColorStop(0, "rgba(255,90,31,0.4)");
    g.addColorStop(1, "rgba(255,90,31,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.5 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 12, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.invuln > 0 && Math.floor(game.time * 20) % 2 === 0 && p.dashing <= 0) {
    ctx.globalAlpha = 0.45;
  }

  const flash = p.flash > 0;
  // pele bronzeada (não pálida de monge)
  const skin = flash ? "#fff" : active ? "#e8a878" : (colors.body || "#c48a58");
  const leather = flash ? "#bbb" : active ? "#5a2010" : (colors.armor || "#4a2818");
  const fur = flash ? "#ccc" : "#3a2818";
  const hair = flash ? "#888" : "#2a1810";

  // pernas / botas
  ctx.fillStyle = leather;
  ctx.beginPath();
  ctx.ellipse(-5, 11, 4.5, 5.5, 0, 0, Math.PI * 2);
  ctx.ellipse(5, 11, 4.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // tronco largo (elipse vertical)
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 2, r * 0.85, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();

  // ombros de pele/fur
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(-11, -1, 7, 5.5, -0.3, 0, Math.PI * 2);
  ctx.ellipse(11, -1, 7, 5.5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // tiras de couro no peito
  ctx.strokeStyle = leather;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.lineTo(4, 8);
  ctx.moveTo(6, -2);
  ctx.lineTo(-4, 8);
  ctx.stroke();

  // cintura / tanga de pele
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // cabeça
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -7, r * 0.52, 0, Math.PI * 2);
  ctx.fill();

  // cabelo selvagem
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(-6, -10, 5, 0, Math.PI * 2);
  ctx.arc(0, -13, 5.5, 0, Math.PI * 2);
  ctx.arc(6, -10, 5, 0, Math.PI * 2);
  ctx.arc(-8, -6, 3.5, 0, Math.PI * 2);
  ctx.arc(8, -6, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // barba grossa
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(-7, -3);
  ctx.quadraticCurveTo(-8, 6, 0, 9);
  ctx.quadraticCurveTo(8, 6, 7, -3);
  ctx.lineTo(4, -4);
  ctx.quadraticCurveTo(0, 2, -4, -4);
  ctx.closePath();
  ctx.fill();

  // olhos
  const ex = Math.cos(p.facing) * 3.5;
  const ey = Math.sin(p.facing) * 2.5;
  ctx.fillStyle = active ? "#ff3b5c" : "#1a0804";
  if (active) {
    ctx.shadowColor = "#ff3b5c";
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.arc(ex - 2.8, -7 + ey * 0.3, 1.8, 0, Math.PI * 2);
  ctx.arc(ex + 2.8, -7 + ey * 0.3, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // arma — desenhada na direção do facing
  ctx.rotate(p.facing);
  const swing =
    p.atkPhase === "windup" ? -0.75 :
    p.atkPhase === "active" ? 1.05 :
    p.atkPhase === "recover" ? 0.35 : 0;
  ctx.rotate(swing);
  drawBarbarianAxe(ctx, p.weapon?.rarity, active);
  ctx.restore();

  if (p.atkPhase === "windup" || p.atkPhase === "active") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);
    ctx.globalAlpha = p.atkPhase === "active" ? (active ? 0.32 : 0.22) : 0.1;
    ctx.fillStyle = active ? "#ff5a1f" : "#c47840";
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

/**
 * Machado de batalha em ferro/aço — silhueta clássica de bipennis leve.
 * Sem ponta de cristal / azul mágico.
 */
function drawBarbarianAxe(ctx, rarity, fury) {
  const steel = meleeBladeColor(rarity, fury);
  const dark = fury ? "#3a1810" : "#2a1a10";
  const wood = fury ? "#6a3820" : "#4a2c18";

  // cabo longo de madeira
  ctx.strokeStyle = wood;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(4, 2);
  ctx.lineTo(30, -1);
  ctx.stroke();
  // wrap de couro no cabo
  ctx.strokeStyle = dark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(10, 1.2);
  ctx.lineTo(16, 0.4);
  ctx.stroke();

  // cabeça do machado (lâmina curva de ferro)
  if (fury) {
    ctx.shadowColor = "rgba(255, 100, 40, 0.5)";
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = steel;
  ctx.beginPath();
  // lâmina principal (topo)
  ctx.moveTo(26, -2);
  ctx.quadraticCurveTo(34, -14, 42, -8);
  ctx.quadraticCurveTo(40, -2, 36, 0);
  ctx.lineTo(28, 1);
  ctx.closePath();
  ctx.fill();
  // contra-lâmina menor (baixo) — silhueta de machado
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.quadraticCurveTo(32, 8, 38, 6);
  ctx.quadraticCurveTo(34, 2, 28, 1);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // olho/soquete do cabo (ferro escuro)
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(27, -0.5, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // fio brilhante de aço (não azul)
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(32, -10);
  ctx.quadraticCurveTo(40, -6, 36, -1);
  ctx.stroke();

  // contorno
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(26, -2);
  ctx.quadraticCurveTo(34, -14, 42, -8);
  ctx.quadraticCurveTo(40, -2, 36, 0);
  ctx.stroke();
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
  if (fury) return "#c07040"; // ferro quente / fúria
  switch (rarity) {
    case "legendary": return "#d4a84a"; // ouro forjado
    case "epic": return "#9a9aaa"; // aço escuro
    case "rare": return "#b89850"; // bronze
    case "magic": return "#a8aeb8"; // aço fosco (nunca azul)
    default: return "#8a9098"; // ferro comum
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
