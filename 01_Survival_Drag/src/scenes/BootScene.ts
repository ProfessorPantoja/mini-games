import Phaser from 'phaser';
import { ASSETS } from '../data/assets';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.setPath('');

    for (const [key, path] of Object.entries(ASSETS)) {
      this.load.image(key, path);
    }
  }

  create(): void {
    this.scene.start('GameScene');
  }
}