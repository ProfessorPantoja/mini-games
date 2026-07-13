export type ZoneType = 'spawn' | 'wild' | 'elite' | 'boss';
export type ObjectivePhase = 'explore' | 'boss' | 'victory';

export interface WorldZone {
  id: string;
  type: ZoneType;
  x: number;
  y: number;
  radius: number;
  label: string;
  color: number;
  mapColor: number;
  cleared: boolean;
}

export const WORLD_SIZE = 3200;
const CX = WORLD_SIZE / 2;
const CY = WORLD_SIZE / 2;

export function createWorldZones(): WorldZone[] {
  return [
    { id: 'spawn', type: 'spawn', x: CX, y: CY, radius: 300, label: 'Acampamento', color: 0x1e3a2f, mapColor: 0x55ff99, cleared: true },
    { id: 'elite_n', type: 'elite', x: CX, y: 520, radius: 220, label: 'Elite Norte', color: 0x3a1e4a, mapColor: 0xcc66ff, cleared: false },
    { id: 'elite_e', type: 'elite', x: 2680, y: CY, radius: 220, label: 'Elite Leste', color: 0x3a1e4a, mapColor: 0xcc66ff, cleared: false },
    { id: 'elite_s', type: 'elite', x: CX, y: 2680, radius: 220, label: 'Elite Sul', color: 0x3a1e4a, mapColor: 0xcc66ff, cleared: false },
    { id: 'boss', type: 'boss', x: 2750, y: 450, radius: 280, label: 'Chefe', color: 0x4a2010, mapColor: 0xff8844, cleared: false },
  ];
}

export const ELITES_TO_UNLOCK_BOSS = 2;
export const BOSS_UNLOCK_TIME_SEC = 90;