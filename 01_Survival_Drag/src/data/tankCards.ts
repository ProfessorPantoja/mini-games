export interface TankCard {
  id: string;
  name: string;
  description: string;
}

export const TANK_CARDS: TankCard[] = [
  { id: 'shield', name: 'Escudo', description: '+30 HP máx · +1 órbita protetora' },
  { id: 'toxic', name: 'Campo Tóxico', description: 'Pulso maior · +50% dano de pulso' },
  { id: 'vampirism', name: 'Vampirismo', description: 'Cura 4 HP por kill · +15% velocidade' },
  { id: 'magnet', name: 'Magnetismo', description: '+60% alcance de XP · órbitas +15% dano' },
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