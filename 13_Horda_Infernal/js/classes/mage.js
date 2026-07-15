/** Classe: Mago — cajado, bola de fogo com splash, MANA */

export default {
  id: "mage",
  name: "Mago",
  icon: "🔥",
  tagline: "Cajado · explosão em área",
  unlocked: true,
  style: "caster",

  stats: {
    maxHp: 92,
    damage: 18,
    defense: 0,
    moveSpeed: 198,
    attackRange: 300,
    attackArc: 0,
    attackCooldown: 0.52,
    attackWindup: 0.12,
    attackActive: 0.1,
    attackRecover: 0.1,
    attackLunge: 0,
    projectileSpeed: 340,
    projectileRadius: 9,
    /** raio do splash ao acertar */
    splashRadius: 52,
    splashMult: 0.55,
    dashSpeed: 520,
    dashDuration: 0.15,
    dashCooldown: 0.85,
    radius: 15,
    invulnAfterHit: 0.42,
    critChance: 0.13,
    critMult: 2.05,
  },

  resource: {
    id: "mana",
    label: "MANA",
    max: 100,
    perHit: 8,
    perKill: 15,
    perCrit: 6,
    decay: 7,
    duration: 4.5,
    dmgMult: 1.4,
    atkSpeed: 0.7,
    moveMult: 1.06,
  },

  starterWeapon: {
    name: "Cajado Ember",
    damage: 12,
  },

  starterArmor: {
    name: "Manto de Aprendiz",
    defense: 0,
    hpBonus: 8,
  },

  colors: {
    body: "#c8b8d8",
    armor: "#3a2a58",
    accent: "#b44dff",
    flame: "#ff6bcb",
  },
};
