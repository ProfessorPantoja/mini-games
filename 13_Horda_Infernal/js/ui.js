/** HUD e telas — Horda Infernal */

import { rarityColor, rarityLabel, compareItems } from "./loot.js";
import { listOwnedPowers } from "./powers.js";
import {
  WORLDS, isWorldUnlocked, loadWorldProgress,
} from "./worlds.js";
import {
  FLAGS, flagMeta, loadPlayerPref, savePlayerPref,
  loadRanking, buildEntry, addToRanking, formatTime, escapeHtml,
} from "./ranking.js";

export class UI {
  constructor() {
    this.hud = document.getElementById("hud");
    this.hpFill = document.getElementById("hp-fill");
    this.xpFill = document.getElementById("xp-fill");
    this.furyFill = document.getElementById("fury-fill");
    this.hpNum = document.getElementById("hp-num");
    this.xpNum = document.getElementById("xp-num");
    this.furyNum = document.getElementById("fury-num");
    this.statDmg = document.getElementById("stat-dmg");
    this.statDef = document.getElementById("stat-def");
    this.statLvl = document.getElementById("stat-lvl");
    this.dashInd = document.getElementById("dash-ind");
    this.stagePill = document.getElementById("stage-pill");
    this.killCount = document.getElementById("kill-count");
    this.chipWeapon = document.getElementById("chip-weapon");
    this.chipArmor = document.getElementById("chip-armor");
    this.banner = document.getElementById("wave-banner");
    this.toastEl = document.getElementById("toast");
    this.powerStrip = document.getElementById("power-strip");
    this._powerSig = "";
    this.bossBar = document.getElementById("boss-bar");
    this.bossBarFill = document.getElementById("boss-bar-fill");
    this.bossBarHp = document.getElementById("boss-bar-hp");
    this.bossBarName = document.getElementById("boss-bar-name");
    this.bossBarPhase = document.getElementById("boss-bar-phase");

    this.screenTitle = document.getElementById("screen-title");
    this.screenPause = document.getElementById("screen-pause");
    this.screenDefeat = document.getElementById("screen-defeat");
    this.screenVictory = document.getElementById("screen-victory");
    this.screenRanking = document.getElementById("screen-ranking");
    this.lootPanel = document.getElementById("loot-panel");
    this.powerPanel = document.getElementById("power-panel");

    this._toastTimer = null;
    this._bannerTimer = null;
    this._lastRecap = null;
    this._lastVictory = false;
    this._rankingReturn = "title";
  }

  showHud(on) {
    this.hud.hidden = !on;
    if (!on) this.hideBossBar();
  }

  hideBossBar() {
    if (this.bossBar) this.bossBar.hidden = true;
  }

  updateBossBar(game) {
    if (!this.bossBar) return;
    const e = game.bossRef;
    const show = e && !e.dead && game.state !== "title" && game.state !== "defeat" && game.state !== "victory";
    if (!show) {
      this.bossBar.hidden = true;
      return;
    }
    this.bossBar.hidden = false;
    const pct = Math.max(0, Math.min(1, e.hp / e.maxHp));
    if (this.bossBarFill) this.bossBarFill.style.transform = `scaleX(${pct})`;
    if (this.bossBarHp) {
      this.bossBarHp.textContent = `${Math.max(0, Math.ceil(e.hp))} / ${e.maxHp}`;
    }
    if (this.bossBarName) {
      this.bossBarName.textContent = (e.name || "SENHOR DA HORDA").toUpperCase();
    }
    const phase = e.bossPhase || 0;
    this.bossBar.classList.toggle("phase-2", phase === 1);
    this.bossBar.classList.toggle("phase-3", phase >= 2);
    if (this.bossBarPhase) {
      this.bossBarPhase.textContent =
        phase >= 2 ? "FASE III · FÚRIA" : phase === 1 ? "FASE II" : "FASE I";
    }
  }

  hideAllScreens() {
    this.screenTitle.classList.remove("active");
    this.screenPause.classList.remove("active");
    this.screenDefeat.classList.remove("active");
    this.screenVictory.classList.remove("active");
    this.screenRanking?.classList.remove("active");
    this.lootPanel.classList.remove("active");
    this.powerPanel?.classList.remove("active");
  }

