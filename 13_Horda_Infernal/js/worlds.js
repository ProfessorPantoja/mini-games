/**
 * Mundos da campanha.
 * Mundo 1 = campanha completa (4 etapas → Senhor da Horda).
 * Mundos 2–4 = SOMENTE a luta do chefão (validação de mecânica).
 */

import { STAGES_WORLD_0 } from "./stages.js";

export const WORLD_UNLOCK_KEY = "horda_infernal_worlds_v1";

/** Playtest: todos os mundos liberados. */
export const PLAYTEST_UNLOCK_ALL = true;

function bossOnlyStage({
  name, subtitle, floorTint, bossType, accent,
}) {
  return [
    {
      id: 0,
      name,
      subtitle,
      hard: true,
      boss: true,
      floorTint,
      accent,
      waves: [
        {
          delay: 0.9,
          groups: [{ type: bossType, count: 1, interval: 0 }],
        },
        { delay: 9999, groups: [], supportOnly: true },
      ],
    },
  ];
}

export const WORLDS = [
  {
    id: "portal",
    index: 0,
    name: "Portal Infernal",
    short: "I",
    label: "Mundo I",
    bossName: "Senhor da Horda",
    tagline: "Campanha clássica · 4 etapas",
    icon: "🔥",
    accent: "#ff5a1f",
    stages: STAGES_WORLD_0,
  },
  {
    id: "ninho",
    index: 1,
    name: "Ninho de Cinzas",
    short: "II",
    label: "Mundo II",
    bossName: "Mãe das Brasas",
    tagline: "Direto no chefão · fábrica de ovos",
    icon: "🌋",
    accent: "#ff6a20",
    stages: bossOnlyStage({
      name: "Útero de Magma",
      subtitle: "Mate a fábrica — ou a ninhada te come",
      floorTint: 2,
      bossType: "boss_mother",
      accent: "#ff6a20",
    }),
  },
  {
    id: "carcere",
    index: 2,
    name: "Pátio dos Ossos",
    short: "III",
    label: "Mundo III",
    bossName: "Carcereiro de Ossos",
    tagline: "Direto no chefão · correntes e puxão",
    icon: "⛓️",
    accent: "#c8b8a0",
    stages: bossOnlyStage({
      name: "Cela do Carcereiro",
      subtitle: "O chão é a arma — não fique parado",
      floorTint: 3,
      bossType: "boss_jailer",
      accent: "#c8b8a0",
    }),
  },
  {
    id: "fenda",
    index: 3,
    name: "Fenda do Portal",
    short: "IV",
    label: "Mundo IV",
    bossName: "Eco do Portal",
    tagline: "Direto no chefão · piscadas e ecos",
    icon: "🌀",
    accent: "#b44dff",
    stages: bossOnlyStage({
      name: "Coração do Portal",
      subtitle: "Não confie no que pisca",
      floorTint: 3,
      bossType: "boss_echo",
      accent: "#b44dff",
    }),
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

export function isWorldUnlocked(worldIndex, progress = null) {
  if (worldIndex <= 0) return true;
  if (PLAYTEST_UNLOCK_ALL) return true;
  const prog = progress || loadWorldProgress();
  return prog.cleared.includes(worldIndex - 1) || prog.cleared.includes(worldIndex);
}
