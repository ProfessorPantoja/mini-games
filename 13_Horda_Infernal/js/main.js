/** Bootstrap — Horda Infernal */

import { W, H } from "./config.js";
import { AudioBus } from "./audio.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";

const canvas = document.getElementById("game");
canvas.width = W;
canvas.height = H;

const audio = new AudioBus();
const ui = new UI();
const game = new Game(canvas, audio, ui);

// ─── Buttons ───
document.getElementById("btn-start").addEventListener("click", () => {
  game.startRun();
});

document.getElementById("btn-resume")?.addEventListener("click", () => game.resume());
document.getElementById("btn-retry")?.addEventListener("click", () => game.startRun());
document.getElementById("btn-retry-win")?.addEventListener("click", () => game.startRun());
document.getElementById("btn-menu")?.addEventListener("click", () => {
  audio.stopAmbience();
  game.state = "title";
  ui.showTitle();
});
document.getElementById("btn-menu-win")?.addEventListener("click", () => {
  audio.stopAmbience();
  game.state = "title";
  ui.showTitle();
});

document.getElementById("btn-equip").addEventListener("click", () => game.acceptLoot());
document.getElementById("btn-skip-loot").addEventListener("click", () => game.rejectLoot());

// power select clicks
document.getElementById("power-choices")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".power-btn");
  if (!btn || !btn.dataset.powerId) return;
  game.pickPower(btn.dataset.powerId);
});

// keyboard loot / power shortcuts
window.addEventListener("keydown", (e) => {
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
    game.startRun();
  }
  if ((game.state === "defeat" || game.state === "victory") && e.code === "Enter") {
    game.startRun();
  }
});

// ─── Touch controls ───
const touchUi = document.getElementById("touch-ui");
const stickZone = document.getElementById("stick-zone");
const stickKnob = document.getElementById("stick-knob");
const atkBtn = document.getElementById("atk-btn");
const dashBtn = document.getElementById("dash-btn");

function isCoarse() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches
    || navigator.maxTouchPoints > 0;
}

if (isCoarse()) {
  touchUi.classList.add("on");
}

let stickId = null;
const stickCenter = { x: 60, y: 60 };
const stickMax = 40;

stickZone.addEventListener("pointerdown", (e) => {
  stickId = e.pointerId;
  stickZone.setPointerCapture(e.pointerId);
  moveStick(e);
});
stickZone.addEventListener("pointermove", (e) => {
  if (e.pointerId === stickId) moveStick(e);
});
function endStick(e) {
  if (e.pointerId !== stickId) return;
  stickId = null;
  game.touchMove.x = 0;
  game.touchMove.y = 0;
  stickKnob.style.transform = "translate(-50%, -50%)";
}
stickZone.addEventListener("pointerup", endStick);
stickZone.addEventListener("pointercancel", endStick);

function moveStick(e) {
  const r = stickZone.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const d = Math.hypot(dx, dy) || 1;
  if (d > stickMax) {
    dx = (dx / d) * stickMax;
    dy = (dy / d) * stickMax;
  }
  stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  game.touchMove.x = dx / stickMax;
  game.touchMove.y = dy / stickMax;
}

atkBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  game.touchAttack = true;
});
atkBtn.addEventListener("pointerup", () => { game.touchAttack = false; });
atkBtn.addEventListener("pointercancel", () => { game.touchAttack = false; });

dashBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
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
  // clamp big hitches
  if (dt > 0.05) dt = 0.05;

  if (game.state === "playing" || game.state === "loot" || game.state === "levelup") {
    game.update(dt);
  } else {
    // still animate particles lightly on title? skip
    game.shake.update(dt);
    game.particles.update(dt);
  }

  game.draw();
  // title idle embers
  if (game.state === "title" && Math.random() < 0.08) {
    game.particles.embers(
      Math.random() * W,
      H * 0.7 + Math.random() * H * 0.25,
      1,
    );
  }
  if (game.state === "title") {
    // soft draw of empty arena as backdrop
  }

  requestAnimationFrame(frame);
}

ui.showTitle();
// draw once so canvas isn't black
game.stage = null;
game.player = null;
game.enemies = [];
game.projectiles = [];
game.loot = [];
game.effects = [];
game.spawnMarks = [];
game.portalOpen = false;
requestAnimationFrame(frame);
