import { drawBullet, drawEnemy, drawPlayer, drawPowerUp, drawBoss } from "../AssetGenerator";
import { GameEngine } from "../GameEngine";
import { RULES, enemiesForWave, enemyReward, progression, rectsOverlap, speedFor } from "../GameRulesEngine";
import { Scene } from "../Scene";
import type { Entity, GameConfig } from "../types";

const WEAPON_STATS: Record<GameConfig["weapon"], { cooldown: number; bulletSpeed: number; damage: number; spread?: number }> = {
  blaster: { cooldown: 0.25, bulletSpeed: 400, damage: 1 },
  pistol: { cooldown: 0.4, bulletSpeed: 350, damage: 2 },
  shotgun: { cooldown: 0.6, bulletSpeed: 300, damage: 1, spread: 3 },
  rifle: { cooldown: 0.15, bulletSpeed: 450, damage: 0.8 },
};

const ENEMY_STATS: Record<GameConfig["enemyType"], { hp: number; speedMult: number; sizeMult: number }> = {
  robot: { hp: 1, speedMult: 1, sizeMult: 1 },
  alien: { hp: 1, speedMult: 1.2, sizeMult: 0.9 },
  drone: { hp: 0.5, speedMult: 1.5, sizeMult: 0.7 },
  monster: { hp: 2, speedMult: 0.7, sizeMult: 1.3 },
};

/** Vertical shooter: clear every wave of enemies to finish the level. */
export class ShooterGame extends GameEngine {
  private fireCooldown = 0;
  private waveEnemiesLeft = 0;
  private powerUpSpawnTimer = 0;
  private boss: Entity | null = null;

  protected setupLevel(): void {
    const size = 32;
    this.scene.player = Scene.entity(this.width / 2 - size / 2, this.height - size - 20, size, size, { hp: 3 });
    // Reset health/lives at the start of each level
    this.stats.lives = 3;
    this.stats.wave = 1;
    this.stats.coinsTotal = this.config.enemies * this.config.waves;
    this.fireCooldown = 0;
    this.powerUpSpawnTimer = 0;
    this.boss = null;
    this.spawnWave();
  }

