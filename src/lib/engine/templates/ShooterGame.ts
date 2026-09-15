import { drawBullet, drawEnemy, drawPlayer, drawPowerUp, drawBoss } from "../AssetGenerator";
import { GameEngine } from "../GameEngine";
import { RULES, enemiesForWave, enemyReward, progression, rectsOverlap, speedFor } from "../GameRulesEngine";
import { Scene } from "../Scene";
import type { Entity, GameConfig, EnemyType } from "../types";

const WEAPON_STATS: Record<GameConfig["weapon"], { cooldown: number; bulletSpeed: number; damage: number; spread?: number }> = {
  blaster: { cooldown: 0.25, bulletSpeed: 400, damage: 1 },
  pistol: { cooldown: 0.4, bulletSpeed: 350, damage: 2 },
  shotgun: { cooldown: 0.6, bulletSpeed: 300, damage: 1, spread: 3 },
  rifle: { cooldown: 0.15, bulletSpeed: 450, damage: 0.8 },
};

const ENEMY_STATS: Record<EnemyType, { hp: number; speedMult: number; sizeMult: number; scoreMult: number }> = {
  robot: { hp: 1, speedMult: 1, sizeMult: 1, scoreMult: 1 },
  alien: { hp: 1, speedMult: 1.2, sizeMult: 0.9, scoreMult: 1.2 },
  drone: { hp: 0.5, speedMult: 1.5, sizeMult: 0.7, scoreMult: 0.8 },
  monster: { hp: 2, speedMult: 0.7, sizeMult: 1.3, scoreMult: 1.8 },
};

type EnemyBehavior = NonNullable<GameConfig["gameIntent"]>["enemies"][number]["behavior"];

function behaviorFor(config: GameConfig, enemyKind: EnemyType): EnemyBehavior {
  return config.gameIntent?.enemies.find((enemy) => enemy.type === enemyKind)?.behavior ?? "chase";
}

function intentStatsFor(config: GameConfig, enemyKind: EnemyType) {
  return config.gameIntent?.enemies.find((enemy) => enemy.type === enemyKind);
}

/** Encounter formation patterns per wave. */
function formationForWave(
  config: GameConfig,
  wave: number,
  count: number,
  width: number,
): { x: number; y: number; vx: number; vy: number }[] {
  const positions: { x: number; y: number; vx: number; vy: number }[] = [];
  const style = config.encounterStyle;
  const pattern = config.spawnPattern;
  const ramp = progression(config, 1, 0) * config.aggression;

  if (pattern === "stream") {
    for (let i = 0; i < count; i++) positions.push({ x: 20 + Math.random() * Math.max(1, width - 60), y: -30 - i * 50, vx: (30 + Math.random() * 30) * (Math.random() > 0.5 ? 1 : -1) * ramp, vy: (60 + Math.random() * 40) * ramp });
  } else if (pattern === "spread") {
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      positions.push({ x: fromLeft ? -30 : width + 10, y: 30 + (i / count) * 200, vx: (fromLeft ? 1 : -1) * (50 + Math.random() * 40) * ramp, vy: (20 + Math.random() * 30) * ramp });
    }
  } else if (pattern === "cluster") {
    const clusters = Math.max(1, Math.ceil(count / 4));
    for (let i = 0; i < count; i++) {
      const clusterIdx = Math.floor(i / 4);
      const within = i % 4;
      const cx = (width / (clusters + 1)) * (clusterIdx + 1);
      positions.push({ x: cx + (within % 2) * 40 - 20, y: 30 + Math.floor(within / 2) * 40 + clusterIdx * 20, vx: (20 + Math.random() * 30) * (Math.random() > 0.5 ? 1 : -1) * ramp, vy: (15 + Math.random() * 20) * ramp });
    }
  } else if (style === "mixed") {
    const sideCount = Math.floor(count / 3);
    const topCount = count - sideCount;
    for (let i = 0; i < topCount; i++) {
      const cols = Math.max(3, Math.ceil(Math.sqrt(topCount)));
      positions.push({ x: 20 + (i % cols) * Math.max(50, (width - 40) / cols), y: 30 + Math.floor(i / cols) * 46, vx: (40 + Math.random() * 40) * (Math.random() > 0.5 ? 1 : -1) * ramp, vy: (12 + Math.random() * 14) * ramp });
    }
    for (let i = 0; i < sideCount; i++) {
      const fromLeft = i % 2 === 0;
      positions.push({ x: fromLeft ? -30 : width + 10, y: 60 + i * 60, vx: (fromLeft ? 1 : -1) * (45 + Math.random() * 30) * ramp, vy: (15 + Math.random() * 20) * ramp });
    }
  } else {
    const perRow = Math.max(3, Math.min(8, Math.ceil(Math.sqrt(count) + 1)));
    for (let i = 0; i < count; i++) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const spacing = Math.max(50, (width - 40) / perRow);
      positions.push({ x: 20 + col * spacing, y: 30 + row * 46, vx: (40 + Math.random() * 40) * (Math.random() > 0.5 ? 1 : -1) * ramp, vy: (12 + Math.random() * 14) * ramp });
    }
  }
  return positions;
}

