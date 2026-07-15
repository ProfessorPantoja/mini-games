/** Classe: Mago — bloqueada (stub escalável para vinda futura) */

export default {
  id: "mage",
  name: "Mago",
  icon: "🔥",
  tagline: "Em breve",
  unlocked: false,
  style: "caster",

  stats: {
    maxHp: 90,
    damage: 16,
    defense: 0,
    moveSpeed: 195,
    attackRange: 280,
    attackArc: 0,
    attackCooldown: 0.45,
    attackWindup: 0.1,
    attackActive: 0.08,
    attackRecover: 0.08,
    attackLunge: 0,
    projectileSpeed: 400,
    projectileRadius: 8,
    dashSpeed: 500,
    dashDuration: 0.16,
    dashCooldown: 0.9,
    radius: 15,
    invulnAfterHit: 0.4,
    critChance: 0.12,
    critMult: 1.9,
  },

  resource: {
    id: "mana",
    label: "MANA",
    max: 100,
    perHit: 5,
    perKill: 12,
    perCrit: 4,
    decay: 6,
    duration: 5,
    dmgMult: 1.35,
    atkSpeed: 0.8,
    moveMult: 1.05,
  },

  starterWeapon: {
    name: "Cajado Embers",
    damage: 11,
  },

  starterArmor: {
    name: "Manto de Aprendiz",
    defense: 0,
    hpBonus: 5,
  },

  colors: {
    body: "#c8b8d8",
    armor: "#3a2a58",
    accent: "#b44dff",
  },
};
