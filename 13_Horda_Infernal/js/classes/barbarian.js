/** Classe: Bárbaro — corpo a corpo, Fúria, cleave */

export default {
  id: "barbarian",
  name: "Bárbaro",
  icon: "🪓",
  tagline: "Corpo a corpo · corte em arco",
  unlocked: true,
  style: "melee", // melee | ranged | caster

  stats: {
    maxHp: 130,
    damage: 15,
    defense: 2,
    moveSpeed: 205,
    attackRange: 84,
    attackArc: Math.PI * 0.95,
    attackCooldown: 0.36,
    attackWindup: 0.05,
    attackActive: 0.12,
    attackRecover: 0.06,
    attackLunge: 38,
    dashSpeed: 560,
    dashDuration: 0.15,
    dashCooldown: 0.72,
    radius: 16,
    invulnAfterHit: 0.4,
    critChance: 0.14,
    critMult: 1.85,
  },

  /** Recurso especial da classe (HUD + gameplay) */
  resource: {
    id: "fury",
    label: "FÚRIA",
    max: 100,
    perHit: 7,
    perKill: 14,
    perCrit: 5,
    decay: 11,
    duration: 4.2,
    dmgMult: 1.4,
    atkSpeed: 0.72,
    moveMult: 1.12,
  },

  starterWeapon: {
    name: "Machado do Iniciante",
    damage: 10,
  },

  starterArmor: {
    name: "Couro Manchado",
    defense: 1,
    hpBonus: 0,
  },

  /** Nomes de loot com flavor da classe (opcional) */
  weaponFlavor: true,

  colors: {
    body: "#c48a58",   // pele bronzeada (não pálida de monge)
    armor: "#4a2818",  // couro escuro / peles
    accent: "#ff5a1f",
  },
};
