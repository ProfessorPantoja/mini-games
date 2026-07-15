/**
 * Campanha Neon Serpent — 10 fases com identidade de terreno.
 *
 * goal: orbs a coletar (boss usa bossHits)
 * stepMs: intervalo entre movimentos (menor = mais rápido)
 * wrap: false = paredes matam; true = atravessa bordas
 * hazards: extras aleatórios (preferir terrain manual)
 * terrain: formas estáticas → células letais
 *   h: linha horizontal { t:"h", x, y, len }
 *   v: linha vertical   { t:"v", x, y, len }
 *   L: cotovelo         { t:"L", x, y, w, h, flipX?, flipY? }
 *   cross: cruz         { t:"cross", x, y, arm }
 *   ring: anel          { t:"ring", cx, cy, r, gap? } gap: "n"|"s"|"e"|"w"|"ne"...
 *   rect: retângulo     { t:"rect", x, y, w, h, fill? }
 *   dots: pontos        { t:"dots", cells: [[x,y],...] }
 * theme: cores de grade / borda / atmosfera / hazard
 * specialChance: chance de power-up no spawn de comida
 * boss: fase Hidra
 */

const THEME = {
  aqua: {
    bg: "#05070f",
    grid: "rgba(0, 240, 255, 0.05)",
    border: "rgba(0, 240, 255, 0.28)",
    borderLethal: "rgba(255, 93, 122, 0.5)",
    hazard: "#ff5d7a",
    star: "#a8c4ff",
    ambience: "rgba(0, 240, 255, 0.03)",
  },
  current: {
    bg: "#040a12",
    grid: "rgba(0, 200, 255, 0.07)",
    border: "rgba(0, 220, 255, 0.35)",
    borderLethal: "rgba(255, 93, 122, 0.5)",
    hazard: "#00d4ff",
    star: "#7ad4ff",
    ambience: "rgba(0, 180, 255, 0.04)",
  },
  hydra: {
    bg: "#0a0410",
    grid: "rgba(255, 43, 214, 0.06)",
    border: "rgba(255, 43, 214, 0.4)",
    borderLethal: "rgba(255, 43, 214, 0.55)",
    hazard: "#ff2bd6",
    star: "#ff9ae8",
    ambience: "rgba(255, 43, 214, 0.05)",
  },
  grid: {
    bg: "#06080e",
    grid: "rgba(140, 160, 220, 0.08)",
    border: "rgba(255, 93, 122, 0.55)",
    borderLethal: "rgba(255, 93, 122, 0.6)",
    hazard: "#9aa8d4",
    star: "#c8d0f0",
    ambience: "rgba(120, 140, 200, 0.035)",
  },
  spikes: {
    bg: "#0c0608",
    grid: "rgba(255, 120, 80, 0.06)",
    border: "rgba(255, 93, 122, 0.55)",
    borderLethal: "rgba(255, 80, 60, 0.65)",
    hazard: "#ff6b4a",
    star: "#ffb09a",
    ambience: "rgba(255, 80, 40, 0.04)",
  },
  maze: {
    bg: "#050910",
    grid: "rgba(100, 220, 180, 0.05)",
    border: "rgba(255, 93, 122, 0.55)",
    borderLethal: "rgba(80, 220, 160, 0.5)",
    hazard: "#4dffa8",
    star: "#a0ffd0",
    ambience: "rgba(40, 200, 140, 0.04)",
  },
  pulse: {
    bg: "#080612",
    grid: "rgba(180, 100, 255, 0.07)",
    border: "rgba(180, 100, 255, 0.4)",
    borderLethal: "rgba(255, 93, 122, 0.5)",
    hazard: "#b46cff",
    star: "#d4b0ff",
    ambience: "rgba(160, 80, 255, 0.045)",
  },
  finale: {
    bg: "#04060c",
    grid: "rgba(0, 240, 255, 0.08)",
    border: "rgba(255, 93, 122, 0.65)",
    borderLethal: "rgba(0, 240, 255, 0.55)",
    hazard: "#00f0ff",
    star: "#ffe08a",
    ambience: "rgba(255, 200, 80, 0.035)",
  },
};

