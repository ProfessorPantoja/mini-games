/**
 * Geração do boss diário a partir do seed.
 */

import { createRng, pick, range, rangeInt } from "./seed.js";

const PREFIX = [
  "Crimson", "Shadow", "Iron", "Neon", "Void", "Storm", "Ashen", "Gilded",
  "Rogue", "Solar", "Frost", "Toxic", "Obsidian", "Pulse", "Hex", "Nova",
];

const CORE = [
  "Warden", "Reaper", "Colossus", "Seraph", "Hydra", "Specter", "Titan",
  "Viper", "Oracle", "Harbinger", "Golem", "Phoenix", "Kraken", "Wraith",
];

const TITLES = [
  "O Inquebrável", "Sombra do Mercado", "Eco da Meia-Noite", "Devorador de Runs",
  "Senhor dos Frames", "A Maldição Diária", "Guardião do Seed", "Pacto Quebrado",
  "Fúria Compacta", "O Último Pattern", "Latência Encarnada", "Boss de Bolso",
];

const PALETTES = [
  { color: "#f472b6", glow: "rgba(244,114,182,0.45)", accent: "#fb7185" },
  { color: "#a78bfa", glow: "rgba(167,139,250,0.45)", accent: "#c4b5fd" },
  { color: "#22d3ee", glow: "rgba(34,211,238,0.4)", accent: "#67e8f9" },
  { color: "#fbbf24", glow: "rgba(251,191,36,0.4)", accent: "#fde68a" },
  { color: "#34d399", glow: "rgba(52,211,153,0.4)", accent: "#6ee7b7" },
  { color: "#fb7185", glow: "rgba(251,113,133,0.45)", accent: "#fda4af" },
  { color: "#818cf8", glow: "rgba(129,140,248,0.45)", accent: "#a5b4fc" },
  { color: "#e879f9", glow: "rgba(232,121,249,0.45)", accent: "#f0abfc" },
];

/** Tipos de golpe do boss */
export const ATK = {
  SWIPE_L: "swipe_l",   // dodge right
  SWIPE_R: "swipe_r",   // dodge left
  SLAM: "slam",         // parry
  BARRAGE: "barrage",   // dodge either then parry window... actually dodge any
};

/**
 * Resposta correta para cada ataque.
 * dodgeL / dodgeR / parry
 */
export function correctDefense(atk) {
  switch (atk) {
    case ATK.SWIPE_L:
      return "dodgeR"; // vem da esquerda → pula pra direita
    case ATK.SWIPE_R:
      return "dodgeL";
    case ATK.SLAM:
      return "parry";
    case ATK.BARRAGE:
      return "dodgeAny";
    default:
      return "parry";
  }
}

export function telegraphClass(atk) {
  switch (atk) {
    case ATK.SWIPE_L:
      return "left";
    case ATK.SWIPE_R:
      return "right";
    case ATK.SLAM:
      return "slam";
    case ATK.BARRAGE:
      return "barrage";
    default:
      return "center";
  }
}

export function attackLabel(atk) {
  switch (atk) {
    case ATK.SWIPE_L:
      return "SWIPE ←";
    case ATK.SWIPE_R:
      return "SWIPE →";
    case ATK.SLAM:
      return "SLAM";
    case ATK.BARRAGE:
      return "BARRAGE";
    default:
      return "ATK";
  }
}

/**
 * Gera boss completo para o dayKey.
 */
export function generateBoss(dayKey) {
  const rng = createRng(dayKey);

  const name = `${pick(rng, PREFIX)} ${pick(rng, CORE)}`;
  const title = pick(rng, TITLES);
  const palette = pick(rng, PALETTES);

  // dificuldade 1–5 (bias leve pro meio — menos Infernal no dia a dia)
  const roll = rng();
  const difficulty =
    roll < 0.22 ? 1 : roll < 0.5 ? 2 : roll < 0.78 ? 3 : roll < 0.93 ? 4 : 5;

  // HP mais baixo → luta ~1–3 min, não maratona de frames
  const hp = Math.round(70 + difficulty * 18 + range(rng, 0, 12));
  // Telegraph mais longo = tempo de ler a cor/lado
  const baseWindup = range(rng, 900, 1200) - difficulty * 40;
  const baseRecover = range(rng, 420, 620) - difficulty * 20;
  const attackGap = range(rng, 520, 820) - difficulty * 25;

  // pool de ataques cresce com dificuldade
  const pool = [ATK.SWIPE_L, ATK.SWIPE_R, ATK.SLAM];
  if (difficulty >= 3) pool.push(ATK.BARRAGE);
  if (difficulty >= 5) pool.push(ATK.SLAM, ATK.BARRAGE);

  // pattern base de 4–7 golpes, depois em loop
  const patternLen = rangeInt(rng, 4, 4 + Math.min(3, difficulty));
  const pattern = [];
  for (let i = 0; i < patternLen; i++) {
    pattern.push(pick(rng, pool));
  }
  // evita 3 iguais seguidos no seed
  for (let i = 2; i < pattern.length; i++) {
    if (pattern[i] === pattern[i - 1] && pattern[i] === pattern[i - 2]) {
      pattern[i] = pick(rng, pool.filter((a) => a !== pattern[i]));
    }
  }

  const phases = [
    { at: 1, speed: 1, label: "FASE 1" },
    { at: 0.66, speed: 1.1, label: "FASE 2" },
    { at: 0.33, speed: 1.22, label: "FASE 3" },
  ];

  return {
    dayKey,
    name,
    title,
    palette,
    difficulty,
    maxHp: hp,
    hp,
    baseWindup: Math.max(560, baseWindup),
    baseRecover: Math.max(280, baseRecover),
    attackGap: Math.max(360, attackGap),
    pattern,
    pool,
    phases,
    // dano do player mais alto → menos hits para matar
    playerDamage: 14 + Math.floor(difficulty / 2),
    perfectBonus: 8,
  };
}

export function difficultyLabel(d) {
  return ["", "Fácil", "Normal", "Difícil", "Pesado", "Infernal"][d] || "???";
}

export function difficultyStars(d) {
  return "★".repeat(d) + "☆".repeat(5 - d);
}
