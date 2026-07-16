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

/** Etapas do Mundo 1 (Portal Infernal → Senhor da Horda) */
export const STAGES_WORLD_0 = [
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
          { type: "imp", count: 6, interval: 0.3 },
          { type: "brute", count: 2, interval: 0.7 },
          { type: "reaver", count: 2, interval: 0.85 },
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
          { type: "imp", count: 6, interval: 0.28 },
          { type: "spitter", count: 2, interval: 1.1 },
          { type: "reaver", count: 2, interval: 0.9 },
        ],
      },
      {
        delay: 0.9,
        groups: [
          { type: "brute", count: 3, interval: 0.55 },
          { type: "imp", count: 5, interval: 0.25 },
          { type: "wraith", count: 3, interval: 0.5 },
          { type: "elite", count: 1, interval: 0 },
        ],
      },
      {
        delay: 1.1,
        groups: [
          { type: "imp", count: 8, interval: 0.22 },
          { type: "spitter", count: 2, interval: 0.8 },
          { type: "reaver", count: 3, interval: 0.65 },
          { type: "brute", count: 2, interval: 0.6 },
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
          { type: "imp", count: 8, interval: 0.2 },
          { type: "wraith", count: 4, interval: 0.35 },
          { type: "spitter", count: 2, interval: 0.7 },
        ],
      },
      {
        delay: 0.8,
        groups: [
          { type: "brute", count: 4, interval: 0.45 },
          { type: "reaver", count: 3, interval: 0.55 },
          { type: "elite", count: 2, interval: 1.2 },
          { type: "imp", count: 6, interval: 0.2 },
        ],
      },
      {
        delay: 1.0,
        groups: [
          { type: "imp", count: 10, interval: 0.18 },
          { type: "spitter", count: 3, interval: 0.55 },
          { type: "wraith", count: 4, interval: 0.3 },
          { type: "reaver", count: 3, interval: 0.5 },
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
          { type: "imp", count: 6, interval: 0.25 },
          { type: "reaver", count: 2, interval: 0.55 },
          { type: "wraith", count: 2, interval: 0.4 },
          { type: "brute", count: 2, interval: 0.5 },
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

/** @deprecated use getWorld(i).stages — alias do mundo 0 */
export const STAGES = STAGES_WORLD_0;

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
  /** Corredor — telegrapha e investe no jogador */
  reaver: {
    kind: "charger",
    name: "Assaltante",
    radius: 13,
    maxHp: 38,
    damage: 16,
    moveSpeed: 88,
    xp: 16,
    color: "#6a2230",
    accent: "#ff7a3a",
    contactInterval: 0.65,
    chargeCooldown: 2.8,
    chargeSpeed: 380,
    chargeDuration: 0.32,
    chargeWindup: 0.45,
  },
  /** Espectro rápido — desliza e some por instantes */
  wraith: {
    kind: "wraith",
    name: "Espectro",
    radius: 12,
    maxHp: 26,
    damage: 11,
    moveSpeed: 145,
    xp: 15,
    color: "#2a2848",
    accent: "#9b8cff",
    contactInterval: 0.5,
    phaseCooldown: 2.4,
    phaseDuration: 0.55,
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
    skillCooldown: 3.4,
    skillWindup: 0.55,
  },
  boss: {
    kind: "boss",
    bossId: "senhor",
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
  /** Mundo 2 — gera adds, zonas de brasa, cura se ninhada viva */
  boss_mother: {
    kind: "boss",
    bossId: "mother",
    name: "Mãe das Brasas",
    radius: 40,
    maxHp: 1100,
    damage: 24,
    moveSpeed: 48,
    xp: 240,
    color: "#4a1808",
    accent: "#ff6a20",
    contactInterval: 0.7,
    isBoss: true,
  },
  /** Mundo 3 — correntes, puxão, prisão */
  boss_jailer: {
    kind: "boss",
    bossId: "jailer",
    name: "Carcereiro de Ossos",
    radius: 38,
    maxHp: 1200,
    damage: 26,
    moveSpeed: 52,
    xp: 260,
    color: "#3a3038",
    accent: "#c8b8a0",
    contactInterval: 0.68,
    isBoss: true,
  },
  /** Mundo 4 — remix de padrões + gravidade do portal */
  boss_echo: {
    kind: "boss",
    bossId: "echo",
    name: "Eco do Portal",
    radius: 34,
    maxHp: 1350,
    damage: 27,
    moveSpeed: 58,
    xp: 300,
    color: "#1a0828",
    accent: "#b44dff",
    contactInterval: 0.62,
    isBoss: true,
  },
};

/** Multiplicadores por dificuldade */
export const DIFFICULTY = {
  normal: {
    id: "normal",
    label: "Normal",
    hp: 1,
    damage: 1,
    speed: 1,
    xp: 1,
    luck: 0,
  },
  infernal: {
    id: "infernal",
    label: "Infernal",
    hp: 1.48,
    damage: 1.28,
    speed: 1.1,
    xp: 1.08,
    luck: -0.05,
  },
};

/**
 * @param {object} def
 * @param {number} stageIndex
 * @param {{ hp?: number, damage?: number, speed?: number, xp?: number }} [diff]
 * @param {number} [endlessDepth] profundidade no abismo (0 = campanha)
 */
export function scaleEnemyStats(def, stageIndex, diff = null, endlessDepth = 0) {
  const d = diff || DIFFICULTY.normal;
  const s = 1 + stageIndex * 0.22 + endlessDepth * 0.12;
  const hpM = d.hp || 1;
  const dmgM = d.damage || 1;
  const spdM = d.speed || 1;
  const xpM = d.xp || 1;
  return {
    ...def,
    maxHp: Math.round(def.maxHp * s * hpM),
    damage: Math.round(def.damage * (1 + stageIndex * 0.15 + endlessDepth * 0.08) * dmgM),
    moveSpeed: def.moveSpeed * (1 + stageIndex * 0.04 + endlessDepth * 0.025) * spdM,
    xp: Math.round(def.xp * (1 + stageIndex * 0.12 + endlessDepth * 0.06) * xpM),
  };
}

/** Gera uma wave do modo Abismo (endless) */
export function makeAbyssWave(depth) {
  const groups = [];
  const base = 6 + Math.min(14, depth * 2);
  groups.push({ type: "imp", count: base, interval: Math.max(0.12, 0.28 - depth * 0.01) });
  if (depth >= 1) {
    groups.push({ type: "reaver", count: 2 + (depth >> 1), interval: 0.55 });
  }
  if (depth >= 2) {
    groups.push({ type: "spitter", count: 1 + (depth >> 1), interval: 0.7 });
    groups.push({ type: "wraith", count: 2 + depth, interval: 0.4 });
  }
  if (depth >= 3) {
    groups.push({ type: "brute", count: 2 + (depth >> 1), interval: 0.5 });
  }
  if (depth >= 1 && depth % 2 === 1) {
    groups.push({ type: "elite", count: 1 + Math.floor(depth / 4), interval: 1.0 });
  }
  // mini-boss a cada 5 ondas
  if (depth > 0 && depth % 5 === 0) {
    groups.push({ type: "elite", count: 2, interval: 0.6 });
    groups.push({ type: "brute", count: 4, interval: 0.4 });
  }
  return {
    id: 100 + depth,
    name: "Abismo Eterno",
    subtitle: `Onda ${depth + 1}`,
    hard: depth >= 3,
    boss: false,
    floorTint: Math.min(3, 1 + (depth % 4)),
    endless: true,
    waves: [
      {
        delay: 0.5,
        groups,
      },
    ],
  };
}