function pickEnemyType(config: GameConfig, index: number, total: number): EnemyType {
  const primary = config.enemyType;
  const mix = config.enemyMix;
  if (mix.length === 0) return primary;
  if (index / total < 0.78) return primary;
  return mix[index % mix.length]!;
}

export class ShooterGame extends GameEngine {
  private fireCooldown = 0;
  private waveEnemiesLeft = 0;
  private powerUpSpawnTimer = 0;
  private boss: Entity | null = null;
  private screenShake = 0;
  private hitFlashes: { x: number; y: number; t: number }[] = [];
  private scorePopups: { x: number; y: number; text: string; t: number; vy: number }[] = [];
  private lowHealthTriggered = false;
  private doingWellTimer = 0;

  protected setupLevel(): void {
    const size = 32;
    this.scene.player = Scene.entity(this.width / 2 - size / 2, this.height - size - 20, size, size, { hp: 3 });
    this.stats.lives = 3;
    this.stats.wave = 1;
    this.stats.coinsTotal = this.config.enemies * this.config.waves;
    this.fireCooldown = 0;
    this.powerUpSpawnTimer = 4;
    this.boss = null;
    this.screenShake = 0;
    this.hitFlashes = [];
    this.scorePopups = [];
    this.lowHealthTriggered = false;
    this.doingWellTimer = 0;
    this.spawnWave();
  }

  private spawnWave() {
    const isFinalWave = this.stats.wave === this.stats.waves;
    if (isFinalWave && this.config.boss.enabled) {
      this.spawnBoss();
      this.waveEnemiesLeft = 1;
      return;
    }
    const count = enemiesForWave(this.config, this.stats.wave);
    const positions = formationForWave(this.config, this.stats.wave, count, this.width);
    for (let i = 0; i < count; i += 1) {
      const pos = positions[i] ?? positions[0]!;
      const enemyKind = pickEnemyType(this.config, i, count);
      const stats = ENEMY_STATS[enemyKind];
      const intent = intentStatsFor(this.config, enemyKind);
      const w = 30 * stats.sizeMult;
      const h = 26 * stats.sizeMult;
      const enemy = Scene.entity(pos.x, pos.y, w, h, {
        hp: intent?.health ?? stats.hp,
        vx: pos.vx * stats.speedMult,
        vy: pos.vy * stats.speedMult,
        cooldown: intent?.attackCooldown ?? 2,
        enemyKind,
        behavior: behaviorFor(this.config, enemyKind),
      });
      this.scene.enemies.push(enemy);
    }
    this.waveEnemiesLeft = count;
  }

  private spawnBoss() {
    const bossSize = 80;
    const boss = Scene.entity(this.width / 2 - bossSize / 2, 40, bossSize, bossSize, { hp: this.config.boss.health, vx: 30, vy: 20, enemyKind: this.config.enemyType, behavior: "boss" });
    this.boss = boss;
    this.scene.enemies.push(boss);
  }

  protected updateWorld(dt: number): void {
    const player = this.scene.player;
    if (!player) return;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 3);
    this.hitFlashes = this.hitFlashes.filter((f) => { f.t -= dt; return f.t > 0; });
    this.scorePopups = this.scorePopups.filter((p) => { p.y += p.vy * dt; p.t -= dt; return p.t > 0; });

