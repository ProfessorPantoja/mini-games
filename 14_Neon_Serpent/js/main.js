import { Game } from "./game.js";
import { audio } from "./audio.js";

const canvas = document.getElementById("game");
const game = new Game(canvas);
const $ = (id) => document.getElementById(id);

const screens = {
  title: $("screen-title"),
  pause: $("screen-pause"),
  over: $("screen-over"),
  inter: $("screen-inter"),
  win: $("screen-win"),
};

function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) {
    if (!el) continue;
    el.hidden = k !== name;
    el.classList.toggle("active", k === name);
  }
  const hudOn = game.state === "playing" || game.state === "pause";
  $("hud").hidden = !hudOn;
}

function syncDevUi() {
  const dev = game.getDevFlags?.() || {};
  const on = !!dev.infiniteContinue;
  const ids = ["btn-skip-dev", "btn-skip-pause", "btn-skip-inter", "btn-skip-over", "btn-skip-win"];
  for (const id of ids) {
    const el = $(id);
    if (!el) continue;
    el.hidden = !on;
  }
}

function refreshHud() {
  $("hud-score").textContent = String(Math.floor(game.score));
  $("title-best").textContent = String(game.best);
  $("title-maxlvl").textContent = String(game.maxLevelReached || 1);
  $("hud-level").textContent = game.cfg ? String(game.cfg.id) : "1";
  $("hud-goal").textContent = game._goalLabel ? game._goalLabel() : "0";
  $("goal-fill").style.width = `${Math.floor((game._goalProgress?.() || 0) * 100)}%`;
  $("power-chip").textContent = game._powerLabel?.() || "";

  const wall = $("wall-chip");
  if (wall) {
    const label = game.wallModeLabel?.() || "";
    wall.textContent = label || "BORDA · —";
    wall.classList.toggle("lethal", !!game.isWallLethal?.());
  }
  syncDevUi();
}

game.on("hud", refreshHud);
game.on("toast", (msg) => {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove("show"), 900);
});
game.on("banner", ({ text, boss }) => {
  const b = $("banner");
  if (!text) {
    b.classList.remove("show", "boss");
    b.textContent = "";
    return;
  }
  b.textContent = text;
  b.classList.toggle("boss", !!boss);
  b.classList.add("show");
});
game.on("state", (data = {}) => {
  refreshHud();
  if (game.state === "title") showScreen("title");
  else if (game.state === "pause") showScreen("pause");
  else if (game.state === "over") {
    $("over-title").textContent = data.title || "FIM DE LINHA";
    $("over-msg").textContent = data.msg || "";
    $("over-score").textContent = String(Math.floor(game.score));
    $("over-level").textContent = game.cfg ? String(game.cfg.id) : "1";
    $("over-best").textContent = String(game.best);
    showScreen("over");
  } else if (game.state === "inter") {
    $("inter-title").textContent = data.title || "FASE LIMPA";
    $("inter-msg").textContent = data.msg || "";
    $("inter-next").textContent = data.isBoss
      ? `Próximo: BOSS · ${data.nextName}`
      : `Próximo: Fase ${data.nextId} · ${data.nextName}`;
    $("inter-score").textContent = String(Math.floor(game.score));
    showScreen("inter");
  } else if (game.state === "win") {
    $("win-score").textContent = String(Math.floor(game.score));
    $("win-best").textContent = String(game.best);
    showScreen("win");
  } else {
    for (const el of Object.values(screens)) {
      if (!el) continue;
      el.hidden = true;
      el.classList.remove("active");
    }
    $("hud").hidden = false;
  }
});

$("btn-start").onclick = () => { audio.unlock(); audio.click(); game.start(0); };
$("btn-pause").onclick = () => game.pause();
$("btn-resume").onclick = () => { audio.click(); game.resume(); };
$("btn-restart-pause").onclick = () => { audio.click(); game.start(game.levelIndex); };
$("btn-menu-pause").onclick = () => { audio.click(); game.toMenu(); };
$("btn-retry").onclick = () => { audio.unlock(); audio.click(); game.start(0); };
$("btn-menu-over").onclick = () => { audio.click(); game.toMenu(); };
$("btn-next").onclick = () => { audio.unlock(); audio.click(); game._continueCampaign(); };
$("btn-menu-inter").onclick = () => { audio.click(); game.toMenu(); };
$("btn-win-again").onclick = () => { audio.unlock(); audio.click(); game.start(0); };
$("btn-menu-win").onclick = () => { audio.click(); game.toMenu(); };

// Dev: pular fase (flag infiniteContinue)
const skip = () => { audio.unlock(); audio.click(); game.skipLevelDev(); };
for (const id of ["btn-skip-dev", "btn-skip-pause", "btn-skip-inter", "btn-skip-over", "btn-skip-win"]) {
  const el = $(id);
  if (el) el.onclick = skip;
}

refreshHud();
showScreen("title");

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
