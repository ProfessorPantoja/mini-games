export type EnemyType = 'slime' | 'skeleton' | 'golem';
export type EnemyTier = 'weak' | 'medium' | 'tank';

export interface EnemyDefinition {
  texture: string;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  scale: number;
  tier: EnemyTier;
  label: string;
  hitColor: number;
  deathColor: number;
  showHpBar: boolean;
}

export const ENEMY_TYPES: Record<EnemyType, EnemyDefinition> = {
  slime: {
    texture: 'enemySlime',
    hp: 1,
    speed: 88,
    damage: 4,
    xp: 1,
    scale: 0.95,
    tier: 'weak',
    label: 'Slime',
    hitColor: 0xffffff,
    deathColor: 0x3dff7a,
    showHpBar: false,
  },
  skeleton: {
    texture: 'enemySkeleton',
    hp: 3,
    speed: 120,
    damage: 7,
    xp: 2,
    scale: 1.15,
    tier: 'medium',
    label: 'Esqueleto',
    hitColor: 0xffaaaa,
    deathColor: 0xff5e6c,
    showHpBar: true,
  },
  golem: {
    texture: 'enemyGolem',
    hp: 10,
    speed: 42,
    damage: 12,
    xp: 5,
    scale: 1.85,
    tier: 'tank',
    label: 'Golem',
    hitColor: 0xddddff,
    deathColor: 0xb0b8c8,
    showHpBar: true,
  },
};