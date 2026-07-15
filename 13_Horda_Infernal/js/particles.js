/** Sistema de partículas e feedback visual */

export class ParticleSystem {
  constructor() {
    this.parts = [];
    this.floats = [];
    this.rings = [];
  }

  clear() {
    this.parts.length = 0;
    this.floats.length = 0;
    this.rings.length = 0;
  }

  burst(x, y, {
    count = 10,
    color = "#ff5a1f",
    speed = 120,
    life = 0.45,
    size = 3,
    gravity = 0,
    spread = Math.PI * 2,
    angle = 0,
  } = {}) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        gravity,
        drag: 0.92,
      });
    }
  }

  blood(x, y, dir = 0) {
    this.burst(x, y, {
      count: 12,
      color: "#c41e3a",
      speed: 160,
      life: 0.5,
      size: 3.5,
      gravity: 220,
      spread: Math.PI * 0.9,
      angle: dir,
    });
    this.burst(x, y, {
      count: 5,
      color: "#6b0f1a",
      speed: 80,
      life: 0.65,
      size: 2.5,
      gravity: 180,
      spread: Math.PI,
      angle: dir,
    });
  }

  sparks(x, y) {
    this.burst(x, y, {
      count: 8,
      color: "#ffb347",
      speed: 200,
      life: 0.28,
      size: 2.2,
      gravity: 0,
    });
  }

  embers(x, y, count = 4) {
    this.burst(x, y, {
      count,
      color: "#ff6a2a",
      speed: 40,
      life: 0.8,
      size: 2,
      gravity: -40,
      spread: Math.PI * 0.6,
      angle: -Math.PI / 2,
    });
  }

  death(x, y, color = "#c41e3a") {
    this.burst(x, y, { count: 22, color, speed: 260, life: 0.6, size: 4.5, gravity: 90 });
    this.burst(x, y, { count: 14, color: "#ff5a1f", speed: 180, life: 0.45, size: 2.8 });
    this.burst(x, y, { count: 8, color: "#fff5ec", speed: 120, life: 0.25, size: 2 });
    this.ring(x, y, color, 48, 0.38);
  }

  furyBurst(x, y) {
    this.burst(x, y, { count: 28, color: "#ff5a1f", speed: 240, life: 0.55, size: 3.5, gravity: -20 });
    this.burst(x, y, { count: 16, color: "#ffb347", speed: 160, life: 0.7, size: 2.5, gravity: -40 });
    this.ring(x, y, "#ff7a18", 90, 0.55);
    this.ring(x, y, "#ff3b5c", 50, 0.35);
  }

  slashDebris(x, y, angle) {
    this.burst(x, y, {
      count: 6,
      color: "#ffe0b0",
      speed: 280,
      life: 0.18,
      size: 2,
      angle,
      spread: 0.5,
    });
  }

  levelUp(x, y) {
    this.burst(x, y, { count: 24, color: "#f0c14b", speed: 180, life: 0.7, size: 3, gravity: -30 });
    this.burst(x, y, { count: 12, color: "#ffe08a", speed: 100, life: 0.9, size: 2, gravity: -50 });
    this.ring(x, y, "#f0c14b", 70, 0.5);
  }

  ring(x, y, color, maxR = 50, life = 0.4) {
    this.rings.push({ x, y, color, r: 4, maxR, life, maxLife: life, width: 3 });
  }

  floatText(x, y, text, color = "#fff", scale = 1) {
    this.floats.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y - 8,
      text,
      color,
      life: 0.85,
      maxLife: 0.85,
      vy: -48,
      scale,
    });
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.floats.splice(i, 1);
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= 0.96;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      r.r = 4 + (r.maxR - 4) * easeOutCubic(t);
    }
  }

  draw(ctx) {
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.maxLife);
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floats) {
      const t = f.life / f.maxLife;
      const a = t < 0.2 ? t / 0.2 : 1;
      ctx.globalAlpha = a;
      ctx.font = `bold ${Math.round(14 * f.scale)}px "Share Tech Mono", monospace`;
      ctx.fillStyle = f.color;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/** Screen shake + zoom punch */
export class CameraShake {
  constructor() {
    this.mag = 0;
    this.timer = 0;
    this.ox = 0;
    this.oy = 0;
    this.zoom = 1;
    this.zoomTarget = 1;
  }

  add(amount, duration = 0.15) {
    this.mag = Math.max(this.mag, amount);
    this.timer = Math.max(this.timer, duration);
  }

  /** Punch de zoom (1.04 = leve, 1.1 = forte) */
  punch(amount = 0.04) {
    this.zoomTarget = Math.min(1.12, this.zoomTarget + amount);
  }

  update(dt) {
    // zoom volta suavemente
    this.zoomTarget += (1 - this.zoomTarget) * Math.min(1, dt * 8);
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 14);

    if (this.timer <= 0) {
      this.mag *= 0.85;
      if (this.mag < 0.15) this.mag = 0;
      this.ox = this.mag ? (Math.random() - 0.5) * this.mag * 0.3 : 0;
      this.oy = this.mag ? (Math.random() - 0.5) * this.mag * 0.3 : 0;
      return;
    }
    this.timer -= dt;
    const decay = Math.min(1, this.mag);
    this.ox = (Math.random() - 0.5) * 2 * decay * this.mag;
    this.oy = (Math.random() - 0.5) * 2 * decay * this.mag;
    this.mag *= 0.88;
  }
}
