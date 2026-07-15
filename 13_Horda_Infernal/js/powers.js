/** Poderes de nível — escolha 1 de 3, empilháveis (máx 3) */

export const POWERS = {
  wideSlash: {
    id: "wideSlash",
    name: "Corte Amplo",
    icon: "🪓",
    desc: "+alcance e arco do machado",
    max: 3,
    apply(p) {
      p.mods.rangeMult += 0.14;
      p.mods.arcMult += 0.12;
    },
  },
  bloodlust: {
    id: "bloodlust",
    name: "Sede de Sangue",
    icon: "🩸",
    desc: "Cura um pouco do dano causado",
    max: 3,
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
    apply(p) {
      p.mods.defenseFlat += 2;
      p.mods.dmgTakenMult *= 0.92;
    },
  },
  rawFury: {
    id: "rawFury",
    name: "Fúria Bruta",
    icon: "🔥",
    desc: "Fúria enche e dura mais",
    max: 3,
    apply(p) {
      p.mods.furyGainMult += 0.22;
      p.mods.furyDurationMult += 0.15;
    },
  },
  quickStrike: {
    id: "quickStrike",
    name: "Golpe Rápido",
    icon: "⚡",
    desc: "Ataques mais velozes",
    max: 3,
    apply(p) {
      p.mods.atkCdMult *= 0.88;
    },
  },
  vitality: {
    id: "vitality",
    name: "Vitalidade",
    icon: "❤️",
    desc: "+vida máxima e cura",
    max: 3,
    apply(p) {
      p.mods.hpFlat += 28;
    },
  },
  brutalCrit: {
    id: "brutalCrit",
    name: "Crítico Brutal",
    icon: "💥",
    desc: "Mais chance de crítico",
    max: 3,
    apply(p) {
      p.mods.critChance += 0.07;
      p.mods.critMult += 0.12;
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
  };
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
 * Sorteia até `count` poderes ainda empilháveis.
 * Prefere poderes ainda não pegos, mas permite stack.
 */
export function rollPowerChoices(player, count = 3) {
  const available = POWER_IDS.filter((id) => (player.powerStacks[id] || 0) < POWERS[id].max);
  if (available.length === 0) return [];

  // peso: não pegos têm prioridade
  const weighted = [];
  for (const id of available) {
    const stacks = player.powerStacks[id] || 0;
    const w = stacks === 0 ? 3 : stacks === 1 ? 2 : 1;
    for (let i = 0; i < w; i++) weighted.push(id);
  }

  const picked = [];
  const used = new Set();
  let guard = 0;
  while (picked.length < count && picked.length < available.length && guard++ < 40) {
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
