import Phaser from 'phaser';
import { sfx } from '../systems/Sfx';

export class MenuScene extends Phaser.Scene {
  private orbitAngle = 0;
  private orbs: Phaser.GameObjects.Image[] = [];
  private hero!: Phaser.GameObjects.Image;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1210);

    for (let i = 0; i < 18; i++) {
      const p = this.add
        .circle(
          Phaser.Math.Between(20, width - 20),
          Phaser.Math.Between(20, height - 20),
          Phaser.Math.Between(2, 5),
          0x44ff88,
          Phaser.Math.FloatBetween(0.08, 0.22),
        )
        .setDepth(1);
      this.tweens.add({
        targets: p,
        y: p.y - Phaser.Math.Between(30, 80),
        alpha: 0,
        duration: Phaser.Math.Between(2200, 4000),
        delay: Phaser.Math.Between(0, 1500),
        repeat: -1,
        onRepeat: () => {
          p.setPosition(Phaser.Math.Between(20, width - 20), height + 10);
          p.setAlpha(Phaser.Math.FloatBetween(0.08, 0.22));
        },
      });
    }

    this.hero = this.add.image(width / 2, height * 0.32, 'player').setScale(2.4).setDepth(5);
    this.tweens.add({
      targets: this.hero,
      y: this.hero.y - 8,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.orbs = [];
    for (let i = 0; i < 3; i++) {
      this.orbs.push(this.add.image(this.hero.x, this.hero.y, 'orb').setScale(1.2).setDepth(6).setAlpha(0.85));
    }

    this.add
      .text(width / 2, height * 0.52, 'SURVIVAL DRAG', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#88ffcc',
        stroke: '#003322',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(width / 2, height * 0.58, 'Build Tanque  ·  Sobreviva · Suba de nível · Derrote o chefão', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#a8cfc0',
      })
      .setOrigin(0.5)
      .setDepth(10);

    const btnY = height * 0.7;
    const btn = this.add
      .rectangle(width / 2, btnY, 220, 56, 0x1a4030)
      .setStrokeStyle(2, 0x55ff99)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);

    const btnLabel = this.add
      .text(width / 2, btnY, 'JOGAR', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#88ffcc',
      })
      .setOrigin(0.5)
      .setDepth(11);

    const homeY = height * 0.8;
    const homeBtn = this.add
      .rectangle(width / 2, homeY, 220, 48, 0x121a16)
      .setStrokeStyle(2, 0x3a6a50)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);

    const homeLabel = this.add
      .text(width / 2, homeY, '← PORTAL', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#6a9a80',
      })
      .setOrigin(0.5)
      .setDepth(11);

    const start = () => {
      sfx.unlock();
      sfx.cardPick();
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.time.delayedCall(300, () => {
        this.scene.start('GameScene');
      });
    };

    const goHome = () => {
      sfx.unlock();
      window.location.href = '/';
    };

    btn.on('pointerover', () => {
      btn.setFillStyle(0x245a40);
      btnLabel.setColor('#ffffff');
    });
    btn.on('pointerout', () => {
      btn.setFillStyle(0x1a4030);
      btnLabel.setColor('#88ffcc');
    });
    btn.on('pointerdown', start);

    homeBtn.on('pointerover', () => {
      homeBtn.setFillStyle(0x1a2e24);
      homeLabel.setColor('#a8ffcc');
    });
    homeBtn.on('pointerout', () => {
      homeBtn.setFillStyle(0x121a16);
      homeLabel.setColor('#6a9a80');
    });
    homeBtn.on('pointerdown', goHome);

    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-SPACE', start);

    this.add
      .text(width / 2, height * 0.9, 'WASD / setas para mover  ·  poderes automáticos  ·  1–3 nas cartas', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#5a7a6a',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(width / 2, height * 0.95, 'ENTER ou ESPAÇO também inicia', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#3a5a4a',
      })
      .setOrigin(0.5)
      .setDepth(10);
  }

  update(_time: number, delta: number): void {
    this.orbitAngle += 2.2 * (delta / 1000);
    const r = 48;
    const step = (Math.PI * 2) / this.orbs.length;
    for (let i = 0; i < this.orbs.length; i++) {
      const a = this.orbitAngle + step * i;
      this.orbs[i].setPosition(this.hero.x + Math.cos(a) * r, this.hero.y + Math.sin(a) * r);
    }
  }
}
