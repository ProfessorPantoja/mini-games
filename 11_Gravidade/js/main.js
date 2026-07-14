import { Game, TOTAL_LEVELS } from "./game.js";
import { audio } from "./audio.js";

const canvas = document.getElementById("game");
const game = new Game(canvas);
const $ = (id) => document.getElementById(id);
const screens = { title: $("screen-title"), pause: $("screen-pause"), over: $("screen-over"), win: $("screen-win") };

function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) {
    el.hidden = k !== name;
    el.classList.toggle("active", k === name);
  }
  const playing = game.state === "paint" || game.state === "sim";
  $("hud").hidden = !playing;
  $("toolbar").hidden = game.state !== "paint";
}

function refreshHud() {
  $("hud-level").textContent = String(game.levelIndex + 1);
  $("hud-ink").textContent = String(game.inkLeft ?? 0);
  $("hud-mode").textContent = game.state === "sim" ? "Voo" : "Pintar";
  $("hud-score").textContent = String(game.score);
  $("title-best").textContent = String(game.best);
  document.querySelectorAll(".tool[data-dir]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.dir === game.dir);
  });
}

game.on("hud", refreshHud);
game.on("toast", (msg) => {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove("show"), 900);
});
game.on("state", (data = {}) => {
  refreshHud();
  if (game.state === "title") showScreen("title");
  else if (game.state === "pause") showScreen("pause");
  else if (game.state === "over") {
    $("over-title").textContent = data.title || "Fim";
    $("over-msg").textContent = data.msg || "";
    $("over-score").textContent = String(game.score);
    $("over-best").textContent = String(game.best);
    showScreen("over");
    $("btn-retry").textContent = "Repintar nível";
  } else if (game.state === "win") {
    $("win-title").textContent = data.title || "Nível!";
    $("win-msg").textContent = data.msg || "";
    $("win-score").textContent = String(data.score ?? game.score);
    $("win-bonus").textContent = String(data.bonus ?? 0);
    $("btn-next").textContent = game.levelIndex >= TOTAL_LEVELS - 1 ? "Ver resultado" : "Próximo nível";
    showScreen("win");
  } else {
    for (const el of Object.values(screens)) { el.hidden = true; el.classList.remove("active"); }
    $("hud").hidden = false;
    $("toolbar").hidden = game.state !== "paint";
  }
});

$("btn-start").onclick = () => { audio.unlock(); audio.click(); game.startGame(); };
$("btn-pause").onclick = () => game.pause();
$("btn-resume").onclick = () => { audio.click(); game.resume(); };
$("btn-restart-pause").onclick = () => { audio.click(); game.retryLevel(); };
$("btn-menu-pause").onclick = () => { audio.click(); game.toMenu(); };
$("btn-retry").onclick = () => { audio.unlock(); audio.click(); game.retryLevel(); };
$("btn-menu-over").onclick = () => { audio.click(); game.toMenu(); };
$("btn-next").onclick = () => { audio.click(); game.nextLevel(); };
$("btn-menu-win").onclick = () => { audio.click(); game.toMenu(); };
$("btn-launch").onclick = () => { audio.unlock(); game.launch(); };
$("btn-clear").onclick = () => { audio.click(); game.clearPaint(); };
document.querySelectorAll(".tool[data-dir]").forEach((btn) => {
  btn.onclick = () => { audio.click(); game.setDir(btn.dataset.dir); };
});

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
