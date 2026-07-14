/**
 * Loop de combate — state machine de turnos do boss.
 *
 * Fluxo por ataque:
 *   idle → telegraph (windup) → impact → recover → idle
 *
 * Player actions: dodgeL, dodgeR, parry, attack
 * - Defesa válida no final do windup (± janela)
 * - Attack só em "open" window após defesa bem-sucedida (ou gap)
 */

import {
  correctDefense,
  telegraphClass,
  attackLabel,
} from "./boss.js";
import { sfx } from "./audio.js";
import {
  burst,
  ring,
  shake,
  flash,
  floatText,
  toast,
  hitStop,
  arenaPoint,
} from "./juice.js";

const STATE = {
  IDLE: "idle",
  TELEGRAPH: "telegraph",
  IMPACT: "impact",
  RECOVER: "recover",
  OPEN: "open",
  PHASE: "phase",
  END: "end",
};

export function createCombat(boss, hooks = {}) {
  const el = {
    player: document.getElementById("player"),
    boss: document.getElementById("boss"),
    bossCore: document.getElementById("boss-core"),
    telegraph: document.getElementById("telegraph"),
    hpFill: document.getElementById("boss-hp-fill"),
    hpGlow: document.getElementById("boss-hp-glow"),
    lives: document.getElementById("hud-lives"),
    score: document.getElementById("hud-score"),
    comboNum: document.getElementById("combo-num"),
    combo: document.getElementById("hud-combo"),
    timer: document.getElementById("hud-timer"),
    phase: document.getElementById("combat-boss-phase"),
    bossName: document.getElementById("combat-boss-name"),
    arenaName: document.getElementById("boss-arena-name"),
    floats: document.getElementById("float-texts"),
    arena: document.getElementById("arena"),
  };

  const run = {
    lives: 3,
    score: 0,
    combo: 0,
    comboMax: 0,
    perfects: 0,
    hitsLanded: 0,
    defenses: 0,
    startedAt: 0,
    endedAt: 0,
    won: false,
    paused: false,
    patternIndex: 0,
    phaseIndex: 0,
    speed: 1,
  };

  let state = STATE.IDLE;
  let stateUntil = 0;
  let currentAtk = null;
  let defenseWindow = { open: false, from: 0, to: 0, resolved: false };
  let openUntil = 0;
  let lastActionAt = 0;
  let pendingDefense = null; // action held during windup
  let raf = 0;
  let alive = false;

  // timing windows (ms) — generosas no MVP; perfect ainda recompensa precisão
  const PARRY_PERFECT = 120;
  const DEFENSE_EARLY = 280;
  const DEFENSE_LATE = 140;
  const ACTION_COOLDOWN = 120;
  const OPEN_WINDOW = 720;
  const INPUT_BUFFER = 220; // ms antes da janela em que o input fica guardado

  function now() {
    return performance.now();
  }

  function applyBossTheme() {
    document.documentElement.style.setProperty("--boss-color", boss.palette.color);
    document.documentElement.style.setProperty("--boss-glow", boss.palette.glow);
    if (el.bossCore) {
      el.bossCore.style.background = `radial-gradient(circle at 35% 30%, #fff6, transparent 40%),
        radial-gradient(circle at 50% 55%, ${boss.palette.color}, #1a0a18)`;
      el.bossCore.style.boxShadow = `0 0 28px ${boss.palette.glow}`;
    }
    if (el.bossName) el.bossName.textContent = boss.name.toUpperCase();
    if (el.arenaName) el.arenaName.textContent = boss.name.split(" ")[0].toUpperCase();
    if (el.phase) el.phase.textContent = boss.phases[0].label;
    updateHp();
    updateHud();
  }

  function updateHp() {
    const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
    if (el.hpFill) el.hpFill.style.width = `${pct}%`;
    const bar = el.hpFill?.parentElement;
    if (bar) bar.setAttribute("aria-valuenow", String(Math.round(pct)));
  }

  function updateHud() {
    if (el.score) el.score.textContent = String(run.score);
    if (el.comboNum) el.comboNum.textContent = String(run.combo);
    if (el.combo) {
      el.combo.classList.toggle("hot", run.combo >= 2);
      el.combo.classList.toggle("blaze", run.combo >= 8);
    }
    if (el.lives) {
      el.lives.querySelectorAll(".heart").forEach((h, i) => {
        h.classList.toggle("lost", i >= run.lives);
      });
    }
    if (el.timer && run.startedAt) {
      const t = Math.floor(((run.endedAt || now()) - run.startedAt) / 1000);
      const m = Math.floor(t / 60);
      const s = String(t % 60).padStart(2, "0");
      el.timer.textContent = `${m}:${s}`;
    }
  }

  function setFighterClass(node, cls, ms = 180) {
    if (!node) return;
    const all = ["dodge-left", "dodge-right", "attacking", "hit", "parrying", "dead"];
    all.forEach((c) => node.classList.remove(c));
    if (!cls) return;
    node.classList.add(cls);
    if (ms > 0) {
      setTimeout(() => node.classList.remove(cls), ms);
    }
  }

  function clearTelegraph() {
    if (!el.telegraph) return;
    el.telegraph.className = "telegraph";
    el.telegraph.style.width = "0";
    el.telegraph.style.height = "0";
    el.telegraph.style.opacity = "0";
  }

  function showTelegraph(atk, windup) {
    if (!el.telegraph) return;
    const cls = telegraphClass(atk);
    el.telegraph.className = `telegraph active ${cls}`;
    el.telegraph.style.transition = "none";
    el.telegraph.style.width = "20px";
    el.telegraph.style.height = "20px";
    el.telegraph.style.opacity = "0.9";
    // expand during windup
    requestAnimationFrame(() => {
      el.telegraph.style.transition = `width ${windup}ms linear, height ${windup}ms linear, opacity 80ms`;
      el.telegraph.style.width = "160px";
      el.telegraph.style.height = "160px";
    });
    sfx.telegraph();
  }

  function nextAttack() {
    currentAtk = boss.pattern[run.patternIndex % boss.pattern.length];
    run.patternIndex++;
    // small seed-free variation late-game: occasionally inject from pool
    if (run.patternIndex > boss.pattern.length && Math.random() < 0.18) {
      currentAtk = boss.pool[Math.floor(Math.random() * boss.pool.length)];
    }
  }

  function windupMs() {
    return Math.max(320, boss.baseWindup / run.speed);
  }

  function recoverMs() {
    return Math.max(180, boss.baseRecover / run.speed);
  }

  function gapMs() {
    return Math.max(200, boss.attackGap / run.speed);
  }

  function enterIdle() {
    state = STATE.IDLE;
    currentAtk = null;
    pendingDefense = null;
    defenseWindow = { open: false, from: 0, to: 0, resolved: false };
    clearTelegraph();
    stateUntil = now() + gapMs();
  }

  function enterTelegraph() {
    nextAttack();
    state = STATE.TELEGRAPH;
    const w = windupMs();
    const t = now();
    stateUntil = t + w;
    // defense window near end of windup
    defenseWindow = {
      open: true,
      from: t + w - DEFENSE_EARLY,
      to: t + w + DEFENSE_LATE,
      impactAt: t + w,
      resolved: false,
      perfectFrom: t + w - PARRY_PERFECT / 2,
      perfectTo: t + w + PARRY_PERFECT / 2,
    };
    pendingDefense = null;
    showTelegraph(currentAtk, w);
    hooks.onTelegraph?.(currentAtk, attackLabel(currentAtk));
  }

  function resolveDefense(action, at) {
    if (defenseWindow.resolved || state === STATE.END) return false;
    if (!defenseWindow.open) return false;

    const need = correctDefense(currentAtk);
    let ok = false;
    let perfect = false;

    if (at < defenseWindow.from) {
      // buffer: guarda o input e resolve no impacto se ainda estiver válido
      pendingDefense = { action, at, early: true };
      return false;
    }
    if (at > defenseWindow.to) {
      return false;
    }

    if (need === "dodgeAny") {
      ok = action === "dodgeL" || action === "dodgeR";
    } else {
      ok = action === need;
    }

    // perfect: parry on slam in tight window, or exact dodge in tight window
    if (ok && at >= defenseWindow.perfectFrom && at <= defenseWindow.perfectTo) {
      perfect = action === "parry" || need === "dodgeAny" || need.startsWith("dodge");
      if (action === "parry" && need === "parry") perfect = true;
      else if (action === "parry") perfect = false;
      else if (need.startsWith("dodge") || need === "dodgeAny") {
        perfect = at >= defenseWindow.perfectFrom && at <= defenseWindow.perfectTo;
      }
    }
    if (ok && action === "parry" && need === "parry") {
      perfect = at >= defenseWindow.perfectFrom && at <= defenseWindow.perfectTo;
    }

    defenseWindow.resolved = true;
    defenseWindow.open = false;
    pendingDefense = null;

    if (!ok) {
      // wrong move during window — will take hit at impact unless... already failed
      defenseWindow.failed = true;
      sfx.miss();
      floatAtPlayer("ERROU", "miss");
      return true;
    }

    defenseWindow.success = true;
    defenseWindow.perfect = perfect;
    run.defenses++;

    if (action === "dodgeL") setFighterClass(el.player, "dodge-left", 220);
    else if (action === "dodgeR") setFighterClass(el.player, "dodge-right", 220);
    else if (action === "parry") setFighterClass(el.player, "parrying", 280);

    if (perfect) {
      run.perfects++;
      run.combo++;
      run.comboMax = Math.max(run.comboMax, run.combo);
      addScore(40 + run.combo * 4, "perfect");
      sfx.perfect();
      ring(...xy(el.player), "#f0abfc");
      flash("rgba(240,171,252,0.35)", 70);
      floatAtPlayer("PERFECT", "perfect");
      toast("PERFECT");
      hitStop(50);
    } else {
      run.combo++;
      run.comboMax = Math.max(run.comboMax, run.combo);
      addScore(18 + run.combo * 2, "defense");
      if (action === "parry") sfx.parry();
      else sfx.dodge();
      floatAtPlayer(action === "parry" ? "PARRY" : "ESQUIVA", "perfect");
    }
    sfx.combo(run.combo);
    updateHud();
    return true;
  }

  function onImpact() {
    state = STATE.IMPACT;
    stateUntil = now() + 120;
    clearTelegraph();
    setFighterClass(el.boss, "attacking", 200);

    // Input buffer: apertou um pouco cedo → resolve no impacto (sem perfect)
    if (!defenseWindow.resolved && pendingDefense) {
      const age = defenseWindow.impactAt - pendingDefense.at;
      if (age <= DEFENSE_EARLY + INPUT_BUFFER) {
        // força timing "na janela" mas fora do perfect
        const safeAt = defenseWindow.from + 1;
        resolveDefense(pendingDefense.action, safeAt);
      }
    }

    const success = defenseWindow.success && !defenseWindow.failed;
    if (!success) {
      // player hit
      takeDamage();
    } else {
      // boss whiff juice
      burst(...xy(el.player, "center"), {
        color: boss.palette.accent,
        count: 8,
        speed: 3,
        size: 2,
      });
      // open window for counter
      openUntil = now() + OPEN_WINDOW * (defenseWindow.perfect ? 1.25 : 1);
    }
  }

  function takeDamage() {
    run.lives = Math.max(0, run.lives - 1);
    run.combo = 0;
    updateHud();
    const hearts = el.lives?.querySelectorAll(".heart");
    if (hearts && hearts[run.lives]) {
      hearts[run.lives].classList.add("pop", "lost");
    }
    setFighterClass(el.player, "hit", 300);
    sfx.hurt();
    shake("md");
    flash("rgba(251,113,133,0.4)", 100);
    floatAtPlayer("-1 ♥", "hurt");
    burst(...xy(el.player), { color: "#fb7185", count: 16, speed: 5 });

    if (run.lives <= 0) {
      endRun(false);
    }
  }

  function addScore(n) {
    run.score += Math.max(0, Math.round(n));
    updateHud();
  }

  function xy(node, side = "center") {
    const p = arenaPoint(node, side);
    return [p.x, p.y];
  }

  function floatAtPlayer(text, cls) {
    const p = arenaPoint(el.player);
    floatText(el.floats, text, p.x, p.y - 20, cls);
  }

  function floatAtBoss(text, cls) {
    const p = arenaPoint(el.boss);
    floatText(el.floats, text, p.x, p.y - 24, cls);
  }

  function tryAttack() {
    if (state === STATE.END || run.paused) return;
    const t = now();
    if (t - lastActionAt < ACTION_COOLDOWN) return;
    lastActionAt = t;

    // only meaningful in open window or recover after success
    const canHit =
      (state === STATE.OPEN || state === STATE.RECOVER || state === STATE.IDLE) &&
      t <= openUntil &&
      openUntil > 0;

    setFighterClass(el.player, "attacking", 160);
    sfx.attack();

    if (!canHit || boss.hp <= 0) {
      if (state === STATE.TELEGRAPH) {
        // attacking during windup is risky / wasted
        floatAtPlayer("CEDO", "miss");
        sfx.miss();
      } else {
        floatAtPlayer("BLOQUEADO", "miss");
      }
      return;
    }

    const mult = 1 + Math.min(run.combo, 15) * 0.08;
    const perfectBonus = defenseWindow.perfect ? boss.perfectBonus : 0;
    const dmg = Math.round((boss.playerDamage + perfectBonus) * mult);
    boss.hp = Math.max(0, boss.hp - dmg);
    run.hitsLanded++;
    addScore(dmg * 3 + run.combo * 2);

    setFighterClass(el.boss, "hit", 220);
    el.hpGlow?.classList.remove("flash");
    void el.hpGlow?.offsetWidth;
    el.hpGlow?.classList.add("flash");
    updateHp();

    sfx.hit();
    shake(dmg > 18 ? "md" : "sm");
    flash("rgba(251,191,36,0.25)", 50);
    burst(...xy(el.boss), { color: "#fbbf24", count: 12 + Math.min(run.combo, 8), speed: 4.5 });
    floatAtBoss(`-${dmg}`, "dmg");
    hitStop(dmg > 20 ? 45 : 28);

    // consume some of open window
    openUntil = Math.min(openUntil, t + 220);

    checkPhase();
    if (boss.hp <= 0) {
      endRun(true);
    }
  }

  function checkPhase() {
    const ratio = boss.hp / boss.maxHp;
    for (let i = run.phaseIndex + 1; i < boss.phases.length; i++) {
      if (ratio <= boss.phases[i].at) {
        run.phaseIndex = i;
        run.speed = boss.phases[i].speed;
        if (el.phase) el.phase.textContent = boss.phases[i].label;
        state = STATE.PHASE;
        stateUntil = now() + 700;
        clearTelegraph();
        defenseWindow.open = false;
        sfx.phase();
        toast(boss.phases[i].label);
        shake("lg");
        flash(boss.palette.glow, 120);
        ring(...xy(el.boss), boss.palette.color);
        floatAtBoss(boss.phases[i].label, "phase");
        addScore(100 * i);
        return;
      }
    }
  }

  function enterRecover() {
    state = STATE.RECOVER;
    stateUntil = now() + recoverMs();
    if (defenseWindow.success) {
      // ensure open window
      openUntil = Math.max(openUntil, now() + OPEN_WINDOW * 0.7);
    }
  }

  function enterOpen() {
    state = STATE.OPEN;
    stateUntil = openUntil || now() + 200;
  }

  function endRun(won) {
    if (state === STATE.END) return;
    state = STATE.END;
    alive = false;
    run.won = won;
    run.endedAt = now();
    openUntil = 0;
    clearTelegraph();
    defenseWindow.open = false;

    if (won) {
      const timeBonus = Math.max(0, 500 - Math.floor((run.endedAt - run.startedAt) / 100));
      const lifeBonus = run.lives * 150;
      addScore(timeBonus + lifeBonus + 250);
      setFighterClass(el.boss, "dead", 0);
      sfx.win();
      shake("lg");
      flash("rgba(52,211,153,0.35)", 150);
      burst(...xy(el.boss), { color: "#34d399", count: 28, speed: 6, size: 4 });
      toast("KO");
    } else {
      setFighterClass(el.player, "dead", 0);
      sfx.lose();
      shake("md");
      toast("DERROTA");
    }
    updateHud();
    cancelAnimationFrame(raf);
    hooks.onEnd?.({ ...run, bossHp: boss.hp, bossMaxHp: boss.maxHp });
  }

  function tick() {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    if (run.paused || state === STATE.END) {
      updateHud();
      return;
    }

    const t = now();
    updateHud();

    // expire open window
    if (openUntil && t > openUntil) openUntil = 0;

    if (t < stateUntil) return;

    switch (state) {
      case STATE.IDLE:
        enterTelegraph();
        break;
      case STATE.TELEGRAPH:
        onImpact();
        break;
      case STATE.IMPACT:
        enterRecover();
        break;
      case STATE.RECOVER:
        if (openUntil > t) enterOpen();
        else enterIdle();
        break;
      case STATE.OPEN:
        enterIdle();
        break;
      case STATE.PHASE:
        enterIdle();
        break;
      default:
        break;
    }
  }

  function input(action) {
    if (!alive || run.paused || state === STATE.END) return;
    const t = now();

    // visual press
    hooks.onInput?.(action);

    if (action === "attack") {
      tryAttack();
      return;
    }

    if (t - lastActionAt < ACTION_COOLDOWN * 0.6) return;
    lastActionAt = t;

    if (state === STATE.TELEGRAPH || (defenseWindow.open && t <= defenseWindow.to)) {
      // buffer cedo ou resolve na janela
      if (t < defenseWindow.from) {
        pendingDefense = { action, at: t, early: true };
        if (action === "dodgeL") setFighterClass(el.player, "dodge-left", 180);
        if (action === "dodgeR") setFighterClass(el.player, "dodge-right", 180);
        if (action === "parry") setFighterClass(el.player, "parrying", 180);
        return;
      }
      resolveDefense(action, t);
      return;
    }

    // idle dodge fluff
    if (action === "dodgeL") {
      setFighterClass(el.player, "dodge-left", 160);
      sfx.dodge();
    } else if (action === "dodgeR") {
      setFighterClass(el.player, "dodge-right", 160);
      sfx.dodge();
    } else if (action === "parry") {
      setFighterClass(el.player, "parrying", 160);
      sfx.parry();
    }
  }

  function start() {
    boss.hp = boss.maxHp;
    run.lives = 3;
    run.score = 0;
    run.combo = 0;
    run.comboMax = 0;
    run.perfects = 0;
    run.hitsLanded = 0;
    run.defenses = 0;
    run.patternIndex = 0;
    run.phaseIndex = 0;
    run.speed = 1;
    run.won = false;
    run.paused = false;
    run.startedAt = now();
    run.endedAt = 0;
    alive = true;
    openUntil = 0;

    // reset classes
    el.player?.classList.remove("dead", "hit", "attacking", "dodge-left", "dodge-right", "parrying");
    el.boss?.classList.remove("dead", "hit", "attacking");
    el.lives?.querySelectorAll(".heart").forEach((h) => h.classList.remove("lost", "pop"));

    applyBossTheme();
    enterIdle();
    // slight delay before first attack
    stateUntil = now() + 900;
    toast("FIGHT");
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function pause() {
    run.paused = true;
  }

  function resume() {
    // shift timers so pause doesn't eat windows
    const t = now();
    // simple approach: push stateUntil if needed — not perfect but ok for MVP
    if (stateUntil < t) stateUntil = t + 200;
    run.paused = false;
  }

  function stop() {
    alive = false;
    cancelAnimationFrame(raf);
    clearTelegraph();
  }

  function getResult() {
    return {
      ...run,
      timeMs: (run.endedAt || now()) - run.startedAt,
      bossName: boss.name,
      bossTitle: boss.title,
      difficulty: boss.difficulty,
      dayKey: boss.dayKey,
    };
  }

  return {
    start,
    stop,
    pause,
    resume,
    input,
    getResult,
    get boss() {
      return boss;
    },
  };
}
