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
    // Rush: enemies come in a stream from the top
    for (let i = 0; i < count; i++) {
      positions.push({
        x: 20 + Math.random() * Math.max(1, width - 60),
        y: -30 - i * 50,
        vx: (30 + Math.random() * 30) * (Math.random() > 0.5 ? 1 : -1) * ramp,
        vy: (60 + Math.random() * 40) * ramp,
      });
    }
  } else if (pattern === "spread") {
    // Side pressure: enemies come from sides
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      positions.push({
        x: fromLeft ? -30 : width + 10,
        y: 30 + (i / count) * 200,
        vx: (fromLeft ? 1 : -1) * (50 + Math.random() * 40) * ramp,
        vy: (20 + Math.random() * 30) * ramp,
      });
    }
  } else if (pattern === "cluster") {
    // Elite: tight clusters
    const clusters = Math.max(1, Math.ceil(count / 4));
    for (let i = 0; i < count; i++) {
      const clusterIdx = Math.floor(i / 4);
      const within = i % 4;
      const cx = (width / (clusters + 1)) * (clusterIdx + 1);
      positions.push({
        x: cx + (within % 2) * 40 - 20,
        y: 30 + Math.floor(within / 2) * 40 + clusterIdx * 20,
        vx: (20 + Math.random() * 30) * (Math.random() > 0.5 ? 1 : -1) * ramp,
        vy: (15 + Math.random() * 20) * ramp,
      });
    }
  } else if (style === "mixed") {
    // Mixed: some from top, some from sides
    const sideCount = Math.floor(count / 3);
    const topCount = count - sideCount;
    for (let i = 0; i < topCount; i++) {
      const col = i % Math.max(3, Math.ceil(Math.sqrt(topCount)));
      const row = Math.floor(i / Math.max(3, Math.ceil(Math.sqrt(topCount))));
      positions.push({
        x: 20 + col * Math.max(50, (width - 40) / Math.max(3, Math.ceil(Math.sqrt(topCount)))),
        y: 30 + row * 46,
        vx: (40 + Math.random() * 40) * (Math.random() > 0.5 ? 1 : -1) * ramp,
        vy: (12 + Math.random() * 14) * ramp,
      });
    }
    for (let i = 0; i < sideCount; i++) {
      const fromLeft = i % 2 === 0;
      positions.push({
        x: fromLeft ? -30 : width + 10,
        y: 60 + i * 60,
        vx: (fromLeft ? 1 : -1) * (45 + Math.random() * 30) * ramp,
        vy: (15 + Math.random() * 20) * ramp,
      });
    }
  } else {
    // Grid (balanced/default)
    const perRow = Math.max(3, Math.min(8, Math.ceil(Math.sqrt(count) + 1)));
    for (let i = 0; i < count; i++) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const spacing = Math.max(50, (width - 40) / perRow);
      positions.push({
        x: 20 + col * spacing,
        y: 30 + row * 46,
        vx: (40 + Math.random() * 40) * (Math.random() > 0.5 ? 1 : -1) * ramp,
        vy: (12 + Math.random() * 14) * ramp,
      });
    }
  }

  return positions;
}

/** Pick enemy type for a given slot, respecting composition. */
function pickEnemyType(config: GameConfig, index: number, total: number): EnemyType {
  const primary = config.enemyType;
  const mix = config.enemyMix;

  if (mix.length === 0) return primary;

  // 70-85% primary, 15-30% complementary
  const primaryRatio = 0.78;
  const isPrimary = index / total < primaryRatio;
  if (isPrimary) return primary;

  // Pick from mix deterministically
  return mix[index % mix.length]!;
}

