/** Constantes e balanceamento do Survival V2 (build Tanque). */

export const WORLD = {
  width: 3200,
  height: 3200,
  tile: 48,
};

export const PLAYER = {
  radius: 14,
  baseSpeed: 145,       // mais “pesado” que um batedor
  maxHp: 120,
  invulnTime: 0.65,     // segundos de i-frames após hit
  knockbackForce: 280,
  xpPickupRadius: 36,
  magnetBase: 120,
};

export const ORBIT = {
  count: 3,
  radius: 42,
  size: 7,
  speed: 2.4,           // rad/s
  damage: 1,
  hitCooldown: 0.28,
};

export const PULSE = {
  interval: 2.4,        // segundos entre pulsos
  maxRadius: 90,
  duration: 0.55,
  damage: 2,
  width: 10,            // espessura da borda que causa dano
};

export const ENEMY = {
  slime: {
    name: "Slime",
    radius: 11,
    speed: 70,
    hp: 1,
    damage: 8,
    color: "#3dcc6a",
    xp: 1,
    mass: 0.6,
  },
  skeleton: {
    name: "Esqueleto",
    radius: 14,
    speed: 105,
    hp: 4,
    damage: 12,
    color: "#e05050",
    xp: 3,
    mass: 1,
    showHp: true,
  },
  golem: {
    name: "Golem",
    radius: 22,
    speed: 42,
    hp: 18,
    damage: 20,
    color: "#8a9098",
    xp: 8,
    mass: 2.2,
    showHp: true,
  },
  elite: {
    name: "Elite",
    radius: 20,
    speed: 80,
    hp: 40,
    damage: 18,
    color: "#b060ff",
    xp: 20,
    mass: 1.8,
    showHp: true,
    isElite: true,
  },
  boss: {
    name: "Chefão",
    radius: 36,
    speed: 55,
    hp: 220,
    damage: 28,
    color: "#ff8c2a",
    xp: 100,
    mass: 4,
    showHp: true,
    isBoss: true,
  },
};

export const SPAWN = {
  baseInterval: 1.35,
  minInterval: 0.45,
  rampTime: 120,        // segundos até cadência mínima
  maxAlive: 55,
  edgeMargin: 80,
};

export const ELITE_ZONES = [
  { x: 700, y: 700, r: 160 },
  { x: 2500, y: 900, r: 160 },
  { x: 1600, y: 2400, r: 160 },
];

export const BOSS = {
  unlockElites: 2,
  unlockTime: 90,
  x: 1600,
  y: 1600,
  zoneR: 200,
};

export const AMBUSH = {
  firstAt: 28,
  intervalMin: 22,
  intervalMax: 38,
  count: 8,
  radius: 160,
};

export const XP = {
  baseToLevel: 10,
  growth: 1.45,
};

export const CAMERA = {
  lerp: 0.12,
  shakeDecay: 6,
};

export const COLORS = {
  ground: "#1a3a28",
  groundAlt: "#163424",
  grassDot: "#245a38",
  player: "#3a7cff",
  playerBorder: "#8ab4ff",
  orbit: "#4dff8a",
  pulse: "rgba(80, 255, 140, 0.55)",
  gem: "#3dffa0",
  objective: "#ffe066",
};
