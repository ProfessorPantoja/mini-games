const TILES = 'kenney_tiny-dungeon/Tiles';

/** Cor sólida do chão (trocar por textura de grama depois) */
export const FLOOR_COLOR = 0x2a4a32;

/** Sprites do pack Kenney Tiny Dungeon usados no jogo */
export const ASSETS = {
  player: `${TILES}/tile_0072.png`,
  enemySlime: `${TILES}/tile_0090.png`,
  enemySkeleton: `${TILES}/tile_0096.png`,
  enemyGolem: `${TILES}/tile_0108.png`,
  xpGem: `${TILES}/tile_0125.png`,
} as const;

export const SPRITE_SCALE = 2;