/**
 * Campanha Neon Serpent
 * goal: orbs normais a coletar (boss usa hits)
 * stepMs: intervalo entre movimentos (menor = mais rápido)
 * wrap: false = paredes matam; true = atravessa bordas
 * hazards: contagem de células estáticas letais
 * specialChance: chance de power-up no spawn de comida
 * boss: se true, fase especial
 */
export const LEVELS = [
  {
    id: 1,
    name: "NASCENTE",
    goal: 5,
    stepMs: 145,
    wrap: true,
    hazards: 0,
    specialChance: 0.12,
  },
  {
    id: 2,
    name: "CORRENTE",
    goal: 7,
    stepMs: 132,
    wrap: true,
    hazards: 0,
    specialChance: 0.15,
  },
  {
    id: 3,
    name: "HIDRA α",
    goal: 3,
    stepMs: 128,
    wrap: true,
    hazards: 0,
    specialChance: 0.18,
    boss: true,
    bossHits: 3,
  },
  {
    id: 4,
    name: "GRADE",
    goal: 8,
    stepMs: 120,
    wrap: false,
    hazards: 0,
    specialChance: 0.16,
  },
  {
    id: 5,
    name: "ESPINHOS",
    goal: 9,
    stepMs: 112,
    wrap: false,
    hazards: 4,
    specialChance: 0.18,
  },
  {
    id: 6,
    name: "HIDRA β",
    goal: 4,
    stepMs: 108,
    wrap: true,
    hazards: 0,
    specialChance: 0.2,
    boss: true,
    bossHits: 4,
  },
  {
    id: 7,
    name: "LABIRINTO",
    goal: 10,
    stepMs: 100,
    wrap: false,
    hazards: 8,
    specialChance: 0.2,
  },
  {
    id: 8,
    name: "PULSO",
    goal: 12,
    stepMs: 94,
    wrap: true,
    hazards: 6,
    specialChance: 0.22,
  },
  {
    id: 9,
    name: "HIDRA Ω",
    goal: 5,
    stepMs: 90,
    wrap: true,
    hazards: 2,
    specialChance: 0.24,
    boss: true,
    bossHits: 5,
  },
  {
    id: 10,
    name: "SERPENTE NEON",
    goal: 15,
    stepMs: 84,
    wrap: false,
    hazards: 10,
    specialChance: 0.22,
  },
];

export const POWER_DEFS = {
  ghost: { label: "FANTASMA", color: "#8b7cff", turns: 12 },
  magnet: { label: "ÍMÃ", color: "#ffc857", turns: 14 },
  turbo: { label: "TURBO", color: "#ff2bd6", turns: 10 },
  shrink: { label: "ENCOLHE", color: "#7dffb3", turns: 0 },
};
