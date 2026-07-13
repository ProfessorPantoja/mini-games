import Phaser from 'phaser';
import { FLOOR_COLOR, SPRITE_SCALE } from '../data/assets';
import { pickTankCards, type TankCard } from '../data/tankCards';

const WORLD_SIZE = 2400;
const PLAYER_SPEED = 140;
const INVULN_MS = 800;
const MAGNET_RANGE = 120;
const PICKUP_RANGE = 24;

type EnemyType = 'slime' | 'skeleton' | 'golem';

interface EnemyConfig {
  texture: string;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  scale: number;
}

const ENEMY_TYPES: Record<EnemyType, EnemyConfig> = {
  slime: { texture: 'enemySlime', hp: 1, speed: 55, damage: 5, xp: 1, scale: SPRITE_SCALE },
  skeleton: { texture: 'enemySkeleton', hp: 2, speed: 90, damage: 8, xp: 2, scale: SPRITE_SCALE },
  golem: { texture: 'enemyGolem', hp: 5, speed: 40, damage: 15, xp: 5, scale: SPRITE_SCALE },
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private xpGems!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private hp = 150;
  private maxHp = 150;
  private level = 1;
  private xp = 0;
  private xpToNext = 5;
  private elapsed = 0;
  private invulnUntil = 0;
  private isLevelUpOpen = false;

  private auraRadius = 70;
  private auraDamage = 1;
  private auraTickMs = 450;
  private auraTimer = 0;
  private vampirismHeal = 0;

  private auraGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private cardOverlay?: Phaser.GameObjects.Container;
  private spawnTimer = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

    this.add
      .rectangle(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE, FLOOR_COLOR)
      .setOrigin(0.5);

    this.player = this.physics.add
      .sprite(WORLD_SIZE / 2, WORLD_SIZE / 2, 'player')
      .setScale(SPRITE_SCALE)
      .setCollideWorldBounds(true);
    this.player.setCircle(10 * SPRITE_SCALE);

    this.enemies = this.physics.add.group();
    this.xpGems = this.physics.add.group();

    this.auraGfx = this.add.graphics().setDepth(5);

    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;

    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.xpGems, this.onCollectXp, undefined, this);

    this.hudText = this.add
      .text(12, 12, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.updateHud();
    this.drawAura();
  }

  update(_time: number, delta: number): void {
    if (this.physics.world.isPaused || this.isLevelUpOpen) return;

    this.elapsed += delta / 1000;
    this.spawnTimer += delta;
    this.auraTimer += delta;

    const spawnInterval = Math.max(400, 1800 - this.elapsed * 30);
    if (this.spawnTimer >= spawnInterval) {
      this.spawnEnemy();
      this.spawnTimer = 0;
    }

    if (this.auraTimer >= this.auraTickMs) {
      this.tickAuraDamage();
      this.auraTimer = 0;
    }

    this.movePlayer();
    this.chasePlayer();
    this.attractXpGems();
    this.drawAura();
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
      const norm = Math.SQRT1_2;
      vx *= norm;
      vy *= norm;
    }

    this.player.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);
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

  private attractXpGems(): void {
    this.xpGems.children.each((child) => {
      const gem = child as Phaser.Physics.Arcade.Sprite;
      if (!gem.active) return true;

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, gem.x, gem.y);
      if (dist < MAGNET_RANGE) {
        this.physics.moveToObject(gem, this.player, 220);
      } else {
        gem.setVelocity(0, 0);
      }
      return true;
    });
  }

  private drawAura(): void {
    this.auraGfx.clear();
    this.auraGfx.fillStyle(0x44ff66, 0.12);
    this.auraGfx.fillCircle(this.player.x, this.player.y, this.auraRadius);
    this.auraGfx.lineStyle(2, 0x66ff88, 0.35);
    this.auraGfx.strokeCircle(this.player.x, this.player.y, this.auraRadius);
  }

  private tickAuraDamage(): void {
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return true;

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist <= this.auraRadius) {
        this.damageEnemy(enemy, this.auraDamage);
      }
      return true;
    });
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, amount: number): void {
    if (!enemy.active) return;

    let hp = (enemy.getData('hp') as number) - amount;
    enemy.setData('hp', hp);
    enemy.setTint(0xaaffaa);
    this.time.delayedCall(80, () => enemy.clearTint());

    if (hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    const xpValue = enemy.getData('xp') as number;
    const x = enemy.x;
    const y = enemy.y;
    enemy.destroy();

    if (this.vampirismHeal > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.vampirismHeal);
    }

    const gem = this.xpGems.create(x, y, 'xpGem') as Phaser.Physics.Arcade.Sprite;
    gem.setScale(1.5);
    gem.setCircle(6);
    gem.setData('value', xpValue);
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

    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.levelUp();
    }
  }

  private levelUp(): void {
    this.level += 1;
    this.xpToNext = Math.floor(this.xpToNext * 1.4) + 2;
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
      .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x000000, 0.65)
      .setScrollFactor(0);
    this.cardOverlay.add(backdrop);

    const title = this.add
      .text(cam.width / 2, 70, `LEVEL UP!  Nível ${this.level}`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.cardOverlay.add(title);

    const subtitle = this.add
      .text(cam.width / 2, 105, 'Escolha 1 carta (build Tanque)', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#cccccc',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.cardOverlay.add(subtitle);

    const cardWidth = 200;
    const gap = 24;
    const totalWidth = cards.length * cardWidth + (cards.length - 1) * gap;
    const startX = cam.width / 2 - totalWidth / 2 + cardWidth / 2;

    cards.forEach((card, index) => {
      const x = startX + index * (cardWidth + gap);
      const y = cam.height / 2 + 20;
      const box = this.add
        .rectangle(x, y, cardWidth, 160, 0x1a3a2a, 1)
        .setStrokeStyle(2, 0x66ff88)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0);

      const name = this.add
        .text(x, y - 40, card.name, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: cardWidth - 20 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0);

      const desc = this.add
        .text(x, y + 10, card.description, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#aaffcc',
          align: 'center',
          wordWrap: { width: cardWidth - 20 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0);

      box.on('pointerdown', () => this.applyCard(card));

      this.cardOverlay!.add([box, name, desc]);
    });
  }

  private applyCard(card: TankCard): void {
    switch (card.id) {
      case 'shield':
        this.maxHp += 25;
        this.hp = Math.min(this.maxHp, this.hp + 10);
        break;
      case 'toxic':
        this.auraDamage = Math.max(1, Math.round(this.auraDamage * 1.4));
        this.auraRadius = Math.round(this.auraRadius * 1.2);
        break;
      case 'vampirism':
        this.vampirismHeal += 3;
        break;
    }

    this.cardOverlay?.destroy(true);
    this.cardOverlay = undefined;
    this.isLevelUpOpen = false;
    this.physics.resume();
    this.updateHud();
  }

  private spawnEnemy(): void {
    const roll = Math.random();
    let type: EnemyType = 'slime';
    if (this.elapsed > 20 && roll > 0.55) type = 'skeleton';
    if (this.elapsed > 45 && roll > 0.82) type = 'golem';

    const config = ENEMY_TYPES[type];
    const margin = 80;
    const side = Phaser.Math.Between(0, 3);
    let x = this.player.x;
    let y = this.player.y;

    switch (side) {
      case 0:
        x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(300, 500), margin, WORLD_SIZE - margin);
        y = this.player.y - Phaser.Math.Between(250, 400);
        break;
      case 1:
        x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(300, 500), margin, WORLD_SIZE - margin);
        y = this.player.y + Phaser.Math.Between(250, 400);
        break;
      case 2:
        x = this.player.x - Phaser.Math.Between(250, 400);
        y = Phaser.Math.Clamp(this.player.y + Phaser.Math.Between(300, 500), margin, WORLD_SIZE - margin);
        break;
      default:
        x = this.player.x + Phaser.Math.Between(250, 400);
        y = Phaser.Math.Clamp(this.player.y + Phaser.Math.Between(300, 500), margin, WORLD_SIZE - margin);
    }

    x = Phaser.Math.Clamp(x, margin, WORLD_SIZE - margin);
    y = Phaser.Math.Clamp(y, margin, WORLD_SIZE - margin);

    const enemy = this.enemies.create(x, y, config.texture) as Phaser.Physics.Arcade.Sprite;
    enemy.setScale(config.scale);
    enemy.setCircle(10 * config.scale);
    enemy.setData('hp', config.hp);
    enemy.setData('speed', config.speed);
    enemy.setData('damage', config.damage);
    enemy.setData('xp', config.xp);
    enemy.setData('type', type);
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

    const damage = enemy.getData('damage') as number;
    this.hp -= damage;
    this.invulnUntil = now + INVULN_MS;

    player.setTint(0xff6666);
    this.time.delayedCall(120, () => player.clearTint());

    if (this.hp <= 0) {
      this.hp = 0;
      this.physics.pause();
      this.hudText.setText('GAME OVER\nTempo: ' + Math.floor(this.elapsed) + 's\nR para reiniciar');
      this.input.keyboard?.once('keydown-R', () => this.scene.restart());
    }
  }

  private updateHud(): void {
    this.hudText.setText(
      [
        'TITÃ — Build Tanque (MVP)',
        `HP ${this.hp}/${this.maxHp}`,
        `LV ${this.level}  XP ${this.xp}/${this.xpToNext}`,
        `Aura ${this.auraDamage} dmg  ${Math.round(this.auraRadius)}px`,
        `Tempo ${Math.floor(this.elapsed)}s`,
        'WASD / Setas para mover',
      ].join('\n'),
    );
  }
}