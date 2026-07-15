/** Definição das etapas da run */

/**
 * Cada stage:
 * - name, subtitle
 * - waves: array de wave configs
 * - hard: flag visual
 * - boss: se true, última wave é o boss
 *
 * wave:
 * - delay: tempo antes de começar
 * - groups: [{ type, count, interval }]
 */

export const STAGES = [
  {
    id: 0,
    name: "Portal Infernal",
    subtitle: "As primeiras chamas",
    hard: false,
    boss: false,
    floorTint: 0,
    waves: [
      {
        delay: 0.6,
        groups: [
          { type: "imp", count: 6, interval: 0.45 },
        ],
      },
      {
        delay: 1.0,
        groups: [
          { type: "imp", count: 5, interval: 0.35 },
          { type: "brute", count: 2, interval: 0.9 },
        ],
      },
      {
        delay: 1.2,
        groups: [
          { type: "imp", count: 8, interval: 0.3 },
          { type: "brute", count: 3, interval: 0.7 },
        ],
      },
    ],
  },
  {
    id: 1,
    name: "Corredor de Cinzas",
    subtitle: "A horda engrossa",
    hard: false,
    boss: false,
    floorTint: 1,
    waves: [
      {
        delay: 0.5,
        groups: [
          { type: "imp", count: 8, interval: 0.28 },
          { type: "spitter", count: 2, interval: 1.1 },
        ],
      },
      {
        delay: 0.9,
        groups: [
          { type: "brute", count: 4, interval: 0.55 },
          { type: "imp", count: 6, interval: 0.25 },
          { type: "elite", count: 1, interval: 0 },
        ],
      },
      {
        delay: 1.1,
        groups: [
          { type: "imp", count: 10, interval: 0.22 },
          { type: "spitter", count: 3, interval: 0.8 },
          { type: "brute", count: 3, interval: 0.6 },
        ],
      },
    ],
  },
  {
    id: 2,
    name: "Fossa das Sombras",
    subtitle: "Aqui a morte é barata",
    hard: true,
    boss: false,
    floorTint: 2,
    waves: [
      {
        delay: 0.4,
        groups: [
          { type: "imp", count: 12, interval: 0.2 },
          { type: "spitter", count: 3, interval: 0.7 },
        ],
      },
      {
        delay: 0.8,
        groups: [
          { type: "brute", count: 5, interval: 0.45 },
          { type: "elite", count: 2, interval: 1.2 },
          { type: "imp", count: 8, interval: 0.2 },
        ],
      },
      {
        delay: 1.0,
        groups: [
          { type: "imp", count: 14, interval: 0.18 },
          { type: "spitter", count: 4, interval: 0.55 },
          { type: "brute", count: 4, interval: 0.5 },
          { type: "elite", count: 2, interval: 0.9 },
        ],
      },
    ],
  },
  {
    id: 3,
    name: "Trono do Abismo",
    subtitle: "O senhor da horda",
    hard: true,
    boss: true,
    floorTint: 3,
    waves: [
      {
        delay: 0.8,
        groups: [
          { type: "imp", count: 8, interval: 0.25 },
          { type: "brute", count: 3, interval: 0.5 },
        ],
      },
      {
        delay: 1.2,
        groups: [
          { type: "boss", count: 1, interval: 0 },
        ],
      },
      {
        // reforços durante o boss (spawnados sob demanda no game se boss vivo)
        delay: 9999,
        groups: [],
        supportOnly: true,
      },
    ],
  },
];

/** Stats base por tipo de inimigo (escalados por stage no spawn) */
export const ENEMY_DEFS = {
  imp: {
    kind: "fodder",
    name: "Diabrete",
    radius: 11,
    maxHp: 22,
    damage: 7,
    moveSpeed: 115,
    xp: 8,
    color: "#8b2e3a",
    accent: "#ff5a1f",
    contactInterval: 0.55,
  },
  brute: {
    kind: "brute",
    name: "Bruto",
    radius: 16,
    maxHp: 55,
    damage: 14,
    moveSpeed: 78,
    xp: 18,
    color: "#4a1e28",
    accent: "#c41e3a",
    contactInterval: 0.7,
  },
  spitter: {
    kind: "ranged",
    name: "Cuspidor",
    radius: 12,
    maxHp: 28,
    damage: 10,
    moveSpeed: 70,
    xp: 14,
    color: "#3a2a48",
    accent: "#b44dff",
    contactInterval: 0.8,
    preferRange: 170,
    shootCooldown: 1.6,
    projectileSpeed: 220,
    projectileDamage: 9,
  },
  elite: {
    kind: "elite",
    name: "Elite Infernal",
    radius: 18,
    maxHp: 120,
    damage: 18,
    moveSpeed: 95,
    xp: 45,
    color: "#5a1a40",
    accent: "#f0c14b",
    contactInterval: 0.55,
  },
  boss: {
    kind: "boss",
    name: "Senhor da Horda",
    radius: 36,
    maxHp: 980,
    damage: 28,
    moveSpeed: 62,
    xp: 200,
    color: "#2a0a12",
    accent: "#ff3b5c",
    contactInterval: 0.65,
    isBoss: true,
  },
};

export function scaleEnemyStats(def, stageIndex) {
  const s = 1 + stageIndex * 0.22;
  return {
    ...def,
    maxHp: Math.round(def.maxHp * s),
    damage: Math.round(def.damage * (1 + stageIndex * 0.15)),
    moveSpeed: def.moveSpeed * (1 + stageIndex * 0.04),
    xp: Math.round(def.xp * (1 + stageIndex * 0.12)),
  };
}
