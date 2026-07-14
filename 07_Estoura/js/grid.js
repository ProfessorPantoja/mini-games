/**
 * Hex/offset bubble grid: placement, neighbors, match, floating clusters
 */

import { CFG } from './config.js';

/**
 * Even-r offset coordinates:
 * - even rows: full cols, x = c * 2r + r
 * - odd rows: cols-1, x = c * 2r + 2r
 * - y = r + row * r * √3
 */

export class BubbleGrid {
  constructor(cols = CFG.cols, bubbleR = CFG.bubbleR) {
    this.cols = cols;
    this.r = bubbleR;
    this.rowH = bubbleR * Math.sqrt(3);
    /** @type {Map<string, {row:number,col:number,color:number,popping?:boolean,popT?:number,falling?:boolean,fx?:number,fy?:number,fvx?:number,fvy?:number}>} */
    this.cells = new Map();
  }

  key(row, col) {
    return `${row},${col}`;
  }

  colsInRow(row) {
    return row % 2 === 0 ? this.cols : this.cols - 1;
  }

  inBounds(row, col) {
    if (row < 0 || col < 0) return false;
    return col < this.colsInRow(row);
  }

  get(row, col) {
    return this.cells.get(this.key(row, col));
  }

  set(row, col, color) {
    if (!this.inBounds(row, col)) return null;
    const cell = { row, col, color };
    this.cells.set(this.key(row, col), cell);
    return cell;
  }

  remove(row, col) {
    this.cells.delete(this.key(row, col));
  }

  clear() {
    this.cells.clear();
  }

  /** World position of cell center */
  cellCenter(row, col) {
    const x = row % 2 === 0
      ? col * this.r * 2 + this.r
      : col * this.r * 2 + this.r * 2;
    const y = this.r + row * this.rowH;
    return { x, y };
  }

  /** Load from level array (rows of color ids, -1 empty) */
  loadFromArray(rows) {
    this.clear();
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] >= 0) this.set(r, c, row[c]);
      }
    }
  }

  /** Neighbor offsets for even/odd rows */
  neighborCoords(row, col) {
    // even-r horizontal layout neighbors
    const odd = row % 2 === 1;
    const deltas = odd
      ? [
          [0, -1], [0, 1],
          [-1, 0], [-1, 1],
          [1, 0], [1, 1],
        ]
      : [
          [0, -1], [0, 1],
          [-1, -1], [-1, 0],
          [1, -1], [1, 0],
        ];
    const out = [];
    for (const [dr, dc] of deltas) {
      const nr = row + dr;
      const nc = col + dc;
      if (this.inBounds(nr, nc)) out.push({ row: nr, col: nc });
    }
    return out;
  }

  /** All occupied cells as array */
  all() {
    return [...this.cells.values()];
  }

  count() {
    return this.cells.size;
  }

  /**
   * Find nearest empty slot to world (x,y), preferring adjacency to existing bubbles
   * (or ceiling for top row).
   */
  findSnapCell(x, y, maxDist) {
    const approxRow = Math.round((y - this.r) / this.rowH);
    const candidates = [];
    const rowStart = Math.max(0, approxRow - 2);
    const rowEnd = approxRow + 3;

    for (let row = rowStart; row <= rowEnd; row++) {
      if (row > CFG.maxRows + 2) continue;
      const n = this.colsInRow(row);
      for (let col = 0; col < n; col++) {
        if (this.get(row, col)) continue;
        const { x: cx, y: cy } = this.cellCenter(row, col);
        const d = Math.hypot(x - cx, y - cy);
        if (d <= maxDist) {
          // Must touch ceiling or at least one neighbor bubble
          const touchesTop = row === 0;
          const hasNeighbor = this.neighborCoords(row, col).some(
            (n) => this.get(n.row, n.col)
          );
          if (touchesTop || hasNeighbor) {
            candidates.push({ row, col, d, cx, cy });
          }
        }
      }
    }

    if (!candidates.length) {
      // Fallback: any empty near position even without neighbor (shouldn't happen often)
      for (let row = rowStart; row <= rowEnd; row++) {
        if (row < 0) continue;
        const n = this.colsInRow(row);
        for (let col = 0; col < n; col++) {
          if (this.get(row, col)) continue;
          const { x: cx, y: cy } = this.cellCenter(row, col);
          const d = Math.hypot(x - cx, y - cy);
          candidates.push({ row, col, d, cx, cy });
        }
      }
    }

    candidates.sort((a, b) => a.d - b.d);
    return candidates[0] || null;
  }

  /** BFS same-color connected group */
  matchGroup(row, col) {
    const start = this.get(row, col);
    if (!start || start.color < 0) return [];
    const color = start.color;
    const seen = new Set();
    const stack = [{ row, col }];
    const group = [];
    while (stack.length) {
      const cur = stack.pop();
      const k = this.key(cur.row, cur.col);
      if (seen.has(k)) continue;
      seen.add(k);
      const cell = this.get(cur.row, cur.col);
      if (!cell || cell.color !== color || cell.popping || cell.falling) continue;
      group.push(cell);
      for (const n of this.neighborCoords(cur.row, cur.col)) {
        stack.push(n);
      }
    }
    return group;
  }

  /** Cells connected to ceiling (row 0) via any colors */
  connectedToCeiling() {
    const seen = new Set();
    const stack = [];
    for (let c = 0; c < this.colsInRow(0); c++) {
      if (this.get(0, c)) stack.push({ row: 0, col: c });
    }
    while (stack.length) {
      const cur = stack.pop();
      const k = this.key(cur.row, cur.col);
      if (seen.has(k)) continue;
      const cell = this.get(cur.row, cur.col);
      if (!cell || cell.popping || cell.falling) continue;
      seen.add(k);
      for (const n of this.neighborCoords(cur.row, cur.col)) {
        stack.push(n);
      }
    }
    return seen;
  }

  /** Floating clusters (not connected to ceiling) */
  floatingCells() {
    const connected = this.connectedToCeiling();
    const floating = [];
    for (const cell of this.cells.values()) {
      if (cell.popping || cell.falling) continue;
      if (!connected.has(this.key(cell.row, cell.col))) {
        floating.push(cell);
      }
    }
    return floating;
  }

  /** Lowest bubble Y center */
  maxY() {
    let m = 0;
    for (const cell of this.cells.values()) {
      if (cell.popping || cell.falling) continue;
      const { y } = this.cellCenter(cell.row, cell.col);
      if (y > m) m = y;
    }
    return m;
  }

  /** Colors still present on the board */
  activeColors() {
    const s = new Set();
    for (const cell of this.cells.values()) {
      if (!cell.popping && !cell.falling && cell.color >= 0) s.add(cell.color);
    }
    return [...s];
  }

  /**
   * Check if a flying bubble at (x,y) collides with any fixed bubble.
   * Returns the hit cell or null.
   */
  collideBubble(x, y, rad) {
    const thresh = (this.r + rad) * 0.92;
    let best = null;
    let bestD = Infinity;
    for (const cell of this.cells.values()) {
      if (cell.popping || cell.falling) continue;
      const { x: cx, y: cy } = this.cellCenter(cell.row, cell.col);
      const d = Math.hypot(x - cx, y - cy);
      if (d < thresh && d < bestD) {
        bestD = d;
        best = cell;
      }
    }
    return best;
  }

  /** Ceiling collision (top of playfield) */
  hitsCeiling(y, rad) {
    return y - rad <= 2;
  }
}