  showTitle() {
    this.hideAllScreens();
    this.showHud(false);
    this.screenTitle.classList.add("active");
  }

  showPause(on) {
    this.screenPause.classList.toggle("active", on);
  }

  showDefeat(game) {
    this.hideAllScreens();
    this.showHud(false);
    this.screenDefeat.classList.add("active");
    const recap = game.getRunRecap();
    this._lastRecap = recap;
    this._lastVictory = false;
    document.getElementById("meta-kills").textContent = recap.kills;
    document.getElementById("meta-level").textContent = recap.level;
    document.getElementById("meta-stage").textContent = recap.stage;
    this._fillRecap("defeat-recap", recap);
    this.prepareRankForm("defeat");
  }

  showVictory(game) {
    this.hideAllScreens();
    this.showHud(false);
    this.screenVictory.classList.add("active");
    const recap = game.getRunRecap();
    this._lastRecap = recap;
    this._lastVictory = true;
    document.getElementById("win-kills").textContent = recap.kills;
    document.getElementById("win-level").textContent = recap.level;
    const timeEl = document.getElementById("win-time");
    if (timeEl) timeEl.textContent = formatTime(recap.time);
    this._fillRecap("victory-recap", recap);
    this.prepareRankForm("victory");
  }

  _fillRecap(elId, r) {
    const el = document.getElementById(elId);
    if (!el) return;
    const cell = (k, v, wide = false) =>
      `<div class="recap-row${wide ? " wide" : ""}"><span class="rk">${k}</span><span class="rv">${v}</span></div>`;
    el.innerHTML = [
      cell("Classe", r.className || "—"),
      cell("Mundo", r.worldName || "—"),
      cell("Modo", r.difficulty || "Normal"),
      cell("Tempo", formatTime(r.time)),
      cell("Combo", `×${r.maxCombo || 1}`),
      cell("Dano", String(r.damage || 0)),
      cell("Cura", String(r.heal || 0)),
      cell("Kills", String(r.kills ?? "—")),
      cell("Etapa", r.stage || "—", true),
      cell("Arma", r.weapon || "—", true),
      cell("Armadura", r.armor || "—", true),
      `<div class="recap-powers">${r.powers || "Sem poderes"}</div>`,
    ].join("");
  }

  /** Seletor de mundos — visual de CAMPANHA (não de classe) */
  renderWorldRow(selectedIndex = 0) {
    const row = document.getElementById("world-row");
    if (!row) return;
    const prog = loadWorldProgress();
    row.innerHTML = "";
    WORLDS.forEach((w) => {
      const unlocked = isWorldUnlocked(w.index, prog);
      const cleared = prog.cleared.includes(w.index);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "world-path"
        + (w.index === selectedIndex ? " selected" : "")
        + (unlocked ? "" : " locked")
        + (cleared ? " cleared" : "");
      btn.dataset.world = String(w.index);
      btn.disabled = !unlocked;
      btn.style.setProperty("--w-accent", w.accent || "#ff5a1f");
      btn.innerHTML = `
        <div class="wp-rail" aria-hidden="true"></div>
        <div class="wp-num">${w.short}</div>
        <div class="wp-body">
          <div class="wp-label">${w.label || w.short}</div>
          <div class="wp-name">${w.name}</div>
          <div class="wp-boss">
            <span class="wp-boss-k">CHEFE</span>
            ${unlocked ? w.bossName : "???"}
          </div>
          <div class="wp-tag">${unlocked ? w.tagline : "Bloqueado"}</div>
        </div>
        ${cleared ? '<span class="wp-check">✓</span>' : ""}
      `;
      row.appendChild(btn);
    });
  }

