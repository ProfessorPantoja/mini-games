import Phaser from 'phaser';
import {
  BOSS_UNLOCK_TIME_SEC,
  createWorldZones,
  ELITES_TO_UNLOCK_BOSS,
  type ObjectivePhase,
  type WorldZone,
  WORLD_SIZE,
} from '../data/worldMap';

const MINIMAP_SIZE = 130;
const MINIMAP_MARGIN = 14;

export class MapDirector {
  private zones: WorldZone[];
  private phase: ObjectivePhase = 'explore';
  private elitesCleared = 0;
  private bossSpawned = false;
  private bossUnlocked = false;
  private activeEliteZone: string | null = null;
  private ambushTimer = 0;
  private nextAmbushMs = 50000;
  private objectiveText?: Phaser.GameObjects.Text;
  private ambushBanner?: Phaser.GameObjects.Text;
  private lastObjectiveText = '';
  private minimapFrame = 0;

  private worldGfx: Phaser.GameObjects.Graphics;
  private minimapGfx: Phaser.GameObjects.Graphics;
  private arrowGfx: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.zones = createWorldZones();
    this.worldGfx = scene.add.graphics().setDepth(2);
    this.minimapGfx = scene.add.graphics().setScrollFactor(0).setDepth(105);
    this.arrowGfx = scene.add.graphics().setDepth(9);
    this.drawWorldStatic();

    this.objectiveText = scene.add
      .text(12, 128, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffdd88',
        backgroundColor: '#0a1210aa',
        padding: { x: 8, y: 5 },
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  getPhase(): ObjectivePhase {
    return this.phase;
  }

  isBossUnlocked(): boolean {
    return this.bossUnlocked;
  }

  isBossSpawned(): boolean {
    return this.bossSpawned;
  }

  setBossSpawned(): void {
    this.bossSpawned = true;
  }

  getBossZone(): WorldZone {
    return this.zones.find((z) => z.id === 'boss')!;
  }

  update(elapsedSec: number, player: Phaser.Physics.Arcade.Sprite, delta: number): {
    enteredElite: WorldZone | null;
    triggerAmbush: boolean;
    enteredBoss: boolean;
    eliteCleared: WorldZone | null;
  } {
    const result = {
      enteredElite: null as WorldZone | null,
      triggerAmbush: false,
      enteredBoss: false,
      eliteCleared: null as WorldZone | null,
    };

    if (!this.bossUnlocked) {
      const elitesDone = this.elitesCleared >= ELITES_TO_UNLOCK_BOSS;
      const timeDone = elapsedSec >= BOSS_UNLOCK_TIME_SEC;
      if (elitesDone || timeDone) {
        if (!this.bossUnlocked) {
          this.bossUnlocked = true;
          this.phase = 'boss';
          this.drawWorldStatic();
        }
      }
    }

    for (const zone of this.zones) {
      if (zone.type !== 'elite' || zone.cleared) continue;
      const dist = Phaser.Math.Distance.Between(player.x, player.y, zone.x, zone.y);
      if (dist <= zone.radius && this.activeEliteZone !== zone.id) {
        this.activeEliteZone = zone.id;
        result.enteredElite = zone;
      }
    }

    const bossZone = this.getBossZone();
    if (this.bossUnlocked && !this.bossSpawned) {
      const distBoss = Phaser.Math.Distance.Between(player.x, player.y, bossZone.x, bossZone.y);
      if (distBoss <= bossZone.radius) {
        result.enteredBoss = true;
      }
    }

    this.ambushTimer += delta;
    if (this.ambushTimer >= this.nextAmbushMs && this.phase !== 'victory') {
      this.ambushTimer = 0;
      this.nextAmbushMs = Phaser.Math.Between(38000, 65000);
      result.triggerAmbush = true;
      this.showAmbushBanner();
    }

    this.drawMinimap(player);
    this.drawObjectiveArrow(player);
    this.updateObjectiveText();

    return result;
  }

  markEliteCleared(zoneId: string): WorldZone | null {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone || zone.cleared) return null;
    zone.cleared = true;
    this.elitesCleared += 1;
    this.activeEliteZone = null;
    if (this.elitesCleared >= ELITES_TO_UNLOCK_BOSS) {
      this.bossUnlocked = true;
      this.phase = 'boss';
    }
    this.drawWorldStatic();
    return zone;
  }

  setVictory(): void {
    this.phase = 'victory';
    this.getBossZone().cleared = true;
    this.drawWorldStatic();
  }

  private getObjectivePoint(): { x: number; y: number; label: string } {
    if (this.phase === 'victory') {
      return { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, label: 'Vitória!' };
    }

    if (this.phase === 'boss' && this.bossUnlocked) {
      const boss = this.getBossZone();
      return { x: boss.x, y: boss.y, label: boss.label };
    }

    const nextElite = this.zones.find((z) => z.type === 'elite' && !z.cleared);
    if (nextElite) {
      return { x: nextElite.x, y: nextElite.y, label: nextElite.label };
    }

    const boss = this.getBossZone();
    return { x: boss.x, y: boss.y, label: boss.label };
  }

