import Phaser from 'phaser';
import { FLOOR_COLOR, GRASS_TILE } from '../data/assets';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.createCircleTexture('player', 14, 0x3d8bfd, 0xffffff);
    this.createCircleTexture('enemySlime', 10, 0x3dff7a, 0x1a6b32);
    this.createCircleTexture('enemySkeleton', 11, 0xff5e6c, 0x8b1020);
    this.createCircleTexture('enemyGolem', 16, 0xb0b8c8, 0x4a5060);
    this.createCircleTexture('xpGem', 6, 0x5dffb0, 0xffffff);
    this.createCircleTexture('orb', 7, 0x66ffaa, 0xffffff);
    this.createCircleTexture('elite', 18, 0xaa44ff, 0xffffff);
    this.createCircleTexture('boss', 28, 0xff6622, 0xffcc88);
    this.createCircleTexture('particle', 3, 0xffffff, 0xffffff);
    this.createGrassTexture();

    this.scene.start('MenuScene');
  }

  private createCircleTexture(key: string, radius: number, fill: number, stroke: number): void {
    const size = radius * 2 + 4;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(fill, 1);
    g.fillCircle(size / 2, size / 2, radius);
    g.lineStyle(2, stroke, 0.9);
    g.strokeCircle(size / 2, size / 2, radius);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** Tile de grama procedural — variação sutil no verde escuro */
  private createGrassTexture(): void {
    const size = GRASS_TILE;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(FLOOR_COLOR, 1);
    g.fillRect(0, 0, size, size);

    // Manchas de grama mais clara
    const light = 0x1a2e22;
    const mid = 0x183024;
    const dark = 0x101c14;

    for (let i = 0; i < 28; i++) {
      const x = (i * 17 + 7) % size;
      const y = (i * 23 + 11) % size;
      const r = 2 + (i % 4);
      g.fillStyle(i % 3 === 0 ? light : mid, 0.55);
      g.fillCircle(x, y, r);
    }

    // Pontinhos de relva
    for (let i = 0; i < 40; i++) {
      const x = (i * 13 + 3) % size;
      const y = (i * 29 + 5) % size;
      g.fillStyle(0x2a4a32, 0.7);
      g.fillRect(x, y, 1, 2 + (i % 3));
    }

    // Sombra sutil nos cantos (tileável)
    g.fillStyle(dark, 0.25);
    g.fillRect(0, 0, size, 2);
    g.fillRect(0, 0, 2, size);

    g.generateTexture('grass', size, size);
    g.destroy();
  }
}