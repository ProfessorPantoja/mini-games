/**
 * Builds jogáveis e suas cartas.
 * Tanque — área / tankiness
 * Batedor — melee de impacto
 */

import { PLAYER, ORBIT, PULSE, MELEE } from "./config.js";

export const BUILDS = {
  tank: {
    id: "tank",
    name: "Tanque",
    icon: "🛡",
    tagline: "Aguente a horda · órbitas + pulso",
    color: "#3a7cff",
    desc: "Fica no meio, resiste e mata com área.",
    howTo: "Órbitas e pulso atacam sozinhos",
  },
  scout: {
    id: "scout",
    name: "Batedor",
    icon: "⚔",
    tagline: "Corpo a corpo · impacto e knockback",
    color: "#ff6a3a",
    desc: "Entra na briga, golpeia de perto.",
    howTo: "Golpes automáticos na direção do movimento",
  },
};

/** Aplica stats base da build no player recém-criado. */
export function applyBuildBase(player, buildId) {
  player.build = buildId;

  if (buildId === "scout") {
    player.speed = PLAYER.baseSpeed * 1.22; // mais ágil
    player.maxHp = Math.round(PLAYER.maxHp * 0.85);
    player.hp = player.maxHp;
    player.orbitCount = 0;
    player.pulseInterval = 9999;
    player.pulseTimer = 9999;
    // melee
    player.meleeRange = MELEE.range;
    player.meleeDamage = MELEE.damage;
    player.meleeInterval = MELEE.interval;
    player.meleeTimer = 0.15;
    player.meleeKnockback = MELEE.knockback;
    player.meleeArc = MELEE.arc;
    player.meleeSwing = null; // { t, duration, angle }
    player.facing = 0;
    player.combo = 0;
  } else {
    // tank defaults já vêm de createPlayer
    player.meleeRange = 0;
    player.meleeDamage = 0;
    player.meleeInterval = 999;
    player.meleeTimer = 999;
    player.meleeKnockback = 0;
    player.meleeArc = 0;
    player.meleeSwing = null;
    player.facing = 0;
    player.combo = 0;
  }
}

export const TANK_CARDS = [
  {
    id: "escudo",
    name: "Escudo",
    icon: "🛡",
    desc: "+30 vida máx. e +1 órbita ao redor do herói.",
    apply(player) {
      player.maxHp += 30;
      player.hp = Math.min(player.hp + 30, player.maxHp);
      player.orbitCount += 1;
    },
  },
  {
    id: "campo_toxico",
    name: "Campo Tóxico",
    icon: "☢",
    desc: "Pulso 25% maior e +1 de dano de área.",
    apply(player) {
      player.pulseMaxRadius *= 1.25;
      player.pulseDamage += 1;
    },
  },
  {
    id: "vampirismo",
    name: "Vampirismo",
    icon: "🩸",
    desc: "Cura 4 HP ao matar. +12% velocidade.",
    apply(player) {
      player.lifestealOnKill += 4;
      player.speed *= 1.12;
    },
  },
  {
    id: "magnetismo",
    name: "Magnetismo",
    icon: "🧲",
    desc: "Gemas de mais longe. Órbitas +1 dano e 15% maiores.",
    apply(player) {
      player.magnetRadius *= 1.55;
      player.orbitDamage += 1;
      player.orbitSize *= 1.15;
      player.orbitRadius *= 1.08;
    },
  },
  {
    id: "casca_grossa",
    name: "Casca Grossa",
    icon: "🪨",
    desc: "+20 vida máx. e cura ao matar.",
    apply(player) {
      player.maxHp += 20;
      player.hp = Math.min(player.hp + 20, player.maxHp);
      player.lifestealOnKill += 2;
    },
  },
  {
    id: "onda_pesada",
    name: "Onda Pesada",
    icon: "🌊",
    desc: "Pulso 20% mais frequente e +1 dano.",
    apply(player) {
      player.pulseInterval *= 0.8;
      player.pulseDamage += 1;
    },
  },
];

export const SCOUT_CARDS = [
  {
    id: "gume_afiado",
    name: "Gume Afiado",
    icon: "🗡",
    desc: "+2 dano melee e +10% alcance.",
    apply(player) {
      player.meleeDamage += 2;
      player.meleeRange *= 1.1;
    },
  },
  {
    id: "furia",
    name: "Fúria",
    icon: "🔥",
    desc: "+20% velocidade de ataque e +8% movimento.",
    apply(player) {
      player.meleeInterval *= 0.8;
      player.speed *= 1.08;
    },
  },
  {
    id: "impacto",
    name: "Impacto",
    icon: "💥",
    desc: "+40% knockback e +1 dano.",
    apply(player) {
      player.meleeKnockback *= 1.4;
      player.meleeDamage += 1;
    },
  },
  {
    id: "combo",
    name: "Combo",
    icon: "🔗",
    desc: "Cada kill seguida (+combo) dá +0.5 dano (máx +3).",
    apply(player) {
      player.comboBonus = (player.comboBonus || 0) + 0.5;
      player.comboCap = (player.comboCap || 0) + 3;
    },
  },
  {
    id: "sedento",
    name: "Sedento",
    icon: "🩸",
    desc: "Cura 3 HP ao matar. +1 dano melee.",
    apply(player) {
      player.lifestealOnKill += 3;
      player.meleeDamage += 1;
    },
  },
  {
    id: "passos_leves",
    name: "Passos Leves",
    icon: "💨",
    desc: "+18% velocidade e +5% alcance.",
    apply(player) {
      player.speed *= 1.18;
      player.meleeRange *= 1.05;
    },
  },
];

export function rollCards(buildId, count = 3) {
  const pool = [...(buildId === "scout" ? SCOUT_CARDS : TANK_CARDS)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// reexport legado para quem ainda importa de cards.js
export { ORBIT, PULSE };
