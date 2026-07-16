/**
 * Mundos da campanha — cada um com 4 etapas (como o Mundo I).
 * Etapa final = chefão do mundo.
 */

import {
  STAGES_WORLD_0,
  STAGES_WORLD_1,
  STAGES_WORLD_2,
  STAGES_WORLD_3,
} from "./stages.js";

export const WORLD_UNLOCK_KEY = "horda_infernal_worlds_v1";

/** Playtest: todos os mundos liberados. */
export const PLAYTEST_UNLOCK_ALL = true;

export const WORLDS = [
  {
    id: "portal",
    index: 0,
    name: "Portal Infernal",
    short: "I",
    label: "Mundo I",
    bossName: "Senhor da Horda",
    tagline: "4 etapas · trono do abismo",
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
    tagline: "4 etapas · fábrica de ovos",
    icon: "🌋",
    accent: "#ff6a20",
    stages: STAGES_WORLD_1,
  },
  {
    id: "carcere",
    index: 2,
    name: "Pátio dos Ossos",
    short: "III",
    label: "Mundo III",
    bossName: "Carcereiro de Ossos",
    tagline: "4 etapas · correntes e puxão",
    icon: "⛓️",
    accent: "#c8b8a0",
    stages: STAGES_WORLD_2,
  },
  {
    id: "fenda",
    index: 3,
    name: "Fenda do Portal",
    short: "IV",
    label: "Mundo IV",
    bossName: "Eco do Portal",
    tagline: "4 etapas · ilusões e ecos",
    icon: "🌀",
    accent: "#b44dff",
    stages: STAGES_WORLD_3,
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
