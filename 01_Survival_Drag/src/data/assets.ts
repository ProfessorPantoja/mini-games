const TILES = 'kenney_tiny-dungeon/Tiles';

/** Cor sólida do chão (trocar por textura de grama depois) */
export const FLOOR_COLOR = 0x2a4a32;

/** Sprites do pack Kenney Tiny Dungeon usados no jogo */
export const ASSETS = {
  player: `${TILES}/tile_0110.png`,
  enemySlime: `${TILES}/tile_0090.png`,
  enemySkeleton: `${TILES}/tile_0096.png`,
  enemyGolem: `${TILES}/tile_0082.png`,
  xpGem: `${TILES}/tile_0125.png`,
} as const;

export const SPRITE_SCALE = 3;

/** Hitbox menor que o sprite — evita dano à distância */
export const HITBOX_RADIUS = 7;
export const HITBOX_OFFSET_X = 8;
export const HITBOX_OFFSET_Y = 12;