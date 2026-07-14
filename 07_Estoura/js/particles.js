/**
 * Lightweight particle system for pops, trails, sparkles
 */

import { CFG, hexToRgb } from './config.js';

export class ParticleSystem {
  constructor() {
    this.list = [];
  }

  clear() {
    this.list.length = 0;
  }

  burst(x, y, colorHex, count = 12, opts = {}) {
    const speed = opts.speed ?? 180;
    const baseLife = opts.life ?? 0.45;
    const lifeJitter = opts.lifeVar ?? 0.25;
    const size = opts.size ?? 3;
    const gravity = opts.gravity ?? 400;
    const rgb = hexToRgb(colorHex);
    const room = CFG.maxParticles - this.list.length;
    const n = Math.min(count, Math.max(0, room));
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = speed * (0.4 + Math.random() * 0.8);
      const pLife = baseLife + Math.random() * lifeJitter;
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: pLife,
        maxLife: baseLife + lifeJitter,
        r: size * (0.5 + Math.random()),
        rgb,
        gravity,
        drag: 0.98,
        type: 'orb',
      });
    }
  }

  sparkle(x, y, colorHex, count = 6) {
    this.burst(x, y, colorHex, count, { speed: 90, life: 0.35, size: 2, gravity: 200 });
  }

  trail(x, y, colorHex) {
    if (this.list.length >= CFG.maxParticles) return;
    const rgb = hexToRgb(colorHex);
    this.list.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      life: 0.18 + Math.random() * 0.1,
      maxLife: 0.28,
      r: 3 + Math.random() * 3,
      rgb,
      gravity: 0,
      drag: 0.92,
      type: 'trail',
    });
  }

  confetti(cx, cy, w, h, count = 40) {
    const palette = ['#ff4d6d', '#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#fb923c'];
    const room = CFG.maxParticles - this.list.length;
    const n = Math.min(count, room);
    for (let i = 0; i < n; i++) {
      const hex = palette[i % palette.length];
      const rgb = hexToRgb(hex);
      this.list.push({
        x: cx + (Math.random() - 0.5) * w * 0.6,
        y: cy - h * 0.2 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 280,
        vy: -120 - Math.random() * 220,
        life: 0.8 + Math.random() * 0.6,
        maxLife: 1.4,
        r: 2.5 + Math.random() * 3,
        rgb,
        gravity: 500,
        drag: 0.99,
        type: 'orb',
      });
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.maxLife);
      const { r, g, b } = p.rgb;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.95})`;
      ctx.fill();
      if (p.type === 'orb' && a > 0.4) {
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.25, p.y - p.r * 0.25, p.r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a * 0.5})`;
        ctx.fill();
      }
    }
  }
}
