import { Game } from "./game.js";
import { audio } from "./audio.js";

const canvas = document.getElementById("game");
const game = new Game(canvas);
const $ = (id) => document.getElementById(id);

const screens = {
  title: $("screen-title"),
  pause: $("screen-pause"),
  over: $("screen-over"),
};

function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) {
    el.hidden = k !== name;
    el.classList.toggle("active", k === name);
  }
  $("hud").hidden = game.state !== "playing" && game.state !== "pause";
}

function refreshHud() {
  $("hud-score").textContent = String(Math.floor(game.score));
  $("hud-speed").textContent = String(Math.floor(game.speed * 0.35));
  $("hud-best").textContent = String(game.best);
  $("title-best").textContent = String(game.best);
  $("hud-nitro").style.width = `${Math.floor((game.nitro || 0) * 100)}%`;

  const lives = $("hud-lives");
  lives.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const h = document.createElement("span");
    h.className = "heart" + (i < game.lives ? "" : " off");
    lives.appendChild(h);
  }

  const combo = $("combo");
  if (game.combo >= 2 && game.state === "playing") {
    combo.hidden = false;
    combo.textContent = `×${game.combo}`;
  } else {
    combo.hidden = true;
  }
}

game.on("hud", refreshHud);
game.on("combo", refreshHud);
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
    $("over-title").textContent = data.title || "CRASH";
    $("over-msg").textContent = data.msg || "";
    $("over-score").textContent = String(Math.floor(game.score));
    $("over-dist").textContent = `${Math.floor(game.dist)} m`;
    $("over-best").textContent = String(game.best);
    showScreen("over");
  } else {
    for (const el of Object.values(screens)) {
      el.hidden = true;
      el.classList.remove("active");
    }
    $("hud").hidden = false;
  }
});

$("btn-start").onclick = () => { audio.unlock(); audio.click(); game.start(); };
$("btn-pause").onclick = () => game.pause();
$("btn-resume").onclick = () => { audio.click(); game.resume(); };
$("btn-restart-pause").onclick = () => { audio.click(); game.start(); };
$("btn-menu-pause").onclick = () => { audio.click(); game.toMenu(); };
$("btn-retry").onclick = () => { audio.unlock(); audio.click(); game.start(); };
$("btn-menu-over").onclick = () => { audio.click(); game.toMenu(); };

refreshHud();
showScreen("title");

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  // idle scroll on title
  if (game.state === "title") game.scroll += 140 * dt;
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
