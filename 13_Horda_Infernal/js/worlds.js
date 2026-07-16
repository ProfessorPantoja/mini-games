/**
 * Mundos da campanha — cada um termina num chefão.
 * Mundo 0 = conteúdo clássico (4 etapas → Senhor da Horda).
 * Mundos 1–3 = caminho curto → chefão novo (para validar no combate).
 */

import { STAGES_WORLD_0 } from "./stages.js";

export const WORLD_UNLOCK_KEY = "horda_infernal_worlds_v1";

/** Todos liberados no playtest dos chefões (progressão real depois). */
export const PLAYTEST_UNLOCK_ALL = true;

export const WORLDS = [
  {
    id: "portal",
    index: 0,
    name: "Portal Infernal",
    short: "Mundo 1",
    bossName: "Senhor da Horda",
    tagline: "A horda clássica · trono do abismo",
    icon: "🔥",
    stages: STAGES_WORLD_0,
  },
  {
    id: "ninho",
    index: 1,
    name: "Ninho de Cinzas",
    short: "Mundo 2",
    bossName: "Mãe das Brasas",
    tagline: "Limpe a ninhada · foque a mãe",
    icon: "🌋",
    stages: [
      {
        id: 0,
        name: "Berçário em Brasas",
        subtitle: "Algo choca sob o chão",
        hard: false,
        boss: false,
        floorTint: 1,
        waves: [
          {
            delay: 0.5,
            groups: [
              { type: "imp", count: 8, interval: 0.28 },
              { type: "reaver", count: 2, interval: 0.7 },
            ],
          },
          {
            delay: 0.8,
            groups: [
              { type: "imp", count: 10, interval: 0.2 },
              { type: "spitter", count: 2, interval: 0.75 },
              { type: "brute", count: 2, interval: 0.55 },
            ],
          },
        ],
      },
      {
        id: 1,
        name: "Útero de Magma",
        subtitle: "A mãe desperta",
        hard: true,
        boss: true,
        floorTint: 2,
        waves: [
          {
            delay: 0.7,
            groups: [
              { type: "imp", count: 5, interval: 0.3 },
              { type: "wraith", count: 2, interval: 0.45 },
            ],
          },
          {
            delay: 1.0,
            groups: [{ type: "boss_mother", count: 1, interval: 0 }],
          },
          { delay: 9999, groups: [], supportOnly: true },
        ],
      },
    ],
  },
  {
    id: "carcere",
    index: 2,
    name: "Pátio dos Ossos",
    short: "Mundo 3",
    bossName: "Carcereiro de Ossos",
    tagline: "Correntes · não seja arrastado",
    icon: "⛓️",
    stages: [
      {
        id: 0,
        name: "Corredor de Correntes",
        subtitle: "O metal range",
        hard: true,
        boss: false,
        floorTint: 2,
        waves: [
          {
            delay: 0.5,
            groups: [
              { type: "brute", count: 3, interval: 0.5 },
              { type: "reaver", count: 3, interval: 0.55 },
              { type: "spitter", count: 2, interval: 0.8 },
            ],
          },
          {
            delay: 0.9,
            groups: [
              { type: "elite", count: 1, interval: 0 },
              { type: "wraith", count: 3, interval: 0.4 },
              { type: "imp", count: 8, interval: 0.22 },
            ],
          },
        ],
      },
      {
        id: 1,
        name: "Cela do Carcereiro",
        subtitle: "Você é o preso",
        hard: true,
        boss: true,
        floorTint: 3,
        waves: [
          {
            delay: 0.6,
            groups: [
              { type: "brute", count: 3, interval: 0.45 },
              { type: "reaver", count: 2, interval: 0.5 },
            ],
          },
          {
            delay: 1.0,
            groups: [{ type: "boss_jailer", count: 1, interval: 0 }],
          },
          { delay: 9999, groups: [], supportOnly: true },
        ],
      },
    ],
  },
  {
    id: "fenda",
    index: 3,
    name: "Fenda do Portal",
    short: "Mundo 4",
    bossName: "Eco do Portal",
    tagline: "O abismo responde · exame final",
    icon: "🌀",
    stages: [
      {
        id: 0,
        name: "Limiar Rachado",
        subtitle: "O ar dói",
        hard: true,
        boss: false,
        floorTint: 3,
        waves: [
          {
            delay: 0.4,
            groups: [
              { type: "imp", count: 8, interval: 0.2 },
              { type: "wraith", count: 3, interval: 0.35 },
              { type: "reaver", count: 3, interval: 0.5 },
              { type: "spitter", count: 2, interval: 0.65 },
            ],
          },
          {
            delay: 0.85,
            groups: [
              { type: "elite", count: 2, interval: 0.8 },
              { type: "brute", count: 3, interval: 0.45 },
              { type: "wraith", count: 4, interval: 0.3 },
            ],
          },
        ],
      },
      {
        id: 1,
        name: "Coração do Portal",
        subtitle: "O que vem depois do trono",
        hard: true,
        boss: true,
        floorTint: 3,
        waves: [
          {
            delay: 0.7,
            groups: [
              { type: "imp", count: 6, interval: 0.25 },
              { type: "elite", count: 1, interval: 0 },
            ],
          },
          {
            delay: 1.1,
            groups: [{ type: "boss_echo", count: 1, interval: 0 }],
          },
          { delay: 9999, groups: [], supportOnly: true },
        ],
      },
    ],
  },
];

export function getWorld(indexOrId) {
  if (typeof indexOrId === "string") {
    return WORLDS.find((w) => w.id === indexOrId) || WORLDS[0];
  }
  return WORLDS[indexOrId] || WORLDS[0];
}

export function loadWorldProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(WORLD_UNLOCK_KEY) || "{}");
    const cleared = Array.isArray(raw.cleared) ? raw.cleared : [];
    return { cleared: cleared.map(Number).filter((n) => n >= 0 && n < WORLDS.length) };
  } catch {
    return { cleared: [] };
  }
}

export function saveWorldCleared(worldIndex) {
  const prog = loadWorldProgress();
  if (!prog.cleared.includes(worldIndex)) {
    prog.cleared.push(worldIndex);
    prog.cleared.sort((a, b) => a - b);
  }
  try {
    localStorage.setItem(WORLD_UNLOCK_KEY, JSON.stringify(prog));
  } catch { /* ignore */ }
  return prog;
}

/** Mundo 0 sempre livre; N liberado se N-1 foi limpo (ou playtest all). */
export function isWorldUnlocked(worldIndex, progress = null) {
  if (worldIndex <= 0) return true;
  if (PLAYTEST_UNLOCK_ALL) return true;
  const prog = progress || loadWorldProgress();
  return prog.cleared.includes(worldIndex - 1) || prog.cleared.includes(worldIndex);
}