    const speed = speedFor(this.config);
    const axis = this.axis();
    const speedMult = this.stats.speedBoost ? 1.5 : 1;
    player.x += axis.x * speed * speedMult * dt;
    player.y += axis.y * speed * 0.5 * dt;
    this.clampToBoard(player);

    if (this.stats.shielded) { this.stats.shieldTimer -= dt; if (this.stats.shieldTimer <= 0) this.stats.shielded = false; }
    if (this.stats.speedBoost) { this.stats.speedTimer -= dt; if (this.stats.speedTimer <= 0) this.stats.speedBoost = false; }
    if (this.stats.doubleScore) { this.stats.doubleScoreTimer -= dt; if (this.stats.doubleScoreTimer <= 0) this.stats.doubleScore = false; }

    if (this.stats.lives <= 1 && !this.lowHealthTriggered) { this.lowHealthTriggered = true; this.powerUpSpawnTimer = Math.min(this.powerUpSpawnTimer, 2); }
    if (this.stats.lives > 2) {
      this.doingWellTimer += dt;
      if (this.doingWellTimer > 15 && !this.stats.doubleScore) { this.powerUpSpawnTimer = Math.min(this.powerUpSpawnTimer, 2); this.doingWellTimer = 0; }
    }

    if (this.config.powerUps.length > 0) {
      this.powerUpSpawnTimer -= dt;
      if (this.powerUpSpawnTimer <= 0) {
        this.powerUpSpawnTimer = 8 + Math.random() * 4;
        let type = this.config.powerUps[Math.floor(Math.random() * this.config.powerUps.length)]!;
        if (this.stats.lives <= 1 && this.config.powerUps.includes("health")) type = "health";
        else if (this.stats.lives <= 1 && this.config.powerUps.includes("shield")) type = "shield";
        else if (this.doingWellTimer > 10 && this.config.powerUps.includes("double_score")) type = "double_score";
        this.scene.powerUps.push(Scene.entity(20 + Math.random() * (this.width - 40), -20, 16, 16, { powerUpType: type, vy: 60 }));
      }
    }

    for (const powerUp of this.scene.powerUps) {
      powerUp.y += (powerUp.vy ?? 60) * dt;
      if (powerUp.y > this.height + 20) powerUp.alive = false;
      if (powerUp.alive && rectsOverlap(powerUp, player)) { powerUp.alive = false; this.applyPowerUp(powerUp.powerUpType ?? "health"); }
    }
    this.scene.powerUps = this.scene.powerUps.filter((p) => p.alive);

    this.fireCooldown -= dt;
    if (this.shootPressed() && this.fireCooldown <= 0) {
      const intentCombat = this.config.gameIntent?.combat;
      const stats = WEAPON_STATS[this.config.weapon];
      const cooldown = intentCombat ? 1 / Math.max(0.2, intentCombat.fireRate) : stats.cooldown;
      this.fireCooldown = cooldown;
      const damage = intentCombat?.damage ?? stats.damage;
      const bulletSpeed = intentCombat?.projectileSpeed ?? stats.bulletSpeed;
      const spread = intentCombat?.spread ?? 0;
      const pelletCount = this.config.weapon === "shotgun" ? 3 : 1;
      for (let i = 0; i < pelletCount; i++) {
        const offset = pelletCount === 1 ? 0 : (i - 1) * spread;
        const bullet = Scene.entity(player.x + player.w / 2 - 3, player.y - 10, 6, 14);
        bullet.vy = -bulletSpeed;
        bullet.vx = offset * bulletSpeed * 0.35;
        bullet.damage = damage;
        this.scene.bullets.push(bullet);
      }
    }

