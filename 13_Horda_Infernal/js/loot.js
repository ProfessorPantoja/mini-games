/** Geração de itens, raridade e comparação */

import {
  RARITY, RARITY_ORDER, RARITY_MULT,
  WEAPON_NAMES, ARMOR_NAMES, PLAYER_BASE,
} from "./config.js";

let _id = 1;
function nextId() {
  return _id++;
}

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

function rollRarity(luckBoost = 0) {
  // luckBoost 0..1 aumenta chance de raridades altas
  const weights = RARITY_ORDER.map((k, i) => {
    const base = RARITY[k].weight;
    const boost = 1 + luckBoost * i * 0.55;
    return base * boost;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < RARITY_ORDER.length; i++) {
    r -= weights[i];
    if (r <= 0) return RARITY_ORDER[i];
  }
  return "common";
}

/**
 * Gera item de arma ou armadura.
 * @param {"weapon"|"armor"} slot
 * @param {number} stageIndex 0-based — escala o poder
 * @param {number} luckBoost
 * @param {string|null} forceRarity
 */
export function generateItem(slot, stageIndex = 0, luckBoost = 0, forceRarity = null) {
  const rarity = forceRarity || rollRarity(luckBoost);
  const mult = RARITY_MULT[rarity];
  const stageScale = 1 + stageIndex * 0.28;

  if (slot === "weapon") {
    const baseDmg = Math.round((PLAYER_BASE.damage * 0.55 + stageIndex * 3.5) * mult * stageScale);
    const name = pick(WEAPON_NAMES[rarity]);
    return {
      id: nextId(),
      slot: "weapon",
      rarity,
      name,
      damage: Math.max(4, baseDmg),
      defense: 0,
    };
  }

  const baseDef = Math.round((1.5 + stageIndex * 1.2) * mult * stageScale);
  const name = pick(ARMOR_NAMES[rarity]);
  const hpBonus = Math.round((8 + stageIndex * 5) * mult);
  return {
    id: nextId(),
    slot: "armor",
    rarity,
    name,
    damage: 0,
    defense: Math.max(1, baseDef),
    hpBonus,
  };
}

/** @param {{ starterWeapon?: object, starterArmor?: object } | null} classDef */
export function starterWeapon(classDef = null) {
  const sw = classDef?.starterWeapon || {};
  return {
    id: nextId(),
    slot: "weapon",
    rarity: "common",
    name: sw.name || "Machado do Iniciante",
    damage: sw.damage ?? 10,
    defense: 0,
  };
}

/** @param {{ starterWeapon?: object, starterArmor?: object } | null} classDef */
export function starterArmor(classDef = null) {
  const sa = classDef?.starterArmor || {};
  return {
    id: nextId(),
    slot: "armor",
    rarity: "common",
    name: sa.name || "Couro Manchado",
    damage: 0,
    defense: sa.defense ?? 1,
    hpBonus: sa.hpBonus || 0,
  };
}

export function rarityColor(key) {
  return RARITY[key]?.color || "#9aa0a6";
}

export function rarityLabel(key) {
  return RARITY[key]?.label || "Comum";
}

/** Compara candidato vs equipado — retorna deltas legíveis */
export function compareItems(candidate, equipped) {
  if (!candidate) return null;
  const eq = equipped || { damage: 0, defense: 0, hpBonus: 0 };

  if (candidate.slot === "weapon") {
    const d = candidate.damage - (eq.damage || 0);
    return {
      stats: [
        { key: "Dano", cur: eq.damage || 0, next: candidate.damage, delta: d },
      ],
      score: d,
    };
  }

  const dDef = candidate.defense - (eq.defense || 0);
  const dHp = (candidate.hpBonus || 0) - (eq.hpBonus || 0);
  return {
    stats: [
      { key: "Defesa", cur: eq.defense || 0, next: candidate.defense, delta: dDef },
      { key: "Vida+", cur: eq.hpBonus || 0, next: candidate.hpBonus || 0, delta: dHp },
    ],
    score: dDef * 2 + dHp * 0.15,
  };
}

/** Drop no chão */
export function createLootDrop(x, y, item) {
  return {
    x, y,
    item,
    bob: Math.random() * Math.PI * 2,
    life: 60, // segundos até sumir
    radius: 14,
    pulled: false,
    ignoreUntil: 0,
  };
}

/**
 * Escolhe loot para um kill.
 * Chance base + boss sempre dropa algo bom.
 */
export function rollDropForKill(enemy, stageIndex) {
  const isBoss = enemy.kind === "boss";
  const isElite = enemy.kind === "elite";
  let chance = 0.24;
  if (isElite) chance = 0.62;
  if (isBoss) chance = 1;

  if (Math.random() > chance) return null;

  const luck = isBoss ? 0.9 : isElite ? 0.45 : stageIndex * 0.08;
  const slot = Math.random() < 0.55 ? "weapon" : "armor";
  let force = null;
  if (isBoss) force = Math.random() < 0.5 ? "legendary" : "epic";
  else if (isElite && Math.random() < 0.35) force = "rare";

  return generateItem(slot, stageIndex, luck, force);
}
