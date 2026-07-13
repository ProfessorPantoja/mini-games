export interface TankCard {
  id: string;
  name: string;
  description: string;
}

/** Cartas exclusivas da build Tanque — sempre 3 opções, escolhe 1 */
export const TANK_CARDS: TankCard[] = [
  { id: 'shield', name: 'Escudo', description: '+25 HP máximo e +10 HP agora' },
  { id: 'toxic', name: 'Campo Tóxico', description: '+40% dano e +20% área da aura' },
  { id: 'vampirism', name: 'Vampirismo', description: 'Cura 3 HP ao matar inimigo' },
];

export function pickTankCards(count = 3): TankCard[] {
  const pool = [...TANK_CARDS];
  const picked: TankCard[] = [];

  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}