  showPowerSelect(choices, level) {
    if (!this.powerPanel) return;
    this.powerPanel.classList.add("active");
    const title = document.getElementById("power-title");
    if (title) title.textContent = `Nível ${level} — escolha um poder`;
    const box = document.getElementById("power-choices");
    if (!box) return;
    box.innerHTML = "";
    choices.forEach((pw, i) => {
      const isNew = pw.stacks === 0;
      const isMax = pw.nextStacks >= pw.max;
      const kind = isNew ? "is-new" : isMax ? "is-max" : "is-stack";
      const badge = isNew
        ? "✦ NOVO"
        : isMax
          ? `★ MÁXIMO ${pw.nextStacks}/${pw.max}`
          : `STACK ${pw.nextStacks}/${pw.max}`;
      const stackLine = isNew
        ? `Primeira vez · máx ${pw.max}`
        : isMax
          ? `${pw.nextStacks} de ${pw.max} — no teto`
          : `${pw.nextStacks} de ${pw.max}`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `power-btn ${kind}`;
      btn.dataset.powerId = pw.id;
      btn.innerHTML = `
        <span class="p-key">${i + 1}</span>
        <span class="p-badge">${badge}</span>
        <span class="p-icon">${pw.icon}</span>
        <div class="p-name">${pw.name}</div>
        <div class="p-desc">${pw.desc}</div>
        <div class="p-stack">${stackLine}</div>
      `;
      box.appendChild(btn);
    });
  }

  hidePowerSelect() {
    this.powerPanel?.classList.remove("active");
  }

  // ─── Ranking ───
  prepareRankForm(prefix) {
    const pref = loadPlayerPref();
    const nameEl = document.getElementById(`${prefix}-name`);
    if (nameEl) nameEl.value = pref.name;
    this.renderFlagPicker(`${prefix}-flags`, pref.flag);
    const msg = document.getElementById(`${prefix}-rank-msg`);
    if (msg) {
      msg.hidden = true;
      msg.textContent = "";
    }
    const btn = document.getElementById(`btn-save-rank-${prefix}`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "SALVAR NO RANKING";
    }
  }

