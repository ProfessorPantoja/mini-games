import Phaser from 'phaser';
import { FLOOR_COLOR } from '../data/assets';
import { ENEMY_TYPES, type EnemyDefinition, type EnemyTier, type EnemyType } from '../data/enemies';
import { pickTankCards, type TankCard } from '../data/tankCards';
import { WORLD_SIZE, type WorldZone } from '../data/worldMap';
import { CombatFeedback } from '../effects/CombatFeedback';
import { MapDirector } from '../systems/MapDirector';

const PLAYER_SPEED = 200;
const INVULN_MS = 600;
const MAGNET_BASE = 100;
const PICKUP_RANGE = 20;
const CONTACT_RANGE = 28;
const ORBIT_RADIUS = 52;
const ORBIT_SPEED = 2.2;
const MAX_ENEMIES = 70;
const MAX_XP_GEMS = 50;
const HUD_EVERY_MS = 120;
const ORBIT_HIT_RANGE = 18;
const LEVEL_UP_DELAY_MS = 400;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private enemies!: Phaser.GameObjects.Group;
  private xpGems!: Phaser.GameObjects.Group;
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
  private isGameOver = false;
  private isVictory = false;
  private kills = 0;
  private pendingLevelUps = 0;
  private levelUpTimer?: Phaser.Time.TimerEvent;

  private knockbackX = 0;
  private knockbackY = 0;

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
  private enemyBarGfx!: Phaser.GameObjects.Graphics;
  private combatFx!: CombatFeedback;
  private hudText!: Phaser.GameObjects.Text;
  private cardOverlay?: Phaser.GameObjects.Container;
  private spawnTimer = 0;
  private trailTimer = 0;
  private mapDirector!: MapDirector;
  private clearedEliteZones = new Set<string>();
  private hudTimer = 0;
  private pulseHitSet = new Set<Phaser.GameObjects.GameObject>();
  private enemyList: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.add.rectangle(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE, FLOOR_COLOR).setOrigin(0.5);

    this.mapDirector = new MapDirector(this);
    this.enemies = this.add.group();
    this.xpGems = this.add.group();

    this.player = this.add
      .image(WORLD_SIZE / 2, WORLD_SIZE / 2, 'player')
      .setDepth(20);

    this.combatFx = new CombatFeedback(this);
    this.auraGfx = this.add.graphics().setDepth(8);
    this.enemyBarGfx = this.add.graphics().setDepth(16);
    this.hpBarGfx = this.add.graphics().setScrollFactor(0).setDepth(110);

    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;

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
    if (this.isGameOver || this.isVictory || this.isLevelUpOpen) return;

    const dt = delta / 1000;
    this.elapsed += dt;
    this.spawnTimer += delta;
    this.pulseTimer += delta;
    this.trailTimer += delta;

    this.refreshEnemyList();

    const enemyCount = this.enemyList.length;
    const spawnInterval = Math.max(350, 1500 - this.elapsed * 30);
    const burst = enemyCount < 40 && this.elapsed > 30 ? 2 : 1;
    if (this.spawnTimer >= spawnInterval && enemyCount < MAX_ENEMIES) {
      for (let i = 0; i < burst; i++) {
        if (this.countEnemies() >= MAX_ENEMIES) break;
        this.spawnEnemy();
      }
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
        this.pulseHitSet.clear();
      } else {
        this.applyPulseDamage();
      }
    }

    this.movePlayer(dt);
    this.chasePlayer(dt);
    this.updateOrbits(delta);
    this.attractXpGems(dt);
    this.checkPlayerContact();
    this.drawEffects();

    this.hudTimer += delta;
    if (this.hudTimer >= HUD_EVERY_MS) {
      this.hudTimer = 0;
      this.updateHud();
    }

    this.handleMapEvents(delta);
  }

  private countEnemies(): number {
    return this.enemyList.length;
  }

  private handleMapEvents(delta: number): void {
    const events = this.mapDirector.update(this.elapsed, this.player, delta);

    if (events.enteredElite && !this.clearedEliteZones.has(events.enteredElite.id)) {
      this.spawnEliteEncounter(events.enteredElite);
    }

    if (events.triggerAmbush) {
      this.spawnAmbush();
    }

    if (events.enteredBoss && !this.mapDirector.isBossSpawned()) {
      this.spawnBoss();
      this.mapDirector.setBossSpawned();
    }
  }

  private clampPosition(x: number, y: number): { x: number; y: number } {
    const margin = 24;
    return {
      x: Phaser.Math.Clamp(x, margin, WORLD_SIZE - margin),
      y: Phaser.Math.Clamp(y, margin, WORLD_SIZE - margin),
    };
  }

  private movePlayer(dt: number): void {
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;

    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    const speed = PLAYER_SPEED * this.speedMult;
    let nx = this.player.x + vx * speed * dt + this.knockbackX * dt;
    let ny = this.player.y + vy * speed * dt + this.knockbackY * dt;

    const clamped = this.clampPosition(nx, ny);
    this.player.setPosition(clamped.x, clamped.y);

    this.knockbackX = Phaser.Math.Linear(this.knockbackX, 0, 0.12);
    this.knockbackY = Phaser.Math.Linear(this.knockbackY, 0, 0.12);

    if ((vx !== 0 || vy !== 0) && this.trailTimer > 100) {
      this.trailTimer = 0;
      const trail = this.add.image(this.player.x, this.player.y, 'particle').setAlpha(0.25).setTint(0x66ccff).setDepth(5);
      this.tweens.add({ targets: trail, alpha: 0, scale: 1.4, duration: 160, onComplete: () => trail.destroy() });
    }
  }

  private refreshEnemyList(): void {
    this.enemyList.length = 0;
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.GameObjects.Image;
      if (enemy.active) this.enemyList.push(enemy);
      return true;
    });
  }

  private chasePlayer(dt: number): void {
    const cam = this.cameras.main;
    const pad = 120;
    const left = cam.scrollX - pad;
    const right = cam.scrollX + cam.width + pad;
    const top = cam.scrollY - pad;
    const bottom = cam.scrollY + cam.height + pad;
    const px = this.player.x;
    const py = this.player.y;
    const stopSq = (CONTACT_RANGE + 6) ** 2;

    for (const enemy of this.enemyList) {
      if (!enemy.active) continue;
      if (enemy.x < left || enemy.x > right || enemy.y < top || enemy.y > bottom) continue;

      const dx = px - enemy.x;
      const dy = py - enemy.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= stopSq) continue;

      const speed = enemy.getData('speed') as number;
      const dist = Math.sqrt(distSq) || 1;
      enemy.x += (dx / dist) * speed * dt;
      enemy.y += (dy / dist) * speed * dt;
    }
  }

  private updateOrbits(delta: number): void {
    this.orbitAngle += ORBIT_SPEED * (delta / 1000);
    const step = (Math.PI * 2) / this.orbitCount;
    const orbPositions: { x: number; y: number }[] = [];

    for (let index = 0; index < this.orbs.length; index++) {
      const angle = this.orbitAngle + step * index;
      const x = this.player.x + Math.cos(angle) * ORBIT_RADIUS;
      const y = this.player.y + Math.sin(angle) * ORBIT_RADIUS;
      this.orbs[index].setPosition(x, y);
      orbPositions.push({ x, y });
    }

    const now = this.time.now;
    for (const enemy of this.enemyList) {
      if (!enemy.active) continue;
      for (const orb of orbPositions) {
        const dx = orb.x - enemy.x;
        const dy = orb.y - enemy.y;
        if (dx * dx + dy * dy > ORBIT_HIT_RANGE * ORBIT_HIT_RANGE) continue;

        const last = this.orbitHitCooldown.get(enemy) ?? 0;
        if (now - last > 180) {
          this.orbitHitCooldown.set(enemy, now);
          this.damageEnemy(enemy, this.orbitDamage, true);
        }
        break;
      }
    }
  }

  private triggerPulse(): void {
    this.pulseActive = true;
    this.pulseRadius = 18;
    this.pulseHitSet.clear();
  }

  private applyPulseDamage(): void {
    for (const enemy of this.enemyList) {
      if (!enemy.active || this.pulseHitSet.has(enemy)) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (Math.abs(dist - this.pulseRadius) < 22) {
        this.pulseHitSet.add(enemy);
        this.damageEnemy(enemy, this.pulseDamage, false);
      }
    }
  }

  private attractXpGems(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;
    const rangeSq = this.magnetRange * this.magnetRange;
    const pickupSq = PICKUP_RANGE * PICKUP_RANGE;

    this.xpGems.children.each((child) => {
      const gem = child as Phaser.GameObjects.Image;
      if (!gem.active) return true;

      const dx = px - gem.x;
      const dy = py - gem.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= pickupSq) {
        this.collectGem(gem);
        return true;
      }

      if (distSq < rangeSq) {
        const dist = Math.sqrt(distSq) || 1;
        const speed = 220 + (this.magnetRange - dist);
        gem.x += (dx / dist) * speed * dt;
        gem.y += (dy / dist) * speed * dt;
      }
      return true;
    });
  }

  private collectGem(gem: Phaser.GameObjects.Image): void {
    this.addXp(gem.getData('value') as number);
    gem.destroy();
  }

  private addXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.xpToNext = Math.floor(this.xpToNext * 1.35) + 2;
      this.pendingLevelUps += 1;
    }
    this.scheduleLevelUp();
  }

  private scheduleLevelUp(): void {
    if (this.pendingLevelUps <= 0 || this.isLevelUpOpen || this.levelUpTimer) return;

    this.levelUpTimer = this.time.delayedCall(LEVEL_UP_DELAY_MS, () => {
      this.levelUpTimer = undefined;
      this.openNextLevelUp();
    });
  }

  private openNextLevelUp(): void {
    if (this.pendingLevelUps <= 0 || this.isLevelUpOpen || this.isGameOver || this.isVictory) return;

    this.pendingLevelUps -= 1;
    this.level += 1;
    this.openCardSelection();
  }

  private drawEffects(): void {
    this.auraGfx.clear();

    if (this.pulseActive) {
      this.auraGfx.lineStyle(3, 0x66ff99, 0.55 - this.pulseRadius / (this.pulseMaxRadius * 2));
      this.auraGfx.strokeCircle(this.player.x, this.player.y, this.pulseRadius);
    }

    this.auraGfx.fillStyle(0x44ff88, 0.06);
    this.auraGfx.fillCircle(this.player.x, this.player.y, ORBIT_RADIUS + 10);

    this.drawEnemyHpBars();

    const barW = 180;
    const barH = 10;
    const bx = 12;
    const by = 152;
    this.hpBarGfx.clear();
    this.hpBarGfx.fillStyle(0x000000, 0.5);
    this.hpBarGfx.fillRoundedRect(bx, by, barW, barH, 4);
    const pct = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    this.hpBarGfx.fillStyle(pct > 0.35 ? 0x44ff88 : 0xff5555, 0.95);
    this.hpBarGfx.fillRoundedRect(bx, by, barW * pct, barH, 4);
  }

  private drawEnemyHpBars(): void {
    this.enemyBarGfx.clear();

    for (const enemy of this.enemyList) {
      if (!enemy.active || !enemy.getData('showHpBar')) continue;

      const maxHp = enemy.getData('maxHp') as number;
      const hp = enemy.getData('hp') as number;
      const pct = Phaser.Math.Clamp(hp / maxHp, 0, 1);
      const w = 28 * enemy.scaleX;
      const h = 5;
      const x = enemy.x - w / 2;
      const y = enemy.y - 20 * enemy.scaleY;

      this.enemyBarGfx.fillStyle(0x000000, 0.65);
      this.enemyBarGfx.fillRoundedRect(x, y, w, h, 2);

      const barColor = pct > 0.5 ? 0xff5555 : pct > 0.25 ? 0xff8844 : 0xff2222;
      this.enemyBarGfx.fillStyle(barColor, 0.95);
      this.enemyBarGfx.fillRoundedRect(x, y, w * pct, h, 2);
    }
  }

  private damageEnemy(enemy: Phaser.GameObjects.Image, amount: number, knockback: boolean): void {
    if (!enemy.active) return;

    const hp = (enemy.getData('hp') as number) - amount;
    enemy.setData('hp', hp);

    const hitColor = enemy.getData('hitColor') as number;
    const dmgColor = enemy.getData('tier') === 'tank' ? '#ffcc88' : '#a8ffcc';
    this.combatFx.showDamageNumber(enemy.x, enemy.y, amount, dmgColor);
    this.combatFx.hitPunch(enemy, hitColor);

    if (knockback) {
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      const push = enemy.getData('tier') === 'tank' ? 4 : 9;
      enemy.x += Math.cos(angle) * push;
      enemy.y += Math.sin(angle) * push;
    }

    if (hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Phaser.GameObjects.Image): void {
    const xpValue = enemy.getData('xp') as number;
    const role = enemy.getData('role') as string | undefined;
    const zoneId = enemy.getData('zoneId') as string | undefined;
    const tier = enemy.getData('tier') as EnemyTier;
    const deathColor = enemy.getData('deathColor') as number;
    const x = enemy.x;
    const y = enemy.y;
    enemy.destroy();
    this.combatFx.deathBurst(x, y, tier, deathColor);
    this.orbitHitCooldown.delete(enemy);
    this.kills += 1;

    if (role === 'elite' && zoneId) {
      const zone = this.mapDirector.markEliteCleared(zoneId);
      if (zone) {
        this.clearedEliteZones.add(zoneId);
        this.spawnBonusGems(x, y, 8);
        this.showBanner(`ELITE DERROTADO — ${zone.label}`, 0xcc66ff);
      }
    }

    if (role === 'boss') {
      this.isVictory = true;
      this.mapDirector.setVictory();
      this.spawnBonusGems(x, y, 20);
      this.showBanner('CHEFÃO DERROTADO — VITÓRIA!', 0xff8844);
      this.time.delayedCall(1800, () => {
        this.hudText.setText(['VITÓRIA!', `Tempo ${Math.floor(this.elapsed)}s`, `Kills ${this.kills}`, 'R para jogar de novo'].join('\n'));
        this.input.keyboard?.once('keydown-R', () => this.scene.restart());
      });
    }

    if (this.vampirismHeal > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.vampirismHeal);
    }

    if (this.xpGems.getLength() < MAX_XP_GEMS) {
      const gem = this.add.image(x, y, 'xpGem');
      gem.setDepth(14);
      gem.setData('value', xpValue);
      this.xpGems.add(gem);
    }
  }

  private openCardSelection(): void {
    this.isLevelUpOpen = true;

    const cards = pickTankCards(3);
    const cam = this.cameras.main;

    this.cardOverlay = this.add.container(0, 0).setScrollFactor(0).setDepth(200);

    const backdrop = this.add
      .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x000000, 0.72)
      .setScrollFactor(0)
      .setInteractive();
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
    this.updateHud();
    this.scheduleLevelUp();
  }

  private rebuildOrbits(): void {
    this.orbs.forEach((o) => o.destroy());
    this.orbs = [];
    for (let i = 0; i < this.orbitCount; i++) {
      const orb = this.add.image(this.player.x, this.player.y, 'orb').setDepth(18);
      this.orbs.push(orb);
    }
  }

  private showBanner(text: string, color: number): void {
    const cam = this.cameras.main;
    const banner = this.add
      .text(cam.width / 2, 90, text, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: `#${color.toString(16).padStart(6, '0')}cc`,
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(160);

    this.tweens.add({ targets: banner, alpha: 0, y: 70, duration: 1200, onComplete: () => banner.destroy() });
  }

  private spawnBonusGems(x: number, y: number, count: number): void {
    const slots = MAX_XP_GEMS - this.xpGems.getLength();
    const spawnCount = Math.min(count, slots);
    for (let i = 0; i < spawnCount; i++) {
      const gem = this.add.image(
        x + Phaser.Math.Between(-40, 40),
        y + Phaser.Math.Between(-40, 40),
        'xpGem',
      );
      gem.setDepth(14);
      gem.setData('value', 3);
      this.xpGems.add(gem);
    }
  }

  private spawnEliteEncounter(zone: WorldZone): void {
    this.showBanner(`ELITE — ${zone.label}`, 0xaa44ff);

    this.spawnEnemyAt(zone.x, zone.y, 'golem', {
      texture: 'elite',
      hp: 22,
      speed: 62,
      damage: 14,
      xp: 12,
      scale: 2.4,
      tier: 'tank',
      showHpBar: true,
      hitColor: 0xeebbff,
      deathColor: 0xaa44ff,
      label: 'Elite',
      role: 'elite',
      zoneId: zone.id,
    });

    for (let i = 0; i < 7; i++) {
      const angle = (Math.PI * 2 * i) / 7;
      this.spawnEnemyAt(zone.x + Math.cos(angle) * 90, zone.y + Math.sin(angle) * 90, i % 2 === 0 ? 'skeleton' : 'slime');
    }
  }

  private spawnAmbush(): void {
    if (this.countEnemies() >= MAX_ENEMIES - 8) return;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const x = this.player.x + Math.cos(angle) * Phaser.Math.Between(160, 220);
      const y = this.player.y + Math.sin(angle) * Phaser.Math.Between(160, 220);
      this.spawnEnemyAt(x, y, Math.random() > 0.4 ? 'skeleton' : 'slime');
    }
  }

  private spawnBoss(): void {
    const zone = this.mapDirector.getBossZone();
    this.showBanner('CHEFÃO APARECEU!', 0xff6622);
    this.spawnEnemyAt(zone.x, zone.y, 'golem', {
      texture: 'boss',
      hp: 90,
      speed: 38,
      damage: 18,
      xp: 30,
      scale: 3.4,
      tier: 'tank',
      showHpBar: true,
      hitColor: 0xffddaa,
      deathColor: 0xff6622,
      label: 'Chefão',
      role: 'boss',
    });
  }

  private spawnEnemyAt(
    x: number,
    y: number,
    type: EnemyType,
    overrides?: Partial<EnemyDefinition> & { texture?: string; role?: string; zoneId?: string },
  ): Phaser.GameObjects.Image {
    const base = ENEMY_TYPES[type];
    const config = { ...base, ...overrides };
    const enemy = this.add.image(x, y, config.texture ?? base.texture);
    enemy.setScale(config.scale);
    enemy.setDepth(12);
    enemy.setData('baseScale', config.scale);
    enemy.setData('hp', config.hp);
    enemy.setData('maxHp', config.hp);
    enemy.setData('speed', config.speed);
    enemy.setData('damage', config.damage);
    enemy.setData('xp', config.xp);
    enemy.setData('type', type);
    enemy.setData('tier', config.tier);
    enemy.setData('label', config.label);
    enemy.setData('hitColor', config.hitColor);
    enemy.setData('deathColor', config.deathColor);
    enemy.setData('showHpBar', config.showHpBar);
    if (overrides?.role) enemy.setData('role', overrides.role);
    if (overrides?.zoneId) enemy.setData('zoneId', overrides.zoneId);
    this.enemies.add(enemy);
    return enemy;
  }

  private spawnEnemy(): void {
    const roll = Math.random();
    let type: EnemyType = 'slime';
    if (this.elapsed > 18 && roll > 0.5) type = 'skeleton';
    if (this.elapsed > 40 && roll > 0.78) type = 'golem';

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

    const clamped = this.clampPosition(x, y);
    this.spawnEnemyAt(clamped.x, clamped.y, type);
  }

  private checkPlayerContact(): void {
    const now = this.time.now;
    if (now < this.invulnUntil) return;

    const px = this.player.x;
    const py = this.player.y;
    const rangeSq = CONTACT_RANGE * CONTACT_RANGE;

    for (const enemy of this.enemyList) {
      if (!enemy.active) continue;

      const dx = px - enemy.x;
      const dy = py - enemy.y;
      if (dx * dx + dy * dy > rangeSq) continue;

      this.invulnUntil = now + INVULN_MS;
      this.hp -= enemy.getData('damage') as number;

      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.knockbackX = (dx / dist) * 320;
      this.knockbackY = (dy / dist) * 320;
      this.player.setTint(0xff8888);
      this.time.delayedCall(100, () => {
        if (this.player.active) this.player.clearTint();
      });

      if (this.hp <= 0) {
        this.hp = 0;
        this.isGameOver = true;
        this.hudText.setText(
          ['GAME OVER', `Sobreviveu ${Math.floor(this.elapsed)}s`, `Kills ${this.kills}  LV ${this.level}`, 'R para reiniciar'].join('\n'),
        );
        this.input.keyboard?.once('keydown-R', () => this.scene.restart());
      }
      return;
    }
  }

  private updateHud(): void {
    const phase = this.mapDirector.getPhase();
    const phaseLabel = phase === 'boss' ? 'Fase: Chefão' : phase === 'victory' ? 'Fase: Vitória' : 'Fase: Explorar';

    this.hudText.setText(
      [
        'SURVIVAL DRAG — Build Tanque',
        `HP ${Math.ceil(this.hp)}/${this.maxHp}   LV ${this.level}`,
        `XP ${this.xp}/${this.xpToNext}   Kills ${this.kills}`,
        `Órbitas ${this.orbitCount} (${this.orbitDamage} dmg)  Pulso ${this.pulseDamage}`,
        `${phaseLabel}   Tempo ${Math.floor(this.elapsed)}s`,
      ].join('\n'),
    );
  }
}