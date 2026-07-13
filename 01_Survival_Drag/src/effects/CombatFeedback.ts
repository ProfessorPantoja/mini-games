import Phaser from 'phaser';
import type { EnemyTier } from '../data/enemies';

export class CombatFeedback {
  constructor(private scene: Phaser.Scene) {}

  showDamageNumber(x: number, y: number, amount: number, color = '#a8ffcc'): void {
    const text = this.scene.add
      .text(x, y - 14, `-${amount}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(40);

    this.scene.tweens.add({
      targets: text,
      y: y - 36,
      alpha: 0,
      duration: 480,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  hitPunch(target: Phaser.GameObjects.Image, hitColor: number): void {
    const base = target.getData('baseScale') as number ?? target.scaleX;
    target.setTint(hitColor);
    this.scene.tweens.add({
      targets: target,
      scaleX: base * 1.3,
      scaleY: base * 1.3,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (target.active) {
          target.setScale(base);
          target.clearTint();
        }
      },
    });
  }

  deathBurst(x: number, y: number, tier: EnemyTier, color: number): void {
    const counts = { weak: 5, medium: 8, tank: 14 };
    const spread = { weak: 28, medium: 40, tank: 58 };
    const count = counts[tier];

    for (let i = 0; i < count; i++) {
      const p = this.scene.add.image(x, y, 'particle').setTint(color).setDepth(25).setScale(tier === 'tank' ? 1.4 : 1);
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = Phaser.Math.Between(spread[tier] * 0.5, spread[tier]);
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        alpha: 0,
        scale: 0,
        duration: tier === 'weak' ? 220 : 340,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }

    if (tier !== 'weak') {
      const ring = this.scene.add.circle(x, y, 10, color, 0).setStrokeStyle(2, color, 0.85).setDepth(24);
      this.scene.tweens.add({
        targets: ring,
        scaleX: tier === 'tank' ? 4.5 : 3,
        scaleY: tier === 'tank' ? 4.5 : 3,
        alpha: 0,
        duration: 280,
        onComplete: () => ring.destroy(),
      });
    }
  }
}