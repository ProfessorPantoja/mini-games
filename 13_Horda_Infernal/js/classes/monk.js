/** Classe: Monge — punhos rápidos, Chi, dash ofensivo */

export default {
  id: "monk",
  name: "Monge",
  icon: "🥋",
  tagline: "Punhos · velocidade · Chi",
  unlocked: true,
  style: "melee",

  stats: {
    maxHp: 108,
    damage: 11,
    defense: 1,
    moveSpeed: 235,
    attackRange: 62,
    attackArc: Math.PI * 0.85,
    attackCooldown: 0.26,
    attackWindup: 0.03,
    attackActive: 0.09,
    attackRecover: 0.04,
    attackLunge: 28,
    dashSpeed: 620,
    dashDuration: 0.13,
    dashCooldown: 0.58,
    radius: 15,
    invulnAfterHit: 0.36,
    critChance: 0.16,
    critMult: 1.9,
  },

  resource: {
    id: "chi",
    label: "CHI",
    max: 100,
    perHit: 8,
    perKill: 15,
    perCrit: 6,
    decay: 10,
    duration: 3.8,
    dmgMult: 1.32,
    atkSpeed: 0.58, // rajada de socos
    moveMult: 1.18,
  },

  starterWeapon: {
    name: "Bandagens de Treino",
    damage: 8,
  },

  starterArmor: {
    name: "Manto Leve",
    defense: 1,
    hpBonus: 5,
  },

  colors: {
    body: "#e8d5c4",
    armor: "#5a4a68",
    accent: "#c4a0ff",
  },
};
