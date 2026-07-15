/** Bootstrap — Horda Infernal */

import { W, H } from "./config.js";
import { AudioBus } from "./audio.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";
import { getClass } from "./classes/registry.js";

const canvas = document.getElementById("game");
canvas.width = W;
canvas.height = H;

const audio = new AudioBus();
const ui = new UI();
const game = new Game(canvas, audio, ui);

let selectedClass = "barbarian";

// seletor de classe no título
document.getElementById("class-row")?.addEventListener("click", (e) => {
  const card = e.target.closest(".class-card");
  if (!card || card.classList.contains("locked") || card.disabled) return;
  const id = card.dataset.class;
  if (!getClass(id).unlocked) return;
  selectedClass = id;
  game.setClass(id);
  document.querySelectorAll(".class-card").forEach((c) => {
    c.classList.toggle("selected", c.dataset.class === id);
  });
  audio.uiClick();
});

// ─── Buttons ───
document.getElementById("btn-start").addEventListener("click", () => {
  game.startRun(selectedClass);
  syncTouchUi();
});

document.getElementById("btn-resume")?.addEventListener("click", () => game.resume());
document.getElementById("btn-retry")?.addEventListener("click", () => {
  game.startRun(selectedClass);
  syncTouchUi();
});
document.getElementById("btn-retry-win")?.addEventListener("click", () => {
  game.startRun(selectedClass);
  syncTouchUi();
});
document.getElementById("btn-menu")?.addEventListener("click", () => {
  audio.stopAmbience();
  game.state = "title";
  ui.showTitle();
  syncTouchUi();
});
document.getElementById("btn-menu-win")?.addEventListener("click", () => {
  audio.stopAmbience();
  game.state = "title";
  ui.showTitle();
  syncTouchUi();
});

document.getElementById("btn-equip").addEventListener("click", () => game.acceptLoot());
document.getElementById("btn-skip-loot").addEventListener("click", () => game.rejectLoot());

// power select clicks
document.getElementById("power-choices")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".power-btn");
  if (!btn || !btn.dataset.powerId) return;
  game.pickPower(btn.dataset.powerId);
});

// ranking
document.getElementById("btn-ranking")?.addEventListener("click", () => {
  audio.uiClick();
  ui.showRanking("title");
});
document.getElementById("btn-ranking-win")?.addEventListener("click", () => {
  audio.uiClick();
  ui.showRanking("victory");
});
document.getElementById("btn-ranking-defeat")?.addEventListener("click", () => {
  audio.uiClick();
  ui.showRanking("defeat");
});
document.getElementById("btn-ranking-back")?.addEventListener("click", () => {
  audio.uiClick();
  ui.closeRanking();
});
document.getElementById("btn-save-rank-victory")?.addEventListener("click", () => {
  ui.handleSaveRanking("victory", audio);
});
document.getElementById("btn-save-rank-defeat")?.addEventListener("click", () => {
  ui.handleSaveRanking("defeat", audio);
});

function isTypingInField() {
  const t = document.activeElement;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

// keyboard loot / power shortcuts
window.addEventListener("keydown", (e) => {
  if (isTypingInField()) {
    if (e.code === "Enter" && (game.state === "victory" || game.state === "defeat")) {
      e.preventDefault();
      const prefix = game.state === "victory" ? "victory" : "defeat";
      ui.handleSaveRanking(prefix, audio);
    }
    return;
  }

  if (game.state === "loot") {
    if (e.code === "KeyE" || e.code === "Enter" || e.code === "Space") {
      e.preventDefault();
      game.acceptLoot();
    } else if (e.code === "KeyQ" || e.code === "Escape") {
      game.rejectLoot();
    }
  }
  if (game.state === "levelup") {
    const map = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };
    if (e.code in map && game.pendingPowerChoices?.[map[e.code]]) {
      e.preventDefault();
      game.pickPower(game.pendingPowerChoices[map[e.code]].id);
    }
  }
  if (game.state === "title" && (e.code === "Enter" || e.code === "Space")) {
    game.startRun(selectedClass);
    syncTouchUi();
  }
  if ((game.state === "defeat" || game.state === "victory") && e.code === "Enter") {
    game.startRun(selectedClass);
    syncTouchUi();
  }
});

// ─── Touch controls (twin-stick) ───
const touchUi = document.getElementById("touch-ui");
const stickZone = document.getElementById("stick-zone");
const stickKnob = document.getElementById("stick-knob");
const aimZone = document.getElementById("aim-zone");
const aimKnob = document.getElementById("aim-knob");
const atkBtn = document.getElementById("atk-btn");
const dashBtn = document.getElementById("dash-btn");

/** Celular de verdade — não notebook com trackpad touch */
function isPhoneLike() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches
    || (
      navigator.maxTouchPoints > 0
      && window.matchMedia("(max-width: 900px)").matches
      && window.matchMedia("(pointer: coarse)").matches
    );
}