  private updateObjectiveText(): void {
    if (!this.objectiveText) return;

    let text = '';
    if (this.phase === 'victory') {
      text = 'OBJETIVO: Chefão derrotado — você venceu!';
    } else if (this.phase === 'boss' && this.bossUnlocked) {
      text = `OBJETIVO: Derrote o Chefão (${this.getBossZone().label})`;
    } else {
      const left = ELITES_TO_UNLOCK_BOSS - this.elitesCleared;
      const obj = this.getObjectivePoint();
      text = `OBJETIVO: Vá até ${obj.label}  ·  Elites restantes: ${left}  ·  Chefão em ${BOSS_UNLOCK_TIME_SEC}s`;
    }

    if (text !== this.lastObjectiveText) {
      this.lastObjectiveText = text;
      this.objectiveText.setText(text);
    }
  }

  private showAmbushBanner(): void {
    this.ambushBanner?.destroy();
    const cam = this.scene.cameras.main;
    this.ambushBanner = this.scene.add
      .text(cam.width / 2, 80, 'EMBOSCADA!', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ff5566',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(150)
      .setAlpha(0);

    this.scene.tweens.add({
      targets: this.ambushBanner,
      alpha: 1,
      y: 100,
      duration: 200,
      yoyo: true,
      hold: 600,
      onComplete: () => this.ambushBanner?.destroy(),
    });
  }

  private drawWorldStatic(): void {
    this.worldGfx.clear();

    for (const zone of this.zones) {
      if (zone.cleared && zone.type !== 'spawn') continue;
      const alpha = zone.type === 'boss' && !this.bossUnlocked ? 0.04 : 0.09;
      this.worldGfx.fillStyle(zone.color, alpha);
      this.worldGfx.fillCircle(zone.x, zone.y, zone.radius);

      if (zone.type === 'elite' && !zone.cleared) {
        this.worldGfx.lineStyle(2, 0xcc66ff, 0.35);
        this.worldGfx.strokeCircle(zone.x, zone.y, zone.radius);
      }

      if (zone.type === 'boss' && this.bossUnlocked && !zone.cleared) {
        this.worldGfx.lineStyle(3, 0xff8844, 0.5);
        this.worldGfx.strokeCircle(zone.x, zone.y, zone.radius);
      }
    }
  }

  private drawMinimap(player: Phaser.Physics.Arcade.Sprite): void {
    this.minimapFrame += 1;
    if (this.minimapFrame % 4 !== 0) return;
    const cam = this.scene.cameras.main;
    const mx = cam.width - MINIMAP_SIZE - MINIMAP_MARGIN;
    const my = cam.height - MINIMAP_SIZE - MINIMAP_MARGIN;
    const scale = MINIMAP_SIZE / WORLD_SIZE;

    this.minimapGfx.clear();
    this.minimapGfx.fillStyle(0x000000, 0.55);
    this.minimapGfx.fillRoundedRect(mx - 4, my - 4, MINIMAP_SIZE + 8, MINIMAP_SIZE + 8, 6);
    this.minimapGfx.lineStyle(1, 0x55ff99, 0.6);
    this.minimapGfx.strokeRoundedRect(mx - 4, my - 4, MINIMAP_SIZE + 8, MINIMAP_SIZE + 8, 6);

    for (const zone of this.zones) {
      if (zone.type === 'spawn') continue;
      if (zone.type === 'boss' && !this.bossUnlocked) continue;
      if (zone.cleared) continue;

      const zx = mx + zone.x * scale;
      const zy = my + zone.y * scale;
      const zr = Math.max(3, zone.radius * scale * 0.35);
      this.minimapGfx.fillStyle(zone.mapColor, zone.type === 'elite' ? 0.85 : 1);
      this.minimapGfx.fillCircle(zx, zy, zr);
    }

    const px = mx + player.x * scale;
    const py = my + player.y * scale;
    this.minimapGfx.fillStyle(0x3d8bfd, 1);
    this.minimapGfx.fillCircle(px, py, 4);

    const obj = this.getObjectivePoint();
    const ox = mx + obj.x * scale;
    const oy = my + obj.y * scale;
    this.minimapGfx.lineStyle(1, 0xffdd44, 0.9);
    this.minimapGfx.strokeCircle(ox, oy, 5);
  }

  private drawObjectiveArrow(player: Phaser.Physics.Arcade.Sprite): void {
    if (this.phase === 'victory') {
      this.arrowGfx.clear();
      return;
    }

    const obj = this.getObjectivePoint();
    const dist = Phaser.Math.Distance.Between(player.x, player.y, obj.x, obj.y);
    if (dist < 120) {
      this.arrowGfx.clear();
      return;
    }

    const angle = Phaser.Math.Angle.Between(player.x, player.y, obj.x, obj.y);
    const ax = player.x + Math.cos(angle) * 42;
    const ay = player.y + Math.sin(angle) * 42;

    this.arrowGfx.clear();
    this.arrowGfx.fillStyle(0xffdd44, 0.9);
    this.arrowGfx.fillTriangle(
      ax + Math.cos(angle) * 10,
      ay + Math.sin(angle) * 10,
      ax + Math.cos(angle + 2.4) * 8,
      ay + Math.sin(angle + 2.4) * 8,
      ax + Math.cos(angle - 2.4) * 8,
      ay + Math.sin(angle - 2.4) * 8,
    );
  }
}