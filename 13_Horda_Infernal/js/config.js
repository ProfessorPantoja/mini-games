/** Configuração global — Horda Infernal */

export const W = 960;
export const H = 640;

export const RARITY = {
  common:    { key: "common",    label: "Comum",     color: "#9aa0a6", weight: 48, glow: 0 },
  magic:     { key: "magic",     label: "Mágico",    color: "#4da3ff", weight: 28, glow: 0.35 },
  rare:      { key: "rare",      label: "Raro",      color: "#f0c14b", weight: 14, glow: 0.55 },
  epic:      { key: "epic",      label: "Épico",     color: "#b44dff", weight: 7,  glow: 0.75 },
  legendary: { key: "legendary", label: "Lendário",  color: "#ff7a18", weight: 3,  glow: 1.0 },
};

export const RARITY_ORDER = ["common", "magic", "rare", "epic", "legendary"];

/**
 * Constantes compartilhadas da run (não dependem de classe).
 * Stats de combate ficam em js/classes/<id>.js
 */
export const SHARED = {
  xpBase: 36,
  xpGrowth: 1.32,
  hitstopHit: 0.028,
  hitstopKill: 0.055,
  hitstopCrit: 0.04,
  hitstopBoss: 0.045,
  comboWindow: 1.35,
};

/** @deprecated use SHARED + classDef.stats — mantido só p/ imports legados */
export const PLAYER_BASE = SHARED;

/** Multiplicadores de raridade aplicados aos stats base do item */
export const RARITY_MULT = {
  common: 1.0,
  magic: 1.25,
  rare: 1.55,
  epic: 1.95,
  legendary: 2.5,
};

export const WEAPON_NAMES = {
  common:    ["Machado de Ferro", "Clava Rústica", "Espada Curta", "Machadinha"],
  magic:     ["Lâmina Ember", "Machado de Brasas", "Cutelo Infernal", "Martelo de Cinzas"],
  rare:      ["Rasga-Almas", "Fúria do Portal", "Quebra-Ossos", "Serrador de Sombras"],
  epic:      ["Devorador Abissal", "Colosso de Sangue", "Ira do Inferno"],
  legendary: ["Trono-Quebrador", "Gume do Abismo", "Aniquilador Primordial"],
};

export const ARMOR_NAMES = {
  common:    ["Couraça de Couro", "Elmo de Ferro", "Manto Roto", "Colete de Placas"],
  magic:     ["Armadura Ember", "Placas de Cinza", "Couraça Flamejante"],
  rare:      ["Couraça do Portal", "Escamas do Inferno", "Guarda de Ossos"],
  epic:      ["Carapaça Abissal", "Placas do Devorador", "Couraça Sanguínea"],
  legendary: ["Égide do Trono", "Invólucro Primordial", "Casca do Abismo"],
};

export const COLORS = {
  bg: "#0d080a",
  floor: "#1a0e10",
  floorAlt: "#140a0c",
  wall: "#2a1418",
  wallEdge: "#4a1e24",
  ember: "#ff5a1f",
  gold: "#f0c14b",
  blood: "#c41e3a",
  player: "#e8d5c4",
  playerArmor: "#6a3a28",
  playerBlade: "#d8dee8",
  shadow: "rgba(0,0,0,0.45)",
};

export const STORAGE_KEY = "horda_infernal_best";
