import Phaser from 'phaser';

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

    this.scene.start('GameScene');
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
}