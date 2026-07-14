/**
 * Canvas rendering — polished orbs, aim line, effects
 */

import { CFG, colorById } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.dpr = 1;
  }

  resize(cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = Math.round(cssW);
    this.h = Math.round(cssH);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear() {
    const { ctx, w, h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0c1224');
    g.addColorStop(0.45, '#0a0e1a');
    g.addColorStop(1, '#070a12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // subtle vignette
    const vg = ctx.createRadialGradient(w / 2, h * 0.4, h * 0.15, w / 2, h * 0.5, h * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    // soft grid dots
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    const step = 28;
    for (let y = step; y < h; y += step) {
      for (let x = step; x < w; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawDangerLine(y) {
    const { ctx, w } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 107, 138, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(w - 12, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // soft red wash below
    const g = ctx.createLinearGradient(0, y, 0, y + 40);
    g.addColorStop(0, 'rgba(255, 77, 109, 0.08)');
    g.addColorStop(1, 'rgba(255, 77, 109, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, 40);
    ctx.restore();
  }

  /**
   * Draw a glossy bubble orb
   */
  drawBubble(x, y, r, colorId, opts = {}) {
    const {
      alpha = 1,
      scale = 1,
      glow = true,
      popProgress = 0, // 0..1 popping
    } = opts;

    const pal = colorById(colorId);
    const rr = r * scale * (1 + popProgress * 0.35);
    const a = alpha * (1 - popProgress);
    if (a <= 0.01) return;

    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = a;

    // outer glow
    if (glow && popProgress < 0.5) {
      ctx.beginPath();
      ctx.arc(x, y, rr * 1.35, 0, Math.PI * 2);
      const gg = ctx.createRadialGradient(x, y, rr * 0.4, x, y, rr * 1.4);
      gg.addColorStop(0, pal.glow);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.fill();
    }

    // body gradient
    const body = ctx.createRadialGradient(
      x - rr * 0.35,
      y - rr * 0.4,
      rr * 0.05,
      x,
      y + rr * 0.1,
      rr
    );
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.12, lighten(pal.hex, 0.35));
    body.addColorStop(0.45, pal.hex);
    body.addColorStop(1, darken(pal.hex, 0.35));

    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    // rim
    ctx.strokeStyle = `rgba(255,255,255,${0.18 * a})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // specular highlight
    ctx.beginPath();
    ctx.ellipse(
      x - rr * 0.28,
      y - rr * 0.32,
      rr * 0.28,
      rr * 0.18,
      -0.5,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = `rgba(255,255,255,${0.55 * a})`;
    ctx.fill();

    // secondary soft specular
    ctx.beginPath();
    ctx.arc(x + rr * 0.25, y + rr * 0.3, rr * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.12 * a})`;
    ctx.fill();

    // pop ring
    if (popProgress > 0) {
      ctx.beginPath();
      ctx.arc(x, y, rr * (1 + popProgress * 0.8), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${(1 - popProgress) * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  drawGrid(grid) {
    for (const cell of grid.all()) {
      if (cell.falling) {
        this.drawBubble(cell.fx, cell.fy, grid.r, cell.color, {
          alpha: 0.95,
          scale: 1,
        });
        continue;
      }
      const { x, y } = grid.cellCenter(cell.row, cell.col);
      if (cell.popping) {
        this.drawBubble(x, y, grid.r, cell.color, {
          popProgress: cell.popT || 0,
          glow: true,
        });
      } else {
        // subtle idle scale pulse by position
        this.drawBubble(x, y, grid.r, cell.color);
      }
    }
  }

  /**
   * Trajectory prediction with wall bounce.
   * Optional grid stops the dashed line at the first collision.
   */
  drawAimLine(ox, oy, angle, boundsW, r, invalid = false, grid = null) {
    const { ctx } = this;
    let x = ox;
    let y = oy;
    // Aim angle: 0 = right, PI/2 = up (canvas y grows down)
    let vx = Math.cos(angle);
    let vy = -Math.sin(angle);

    ctx.save();
    ctx.strokeStyle = invalid
      ? 'rgba(255, 107, 138, 0.45)'
      : 'rgba(110, 231, 255, 0.55)';
    ctx.fillStyle = invalid
      ? 'rgba(255, 107, 138, 0.7)'
      : 'rgba(110, 231, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);

    const maxSteps = 100;
    const step = 7;
    let hitEnd = false;

    for (let i = 0; i < maxSteps; i++) {
      x += vx * step;
      y += vy * step;

      // walls (classic ricochet)
      if (x - r < 0) {
        x = r;
        vx = Math.abs(vx);
      } else if (x + r > boundsW) {
        x = boundsW - r;
        vx = -Math.abs(vx);
      }

      ctx.lineTo(x, y);

      if (y - r <= 2) {
        hitEnd = true;
        break;
      }

      if (grid && grid.collideBubble(x, y, r * 0.95)) {
        hitEnd = true;
        break;
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // endpoint ghost / impact marker
    ctx.beginPath();
    ctx.arc(x, y, hitEnd ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (hitEnd && !invalid) {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(110, 231, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  drawShooterBase(x, y, angle, currentColor, invalid) {
    const { ctx } = this;
    // pedestal
    ctx.save();
    const ped = ctx.createLinearGradient(x - 40, y, x + 40, y + 30);
    ped.addColorStop(0, 'rgba(30, 40, 70, 0.9)');
    ped.addColorStop(1, 'rgba(15, 20, 40, 0.95)');
    ctx.beginPath();
    roundRect(ctx, x - 48, y + 8, 96, 28, 12);
    ctx.fillStyle = ped;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    // launcher arm
    ctx.translate(x, y);
    ctx.rotate(-angle + Math.PI / 2);
    ctx.fillStyle = invalid ? 'rgba(255,107,138,0.35)' : 'rgba(110,231,255,0.2)';
    ctx.beginPath();
    roundRect(ctx, -6, -36, 12, 32, 4);
    ctx.fill();
    ctx.restore();

    // current bubble
    this.drawBubble(x, y, CFG.bubbleR * 0.95, currentColor, {
      glow: !invalid,
      scale: invalid ? 0.92 : 1,
      alpha: invalid ? 0.7 : 1,
    });
  }

  drawFloatingScore(texts) {
    const { ctx } = this;
    for (const t of texts) {
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.font = `700 ${t.size || 16}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color || '#fbbf24';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 6;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  drawNextPreview(canvas, colorId) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = 48;
    canvas.width = s * dpr;
    canvas.height = s * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);
    // mini bubble
    const r = 18;
    const x = s / 2;
    const y = s / 2;
    const pal = colorById(colorId);
    const body = ctx.createRadialGradient(x - 6, y - 7, 2, x, y, r);
    body.addColorStop(0, '#fff');
    body.addColorStop(0.2, lighten(pal.hex, 0.3));
    body.addColorStop(0.55, pal.hex);
    body.addColorStop(1, darken(pal.hex, 0.3));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 5, y - 6, 6, 4, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  }
}

function lighten(hex, t) {
  const { r, g, b } = parseHex(hex);
  return `rgb(${mix(r, 255, t)},${mix(g, 255, t)},${mix(b, 255, t)})`;
}

function darken(hex, t) {
  const { r, g, b } = parseHex(hex);
  return `rgb(${mix(r, 0, t)},${mix(g, 0, t)},${mix(b, 0, t)})`;
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function parseHex(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
