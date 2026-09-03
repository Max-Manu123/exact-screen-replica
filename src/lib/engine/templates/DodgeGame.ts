import { drawObstacle, drawPlayer } from "../AssetGenerator";
import { GameEngine } from "../GameEngine";
import { RULES, progression, rectsOverlap, speedFor } from "../GameRulesEngine";
import { Scene } from "../Scene";

/** Falling-obstacle survival: difficulty ramps up with time and level. */
export class DodgeGame extends GameEngine {
  private spawnTimer = 0;
  private levelTarget = 0;

  protected setupLevel(): void {
    const size = 30;
    this.scene.player = Scene.entity(this.width / 2 - size / 2, this.height - size - 18, size, size);
    this.spawnTimer = 0;
    this.stats.coinsTotal = 0;
    // Each level asks the player to survive a growing amount of time.
    this.levelTarget = 12 + this.stats.level * 6;
    this.levelStart = this.elapsed;
  }

  private levelStart = 0;

  protected updateWorld(dt: number): void {
    const player = this.scene.player;
    if (!player) return;

    const ramp = progression(this.config, this.stats.level, this.elapsed - this.levelStart);
    const speed = speedFor(this.config);

    const axis = this.axis();
    if (this.pointer?.active) {
      const target = this.pointer.x - player.w / 2;
      const diff = target - player.x;
      if (Math.abs(diff) > 2) player.x += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
    } else {
      player.x += axis.x * speed * dt;
      player.y += axis.y * speed * 0.6 * dt;
    }
    this.clampToBoard(player);

    const spawnInterval = Math.max(0.18, 0.95 / (ramp * (0.6 + this.config.obstacles / 12)));
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnInterval;
      const w = 22 + Math.random() * 46;
      const obstacle = Scene.entity(Math.random() * Math.max(1, this.width - w), -40, w, 18);
      obstacle.vy = (140 + Math.random() * 90) * ramp;
      this.scene.obstacles.push(obstacle);
    }

    for (const obstacle of this.scene.obstacles) {
      obstacle.y += obstacle.vy * dt;
      if (obstacle.y > this.height + 40) {
        obstacle.alive = false;
        this.stats.score += 5;
      } else if (rectsOverlap(player, obstacle)) {
        this.gameOver();
        return;
      }
    }
    this.scene.obstacles = this.scene.obstacles.filter((obstacle) => obstacle.alive);

    this.stats.score += RULES.survivalScorePerSecond * dt;
    this.stats.score = Math.round(this.stats.score);

    if (this.elapsed - this.levelStart >= this.levelTarget) this.completeLevel();
  }

  protected renderWorld(): void {
    for (const obstacle of this.scene.obstacles) drawObstacle(this.ctx, obstacle, this.palette);
    if (this.scene.player) drawPlayer(this.ctx, this.scene.player, this.palette);

    const remaining = Math.max(0, this.levelTarget - (this.elapsed - this.levelStart));
    this.ctx.save();
    this.ctx.globalAlpha = 0.8;
    this.ctx.fillStyle = this.palette.hud;
    this.ctx.font = "600 13px system-ui, sans-serif";
    this.ctx.fillText(`${Math.ceil(remaining)}s`, this.width - 44, 22);
    this.ctx.restore();
  }
}
