/**
 * Pocket Boss — UI + wiring
 */

import { getLocalDayKey, formatDayLabel } from "./seed.js";
import { generateBoss, difficultyLabel, difficultyStars } from "./boss.js";
import { getDayRun, saveRun, getHistory } from "./storage.js";
import { unlockAudio, sfx } from "./audio.js";
import { initJuice, toast } from "./juice.js";
import { createCombat } from "./combat.js";
import { buildShareText, shareResult } from "./share.js";

const dayKey = getLocalDayKey();
const boss = generateBoss(dayKey);

let combat = null;
let lastResult = null;
let currentScreen = "menu";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function showScreen(name) {
  currentScreen = name;
  // Pause is an overlay — keep combat visible underneath
  $$(".screen").forEach((s) => {
    const id = s.dataset.screen;
    let match = id === name;
    if (name === "pause" && id === "combat") match = true;
    s.classList.toggle("active", match);
  });
}

function paintMenu() {
  $("#menu-date").textContent = formatDayLabel(dayKey);
  $("#menu-boss-name").textContent = boss.name;
  $("#menu-boss-title").textContent = boss.title;

  const portrait = $("#menu-portrait");
  if (portrait) {
    portrait.style.setProperty("--boss-color", boss.palette.color);
    portrait.style.background = `radial-gradient(circle at 35% 30%, #fff6, transparent 40%),
      radial-gradient(circle at 50% 55%, ${boss.palette.color}, #1a1020 70%)`;
    portrait.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.4), 0 0 28px ${boss.palette.glow}`;
  }
  const card = $("#daily-card");
  if (card) card.style.setProperty("--boss-glow", boss.palette.glow);

  const stats = $("#menu-boss-stats");
  stats.innerHTML = "";
  const pills = [
    { t: difficultyStars(boss.difficulty), hot: boss.difficulty >= 4 },
    { t: difficultyLabel(boss.difficulty) },
    { t: `${boss.maxHp} HP` },
    { t: `${boss.pattern.length} hits` },
  ];
  pills.forEach((p) => {
    const span = document.createElement("span");
    span.className = `pill${p.hot ? " hot" : ""}`;
    span.textContent = p.t;
    stats.appendChild(span);
  });

  const best = getDayRun(dayKey);
  const hint = $("#menu-best");
  if (best) {
    hint.classList.add("best");
    hint.textContent = `Melhor hoje: ${best.score.toLocaleString("pt-BR")} pts · ${best.won ? "vitória" : "derrota"} · ${"❤️".repeat(best.livesLeft)}${"🖤".repeat(3 - best.livesLeft)}`;
  } else {
    hint.classList.remove("best");
    hint.textContent = "Ainda não jogou hoje — boa sorte.";
  }
}

function paintRank() {
  const list = $("#rank-list");
  const empty = $("#rank-empty");
  const history = getHistory(20);
  list.innerHTML = "";
  if (!history.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  history.forEach((r) => {
    const li = document.createElement("li");
    li.className = "rank-item";
    li.innerHTML = `
      <span class="date">${formatDayLabel(r.dayKey)} · ${r.dayKey}</span>
      <span class="score">${r.score.toLocaleString("pt-BR")}</span>
      <span class="boss">${r.bossName || "Boss"}</span>
      <span class="meta">${r.won ? "Vitória" : "Derrota"} · ${"❤️".repeat(r.livesLeft || 0)}${"🖤".repeat(3 - (r.livesLeft || 0))} · combo ${r.comboMax || 0}</span>
    `;
    list.appendChild(li);
  });
}

function bindActions() {
  // menu
  $("#btn-play").addEventListener("click", () => {
    unlockAudio();
    sfx.ui();
    startFight();
  });
  $("#btn-how").addEventListener("click", () => {
    sfx.ui();
    showScreen("how");
  });
  $("#btn-rank").addEventListener("click", () => {
    sfx.ui();
    paintRank();
    showScreen("rank");
  });
  $("#btn-how-back").addEventListener("click", () => {
    sfx.ui();
    showScreen("menu");
  });
  $("#btn-rank-back").addEventListener("click", () => {
    sfx.ui();
    showScreen("menu");
  });

  // combat
  $("#btn-pause").addEventListener("click", () => {
    if (!combat) return;
    sfx.ui();
    combat.pause();
    showScreen("pause");
  });
  $("#btn-resume").addEventListener("click", () => {
    sfx.ui();
    combat?.resume();
    showScreen("combat");
  });
  $("#btn-quit").addEventListener("click", () => {
    sfx.ui();
    combat?.stop();
    combat = null;
    paintMenu();
    showScreen("menu");
  });

  // action buttons
  $$(".act-btn").forEach((btn) => {
    const act = btn.dataset.act;
    const fire = (e) => {
      e.preventDefault();
      unlockAudio();
      btn.classList.add("pressed");
      setTimeout(() => btn.classList.remove("pressed"), 120);
      combat?.input(act);
    };
    btn.addEventListener("pointerdown", fire);
  });

  // keyboard
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();

    if (currentScreen === "pause" && (key === "escape" || key === "p")) {
      e.preventDefault();
      $("#btn-resume").click();
      return;
    }

    if (currentScreen === "combat") {
      if (key === "escape" || key === "p") {
        e.preventDefault();
        $("#btn-pause").click();
        return;
      }
      const map = {
        a: "dodgeL",
        arrowleft: "dodgeL",
        d: "dodgeR",
        arrowright: "dodgeR",
        j: "attack",
        " ": "attack",
        k: "parry",
        shift: "parry",
      };
      const act = map[key];
      if (act) {
        e.preventDefault();
        unlockAudio();
        const sel = `.act-btn[data-act="${act}"]`;
        document.querySelector(sel)?.classList.add("pressed");
        setTimeout(() => document.querySelector(sel)?.classList.remove("pressed"), 100);
        combat?.input(act);
      }
    }

    if (currentScreen === "menu" && (key === "enter" || key === " ")) {
      e.preventDefault();
      $("#btn-play").click();
    }
  });

  // result
  $("#btn-share").addEventListener("click", async () => {
    if (!lastResult) return;
    unlockAudio();
    sfx.ui();
    const text = buildShareText(lastResult);
    const res = await shareResult(text);
    if (res.ok && res.method === "clipboard") {
      toast("COPIADO");
      const btn = $("#btn-share");
      const prev = btn.textContent;
      btn.textContent = "Copiado!";
      setTimeout(() => (btn.textContent = prev), 1400);
    } else if (!res.ok && !res.aborted) {
      toast("FALHA AO COPIAR");
    }
  });
  $("#btn-retry").addEventListener("click", () => {
    unlockAudio();
    sfx.ui();
    startFight();
  });
  $("#btn-home").addEventListener("click", () => {
    sfx.ui();
    paintMenu();
    showScreen("menu");
  });

  // first interaction unlock
  window.addEventListener("pointerdown", () => unlockAudio(), { once: true });
}

function startFight() {
  // fresh boss instance for HP
  const fightBoss = generateBoss(dayKey);
  combat?.stop();
  combat = createCombat(fightBoss, {
    onEnd: (run) => {
      finishRun(run, fightBoss);
    },
  });
  showScreen("combat");
  combat.start();
}

function finishRun(run, fightBoss) {
  const result = {
    dayKey,
    bossName: fightBoss.name,
    bossTitle: fightBoss.title,
    score: run.score,
    won: run.won,
    lives: run.lives,
    livesLeft: run.lives,
    perfects: run.perfects,
    comboMax: run.comboMax,
    timeMs: run.endedAt - run.startedAt,
    defenses: run.defenses,
    hitsLanded: run.hitsLanded,
  };
  lastResult = result;

  const { isNewBest, best } = saveRun(dayKey, result);

  // paint result
  const card = $("#result-card");
  card.classList.toggle("victory", result.won);
  card.classList.toggle("defeat", !result.won);
  $("#result-eyebrow").textContent = result.won ? "VITÓRIA" : "DERROTA";
  $("#result-title").textContent = result.won ? "Boss derrotado" : "Você caiu";
  $("#result-boss").textContent = `${fightBoss.name} — ${fightBoss.title}`;

  const stats = $("#result-stats");
  const cells = [
    { k: "Pontos", v: result.score.toLocaleString("pt-BR") },
    { k: "Tempo", v: formatMs(result.timeMs) },
    { k: "Perfects", v: String(result.perfects) },
    { k: "Combo máx", v: String(result.comboMax) },
    { k: "Vidas", v: `${result.livesLeft}/3` },
    { k: "Recorde", v: isNewBest ? "NOVO!" : best.score.toLocaleString("pt-BR") },
  ];
  stats.innerHTML = cells
    .map(
      (c) => `<div class="stat-cell"><span class="v">${c.v}</span><span class="k">${c.k}</span></div>`
    )
    .join("");

  $("#share-preview").textContent = buildShareText(result);
  showScreen("result");
}

function formatMs(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function boot() {
  initJuice($("#fx-canvas"));
  paintMenu();
  bindActions();
  showScreen("menu");
}

boot();