function syncTouchUi() {
  // só durante combate livre — some no loot/levelup para não bloquear botões
  const on = isPhoneLike() && game.state === "playing";
  touchUi.classList.toggle("on", on);
  game.mobileTouch = isPhoneLike();
  if (!on) {
    game.touchMove.x = 0;
    game.touchMove.y = 0;
    game.touchAim.x = 0;
    game.touchAim.y = 0;
    game.touchAim.active = false;
    if (!atkHeld) game.touchAttack = false;
  }
}

// liga/desliga ao redimensionar
window.addEventListener("resize", syncTouchUi);
window.addEventListener("orientationchange", () => setTimeout(syncTouchUi, 200));

const stickMax = 46;
let movePtr = null;
let aimPtr = null;

function bindStick(zone, knob, onMove, onEnd) {
  if (!zone || !knob) return;
  let activeId = null;

  zone.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    activeId = e.pointerId;
    try { zone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    onMove(e);
  });
  zone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== activeId) return;
    e.preventDefault();
    onMove(e);
  });
  const end = (e) => {
    if (activeId != null && e.pointerId !== activeId) return;
    activeId = null;
    onEnd(e);
    knob.style.transform = "translate(-50%, -50%)";
  };
  zone.addEventListener("pointerup", end);
  zone.addEventListener("pointercancel", end);
}

function stickVector(zone, e) {
  const r = zone.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const d = Math.hypot(dx, dy) || 1;
  if (d > stickMax) {
    dx = (dx / d) * stickMax;
    dy = (dy / d) * stickMax;
  }
  return { dx, dy, nx: dx / stickMax, ny: dy / stickMax, mag: Math.min(1, d / stickMax) };
}

bindStick(stickZone, stickKnob, (e) => {
  movePtr = e.pointerId;
  const v = stickVector(stickZone, e);
  stickKnob.style.transform = `translate(calc(-50% + ${v.dx}px), calc(-50% + ${v.dy}px))`;
  game.touchMove.x = v.nx;
  game.touchMove.y = v.ny;
}, () => {
  movePtr = null;
  game.touchMove.x = 0;
  game.touchMove.y = 0;
});

bindStick(aimZone, aimKnob, (e) => {
  aimPtr = e.pointerId;
  const v = stickVector(aimZone, e);
  aimKnob.style.transform = `translate(calc(-50% + ${v.dx}px), calc(-50% + ${v.dy}px))`;
  game.touchAim.x = v.nx;
  game.touchAim.y = v.ny;
  // stick de mira ativo a partir de leve toque
  game.touchAim.active = v.mag > 0.18;
  // puxar o stick de mira = atirar/atacar (twin-stick shooter)
  game.touchAttack = v.mag > 0.35;
}, () => {
  aimPtr = null;
  game.touchAim.x = 0;
  game.touchAim.y = 0;
  game.touchAim.active = false;
  // se o botão ATACAR não estiver pressionado, solta o ataque
  if (!atkHeld) game.touchAttack = false;
});

let atkHeld = false;
atkBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  atkHeld = true;
  game.touchAttack = true;
  // auto-mira no mais próximo ao apertar
  if (game.player && game.state === "playing") {
    game.updateFacing(game.touchMove.x, game.touchMove.y, true);
  }
});
const endAtk = () => {
  atkHeld = false;
  if (!game.touchAim.active || Math.hypot(game.touchAim.x, game.touchAim.y) <= 0.35) {
    game.touchAttack = false;
  }
};
atkBtn.addEventListener("pointerup", endAtk);
atkBtn.addEventListener("pointercancel", endAtk);
atkBtn.addEventListener("pointerleave", endAtk);

dashBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  game.touchDash = true;
});

// first interaction unlocks audio
const unlock = () => {
  audio.unlock();
  window.removeEventListener("pointerdown", unlock);
  window.removeEventListener("keydown", unlock);
};
window.addEventListener("pointerdown", unlock);
window.addEventListener("keydown", unlock);

// ─── Frame loop ───
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;

  // touch só na run
  // re-sync touch visibility when state changes
  const wantTouch = isPhoneLike() && game.state === "playing";
  if (wantTouch !== touchUi.classList.contains("on")) syncTouchUi();

  if (game.state === "playing" || game.state === "loot" || game.state === "levelup") {
    game.update(dt);
  } else {
    game.shake.update(dt);
    game.particles.update(dt);
  }

  game.draw();
  if (game.state === "title" && Math.random() < 0.08) {
    game.particles.embers(
      Math.random() * W,
      H * 0.7 + Math.random() * H * 0.25,
      1,
    );
  }

  requestAnimationFrame(frame);
}

ui.showTitle();
game.stage = null;
game.player = null;
game.enemies = [];
game.projectiles = [];
game.loot = [];
game.effects = [];
game.spawnMarks = [];
game.portalOpen = false;
syncTouchUi();
requestAnimationFrame(frame);