/** Vertical shooter: clear every wave of enemies to finish the level. */
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
    this.powerUpSpawnTimer = 4; // First power-up at ~4 seconds
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
      const w = 30 * stats.sizeMult;
      const h = 26 * stats.sizeMult;

      const enemy = Scene.entity(pos.x, pos.y, w, h, {
        hp: stats.hp,
        vx: pos.vx * stats.speedMult,
        vy: pos.vy * stats.speedMult,
        enemyKind,
      });
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
      { hp: this.config.boss.health, vx: 30, vy: 20, enemyKind: this.config.enemyType },
    );
    this.boss = boss;
    this.scene.enemies.push(boss);
  }

  protected updateWorld(dt: number): void {
    const player = this.scene.player;
    if (!player) return;

    // Screen shake decay
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 3);

    // Update hit flashes
    this.hitFlashes = this.hitFlashes.filter((f) => {
      f.t -= dt;
      return f.t > 0;
    });

    // Update score popups
    this.scorePopups = this.scorePopups.filter((p) => {
      p.y += p.vy * dt;
      p.t -= dt;
      return p.t > 0;
    });

    const speed = speedFor(this.config);
    const axis = this.axis();
    let speedMult = 1;
    if (this.stats.speedBoost) speedMult = 1.5;
    player.x += axis.x * speed * speedMult * dt;
    player.y += axis.y * speed * 0.5 * dt;
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

    // Track player performance for power-up pacing
    if (this.stats.lives <= 1 && !this.lowHealthTriggered) {
      this.lowHealthTriggered = true;
      // Player struggling - spawn a shield/health soon
      this.powerUpSpawnTimer = Math.min(this.powerUpSpawnTimer, 2);
    }
    if (this.stats.lives > 2) {
      this.doingWellTimer += dt;
      if (this.doingWellTimer > 15 && !this.stats.doubleScore) {
        // Player doing well - offer double score
        this.powerUpSpawnTimer = Math.min(this.powerUpSpawnTimer, 2);
        this.doingWellTimer = 0;
      }
    }

    // Spawn power-ups with pacing
    if (this.config.powerUps.length > 0) {
      this.powerUpSpawnTimer -= dt;
      if (this.powerUpSpawnTimer <= 0) {
        this.powerUpSpawnTimer = 8 + Math.random() * 4;
        // Pick contextually appropriate power-up
        let type = this.config.powerUps[Math.floor(Math.random() * this.config.powerUps.length)]!;
        if (this.stats.lives <= 1 && this.config.powerUps.includes("health")) type = "health";
        else if (this.stats.lives <= 1 && this.config.powerUps.includes("shield")) type = "shield";
        else if (this.doingWellTimer > 10 && this.config.powerUps.includes("double_score")) type = "double_score";

        const powerUp = Scene.entity(
          20 + Math.random() * (this.width - 40),
          -20,
          16,
          16,
          { powerUpType: type, vy: 60 },
        );
        this.scene.powerUps.push(powerUp);
      }
    }

    // Update power-ups
    for (const powerUp of this.scene.powerUps) {
      powerUp.y += (powerUp.vy ?? 60) * dt;
      if (powerUp.y > this.height + 20) powerUp.alive = false;

      if (powerUp.alive && rectsOverlap(powerUp, player)) {
        powerUp.alive = false;
        this.applyPowerUp(powerUp.powerUpType ?? "health");
      }
    }
    this.scene.powerUps = this.scene.powerUps.filter((p) => p.alive);

    // Shooting
    this.fireCooldown -= dt;
    if (this.shootPressed() && this.fireCooldown <= 0) {
      const stats = WEAPON_STATS[this.config.weapon];
      this.fireCooldown = stats.cooldown;

      if (stats.spread) {
        for (let i = 0; i < stats.spread; i++) {
          const spreadAngle = (i - (stats.spread - 1) / 2) * 0.15;
          const bullet = Scene.entity(player.x + player.w / 2 - 3, player.y - 10, 6, 14);
          bullet.vy = -stats.bulletSpeed * Math.cos(spreadAngle);
          bullet.vx = stats.bulletSpeed * Math.sin(spreadAngle);
          bullet.damage = stats.damage;
          this.scene.bullets.push(bullet);
        }
      } else {
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

      // Boss movement
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

      // Bullet collisions
      for (const bullet of this.scene.bullets) {
        if (!bullet.alive || !enemy.alive) continue;
        if (rectsOverlap(bullet, enemy)) {
          bullet.alive = false;
          const damage = bullet.damage ?? 1;
          enemy.hp = (enemy.hp ?? 1) - damage;
          enemy.hitFlash = 0.15;

          if ((enemy.hp ?? 0) <= 0) {
            enemy.alive = false;
            const enemyKind = enemy.enemyKind ?? this.config.enemyType;
            const stats = ENEMY_STATS[enemyKind];
            const reward = enemyReward();
            const scoreGain = this.stats.doubleScore ? reward.score * 2 : reward.score;
            const bossMultiplier = enemy === this.boss ? 5 : 1;
            const finalScore = Math.round(scoreGain * stats.scoreMult * bossMultiplier);
            this.stats.score += finalScore;
            this.stats.xp += reward.xp * bossMultiplier;
            this.stats.coins += reward.coins * bossMultiplier;
            this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);

            // Visual feedback
            this.hitFlashes.push({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2, t: 0.3 });
            this.scorePopups.push({
              x: enemy.x + enemy.w / 2,
              y: enemy.y,
              text: `+${finalScore}`,
              t: 0.8,
              vy: -40,
            });
            if (enemy === this.boss) {
              this.boss = null;
              this.screenShake = 0.5;
            } else {
              this.screenShake = Math.max(this.screenShake, 0.1);
            }
          }
        }
      }

      // Player collision
      if (enemy.alive && rectsOverlap(enemy, player)) {
        enemy.alive = false;
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        this.screenShake = Math.max(this.screenShake, 0.2);
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

    // Decay hit flash on enemies
    for (const enemy of this.scene.enemies) {
      if (enemy.hitFlash && enemy.hitFlash > 0) {
        enemy.hitFlash -= dt;
        if (enemy.hitFlash < 0) enemy.hitFlash = 0;
      }
    }

    this.scene.bullets = this.scene.bullets.filter((bullet) => bullet.alive);
    this.scene.enemies = this.scene.enemies.filter((enemy) => enemy.alive);

    // Wave completion
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
        this.stats.shieldTimer = 5;
        break;
      case "speed":
        this.stats.speedBoost = true;
        this.stats.speedTimer = 8;
        break;
      case "double_score":
        this.stats.doubleScore = true;
        this.stats.doubleScoreTimer = 10;
        break;
    }
  }

  protected renderWorld(): void {
    const ctx = this.ctx;

    // Apply screen shake
    if (this.screenShake > 0) {
      const shake = this.screenShake * 6;
      ctx.save();
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
      );
    }

    for (const bullet of this.scene.bullets) drawBullet(ctx, bullet, this.palette);
    for (const enemy of this.scene.enemies) {
      if (enemy === this.boss) {
        drawBoss(ctx, enemy, this.palette, this.config.boss.type);
      } else {
        const enemyKind = enemy.enemyKind ?? this.config.enemyType;
        drawEnemy(ctx, enemy, this.palette, enemyKind);
        // Hit flash overlay
        if (enemy.hitFlash && enemy.hitFlash > 0) {
          ctx.save();
          ctx.globalAlpha = enemy.hitFlash * 3;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
          ctx.restore();
        }
      }
    }
    for (const powerUp of this.scene.powerUps) drawPowerUp(ctx, powerUp, this.palette, this.elapsed * 3);
    if (this.scene.player) drawPlayer(ctx, this.scene.player, this.palette, true, this.config.character);

    // Shield visual
    if (this.stats.shielded && this.scene.player) {
      const p = this.scene.player;
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(this.elapsed * 6);
      ctx.strokeStyle = "#44aaff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Hit flash bursts
    for (const f of this.hitFlashes) {
      ctx.save();
      ctx.globalAlpha = f.t * 2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(f.x, f.y, 8 + (1 - f.t / 0.3) * 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Score popups
    for (const p of this.scorePopups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.t / 0.8);
      ctx.fillStyle = this.palette.hud;
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }

    if (this.screenShake > 0) {
      ctx.restore();
    }

    // Boss health bar
    if (this.boss && this.boss.alive) {
      const barWidth = 200;
      const barHeight = 8;
      const barX = this.width / 2 - barWidth / 2;
      const barY = 15;
      const healthPercent = Math.max(0, (this.boss.hp ?? 0) / this.config.boss.health);

      ctx.save();
      ctx.fillStyle = "#333333";
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
      ctx.restore();
    }
  }
}
