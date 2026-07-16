/** Poderes de nível — escolha 1 de 3, empilháveis (máx 3)
 *
 * Cada poder tem `classes`:
 *  - null  → todas as classes
 *  - array → só essas classes (id)
 */

export const POWERS = {
  // ── Comuns ──────────────────────────────────────────────
  bloodlust: {
    id: "bloodlust",
    name: "Sede de Sangue",
    icon: "🩸",
    desc: "Cura um pouco do dano causado",
    max: 3,
    classes: null,
    apply(p) {
      p.mods.lifesteal += 0.06;
    },
  },
  ghostStep: {
    id: "ghostStep",
    name: "Passo Fantasma",
    icon: "💨",
    desc: "Dash recarrega mais rápido",
    max: 3,
    classes: null,
    apply(p) {
      p.mods.dashCdMult *= 0.82;
    },
  },
  ironHide: {
    id: "ironHide",
    name: "Pele de Ferro",
    icon: "🛡️",
    desc: "+defesa e resistência",
    max: 3,
    classes: null,
    apply(p) {
      p.mods.defenseFlat += 2;
      p.mods.dmgTakenMult *= 0.92;
    },
  },
  quickStrike: {
    id: "quickStrike",
    name: "Golpe Rápido",
    icon: "⚡",
    desc: "Ataques mais velozes",
    max: 3,
    classes: null,
    apply(p) {
      p.mods.atkCdMult *= 0.88;
    },
  },
  vitality: {
    id: "vitality",
    name: "Vitalidade",
    icon: "❤️",
    desc: "+vida máxima",
    max: 3,
    classes: null,
    apply(p) {
      p.mods.hpFlat += 28;
    },
  },
  brutalCrit: {
    id: "brutalCrit",
    name: "Crítico Brutal",
    icon: "💥",
    desc: "Mais chance e dano de crítico",
    max: 3,
    classes: null,
    apply(p) {
      p.mods.critChance += 0.07;
      p.mods.critMult += 0.12;
    },
  },
  resourceSurge: {
    id: "resourceSurge",
    name: "Ímpeto Selvagem",
    icon: "✨",
    desc: "Recurso da classe enche e dura mais",
    max: 3,
    classes: null,
    apply(p) {
      p.mods.furyGainMult += 0.22;
      p.mods.furyDurationMult += 0.15;
    },
  },

  // ── Bárbaro ─────────────────────────────────────────────
  wideSlash: {
    id: "wideSlash",
    name: "Corte Amplo",
    icon: "🪓",
    desc: "+alcance e arco do machado",
    max: 3,
    classes: ["barbarian"],
    apply(p) {
      p.mods.rangeMult += 0.14;
      p.mods.arcMult += 0.12;
    },
  },
  rawFury: {
    id: "rawFury",
    name: "Fúria Bruta",
    icon: "🔥",
    desc: "Fúria enche bem mais e dura mais",
    max: 3,
    classes: ["barbarian"],
    apply(p) {
      p.mods.furyGainMult += 0.18;
      p.mods.furyDurationMult += 0.18;
    },
  },
  cleaveMaster: {
    id: "cleaveMaster",
    name: "Mestre do Cleave",
    icon: "⚔️",
    desc: "Ainda mais alcance no corte",
    max: 3,
    classes: ["barbarian"],
    apply(p) {
      p.mods.rangeMult += 0.1;
      p.mods.arcMult += 0.1;
    },
  },

  // ── Arqueiro ────────────────────────────────────────────
  eagleEye: {
    id: "eagleEye",
    name: "Olho de Águia",
    icon: "👁️",
    desc: "Flechas mais longas e rápidas",
    max: 3,
    classes: ["archer"],
    apply(p) {
      p.mods.rangeMult += 0.12;
      p.mods.projSpeedMult += 0.12;
    },
  },
  multiShot: {
    id: "multiShot",
    name: "Rajada",
    icon: "🏹",
    desc: "+1 flecha por disparo",
    max: 2,
    classes: ["archer"],
    apply(p) {
      p.mods.extraShots += 1;
    },
  },
  piercingShot: {
    id: "piercingShot",
    name: "Perfuração",
    icon: "🎯",
    desc: "Flechas atravessam +1 inimigo",
    max: 2,
    classes: ["archer"],
    apply(p) {
      p.mods.pierce += 1;
    },
  },
  steadyAim: {
    id: "steadyAim",
    name: "Mira Firme",
    icon: "🟢",
    desc: "Foco enche e dura mais",
    max: 3,
    classes: ["archer"],
    apply(p) {
      p.mods.furyGainMult += 0.2;
      p.mods.furyDurationMult += 0.12;
    },
  },

  // ── Mago ────────────────────────────────────────────────
  fireNova: {
    id: "fireNova",
    name: "Nova de Fogo",
    icon: "☄️",
    desc: "Explosão maior e mais forte",
    max: 3,
    classes: ["mage"],
    apply(p) {
      p.mods.splashRadiusMult += 0.18;
      p.mods.splashDmgMult += 0.12;
    },
  },
  arcaneBolt: {
    id: "arcaneBolt",
    name: "Raio Arcano",
    icon: "🔮",
    desc: "Orbes mais rápidos e longe",
    max: 3,
    classes: ["mage"],
    apply(p) {
      p.mods.projSpeedMult += 0.14;
      p.mods.rangeMult += 0.1;
    },
  },
  manaWell: {
    id: "manaWell",
    name: "Poço de Mana",
    icon: "💜",
    desc: "Mana enche e dura mais",
    max: 3,
    classes: ["mage"],
    apply(p) {
      p.mods.furyGainMult += 0.2;
      p.mods.furyDurationMult += 0.16;
    },
  },
  scorchedEarth: {
    id: "scorchedEarth",
    name: "Terra Queimada",
    icon: "🌋",
    desc: "Splash bem mais largo",
    max: 2,
    classes: ["mage"],
    apply(p) {
      p.mods.splashRadiusMult += 0.22;
    },
  },
};

