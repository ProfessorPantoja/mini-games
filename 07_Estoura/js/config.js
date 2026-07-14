/** Estoura — configuration & palette */

export const STORAGE_KEY = 'estoura_best';

export const COLORS = {
  red:    { id: 0, name: 'red',    hex: '#ff4d6d', glow: 'rgba(255, 77, 109, 0.55)' },
  blue:   { id: 1, name: 'blue',   hex: '#38bdf8', glow: 'rgba(56, 189, 248, 0.55)' },
  green:  { id: 2, name: 'green',  hex: '#34d399', glow: 'rgba(52, 211, 153, 0.5)' },
  yellow: { id: 3, name: 'yellow', hex: '#fbbf24', glow: 'rgba(251, 191, 36, 0.5)' },
  purple: { id: 4, name: 'purple', hex: '#a78bfa', glow: 'rgba(167, 139, 250, 0.55)' },
  orange: { id: 5, name: 'orange', hex: '#fb923c', glow: 'rgba(251, 146, 60, 0.5)' },
};

export const COLOR_LIST = Object.values(COLORS);

/** Map color id → palette entry */
export function colorById(id) {
  return COLOR_LIST.find((c) => c.id === id) || COLOR_LIST[0];
}

export const CFG = {
  // Grid (logical units; renderer scales to canvas)
  cols: 8,
  maxRows: 14,
  bubbleR: 22,           // logical radius
  rowGap: Math.sqrt(3),  // hex vertical spacing factor * r

  // Aim
  minAngle: 0.18,        // rad from horizontal (~10°)
  maxAngle: Math.PI - 0.18,
  shooterYOffset: 48,    // from canvas bottom

  // Shot
  shotSpeed: 780,        // px/s logical
  wallBounce: true,

  // Match
  minMatch: 3,

  // Scoring
  popBase: 10,
  fallBase: 20,
  comboMult: 0.35,       // +35% per cascade step
  clearBonus: 500,
  levelBonus: 200,

  // Danger: game over if any bubble center is below this fraction of height
  dangerLineFrac: 0.82,

  // Particles
  maxParticles: 220,

  // Timing
  popDuration: 0.28,
  fallGravity: 1800,
  stickSnapMs: 90,
};

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