export const LEVELS = [
  // ─── 1 · open cradle ─────────────────────────────
  {
    id: 1,
    name: "NASCENTE",
    goal: 5,
    stepMs: 145,
    wrap: true,
    hazards: 0,
    specialChance: 0.12,
    theme: THEME.aqua,
    terrain: [],
  },

  // ─── 2 · twin current channels ───────────────────
  {
    id: 2,
    name: "CORRENTE",
    goal: 7,
    stepMs: 132,
    wrap: true,
    hazards: 0,
    specialChance: 0.15,
    theme: THEME.current,
    terrain: [
      // duas "correntes" verticais com brechas
      { t: "v", x: 5, y: 2, len: 8 },
      { t: "v", x: 5, y: 14, len: 10 },
      { t: "v", x: 14, y: 4, len: 10 },
      { t: "v", x: 14, y: 18, len: 6 },
      // guelras laterais
      { t: "h", x: 1, y: 10, len: 3 },
      { t: "h", x: 16, y: 16, len: 3 },
    ],
  },

  // ─── 3 · boss α — arena aberta, cantos só ────────
  {
    id: 3,
    name: "HIDRA α",
    goal: 3,
    stepMs: 128,
    wrap: true,
    hazards: 0,
    specialChance: 0.18,
    boss: true,
    bossHits: 3,
    theme: THEME.hydra,
    // base (y≥20) livre para spawn; cantos superiores decorativos
    terrain: [
      { t: "L", x: 1, y: 1, w: 3, h: 3 },
      { t: "L", x: 16, y: 1, w: 3, h: 3, flipX: true },
      { t: "dots", cells: [[2, 26], [17, 26]] },
    ],
  },

  // ─── 4 · pillar grid (paredes letais) ─────────────
  {
    id: 4,
    name: "GRADE",
    goal: 8,
    stepMs: 120,
    wrap: false,
    hazards: 0,
    specialChance: 0.16,
    theme: THEME.grid,
    terrain: [
      // pilares 2×2 em grade irregular (corredores largos)
      { t: "rect", x: 3, y: 4, w: 2, h: 2, fill: true },
      { t: "rect", x: 9, y: 4, w: 2, h: 2, fill: true },
      { t: "rect", x: 15, y: 4, w: 2, h: 2, fill: true },
      { t: "rect", x: 3, y: 12, w: 2, h: 2, fill: true },
      { t: "rect", x: 15, y: 12, w: 2, h: 2, fill: true },
      { t: "rect", x: 3, y: 20, w: 2, h: 2, fill: true },
      { t: "rect", x: 9, y: 20, w: 2, h: 2, fill: true },
      { t: "rect", x: 15, y: 20, w: 2, h: 2, fill: true },
      // centro livre para manobra
    ],
  },

  // ─── 5 · spike islands ───────────────────────────
  {
    id: 5,
    name: "ESPINHOS",
    goal: 9,
    stepMs: 112,
    wrap: false,
    hazards: 0,
    specialChance: 0.18,
    theme: THEME.spikes,
    terrain: [
      { t: "cross", x: 4, y: 6, arm: 2 },
      { t: "cross", x: 15, y: 8, arm: 2 },
      { t: "cross", x: 9, y: 14, arm: 1 },
      { t: "cross", x: 5, y: 20, arm: 2 },
      { t: "cross", x: 14, y: 22, arm: 2 },
      { t: "dots", cells: [[10, 3], [2, 14], [17, 16], [10, 25]] },
    ],
  },

  // ─── 6 · boss β — bordas parciais ─────────────────
  {
    id: 6,
    name: "HIDRA β",
    goal: 4,
    stepMs: 108,
    wrap: true,
    hazards: 0,
    specialChance: 0.2,
    boss: true,
    bossHits: 4,
    theme: THEME.hydra,
    terrain: [
      // moldura incompleta — faixa y≥22 livre para spawn
      { t: "h", x: 3, y: 1, len: 5 },
      { t: "h", x: 12, y: 1, len: 5 },
      { t: "v", x: 1, y: 4, len: 6 },
      { t: "v", x: 18, y: 4, len: 6 },
      { t: "L", x: 1, y: 18, w: 4, h: 3, flipY: true },
      { t: "L", x: 15, y: 18, w: 4, h: 3, flipX: true, flipY: true },
    ],
  },

  // ─── 7 · maze of L corridors ─────────────────────
  {
    id: 7,
    name: "LABIRINTO",
    goal: 10,
    stepMs: 100,
    wrap: false,
    hazards: 0,
    specialChance: 0.2,
    theme: THEME.maze,
    terrain: [
      // corredores em L — passagens largas (2+ células)
      { t: "L", x: 2, y: 2, w: 7, h: 5 },
      { t: "L", x: 12, y: 2, w: 6, h: 4, flipX: true },
      { t: "h", x: 2, y: 10, len: 6 },
      { t: "v", x: 10, y: 8, len: 6 },
      { t: "L", x: 13, y: 10, w: 5, h: 5 },
      { t: "L", x: 2, y: 15, w: 5, h: 6, flipY: true },
      { t: "h", x: 9, y: 18, len: 8 },
      { t: "v", x: 16, y: 18, len: 5 },
      { t: "L", x: 2, y: 23, w: 6, h: 3, flipY: true },
      { t: "rect", x: 12, y: 23, w: 5, h: 1, fill: true },
    ],
  },

  // ─── 8 · pulse rings ─────────────────────────────
  {
    id: 8,
    name: "PULSO",
    goal: 12,
    stepMs: 94,
    wrap: true,
    hazards: 0,
    specialChance: 0.22,
    theme: THEME.pulse,
    terrain: [
      // anéis concêntricos com aberturas alternadas
      { t: "ring", cx: 10, cy: 13, r: 4, gap: "e" },
      { t: "ring", cx: 10, cy: 13, r: 7, gap: "w" },
      { t: "ring", cx: 10, cy: 13, r: 10, gap: "n" },
      // satélites
      { t: "cross", x: 3, y: 3, arm: 1 },
      { t: "cross", x: 16, y: 24, arm: 1 },
    ],
  },

  // ─── 9 · boss Ω — pressão lateral ────────────────
  {
    id: 9,
    name: "HIDRA Ω",
    goal: 5,
    stepMs: 90,
    wrap: true,
    hazards: 0,
    specialChance: 0.24,
    boss: true,
    bossHits: 5,
    theme: THEME.hydra,
    terrain: [
      // parede esquerda parcial + ilhas (direita/base abertas)
      { t: "v", x: 2, y: 2, len: 10 },
      { t: "v", x: 2, y: 16, len: 8 },
      { t: "h", x: 2, y: 2, len: 4 },
      { t: "cross", x: 16, y: 6, arm: 1 },
      { t: "cross", x: 15, y: 18, arm: 1 },
      { t: "dots", cells: [[17, 12], [6, 25], [12, 25]] },
    ],
  },

  // ─── 10 · finale arena ───────────────────────────
  {
    id: 10,
    name: "SERPENTE NEON",
    goal: 15,
    stepMs: 84,
    wrap: false,
    hazards: 0,
    specialChance: 0.22,
    theme: THEME.finale,
    terrain: [
      // arena: moldura interna com portas + cruz central + Ls
      { t: "h", x: 2, y: 2, len: 6 },
      { t: "h", x: 12, y: 2, len: 6 },
      { t: "h", x: 2, y: 25, len: 6 },
      { t: "h", x: 12, y: 25, len: 6 },
      { t: "v", x: 2, y: 2, len: 8 },
      { t: "v", x: 2, y: 18, len: 8 },
      { t: "v", x: 17, y: 2, len: 8 },
      { t: "v", x: 17, y: 18, len: 8 },
      { t: "cross", x: 10, y: 13, arm: 3 },
      { t: "L", x: 5, y: 7, w: 3, h: 3 },
      { t: "L", x: 12, y: 7, w: 3, h: 3, flipX: true },
      { t: "L", x: 5, y: 17, w: 3, h: 3, flipY: true },
      { t: "L", x: 12, y: 17, w: 3, h: 3, flipX: true, flipY: true },
      { t: "dots", cells: [[10, 5], [10, 21], [6, 13], [14, 13]] },
    ],
  },
];

export const POWER_DEFS = {
  ghost: { label: "FANTASMA", color: "#8b7cff", turns: 12 },
  magnet: { label: "ÍMÃ", color: "#ffc857", turns: 14 },
  turbo: { label: "TURBO", color: "#ff2bd6", turns: 10 },
  shrink: { label: "ENCOLHE", color: "#7dffb3", turns: 0 },
};

export const DEFAULT_THEME = THEME.aqua;