export const POWER_IDS = Object.keys(POWERS);

export function createEmptyMods() {
  return {
    rangeMult: 1,
    arcMult: 1,
    lifesteal: 0,
    dashCdMult: 1,
    defenseFlat: 0,
    dmgTakenMult: 1,
    furyGainMult: 1,
    furyDurationMult: 1,
    atkCdMult: 1,
    hpFlat: 0,
    critChance: 0,
    critMult: 0,
    // class-specific combat
    extraShots: 0,
    pierce: 0,
    projSpeedMult: 1,
    splashRadiusMult: 1,
    splashDmgMult: 1,
  };
}

function powerAvailableForClass(def, classId) {
  if (!def.classes || def.classes.length === 0) return true;
  if (!classId) return true;
  return def.classes.includes(classId);
}

/** Reaplica todos os stacks de poderes nos mods do player */
export function recomputeMods(player) {
  player.mods = createEmptyMods();
  for (const id of POWER_IDS) {
    const stacks = player.powerStacks[id] || 0;
    const def = POWERS[id];
    for (let i = 0; i < stacks; i++) def.apply(player);
  }
}

/**
 * Sorteia até `count` poderes ainda empilháveis para a classe.
 * Prefere poderes ainda não pegos, mas permite stack.
 * @param {object} player
 * @param {number} count
 * @param {string|null} classId
 */
export function rollPowerChoices(player, count = 3, classId = null) {
  const available = POWER_IDS.filter((id) => {
    const def = POWERS[id];
    if (!powerAvailableForClass(def, classId)) return false;
    return (player.powerStacks[id] || 0) < def.max;
  });
  if (available.length === 0) return [];

  // peso: não pegos têm prioridade; poderes de classe um pouco mais
  const weighted = [];
  for (const id of available) {
    const def = POWERS[id];
    const stacks = player.powerStacks[id] || 0;
    let w = stacks === 0 ? 3 : stacks === 1 ? 2 : 1;
    if (def.classes && def.classes.length) w += 1; // levemente favorece assinatura da classe
    for (let i = 0; i < w; i++) weighted.push(id);
  }

  const picked = [];
  const used = new Set();
  let guard = 0;
  while (picked.length < count && picked.length < available.length && guard++ < 50) {
    const id = weighted[(Math.random() * weighted.length) | 0];
    if (used.has(id)) continue;
    used.add(id);
    const stacks = player.powerStacks[id] || 0;
    picked.push({
      ...POWERS[id],
      stacks,
      nextStacks: stacks + 1,
    });
  }
  return picked;
}

export function applyPower(player, powerId) {
  const def = POWERS[powerId];
  if (!def) return false;
  const cur = player.powerStacks[powerId] || 0;
  if (cur >= def.max) return false;
  player.powerStacks[powerId] = cur + 1;
  recomputeMods(player);
  return true;
}

export function listOwnedPowers(player) {
  return POWER_IDS
    .filter((id) => (player.powerStacks[id] || 0) > 0)
    .map((id) => ({
      ...POWERS[id],
      stacks: player.powerStacks[id],
    }));
}