  private spawnWave() {
    // Check if this is the final wave and boss is enabled
    const isFinalWave = this.stats.wave === this.stats.waves;
    if (isFinalWave && this.config.boss.enabled) {
      this.spawnBoss();
      this.waveEnemiesLeft = 1; // Boss counts as the "enemy" for this wave
      return;
    }

    const count = enemiesForWave(this.config, this.stats.wave);
    const ramp = progression(this.config, this.stats.level, this.elapsed);
    const perRow = Math.max(3, Math.min(8, Math.ceil(Math.sqrt(count) + 1)));
    const enemyStats = ENEMY_STATS[this.config.enemyType];
    
    for (let i = 0; i < count; i += 1) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const w = 30 * enemyStats.sizeMult;
      const spacing = Math.max(w + 8, (this.width - 40) / perRow);
      const enemy = Scene.entity(20 + col * spacing, 30 + row * 46, w, 26 * enemyStats.sizeMult, { hp: enemyStats.hp });
      enemy.vx = (40 + Math.random() * 40) * ramp * enemyStats.speedMult * (Math.random() > 0.5 ? 1 : -1);
      enemy.vy = (12 + Math.random() * 14) * ramp * enemyStats.speedMult;
      this.scene.enemies.push(enemy);
    }
    this.waveEnemiesLeft = count;
  }

  private spawnBoss() {
    const bossSize = 80;
    const boss = Scene.entity(
      this.width / 2 - bossSize / 2,
      40,
      bossSize,
      bossSize,
      { hp: this.config.boss.health, vx: 30, vy: 20 }
    );
    this.boss = boss;
    this.scene.enemies.push(boss);
  }

  protected updateWorld(dt: number): void {
    const player = this.scene.player;
    if (!player) return;

    const speed = speedFor(this.config);
    const axis = this.axis();
    if (this.pointer?.active) {
      const target = this.pointer.x - player.w / 2;
      const diff = target - player.x;
      if (Math.abs(diff) > 2) player.x += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
    } else {
      player.x += axis.x * speed * dt;
      player.y += axis.y * speed * 0.5 * dt;
    }
    this.clampToBoard(player);

    // Update power-up timers
    if (this.stats.shielded) {
      this.stats.shieldTimer -= dt;
      if (this.stats.shieldTimer <= 0) this.stats.shielded = false;
    }
    if (this.stats.speedBoost) {
      this.stats.speedTimer -= dt;
      if (this.stats.speedTimer <= 0) this.stats.speedBoost = false;
    }
    if (this.stats.doubleScore) {
      this.stats.doubleScoreTimer -= dt;
      if (this.stats.doubleScoreTimer <= 0) this.stats.doubleScore = false;
    }

    // Spawn power-ups if enabled
    if (this.config.powerUps.length > 0) {
      this.powerUpSpawnTimer -= dt;
      if (this.powerUpSpawnTimer <= 0) {
        this.powerUpSpawnTimer = 8 + Math.random() * 4; // Spawn every 8-12 seconds
        const type = this.config.powerUps[Math.floor(Math.random() * this.config.powerUps.length)];
        const powerUp = Scene.entity(
          20 + Math.random() * (this.width - 40),
          -20,
          16,
          16,
          { powerUpType: type, vy: 60 }
        );
        this.scene.powerUps.push(powerUp);
      }
    }

    // Update power-ups
    for (const powerUp of this.scene.powerUps) {
      powerUp.y += (powerUp.vy ?? 60) * dt;
      if (powerUp.y>this.height + 20) powerUp.alive = false;
      
      // Check collection
      if (powerUp.alive && rectsOverlap(powerUp, player)) {
        powerUp.alive = false;
        this.applyPowerUp(powerUp.powerUpType ?? "health");
      }
    }
    this.scene.powerUps = this.scene.powerUps.filter((p) => p.alive);

    this.fireCooldown -= dt;
    if (this.shootPressed() && this.fireCooldown <= 0) {
      const stats = WEAPON_STATS[this.config.weapon];
      this.fireCooldown = stats.cooldown;
      
      if (stats.spread) {
        // Shotgun: multiple bullets with spread
        for (let i = 0; i < stats.spread; i++) {
          const spreadAngle = (i - (stats.spread - 1) / 2) * 0.15;
          const bullet = Scene.entity(player.x + player.w / 2 - 3, player.y - 10, 6, 14);
          bullet.vy = -stats.bulletSpeed * Math.cos(spreadAngle);
          bullet.vx = stats.bulletSpeed * Math.sin(spreadAngle);
          bullet.damage = stats.damage;
          this.scene.bullets.push(bullet);
        }
      } else {
        // Single bullet
        const bullet = Scene.entity(player.x + player.w / 2 - 3, player.y - 10, 6, 14);
        bullet.vy = -stats.bulletSpeed;
        bullet.damage = stats.damage;
        this.scene.bullets.push(bullet);
      }
    }

    for (const bullet of this.scene.bullets) {
      bullet.x += (bullet.vx ?? 0) * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.y + bullet.h < 0) bullet.alive = false;
    }

    for (const enemy of this.scene.enemies) {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      
      // Boss-specific movement
      if (enemy === this.boss) {
        if (enemy.x <= 0 || enemy.x + enemy.w >= this.width) {
          enemy.vx *= -1;
          enemy.x = Math.max(0, Math.min(this.width - enemy.w, enemy.x));
        }
        if (enemy.y <= 20 || enemy.y >= this.height * 0.4) {
          enemy.vy *= -1;
          enemy.y = Math.max(20, Math.min(this.height * 0.4, enemy.y));
        }
      } else {
        // Regular enemy movement
        if (enemy.x <= 0 || enemy.x + enemy.w >= this.width) {
          enemy.vx *= -1;
          enemy.x = Math.max(0, Math.min(this.width - enemy.w, enemy.x));
        }
      }

      for (const bullet of this.scene.bullets) {
        if (!bullet.alive || !enemy.alive) continue;
        if (rectsOverlap(bullet, enemy)) {
          bullet.alive = false;
          const damage = bullet.damage ?? 1;
          enemy.hp = (enemy.hp ?? 1) - damage;
          if ((enemy.hp ?? 0) <= 0) {
            enemy.alive = false;
            const reward = enemyReward();
            const scoreGain = this.stats.doubleScore ? reward.score * 2 : reward.score;
            // Boss gives extra points
            const bossMultiplier = enemy === this.boss ? 5 : 1;
            this.stats.score += scoreGain * bossMultiplier;
            this.stats.xp += reward.xp * bossMultiplier;
            this.stats.coins += reward.coins * bossMultiplier;
            this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
            if (enemy === this.boss) {
              this.boss = null;
            }
          }
        }
      }

      if (enemy.alive && rectsOverlap(enemy, player)) {
        enemy.alive = false;
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        if (this.stats.shielded) {
          this.stats.shielded = false;
          this.stats.shieldTimer = 0;
        } else {
          this.stats.lives -= 1;
          if (this.stats.lives <= 0) {
            this.gameOver();
            return;
          }
        }
      }

      // Regular enemies that reach bottom cost lives
      if (enemy.alive && enemy !== this.boss && enemy.y > this.height) {
        enemy.alive = false;
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        this.stats.lives -= 1;
        if (this.stats.lives <= 0) {
          this.gameOver();
          return;
        }
      }
    }

    this.scene.bullets = this.scene.bullets.filter((bullet) => bullet.alive);
    this.scene.enemies = this.scene.enemies.filter((enemy) => enemy.alive);

    if (this.scene.enemies.length === 0 && this.waveEnemiesLeft === 0) {
      if (this.stats.wave < this.stats.waves) {
        this.stats.wave += 1;
        this.spawnWave();
        this.emitStats();
      } else {
        this.completeLevel();
      }
    }
  }

  private applyPowerUp(type: "health" | "shield" | "speed" | "double_score"): void {
    switch (type) {
      case "health":
        this.stats.lives = Math.min(this.stats.lives + 1, 5);
        break;
      case "shield":
        this.stats.shielded = true;
        this.stats.shieldTimer = 5; // 5 seconds
        break;
      case "speed":
        this.stats.speedBoost = true;
        this.stats.speedTimer = 8; // 8 seconds
        break;
      case "double_score":
        this.stats.doubleScore = true;
        this.stats.doubleScoreTimer = 10; // 10 seconds
        break;
    }
  }

  protected renderWorld(): void {
    for (const bullet of this.scene.bullets) drawBullet(this.ctx, bullet, this.palette);
    for (const enemy of this.scene.enemies) {
      if (enemy === this.boss) {
        drawBoss(this.ctx, enemy, this.palette, this.config.boss.type);
      } else {
        drawEnemy(this.ctx, enemy, this.palette, this.config.enemyType);
      }
    }
    for (const powerUp of this.scene.powerUps) drawPowerUp(this.ctx, powerUp, this.palette, this.elapsed * 3);
    if (this.scene.player) drawPlayer(this.ctx, this.scene.player, this.palette, true, this.config.character);
    
    // Draw boss health bar
    if (this.boss && this.boss.alive) {
      const barWidth = 200;
      const barHeight = 8;
      const barX = this.width / 2 - barWidth / 2;
      const barY = 15;
      const healthPercent = Math.max(0, (this.boss.hp ?? 0) / this.config.boss.health);
      
      this.ctx.save();
      this.ctx.fillStyle = "#333333";
      this.ctx.fillRect(barX, barY, barWidth, barHeight);
      this.ctx.fillStyle = "#ff4444";
      this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(barX, barY, barWidth, barHeight);
      this.ctx.restore();
    }
  }
}