    for (const bullet of this.scene.bullets) {
      bullet.x += (bullet.vx ?? 0) * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.y + bullet.h < 0 || bullet.x < -50 || bullet.x > this.width + 50) bullet.alive = false;
    }

    for (const enemyBullet of this.scene.enemyBullets) {
      enemyBullet.x += enemyBullet.vx * dt;
      enemyBullet.y += enemyBullet.vy * dt;
      if (enemyBullet.y < -40 || enemyBullet.y > this.height + 40 || enemyBullet.x < -40 || enemyBullet.x > this.width + 40) {
        enemyBullet.alive = false;
      }
      if (enemyBullet.alive && rectsOverlap(enemyBullet, player)) {
        enemyBullet.alive = false;
        const damage = enemyBullet.damage ?? 1;
        if (this.stats.shielded) {
          this.stats.shieldTimer = Math.max(0, this.stats.shieldTimer - 1);
        } else {
          this.stats.lives -= damage > 1.5 ? 2 : 1;
          this.screenShake = Math.max(this.screenShake, 0.25);
        }
      }
    }
    this.scene.enemyBullets = this.scene.enemyBullets.filter((b) => b.alive);

    for (const enemy of this.scene.enemies) {
      const enemyKind = enemy.enemyKind ?? this.config.enemyType;
      const behavior = behaviorFor(this.config, enemyKind);
      const intent = intentStatsFor(this.config, enemyKind);
      const aggression = this.config.gameIntent?.aggression ?? this.config.aggression;
      const enemySpeed = (intent?.speed ?? ENEMY_STATS[enemyKind].speedMult) * (0.8 + aggression * 0.2);

      if (enemy !== this.boss) {
        switch (behavior) {
          case "chase": {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.hypot(dx, dy) || 1;
            enemy.vx += (dx / distance) * 55 * enemySpeed * dt;
            enemy.vy += (dy / distance) * 35 * enemySpeed * dt;
            break;
          }
          case "swarm": {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.hypot(dx, dy) || 1;
            enemy.vx += (dx / distance) * 40 * enemySpeed * dt;
            enemy.vy += (dy / distance) * 28 * enemySpeed * dt;
            enemy.vx += Math.sin((enemy.x + enemy.y) * 0.02) * 18 * dt;
            break;
          }
          case "charge": {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.hypot(dx, dy) || 1;
            enemy.vx += (dx / distance) * 85 * enemySpeed * dt;
            enemy.vy += (dy / distance) * 65 * enemySpeed * dt;
            break;
          }
          case "ranged": {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.hypot(dx, dy) || 1;
            if (distance < 170) {
              enemy.vx -= (dx / distance) * 45 * dt;
              enemy.vy -= (dy / distance) * 25 * dt;
            } else if (distance > 300) {
              enemy.vx += (dx / distance) * 25 * dt;
              enemy.vy += (dy / distance) * 15 * dt;
            }
            enemy.vx += Math.sin(enemy.y * 0.025) * 22 * dt;

            enemy.cooldown = (enemy.cooldown ?? intent?.attackCooldown ?? 2) - dt;
            const attackRange = 150 + Math.min(250, enemySpeed * 100);
            if (enemy.cooldown <= 0 && distance >= 150 && distance <= attackRange) {
              const bulletSpeed = 190 + Math.min(70, enemySpeed * 30);
              const bullet = Scene.entity(enemy.x + enemy.w / 2 - 4, enemy.y + enemy.h / 2 - 4, 8, 8);
              bullet.vx = (dx / distance) * bulletSpeed;
              bullet.vy = (dy / distance) * bulletSpeed;
              bullet.damage = Math.max(0.5, intent?.damage ?? 1);
              this.scene.enemyBullets.push(bullet);
              enemy.cooldown = Math.max(0.9, intent?.attackCooldown ?? 2);
            }
            break;
          }
          case "strafe": {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.hypot(dx, dy) || 1;
            enemy.vx += (dx / distance) * 20 * enemySpeed * dt;
            enemy.vy += (dy / distance) * 18 * enemySpeed * dt;
            enemy.vx += (-dy / distance) * 40 * enemySpeed * dt;
            break;
          }
          case "patrol":
          default:
            break;
        }

        const maxSpeed = 110 * enemySpeed;
        const currentSpeed = Math.hypot(enemy.vx, enemy.vy);
        if (currentSpeed > maxSpeed) {
          const scale = maxSpeed / currentSpeed;
          enemy.vx *= scale;
          enemy.vy *= scale;
        }
      }

      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      if (enemy === this.boss) {
        if (enemy.x <= 0 || enemy.x + enemy.w >= this.width) { enemy.vx *= -1; enemy.x = Math.max(0, Math.min(this.width - enemy.w, enemy.x)); }
        if (enemy.y <= 20 || enemy.y >= this.height * 0.4) { enemy.vy *= -1; enemy.y = Math.max(20, Math.min(this.height * 0.4, enemy.y)); }
      } else {
        if (enemy.x <= 0 || enemy.x + enemy.w >= this.width) { enemy.vx *= -0.7; enemy.x = Math.max(0, Math.min(this.width - enemy.w, enemy.x)); }
        if (enemy.y > this.height + 50) enemy.alive = false;
      }

      for (const bullet of this.scene.bullets) {
        if (!bullet.alive || !enemy.alive) continue;
        if (rectsOverlap(bullet, enemy)) {
          bullet.alive = false;
          enemy.hp = (enemy.hp ?? 1) - (bullet.damage ?? 1);
          enemy.hitFlash = 0.15;
          if ((enemy.hp ?? 0) <= 0) {
            enemy.alive = false;
            const kind = enemy.enemyKind ?? this.config.enemyType;
            const stats = ENEMY_STATS[kind];
            const reward = enemyReward();
            const scoreGain = this.stats.doubleScore ? reward.score * 2 : reward.score;
            const bossMultiplier = enemy === this.boss ? 5 : 1;
            const finalScore = Math.round(scoreGain * stats.scoreMult * bossMultiplier);
            this.stats.score += finalScore;
            this.stats.xp += reward.xp * bossMultiplier;
            this.stats.coins += reward.coins * bossMultiplier;
            this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
            this.hitFlashes.push({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2, t: 0.3 });
            this.scorePopups.push({ x: enemy.x + enemy.w / 2, y: enemy.y, text: `+${finalScore}`, t: 0.8, vy: -40 });
            if (enemy === this.boss) { this.boss = null; this.screenShake = 0.5; }
            else this.screenShake = Math.max(this.screenShake, 0.1);
          }
        }
      }

      if (enemy.alive && rectsOverlap(enemy, player)) {
        const damage = intent?.damage ?? 1;
        if (this.stats.shielded) {
          enemy.alive = false;
          this.stats.shieldTimer = Math.max(0, this.stats.shieldTimer - 1);
        } else {
          enemy.alive = false;
          this.stats.lives -= damage > 1.5 ? 2 : 1;
          this.screenShake = 0.35;
        }
      }
    }

    this.scene.enemies = this.scene.enemies.filter((e) => e.alive);
    this.scene.bullets = this.scene.bullets.filter((b) => b.alive);

    if (this.waveEnemiesLeft <= 0 && !this.boss && this.stats.wave < this.stats.waves) {
      this.stats.wave += 1;
      this.spawnWave();
    } else if (this.waveEnemiesLeft <= 0 && !this.boss && this.stats.wave >= this.stats.waves) {
      this.completeLevel();
    }
  }

  protected renderWorld(): void {
    const ctx = this.ctx;
    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake * 8 : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake * 8 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    if (this.scene.player)
      drawPlayer(ctx, this.scene.player, this.palette, true, this.config.character);
    for (const enemy of this.scene.enemies) {
      if (enemy === this.boss) drawBoss(ctx, enemy, this.palette, this.config.boss.type);
      else drawEnemy(ctx, enemy, this.palette, enemy.enemyKind ?? this.config.enemyType);
    }
    for (const bullet of this.scene.bullets) drawBullet(ctx, bullet, this.palette);
    for (const bullet of this.scene.enemyBullets) drawBullet(ctx, bullet, this.palette);
    for (const powerUp of this.scene.powerUps) drawPowerUp(ctx, powerUp, this.palette, this.elapsed);
    ctx.restore();
    for (const popup of this.scorePopups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, popup.t / 0.4);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(popup.text, popup.x, popup.y);
      ctx.restore();
    }
  }

  private applyPowerUp(type: string): void {
    switch (type) {
      case "health": this.stats.lives = Math.min(3, this.stats.lives + 1); break;
      case "shield": this.stats.shielded = true; this.stats.shieldTimer = 6; break;
      case "speed": this.stats.speedBoost = true; this.stats.speedTimer = 5; break;
      case "double_score": this.stats.doubleScore = true; this.stats.doubleScoreTimer = 10; break;
    }
  }
}
