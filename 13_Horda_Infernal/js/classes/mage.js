/** Classe: Mago — cajado, bola de fogo com splash, MANA (feel snappy) */

export default {
  id: "mage",
  name: "Mago",
  icon: "🔥",
  tagline: "Cajado · explosão em área",
  unlocked: true,
  style: "caster",

  stats: {
    maxHp: 95,
    damage: 17,
    defense: 0,
    moveSpeed: 205,
    attackRange: 310,
    attackArc: 0,
    // mais próximo do arqueiro em responsividade
    attackCooldown: 0.40,
    attackWindup: 0.055,
    attackActive: 0.06,
    attackRecover: 0.05,
    attackLunge: 0,
    projectileSpeed: 440,
    projectileRadius: 8,
    splashRadius: 58,
    splashMult: 0.62,
    dashSpeed: 540,
    dashDuration: 0.15,
    dashCooldown: 0.78,
    radius: 15,
    invulnAfterHit: 0.4,
    critChance: 0.14,
    critMult: 2.1,
  },

  resource: {
    id: "mana",
    label: "MANA",
    max: 100,
    perHit: 10,
    perKill: 16,
    perCrit: 7,
    decay: 8,
    duration: 4.8,
    dmgMult: 1.38,
    atkSpeed: 0.62,
    moveMult: 1.08,
  },

  starterWeapon: {
    name: "Cajado Ember",
    damage: 11,
  },

  starterArmor: {
    name: "Manto de Aprendiz",
    defense: 0,
    hpBonus: 10,
  },

  colors: {
    body: "#c8b8d8",
    armor: "#3a2a58",
    accent: "#b44dff",
    flame: "#ff6bcb",
  },
};
