/**
 * Pre-generated level layouts.
 * Each cell: color id 0–5, or -1 empty.
 * Rows use offset: even rows have `cols` cells, odd rows have `cols - 1`.
 */

/** Simple seeded PRNG for reproducible layouts */
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a level grid.
 * @param {number} seed
 * @param {object} opts
 * @returns {number[][]} rows of color ids (-1 empty)
 */
export function generateLevel(seed, opts = {}) {
  const {
    cols = 8,
    rows = 6,
    colorCount = 4,
    density = 0.92,
    pattern = 'random',
  } = opts;

  const rng = mulberry32(seed);
  const colors = Array.from({ length: colorCount }, (_, i) => i);
  const grid = [];

  for (let r = 0; r < rows; r++) {
    const n = r % 2 === 0 ? cols : cols - 1;
    const row = [];
    for (let c = 0; c < n; c++) {
      if (rng() > density) {
        row.push(-1);
        continue;
      }

      let color;
      if (pattern === 'stripes') {
        color = colors[r % colorCount];
      } else if (pattern === 'columns') {
        color = colors[c % colorCount];
      } else if (pattern === 'diamond') {
        const mid = (cols - 1) / 2;
        const d = Math.abs(c - mid + (r % 2) * 0.5) + Math.abs(r - rows / 2);
        color = colors[Math.floor(d) % colorCount];
      } else if (pattern === 'clusters') {
        // Prefer neighbor colors for cluster-friendly layouts
        const neighbors = [];
        if (c > 0 && row[c - 1] >= 0) neighbors.push(row[c - 1]);
        if (r > 0) {
          const prev = grid[r - 1];
          const off = r % 2; // current is odd → prev even
          const left = c - (1 - off);
          const right = c + off;
          if (left >= 0 && left < prev.length && prev[left] >= 0) neighbors.push(prev[left]);
          if (right >= 0 && right < prev.length && prev[right] >= 0) neighbors.push(prev[right]);
        }
        if (neighbors.length && rng() < 0.55) {
          color = neighbors[Math.floor(rng() * neighbors.length)];
        } else {
          color = colors[Math.floor(rng() * colorCount)];
        }
      } else {
        color = colors[Math.floor(rng() * colorCount)];
      }
      row.push(color);
    }
    grid.push(row);
  }

  // Guarantee at least some bubbles
  let count = 0;
  for (const row of grid) for (const v of row) if (v >= 0) count++;
  if (count < 8) {
    for (let r = 0; r < Math.min(3, rows); r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] < 0) grid[r][c] = colors[Math.floor(rng() * colorCount)];
      }
    }
  }

  return grid;
}

/** Level progression definitions */
export const LEVELS = [
  { seed: 101, rows: 5, colorCount: 3, density: 0.95, pattern: 'clusters', name: 'Aquecimento' },
  { seed: 202, rows: 6, colorCount: 4, density: 0.9, pattern: 'stripes', name: 'Faixas' },
  { seed: 303, rows: 6, colorCount: 4, density: 0.88, pattern: 'clusters', name: 'Nuvens' },
  { seed: 404, rows: 7, colorCount: 4, density: 0.92, pattern: 'columns', name: 'Colunas' },
  { seed: 505, rows: 7, colorCount: 5, density: 0.9, pattern: 'diamond', name: 'Diamante' },
  { seed: 606, rows: 8, colorCount: 5, density: 0.88, pattern: 'clusters', name: 'Tempestade' },
  { seed: 707, rows: 8, colorCount: 5, density: 0.93, pattern: 'stripes', name: 'Arco' },
  { seed: 808, rows: 9, colorCount: 5, density: 0.9, pattern: 'clusters', name: 'Nebulosa' },
  { seed: 909, rows: 9, colorCount: 6, density: 0.88, pattern: 'diamond', name: 'Cristal' },
  { seed: 1010, rows: 10, colorCount: 6, density: 0.9, pattern: 'clusters', name: 'Supernova' },
];

export function getLevelDef(index) {
  if (index < LEVELS.length) return { ...LEVELS[index], index };
  // Endless procedural after campaign
  const i = index;
  return {
    index: i,
    seed: 1000 + i * 97,
    rows: Math.min(11, 6 + Math.floor(i / 2)),
    colorCount: Math.min(6, 3 + Math.floor(i / 2)),
    density: 0.88 + (i % 3) * 0.02,
    pattern: ['clusters', 'stripes', 'diamond', 'columns'][i % 4],
    name: `Infinito ${i - LEVELS.length + 1}`,
  };
}

export function buildLevelGrid(levelIndex, cols = 8) {
  const def = getLevelDef(levelIndex);
  const grid = generateLevel(def.seed, { ...def, cols });
  return { def, grid };
}
