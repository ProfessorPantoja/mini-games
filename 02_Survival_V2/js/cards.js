/**
 * Cartas da build Tanque.
 * Todas reforçam: aguentar, área, regenerar.
 */

export const TANK_CARDS = [
  {
    id: "escudo",
    name: "Escudo",
    icon: "🛡",
    desc: "+30 vida máx. e +1 órbita ao redor do herói.",
    apply(player) {
      player.maxHp += 30;
      player.hp = Math.min(player.hp + 30, player.maxHp);
      player.orbitCount += 1;
    },
  },
  {
    id: "campo_toxico",
    name: "Campo Tóxico",
    icon: "☢",
    desc: "Pulso 25% maior e +1 de dano de área.",
    apply(player) {
      player.pulseMaxRadius *= 1.25;
      player.pulseDamage += 1;
    },
  },
  {
    id: "vampirismo",
    name: "Vampirismo",
    icon: "🩸",
    desc: "Cura 4 HP ao matar. +12% velocidade.",
    apply(player) {
      player.lifestealOnKill += 4;
      player.speed *= 1.12;
    },
  },
  {
    id: "magnetismo",
    name: "Magnetismo",
    icon: "🧲",
    desc: "Gemas de mais longe. Órbitas +1 dano e 15% maiores.",
    apply(player) {
      player.magnetRadius *= 1.55;
      player.orbitDamage += 1;
      player.orbitSize *= 1.15;
      player.orbitRadius *= 1.08;
    },
  },
  {
    id: "casca_grossa",
    name: "Casca Grossa",
    icon: "🪨",
    desc: "+20 vida máx. e +15% de cura ao matar (base).",
    apply(player) {
      player.maxHp += 20;
      player.hp = Math.min(player.hp + 20, player.maxHp);
      player.lifestealOnKill += 2;
    },
  },
  {
    id: "onda_pesada",
    name: "Onda Pesada",
    icon: "🌊",
    desc: "Pulso 20% mais frequente e +1 dano.",
    apply(player) {
      player.pulseInterval *= 0.8;
      player.pulseDamage += 1;
    },
  },
];

/** Sorteia 3 cartas distintas do pool Tanque. */
export function rollCards(count = 3) {
  const pool = [...TANK_CARDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
