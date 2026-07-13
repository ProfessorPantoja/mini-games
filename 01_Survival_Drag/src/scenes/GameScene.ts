import Phaser from 'phaser';
import { FLOOR_COLOR } from '../data/assets';
import { pickTankCards, type TankCard } from '../data/tankCards';

const WORLD_SIZE = 3200;
const PLAYER_SPEED = 200;
const INVULN_MS = 600;
const MAGNET_BASE = 100;
const PICKUP_RANGE = 20;
const CONTACT_RANGE = 28;
const ORBIT_RADIUS = 52;
const ORBIT_SPEED = 2.2;

type EnemyType = 'slime' | 'skeleton' | 'golem';

interface EnemyConfig {
  texture: string;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  scale: number;
  tint?: number;
}

const ENEMY_TYPES: Record<EnemyType, EnemyConfig> = {
  slime: { texture: 'enemySlime', hp: 1, speed: 75, damage: 4, xp: 1, scale: 1.1 },
  skeleton: { texture: 'enemySkeleton', hp: 2, speed: 115, damage: 7, xp: 2, scale: 1.2 },
  golem: { texture: 'enemyGolem', hp: 6, speed: 48, damage: 12, xp: 5, scale: 1.6 },
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private xpGems!: Phaser.Physics.Arcade.Group;
  private orbs: Phaser.GameObjects.Image[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private hp = 120;
  private maxHp = 120;
  private level = 1;
  private xp = 0;
  private xpToNext = 4;
  private elapsed = 0;
  private invulnUntil = 0;
  private isLevelUpOpen = false;
  private kills = 0;

  private orbitCount = 2;
  private orbitAngle = 0;
  private orbitDamage = 1;
  private orbitHitCooldown = new Map<Phaser.GameObjects.GameObject, number>();

  private pulseRadius = 0;
  private pulseMaxRadius = 95;
  private pulseDamage = 2;
  private pulseIntervalMs = 1100;
  private pulseTimer = 0;
  private pulseActive = false;

  private magnetRange = MAGNET_BASE;
  private vampirismHeal = 0;
  private speedMult = 1;

  private auraGfx!: Phaser.GameObjects.Graphics;
  private hpBarGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private cardOverlay?: Phaser.GameObjects.Container;
  private spawnTimer = 0;
  private trailTimer = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

    this.add.rectangle(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE, FLOOR_COLOR).setOrigin(0.5);

    this.player = this.physics.add
      .sprite(WORLD_SIZE / 2, WORLD_SIZE / 2, 'player')
      .setDepth(20)
      .setCollideWorldBounds(true);
    this.player.setCircle(12);

    this.enemies = this.physics.add.group();
    this.xpGems = this.physics.add.group();

    this.auraGfx = this.add.graphics().setDepth(8);
    this.hpBarGfx = this.add.graphics().setScrollFactor(0).setDepth(110);

    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;

    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, this.mustBeTouching, this);
    this.physics.add.overlap(this.player, this.xpGems, this.onCollectXp, undefined, this);

    this.hudText = this.add
      .text(12, 12, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#e8fff0',
        backgroundColor: '#0a1210cc',
        padding: { x: 10, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.rebuildOrbits();
    this.updateHud();
  }

  update(_time: number, delta: number): void {
    if (this.physics.world.isPaused || this.isLevelUpOpen) return;

    const dt = delta / 1000;
    this.elapsed += dt;
    this.spawnTimer += delta;
    this.pulseTimer += delta;
    this.trailTimer += delta;

    const spawnInterval = Math.max(280, 1400 - this.elapsed * 35);
    const burst = this.elapsed > 30 ? Phaser.Math.Between(1, 3) : 1;
    if (this.spawnTimer >= spawnInterval) {
      for (let i = 0; i < burst; i++) this.spawnEnemy();
      this.spawnTimer = 0;
    }

    if (this.pulseTimer >= this.pulseIntervalMs) {
      this.triggerPulse();
      this.pulseTimer = 0;
    }

    if (this.pulseActive) {
      this.pulseRadius += 280 * dt;
      if (this.pulseRadius >= this.pulseMaxRadius) {
        this.pulseActive = false;
        this.pulseRadius = 0;
      } else {
        this.applyPulseDamage();
      }
    }

    this.movePlayer();
    this.chasePlayer();
    this.updateOrbits(delta);
    this.attractXpGems();
    this.drawEffects();
    this.updateHud();
  }

  private movePlayer(): void {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    let vx = 0;
    let vy = 0;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    const speed = PLAYER_SPEED * this.speedMult;
    this.player.setVelocity(vx * speed, vy * speed);

    if ((vx !== 0 || vy !== 0) && this.trailTimer > 40) {
      this.trailTimer = 0;
      const trail = this.add.image(this.player.x, this.player.y, 'particle').setAlpha(0.35).setTint(0x66ccff).setDepth(5);
      this.tweens.add({ targets: trail, alpha: 0, scale: 2, duration: 220, onComplete: () => trail.destroy() });
    }
  }

  private chasePlayer(): void {
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return true;
      const speed = enemy.getData('speed') as number;
      this.physics.moveToObject(enemy, this.player, speed);
      return true;
    });
  }

  private updateOrbits(delta: number): void {
    this.orbitAngle += ORBIT_SPEED * (delta / 1000);
    const step = (Math.PI * 2) / this.orbitCount;

    this.orbs.forEach((orb, index) => {
      const angle = this.orbitAngle + step * index;
      const x = this.player.x + Math.cos(angle) * ORBIT_RADIUS;
      const y = this.player.y + Math.sin(angle) * ORBIT_RADIUS;
      orb.setPosition(x, y);

      this.enemies.children.each((child) => {
        const enemy = child as Phaser.Physics.Arcade.Sprite;
        if (!enemy.active) return true;

        const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
        if (dist <= 18) {
          const last = this.orbitHitCooldown.get(enemy) ?? 0;
          if (this.time.now - last > 180) {
            this.orbitHitCooldown.set(enemy, this.time.now);
            this.damageEnemy(enemy, this.orbitDamage, true);
          }
        }
        return true;
      });
    });
  }

  private triggerPulse(): void {
    this.pulseActive = true;
    this.pulseRadius = 18;
    this.cameras.main.shake(80, 0.004);
  }

  private applyPulseDamage(): void {
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return true;

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (Math.abs(dist - this.pulseRadius) < 22) {
        this.damageEnemy(enemy, this.pulseDamage, false);
      }
      return true;
    });
  }

  private attractXpGems(): void {
    this.xpGems.children.each((child) => {
      const gem = child as Phaser.Physics.Arcade.Sprite;
      if (!gem.active) return true;

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, gem.x, gem.y);
      if (dist < this.magnetRange) {
        this.physics.moveToObject(gem, this.player, 280 + (this.magnetRange - dist));
      } else {
        gem.setVelocity(0, 0);
      }
      return true;
    });
  }

  private drawEffects(): void {
    this.auraGfx.clear();

    if (this.pulseActive) {
      this.auraGfx.lineStyle(3, 0x66ff99, 0.55 - this.pulseRadius / (this.pulseMaxRadius * 2));
      this.auraGfx.strokeCircle(this.player.x, this.player.y, this.pulseRadius);
    }

    this.auraGfx.fillStyle(0x44ff88, 0.06);
    this.auraGfx.fillCircle(this.player.x, this.player.y, ORBIT_RADIUS + 10);

    const barW = 180;
    const barH = 10;
    const bx = 12;
    const by = 108;
    this.hpBarGfx.clear();
    this.hpBarGfx.fillStyle(0x000000, 0.5);
    this.hpBarGfx.fillRoundedRect(bx, by, barW, barH, 4);
    const pct = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    this.hpBarGfx.fillStyle(pct > 0.35 ? 0x44ff88 : 0xff5555, 0.95);
    this.hpBarGfx.fillRoundedRect(bx, by, barW * pct, barH, 4);
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, amount: number, knockback: boolean): void {
    if (!enemy.active) return;

    let hp = (enemy.getData('hp') as number) - amount;
    enemy.setData('hp', hp);
    enemy.setTint(0xffffff);
    this.time.delayedCall(60, () => enemy.clearTint());

    if (knockback) {
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      enemy.setVelocity(Math.cos(angle) * 160, Math.sin(angle) * 160);
      this.time.delayedCall(120, () => enemy.setVelocity(0, 0));
    }

    const spark = this.add.image(enemy.x, enemy.y, 'particle').setTint(0xaaffcc).setDepth(30);
    this.tweens.add({ targets: spark, alpha: 0, scale: 3, duration: 150, onComplete: () => spark.destroy() });

    if (hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    const xpValue = enemy.getData('xp') as number;
    const x = enemy.x;
    const y = enemy.y;
    enemy.destroy();
    this.orbitHitCooldown.delete(enemy);
    this.kills += 1;

    if (this.vampirismHeal > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.vampirismHeal);
    }

    for (let i = 0; i < 6; i++) {
      const p = this.add.image(x, y, 'particle').setTint(0x66ffaa).setDepth(15);
      const a = Math.random() * Math.PI * 2;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * Phaser.Math.Between(20, 50),
        y: y + Math.sin(a) * Phaser.Math.Between(20, 50),
        alpha: 0,
        duration: 260,
        onComplete: () => p.destroy(),
      });
    }

    const gem = this.xpGems.create(x, y, 'xpGem') as Phaser.Physics.Arcade.Sprite;
    gem.setCircle(6);
    gem.setData('value', xpValue);
    this.tweens.add({ targets: gem, scale: { from: 0.5, to: 1.2 }, duration: 180, yoyo: true });
  }

  private onCollectXp(
    _playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
    gemObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
  ): void {
    const gem = gemObj as Phaser.Physics.Arcade.Sprite;
    if (!gem.active) return;

    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, gem.x, gem.y);
    if (dist > PICKUP_RANGE) return;

    this.xp += gem.getData('value') as number;
    gem.destroy();

    const pop = this.add.image(this.player.x, this.player.y - 20, 'particle').setTint(0x88ffcc).setScrollFactor(0).setDepth(120);
    this.tweens.add({ targets: pop, y: pop.y - 18, alpha: 0, duration: 300, onComplete: () => pop.destroy() });

    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.levelUp();
    }
  }

  private levelUp(): void {
    this.level += 1;
    this.xpToNext = Math.floor(this.xpToNext * 1.35) + 2;
    this.openCardSelection();
  }

  private openCardSelection(): void {
    this.isLevelUpOpen = true;
    this.physics.pause();
    this.player.setVelocity(0, 0);

    const cards = pickTankCards(3);
    const cam = this.cameras.main;

    this.cardOverlay = this.add.container(0, 0).setScrollFactor(0).setDepth(200);

    const backdrop = this.add
      .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x000000, 0.72)
      .setScrollFactor(0);
    this.cardOverlay.add(backdrop);

    const title = this.add
      .text(cam.width / 2, 64, `LEVEL UP  ·  ${this.level}`, {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#88ffcc',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.cardOverlay.add(title);

    const cardWidth = 210;
    const gap = 20;
    const totalWidth = cards.length * cardWidth + (cards.length - 1) * gap;
    const startX = cam.width / 2 - totalWidth / 2 + cardWidth / 2;

    cards.forEach((card, index) => {
      const x = startX + index * (cardWidth + gap);
      const y = cam.height / 2 + 10;
      const box = this.add
        .rectangle(x, y, cardWidth, 170, 0x142820, 1)
        .setStrokeStyle(2, 0x55ff99)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0);

      const keyHint = this.add
        .text(x, y - 58, `[ ${index + 1} ]`, { fontFamily: 'monospace', fontSize: '14px', color: '#55ff99' })
        .setOrigin(0.5)
        .setScrollFactor(0);

      const name = this.add
        .text(x, y - 28, card.name, { fontFamily: 'monospace', fontSize: '17px', color: '#ffffff', align: 'center', wordWrap: { width: cardWidth - 16 } })
        .setOrigin(0.5)
        .setScrollFactor(0);

      const desc = this.add
        .text(x, y + 18, card.description, { fontFamily: 'monospace', fontSize: '12px', color: '#a8ffcc', align: 'center', wordWrap: { width: cardWidth - 16 } })
        .setOrigin(0.5)
        .setScrollFactor(0);

      const pick = () => this.applyCard(card);
      box.on('pointerdown', pick);
      this.input.keyboard?.once(`keydown-${index + 1}`, pick);

      this.cardOverlay!.add([box, keyHint, name, desc]);
    });
  }

  private applyCard(card: TankCard): void {
    switch (card.id) {
      case 'shield':
        this.maxHp += 30;
        this.hp = Math.min(this.maxHp, this.hp + 20);
        this.orbitCount = Math.min(6, this.orbitCount + 1);
        this.rebuildOrbits();
        break;
      case 'toxic':
        this.pulseDamage = Math.round(this.pulseDamage * 1.5);
        this.pulseMaxRadius = Math.round(this.pulseMaxRadius * 1.25);
        this.pulseIntervalMs = Math.max(700, this.pulseIntervalMs - 120);
        break;
      case 'vampirism':
        this.vampirismHeal += 4;
        this.speedMult += 0.15;
        break;
      case 'magnet':
        this.magnetRange = Math.round(this.magnetRange * 1.6);
        this.orbitDamage += 1;
        break;
    }

    this.cardOverlay?.destroy(true);
    this.cardOverlay = undefined;
    this.isLevelUpOpen = false;
    this.physics.resume();
    this.cameras.main.flash(200, 80, 255, 160, false);
    this.updateHud();
  }

  private rebuildOrbits(): void {
    this.orbs.forEach((o) => o.destroy());
    this.orbs = [];
    for (let i = 0; i < this.orbitCount; i++) {
      const orb = this.add.image(this.player.x, this.player.y, 'orb').setDepth(18);
      this.orbs.push(orb);
    }
  }

  private spawnEnemy(): void {
    const roll = Math.random();
    let type: EnemyType = 'slime';
    if (this.elapsed > 18 && roll > 0.5) type = 'skeleton';
    if (this.elapsed > 40 && roll > 0.78) type = 'golem';

    const config = ENEMY_TYPES[type];
    const cam = this.cameras.main;
    const margin = 40;
    const left = cam.scrollX - margin;
    const right = cam.scrollX + cam.width + margin;
    const top = cam.scrollY - margin;
    const bottom = cam.scrollY + cam.height + margin;
    const side = Phaser.Math.Between(0, 3);

    let x = this.player.x;
    let y = this.player.y;
    switch (side) {
      case 0:
        x = Phaser.Math.Between(left, right);
        y = top;
        break;
      case 1:
        x = Phaser.Math.Between(left, right);
        y = bottom;
        break;
      case 2:
        x = left;
        y = Phaser.Math.Between(top, bottom);
        break;
      default:
        x = right;
        y = Phaser.Math.Between(top, bottom);
    }

    x = Phaser.Math.Clamp(x, 40, WORLD_SIZE - 40);
    y = Phaser.Math.Clamp(y, 40, WORLD_SIZE - 40);

    const enemy = this.enemies.create(x, y, config.texture) as Phaser.Physics.Arcade.Sprite;
    enemy.setScale(config.scale);
    enemy.setCircle(10 * config.scale);
    enemy.setDepth(12);
    enemy.setData('hp', config.hp);
    enemy.setData('speed', config.speed);
    enemy.setData('damage', config.damage);
    enemy.setData('xp', config.xp);
    enemy.setData('type', type);

    enemy.setAlpha(0);
    this.tweens.add({ targets: enemy, alpha: 1, duration: 180 });
  }

  private mustBeTouching(
    playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
  ): boolean {
    const player = playerObj as Phaser.Physics.Arcade.Sprite;
    const enemy = enemyObj as Phaser.Physics.Arcade.Sprite;
    return Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y) <= CONTACT_RANGE;
  }

  private onPlayerHitEnemy(
    playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
  ): void {
    const player = playerObj as Phaser.Physics.Arcade.Sprite;
    const enemy = enemyObj as Phaser.Physics.Arcade.Sprite;
    if (!enemy.active) return;

    const now = this.time.now;
    if (now < this.invulnUntil) return;

    this.hp -= enemy.getData('damage') as number;
    this.invulnUntil = now + INVULN_MS;

    player.setTint(0xff8888);
    this.time.delayedCall(100, () => player.clearTint());
    this.cameras.main.shake(120, 0.012);

    if (this.hp <= 0) {
      this.hp = 0;
      this.physics.pause();
      this.hudText.setText(
        ['GAME OVER', `Sobreviveu ${Math.floor(this.elapsed)}s`, `Kills ${this.kills}  LV ${this.level}`, 'R para reiniciar'].join('\n'),
      );
      this.input.keyboard?.once('keydown-R', () => this.scene.restart());
    }
  }

  private updateHud(): void {
    this.hudText.setText(
      [
        'SURVIVAL DRAG — Build Tanque',
        `HP ${Math.ceil(this.hp)}/${this.maxHp}   LV ${this.level}`,
        `XP ${this.xp}/${this.xpToNext}   Kills ${this.kills}`,
        `Órbitas ${this.orbitCount} (${this.orbitDamage} dmg)  Pulso ${this.pulseDamage}`,
        `Tempo ${Math.floor(this.elapsed)}s`,
      ].join('\n'),
    );
  }
}