  renderFlagPicker(containerId, selected) {
    const box = document.getElementById(containerId);
    if (!box) return;
    box.innerHTML = "";
    box.dataset.selected = selected || "BR";
    FLAGS.forEach((f) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flag-btn" + (f.code === (selected || "BR") ? " selected" : "");
      btn.dataset.flag = f.code;
      btn.title = f.name;
      btn.setAttribute("aria-label", f.name);
      btn.textContent = f.emoji;
      btn.addEventListener("click", () => {
        box.dataset.selected = f.code;
        box.querySelectorAll(".flag-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
      box.appendChild(btn);
    });
  }

  handleSaveRanking(prefix, audio) {
    if (!this._lastRecap) return;
    const nameEl = document.getElementById(`${prefix}-name`);
    const flagsEl = document.getElementById(`${prefix}-flags`);
    const name = (nameEl?.value || "").trim();
    const flag = flagsEl?.dataset.selected || "BR";
    if (!name) {
      nameEl?.focus();
      const msg = document.getElementById(`${prefix}-rank-msg`);
      if (msg) {
        msg.hidden = false;
        msg.textContent = "Digite seu nome para salvar.";
        msg.style.color = "#ff6b7a";
      }
      return;
    }
    savePlayerPref(name, flag);
    const entry = buildEntry(this._lastRecap, this._lastVictory, name, flag);
    const { position } = addToRanking(entry);
    const msg = document.getElementById(`${prefix}-rank-msg`);
    if (msg) {
      msg.hidden = false;
      msg.style.color = "";
      msg.textContent =
        position > 0
          ? `Salvo! #${position} no ranking local`
          : "Salvo! (fora do top)";
    }
    const btn = document.getElementById(`btn-save-rank-${prefix}`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = "SALVO ✓";
    }
    audio?.uiClick?.();
  }

  showRanking(returnTo = "title") {
    this._rankingReturn = returnTo;
    this.hideAllScreens();
    this.showHud(false);
    this.screenRanking?.classList.add("active");
    this.refreshRankingList();
  }

  closeRanking() {
    this.hideAllScreens();
    if (this._rankingReturn === "victory") {
      this.screenVictory.classList.add("active");
    } else if (this._rankingReturn === "defeat") {
      this.screenDefeat.classList.add("active");
    } else {
      this.screenTitle.classList.add("active");
    }
  }

  refreshRankingList() {
    const listEl = document.getElementById("ranking-list");
    if (!listEl) return;
    const list = loadRanking();
    if (!list.length) {
      listEl.innerHTML =
        '<p class="ranking-empty">Nenhum recorde ainda.<br/>Vença o Trono e salve sua marca!</p>';
      return;
    }
    listEl.innerHTML = list
      .map((e, i) => {
        const fl = flagMeta(e.flag);
        const dnf = e.completed ? "" : '<span class="dnf-tag">DNF</span>';
        const rowCls = e.completed ? "rank-row" : "rank-row dnf";
        return `<div class="${rowCls}">
          <span class="rank-pos">#${i + 1}</span>
          <span class="rank-flag" title="${fl.name}">${fl.emoji}</span>
          <span class="rank-name">${escapeHtml(e.name)}
            <span class="rn-class">${escapeHtml(e.className || "—")}</span>
          </span>
          <span class="rank-time">${formatTime(e.time)}${dnf}</span>
          <span class="rank-meta">${e.kills} kills · nv ${e.level} · ${escapeHtml(e.difficulty || "Normal")}${e.endless ? ` · Abismo ${e.abyssDepth || 0}` : ""} · ×${e.maxCombo || 1}</span>
        </div>`;
      })
      .join("");
  }

  updateHud(game) {
    if (!game.player || this.hud.hidden) return;
    const p = game.player;
    const hpPct = Math.max(0, p.hp / p.maxHp);
    const xpPct = Math.max(0, p.xp / p.xpToLevel);
    const resMax = game.classDef?.resource?.max || 100;
    const furyPct = Math.max(0, (p.fury || 0) / resMax);

    this.hpFill.style.transform = `scaleX(${hpPct})`;
    this.xpFill.style.transform = `scaleX(${xpPct})`;
    if (this.furyFill) {
      this.furyFill.style.transform = `scaleX(${furyPct})`;
      this.furyFill.classList.toggle("active", p.furyActive > 0);
      this.furyFill.classList.toggle("ready", p.furyActive <= 0 && furyPct >= 0.98);
    }
    this.hpNum.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    this.xpNum.textContent = `${p.xp}/${p.xpToLevel}`;
    if (this.furyNum) {
      this.furyNum.textContent = p.furyActive > 0
        ? p.furyActive.toFixed(1)
        : String(Math.round(p.fury || 0));
    }
    this.statDmg.textContent = game.getPlayerDamage();
    this.statDef.textContent = game.getPlayerDefense();
    this.statLvl.textContent = p.level;
    this.killCount.textContent = game.kills;

    // label do recurso da classe (FÚRIA / FOCO / …)
    const resLabel = document.getElementById("res-label");
    if (resLabel && game.classDef?.resource) {
      resLabel.textContent = game.classDef.resource.label;
    }

    if (this.dashInd) {
      this.dashInd.classList.toggle("cd", p.dashCd > 0 && p.dashing <= 0);
      this.dashInd.textContent = p.dashing > 0 ? "!" : p.dashCd > 0 ? "…" : "DASH";
    }

    if (game.stage) {
      const hard = game.stage.hard ? " ☠" : "";
      // Durante o chefe a barra HTML ocupa o centro — esconde o pill de etapa
      const bossUp = game.bossRef && !game.bossRef.dead;
      if (this.stagePill) {
        this.stagePill.style.visibility = bossUp ? "hidden" : "visible";
        if (!bossUp) {
          if (game.endless) {
            this.stagePill.textContent = `ABISMO · Onda ${game.abyssDepth + 1}${hard}`;
            this.stagePill.classList.add("endless");
          } else {
            this.stagePill.classList.remove("endless");
            const stages = game.worldStages || [];
            const diffTag = game.difficultyId === "infernal" ? " · 🔥" : "";
            const wShort = game.world?.short || "Mundo";
            this.stagePill.textContent =
              `${wShort} · ${game.stageIndex + 1}/${stages.length || 1} · ${game.stage.name}${hard}${diffTag}`;
          }
        }
      }
    }

    this._fillChip(this.chipWeapon, p.weapon, "ARMA");
    this._fillChip(this.chipArmor, p.armor, "ARMADURA");

    // HP low pulse on fill
    this.hpFill.classList.toggle("critical", hpPct < 0.3);

    this._updatePowerStrip(p);
    this.updateBossBar(game);
  }

  _updatePowerStrip(player) {
    if (!this.powerStrip) return;
    const owned = listOwnedPowers(player);
    const sig = owned.map((pw) => `${pw.id}:${pw.stacks}`).join("|");
    if (sig === this._powerSig) return;
    this._powerSig = sig;
    if (owned.length === 0) {
      this.powerStrip.innerHTML = "";
      return;
    }
    this.powerStrip.innerHTML = owned.map((pw) =>
      `<span class="power-chip" title="${pw.name}: ${pw.desc}">` +
      `<span class="pc-icon">${pw.icon}</span>` +
      `<span class="pc-n">×${pw.stacks}</span></span>`,
    ).join("");
  }

  _fillChip(el, item, slotLabel) {
    if (!item) {
      el.dataset.rarity = "common";
      el.querySelector(".slot").textContent = slotLabel;
      el.querySelector(".name").textContent = "—";
      return;
    }
    el.dataset.rarity = item.rarity;
    el.querySelector(".slot").textContent = slotLabel;
    el.querySelector(".name").textContent = item.name;
  }

  showBanner(text) {
    this.banner.textContent = text;
    this.banner.classList.remove("show");
    // reflow
    void this.banner.offsetWidth;
    this.banner.classList.add("show");
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.banner.classList.remove("show"), 2300);
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove("show"), 1800);
  }

