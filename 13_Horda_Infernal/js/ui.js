/** HUD e telas — Horda Infernal */

import { rarityColor, rarityLabel, compareItems } from "./loot.js";
import { STAGES } from "./stages.js";
import { listOwnedPowers } from "./powers.js";

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

    this.screenTitle = document.getElementById("screen-title");
    this.screenPause = document.getElementById("screen-pause");
    this.screenDefeat = document.getElementById("screen-defeat");
    this.screenVictory = document.getElementById("screen-victory");
    this.lootPanel = document.getElementById("loot-panel");
    this.powerPanel = document.getElementById("power-panel");

    this._toastTimer = null;
    this._bannerTimer = null;
  }

  showHud(on) {
    this.hud.hidden = !on;
  }

  hideAllScreens() {
    this.screenTitle.classList.remove("active");
    this.screenPause.classList.remove("active");
    this.screenDefeat.classList.remove("active");
    this.screenVictory.classList.remove("active");
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
    document.getElementById("meta-kills").textContent = recap.kills;
    document.getElementById("meta-level").textContent = recap.level;
    document.getElementById("meta-stage").textContent = recap.stage;
    this._fillRecap("defeat-recap", recap);
  }

  showVictory(game) {
    this.hideAllScreens();
    this.showHud(false);
    this.screenVictory.classList.add("active");
    const recap = game.getRunRecap();
    document.getElementById("win-kills").textContent = recap.kills;
    document.getElementById("win-level").textContent = recap.level;
    document.getElementById("win-dmg").textContent =
      recap.maxCombo > 1 ? `${recap.damage} · ×${recap.maxCombo}` : recap.damage;
    this._fillRecap("victory-recap", recap);
  }

  _fillRecap(elId, r) {
    const el = document.getElementById(elId);
    if (!el) return;
    const mm = String(Math.floor(r.time / 60)).padStart(2, "0");
    const ss = String(r.time % 60).padStart(2, "0");
    el.innerHTML = `
      <div class="recap-row"><span>Classe</span><span>${r.className || "—"}</span></div>
      <div class="recap-row"><span>Tempo</span><span>${mm}:${ss}</span></div>
      <div class="recap-row"><span>Combo máx</span><span>×${r.maxCombo || 1}</span></div>
      <div class="recap-row"><span>Cura total</span><span>${r.heal}</span></div>
      <div class="recap-row"><span>Arma</span><span>${r.weapon}</span></div>
      <div class="recap-row"><span>Armadura</span><span>${r.armor}</span></div>
      <div class="recap-powers">${r.powers}</div>
    `;
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
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "power-btn";
      btn.dataset.powerId = pw.id;
      btn.innerHTML = `
        <span class="p-key">${i + 1}</span>
        <span class="p-icon">${pw.icon}</span>
        <div class="p-name">${pw.name}</div>
        <div class="p-desc">${pw.desc}</div>
        <div class="p-stack">${pw.stacks > 0 ? `Stack ${pw.nextStacks}/${pw.max}` : `Novo · máx ${pw.max}`}</div>
      `;
      box.appendChild(btn);
    });
  }

  hidePowerSelect() {
    this.powerPanel?.classList.remove("active");
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
      // Durante o chefe a barra de vida ocupa o centro — some com o pill
      // para não sobrepor o nome/HP do boss no canvas.
      const bossUp = game.bossRef && !game.bossRef.dead;
      if (this.stagePill) {
        this.stagePill.style.visibility = bossUp ? "hidden" : "visible";
        if (!bossUp) {
          this.stagePill.textContent = `${game.stageIndex + 1}/${STAGES.length} · ${game.stage.name}${hard}`;
        }
      }
    }

    this._fillChip(this.chipWeapon, p.weapon, "ARMA");
    this._fillChip(this.chipArmor, p.armor, "ARMADURA");

    // HP low pulse on fill
    this.hpFill.classList.toggle("critical", hpPct < 0.3);

    this._updatePowerStrip(p);
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
