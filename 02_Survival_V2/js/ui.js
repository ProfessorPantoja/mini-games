import { WORLD, BOSS, COLORS } from "./config.js";
import { formatTime } from "./utils.js";
import { BUILDS } from "./builds.js";

const $ = (id) => document.getElementById(id);

export function bindUI(handlers) {
  // botões de build no menu
  document.querySelectorAll("[data-build]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const build = btn.getAttribute("data-build");
      handlers.onPlay?.(build);
    });
  });

  $("btn-restart")?.addEventListener("click", () => handlers.onRestart?.());
  $("btn-again")?.addEventListener("click", () => handlers.onRestart?.());
  $("btn-menu-go")?.addEventListener("click", () => handlers.onMenu?.());
  $("btn-menu-vic")?.addEventListener("click", () => handlers.onMenu?.());
}

export function showMenu() {
  setVisible("menu", true);
  setVisible("hud", false);
  setVisible("gameover", false);
  setVisible("victory", false);
  setVisible("card-overlay", false);
  setVisible("banner", false);
}

export function showHud() {
  setVisible("menu", false);
  setVisible("hud", true);
  setVisible("gameover", false);
  setVisible("victory", false);
}

export function showGameOver(time, kills) {
  setVisible("gameover", true);
  setVisible("card-overlay", false);
  $("go-stats").textContent = `Tempo: ${formatTime(time)}  ·  Kills: ${kills}`;
}

export function showVictory(time, kills) {
  setVisible("victory", true);
  setVisible("card-overlay", false);
  $("vic-stats").textContent = `Tempo: ${formatTime(time)}  ·  Kills: ${kills}`;
}

export function setBuildLabel(buildId) {
  const b = BUILDS[buildId];
  const el = $("build-label");
  if (el && b) el.textContent = b.name;
}

export function setMuteHint(enabled) {
  const el = $("mute-hint");
  if (el) el.textContent = enabled ? "Som ligado (M no menu)" : "Som mudo (M no menu)";
}

export function updateHud(state) {
  const p = state.player;
  $("hp-text").textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
  $("level-text").textContent = String(p.level);
  $("xp-text").textContent = `${p.xp}/${p.xpToNext}`;
  $("kills-text").textContent = String(p.kills);
  $("time-text").textContent = formatTime(state.time);
  $("phase-text").textContent = state.phaseLabel;
  $("objective").textContent = state.objectiveText;

  const pct = Math.max(0, (p.hp / p.maxHp) * 100);
  $("hp-bar").style.width = `${pct}%`;
  if (pct < 30) {
    $("hp-bar").style.background = "linear-gradient(90deg, #8a2a2a, #ff5a5a)";
  } else if (p.build === "scout") {
    $("hp-bar").style.background = "linear-gradient(90deg, #8a4a2a, #ff8a4a)";
  } else {
    $("hp-bar").style.background = "linear-gradient(90deg, #2a8a4a, #3dffa0)";
  }
}

export function showBanner(text, ms = 1800) {
  const el = $("banner");
  el.textContent = text;
  setVisible("banner", true);
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => setVisible("banner", false), ms);
}

export function showCards(cards, onPick) {
  const container = $("cards");
  container.innerHTML = "";
  setVisible("card-overlay", true);

  if (showCards._keyHandler) {
    window.removeEventListener("keydown", showCards._keyHandler);
  }

  cards.forEach((card, i) => {
    const div = document.createElement("button");
    div.className = "card";
    div.type = "button";
    div.innerHTML = `
      <span class="key">${i + 1}</span>
      <span class="icon">${card.icon}</span>
      <h3>${card.name}</h3>
      <p>${card.desc}</p>
    `;
    div.addEventListener("click", () => {
      hideCards();
      onPick(card);
    });
    container.appendChild(div);
  });

  const keyHandler = (e) => {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= cards.length) {
      hideCards();
      onPick(cards[n - 1]);
    }
  };
  window.addEventListener("keydown", keyHandler);
  showCards._keyHandler = keyHandler;
}

export function hideCards() {
  setVisible("card-overlay", false);
  if (showCards._keyHandler) {
    window.removeEventListener("keydown", showCards._keyHandler);
    showCards._keyHandler = null;
  }
}

export function drawMinimap(canvas, state) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(10, 22, 16, 0.95)";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(40, 80, 55, 0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  for (const z of state.eliteZones) {
    const done = state.clearedElites.has(z.id);
    ctx.beginPath();
    ctx.arc(z.x * sx, z.y * sy, z.r * sx, 0, Math.PI * 2);
    ctx.fillStyle = done ? "rgba(100,60,150,0.25)" : "rgba(176,96,255,0.45)";
    ctx.fill();
  }

  if (state.bossUnlocked) {
    ctx.beginPath();
    ctx.arc(BOSS.x * sx, BOSS.y * sy, BOSS.zoneR * sx, 0, Math.PI * 2);
    ctx.fillStyle = state.bossDefeated
      ? "rgba(150,80,20,0.25)"
      : "rgba(255,140,42,0.55)";
    ctx.fill();
  }

  if (state.objective && !state.bossDefeated) {
    const o = state.objective;
    ctx.fillStyle = COLORS.objective;
    ctx.beginPath();
    ctx.arc(o.x * sx, o.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (e.isElite) {
      ctx.fillStyle = "#b060ff";
      ctx.fillRect(e.x * sx - 2, e.y * sy - 2, 4, 4);
    } else if (e.isBoss) {
      ctx.fillStyle = "#ff8c2a";
      ctx.beginPath();
      ctx.arc(e.x * sx, e.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const p = state.player;
  ctx.fillStyle = p.build === "scout" ? "#ff6a3a" : "#3a7cff";
  ctx.beginPath();
  ctx.arc(p.x * sx, p.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function setVisible(id, on) {
  const el = $(id);
  if (!el) return;
  el.classList.toggle("hidden", !on);
}
