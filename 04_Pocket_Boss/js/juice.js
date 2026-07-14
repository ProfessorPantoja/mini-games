/**
 * Juice visual: shake, flash, partículas, float text.
 */

const reduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

let canvas;
let ctx;
let particles = [];
let raf = 0;
let w = 0;
let h = 0;

export function initJuice(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
  if (!raf) loop();
}

function resize() {
  if (!canvas) return;
  const parent = canvas.parentElement || document.body;
  const rect = parent.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = rect.width;
  h = rect.height;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loop() {
  raf = requestAnimationFrame(loop);
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= p.decay;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.g || 0;
    p.vx *= 0.98;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    if (p.soft) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

export function burst(x, y, { color = "#fbbf24", count = 14, speed = 4, size = 3, soft = true } = {}) {
  if (reduced) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.9);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      g: 0.08,
      size: size * (0.5 + Math.random()),
      color,
      life: 0.7 + Math.random() * 0.4,
      decay: 0.018 + Math.random() * 0.015,
      soft,
    });
  }
}

export function ring(x, y, color = "#f0abfc") {
  if (reduced) return;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * 5.5,
      vy: Math.sin(a) * 5.5,
      size: 2.5,
      color,
      life: 0.85,
      decay: 0.03,
      soft: true,
    });
  }
}

export function shake(level = "md") {
  if (reduced) return;
  const cls = `shake-${level}`;
  document.body.classList.remove("shake-sm", "shake-md", "shake-lg");
  // reflow
  void document.body.offsetWidth;
  document.body.classList.add(cls);
  setTimeout(() => document.body.classList.remove(cls), 420);
}

export function flash(color = "rgba(255,255,255,0.55)", ms = 80) {
  if (reduced) return;
  const el = document.getElementById("flash-layer");
  if (!el) return;
  el.style.background = color;
  el.style.opacity = "1";
  el.style.transition = "none";
  requestAnimationFrame(() => {
    el.style.transition = `opacity ${ms}ms ease-out`;
    el.style.opacity = "0";
  });
}

export function floatText(container, text, x, y, cls = "dmg") {
  if (!container) return;
  const el = document.createElement("div");
  el.className = `float-text ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

export function toast(text) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
}

export function hitStop(ms = 40) {
  if (reduced) return Promise.resolve();
  return new Promise((resolve) => {
    // freeze via CSS animation-play-state on fighters
    const arena = document.getElementById("arena");
    if (arena) arena.style.animationPlayState = "paused";
    setTimeout(() => {
      if (arena) arena.style.animationPlayState = "";
      resolve();
    }, ms);
  });
}

export function arenaPoint(el, side = "center") {
  if (!el) return { x: w / 2, y: h / 2 };
  const r = el.getBoundingClientRect();
  const root = document.getElementById("app").getBoundingClientRect();
  const x =
    side === "left"
      ? r.left - root.left + r.width * 0.3
      : side === "right"
        ? r.left - root.left + r.width * 0.7
        : r.left - root.left + r.width / 2;
  const y = r.top - root.top + r.height / 2;
  return { x, y };
}
