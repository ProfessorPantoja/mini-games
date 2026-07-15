/** Classe: Arqueiro — distância, Foco, tiros precisos */

export default {
  id: "archer",
  name: "Arqueiro",
  icon: "🏹",
  tagline: "À distância · tiro preciso",
  unlocked: true,
  style: "ranged",

  stats: {
    maxHp: 100,
    damage: 12,
    defense: 1,
    moveSpeed: 220,
    attackRange: 320, // alcance do tiro
    attackArc: 0, // não usa arco melee
    attackCooldown: 0.38,
    attackWindup: 0.04,
    attackActive: 0.06,
    attackRecover: 0.05,
    attackLunge: 0,
    projectileSpeed: 520,
    projectileRadius: 5,
    dashSpeed: 580,
    dashDuration: 0.14,
    dashCooldown: 0.68,
    radius: 15,
    invulnAfterHit: 0.38,
    critChance: 0.18,
    critMult: 2.0,
  },

  resource: {
    id: "focus",
    label: "FOCO",
    max: 100,
    perHit: 9,
    perKill: 16,
    perCrit: 6,
    decay: 9,
    duration: 3.6,
    dmgMult: 1.25,
    atkSpeed: 0.55, // rajada bem mais rápida
    moveMult: 1.08,
  },

  starterWeapon: {
    name: "Arco de Caça",
    damage: 9,
  },

  starterArmor: {
    name: "Colete de Couro",
    defense: 1,
    hpBonus: 0,
  },

  weaponFlavor: true,

  colors: {
    body: "#d4c4a8",
    armor: "#3a4a38",
    accent: "#7dffb3",
  },
};