  showLootCompare(item, player) {
    this.lootPanel.classList.add("active");
    const equipped = item.slot === "weapon" ? player.weapon : player.armor;
    const cmp = compareItems(item, equipped);
    const col = rarityColor(item.rarity);

    document.getElementById("loot-name").textContent = item.name;
    document.getElementById("loot-name").style.color = col;
    document.getElementById("loot-rarity").textContent = rarityLabel(item.rarity).toUpperCase();
    document.getElementById("loot-rarity").style.color = col;
    document.getElementById("loot-slot").textContent =
      item.slot === "weapon" ? "Arma · corpo a corpo" : "Armadura · proteção";

    // equipped col
    const eqName = document.getElementById("eq-name");
    const eqStats = document.getElementById("eq-stats");
    if (equipped) {
      eqName.textContent = equipped.name;
      eqName.style.color = rarityColor(equipped.rarity);
      eqStats.innerHTML = cmp.stats.map((s) =>
        `<div class="stat"><span>${s.key}</span><span>${s.cur}</span></div>`,
      ).join("");
    } else {
      eqName.textContent = "Nada equipado";
      eqName.style.color = "#8a7a78";
      eqStats.innerHTML = `<div class="stat"><span>—</span><span>0</span></div>`;
    }

    // new col
    document.getElementById("new-name").textContent = item.name;
    document.getElementById("new-name").style.color = col;
    document.getElementById("new-stats").innerHTML = cmp.stats.map((s) => {
      const cls = s.delta > 0 ? "delta-up" : s.delta < 0 ? "delta-down" : "delta-same";
      const sign = s.delta > 0 ? "+" : "";
      return `<div class="stat"><span>${s.key}</span><span class="${cls}">${s.next} <small>(${sign}${s.delta})</small></span></div>`;
    }).join("");

    // veredito upgrade / downgrade
    const verdict = document.getElementById("loot-verdict");
    if (verdict) {
      verdict.hidden = false;
      verdict.classList.remove("upgrade", "downgrade", "same");
      if (cmp.score > 0.5) {
        verdict.classList.add("upgrade");
        verdict.textContent = "▲ UPGRADE — vale equipar";
      } else if (cmp.score < -0.5) {
        verdict.classList.add("downgrade");
        verdict.textContent = "▼ PIOR — pode deixar";
      } else {
        verdict.classList.add("same");
        verdict.textContent = "≈ PARECIDO — sua escolha";
      }
    }

    // destaca botão equipar se upgrade
    const btnEquip = document.getElementById("btn-equip");
    if (btnEquip) {
      btnEquip.style.boxShadow = cmp.score > 0.5
        ? "0 0 28px rgba(61, 255, 168, 0.35)"
        : "";
    }
  }

  hideLootCompare() {
    this.lootPanel.classList.remove("active");
  }
}
