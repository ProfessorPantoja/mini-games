import { WORLD, COLORS, ELITE_ZONES, BOSS } from "./config.js";

/** Desenha o chão com grade sutil e “grama” procedural. */
export function drawGround(ctx, camX, camY, viewW, viewH) {
  const tile = WORLD.tile;
  const startX = Math.floor(camX / tile) * tile;
  const startY = Math.floor(camY / tile) * tile;
  const endX = camX + viewW + tile;
  const endY = camY + viewH + tile;

  for (let y = startY; y < endY; y += tile) {
    for (let x = startX; x < endX; x += tile) {
      const gx = Math.floor(x / tile);
      const gy = Math.floor(y / tile);
      const alt = (gx + gy) % 2 === 0;
      ctx.fillStyle = alt ? COLORS.ground : COLORS.groundAlt;
      ctx.fillRect(x, y, tile + 0.5, tile + 0.5);

      // pontinhos de grama (determinísticos)
      const seed = hash2(gx, gy);
      const n = 2 + (seed % 3);
      ctx.fillStyle = COLORS.grassDot;
      for (let i = 0; i < n; i++) {
        const px = x + ((seed * (i + 3) * 17) % tile);
        const py = y + ((seed * (i + 5) * 31) % tile);
        ctx.fillRect(px, py, 2, 2);
      }
    }
  }

  // borda do mundo
  ctx.strokeStyle = "rgba(40, 100, 60, 0.6)";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, WORLD.width - 4, WORLD.height - 4);
}

function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return Math.abs(h) >>> 0;
}

/** Zonas de elite (roxas) no mundo. */
export function drawEliteZones(ctx, zones, cleared) {
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const done = cleared.has(i);
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    ctx.fillStyle = done
      ? "rgba(80, 40, 120, 0.12)"
      : "rgba(140, 60, 255, 0.14)";
    ctx.fill();
    ctx.strokeStyle = done
      ? "rgba(120, 80, 160, 0.35)"
      : "rgba(176, 96, 255, 0.65)";
    ctx.lineWidth = 2;
    ctx.setLineDash(done ? [6, 6] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!done) {
      ctx.font = "bold 12px Segoe UI, system-ui, sans-serif";
      ctx.fillStyle = "rgba(200, 160, 255, 0.85)";
      ctx.textAlign = "center";
      ctx.fillText("ELITE", z.x, z.y - z.r - 8);
    }
  }
}

/** Zona do chefão (laranja). */
export function drawBossZone(ctx, unlocked, defeated) {
  if (!unlocked) return;
  const { x, y, zoneR } = BOSS;
  ctx.beginPath();
  ctx.arc(x, y, zoneR, 0, Math.PI * 2);
  ctx.fillStyle = defeated
    ? "rgba(100, 60, 20, 0.1)"
    : "rgba(255, 120, 30, 0.15)";
  ctx.fill();
  ctx.strokeStyle = defeated
    ? "rgba(180, 100, 40, 0.3)"
    : "rgba(255, 140, 42, 0.8)";
  ctx.lineWidth = 3;
  ctx.stroke();

  if (!defeated) {
    ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "#ffb060";
    ctx.textAlign = "center";
    ctx.fillText("CHEFÃO", x, y - zoneR - 10);
  }
}

/** Seta amarela apontando para o objetivo no mundo. */
export function drawObjectiveArrow(ctx, px, py, tx, ty, minDist = 180) {
  const dx = tx - px;
  const dy = ty - py;
  const d = Math.hypot(dx, dy);
  if (d < minDist) return;

  const ang = Math.atan2(dy, dx);
  const dist = 70;
  const ax = px + Math.cos(ang) * dist;
  const ay = py + Math.sin(ang) * dist;

  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);

  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, 10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, -10);
  ctx.closePath();
  ctx.fillStyle = "#ffe066";
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function createEliteZoneState() {
  return ELITE_ZONES.map((z, i) => ({
    ...z,
    id: i,
    spawned: false,
    cleared: false,
  }));
}

export { WORLD, BOSS, ELITE_ZONES };
