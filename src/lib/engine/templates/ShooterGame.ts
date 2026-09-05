import { drawBullet, drawEnemy, drawPlayer } from "../AssetGenerator";
import { GameEngine } from "../GameEngine";
import { RULES, enemiesForWave, enemyReward, progression, rectsOverlap, speedFor } from "../GameRulesEngine";
import { Scene } from "../Scene";

/** Vertical shooter: clear every wave of enemies to finish the level. */
export class ShooterGame extends GameEngine {
  private fireCooldown = 0;
  private waveEnemiesLeft = 0;

  protected setupLevel(): void {
    const size = 32;
    this.scene.player = Scene.entity(this.width / 2 - size / 2, this.height - size - 20, size, size, { hp: 3 });
    // Reset health/lives at the start of each level
    this.stats.lives = 3;
    this.stats.wave = 1;
    this.stats.coinsTotal = this.config.enemies * this.config.waves;
    this.fireCooldown = 0;
    this.spawnWave();
  }

  private spawnWave() {
    const count = enemiesForWave(this.config, this.stats.wave);
    const ramp = progression(this.config, this.stats.level, this.elapsed);
    const perRow = Math.max(3, Math.min(8, Math.ceil(Math.sqrt(count) + 1)));
    for (let i = 0; i < count; i += 1) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const w = 30;
      const spacing = Math.max(w + 8, (this.width - 40) / perRow);
      const enemy = Scene.entity(20 + col * spacing, 30 + row * 46, w, 26, { hp: 1 });
      enemy.vx = (40 + Math.random() * 40) * ramp * (Math.random() > 0.5 ? 1 : -1);
      enemy.vy = (12 + Math.random() * 14) * ramp;
      this.scene.enemies.push(enemy);
    }
    this.waveEnemiesLeft = count;
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

    this.fireCooldown -= dt;
    if (this.shootPressed() && this.fireCooldown <= 0) {
      this.fireCooldown = RULES.fireCooldown;
      const bullet = Scene.entity(player.x + player.w / 2 - 3, player.y - 10, 6, 14);
      bullet.vy = -RULES.bulletSpeed;
      this.scene.bullets.push(bullet);
    }

    for (const bullet of this.scene.bullets) {
      bullet.y += bullet.vy * dt;
      if (bullet.y + bullet.h < 0) bullet.alive = false;
    }

    for (const enemy of this.scene.enemies) {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.x <= 0 || enemy.x + enemy.w >= this.width) {
        enemy.vx *= -1;
        enemy.x = Math.max(0, Math.min(this.width - enemy.w, enemy.x));
      }

      for (const bullet of this.scene.bullets) {
        if (!bullet.alive || !enemy.alive) continue;
        if (rectsOverlap(bullet, enemy)) {
          bullet.alive = false;
          enemy.alive = false;
          const reward = enemyReward();
          this.stats.score += reward.score;
          this.stats.xp += reward.xp;
          this.stats.coins += reward.coins;
          this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        }
      }

      if (enemy.alive && rectsOverlap(enemy, player)) {
        enemy.alive = false;
        this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
        this.stats.lives -= 1;
        if (this.stats.lives <= 0) {
          this.gameOver();
          return;
        }
      }

      if (enemy.alive && enemy.y > this.height) {
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

  protected renderWorld(): void {
    for (const bullet of this.scene.bullets) drawBullet(this.ctx, bullet, this.palette);
    for (const enemy of this.scene.enemies) drawEnemy(this.ctx, enemy, this.palette);
    if (this.scene.player) drawPlayer(this.ctx, this.scene.player, this.palette, true);
  }
}
