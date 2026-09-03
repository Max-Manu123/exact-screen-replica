import { drawCoin, drawObstacle, drawPlayer } from "../AssetGenerator";
import { GameEngine } from "../GameEngine";
import { RULES, coinScore, coinsForLevel, rectsOverlap, speedFor } from "../GameRulesEngine";
import { Scene } from "../Scene";

/** Top-down coin collecting: collect every coin in the level to advance. */
export class CoinCollectorGame extends GameEngine {
  protected setupLevel(): void {
    const size = 30;
    this.scene.player = Scene.entity(this.width / 2 - size / 2, this.height / 2 - size / 2, size, size);

    const total = coinsForLevel(this.config, this.stats.level);
    this.stats.coinsTotal = total;
    this.stats.coins = 0;

    for (let i = 0; i < total; i += 1) {
      const w = 18;
      this.scene.coins.push(
        Scene.entity(
          24 + Math.random() * Math.max(1, this.width - 48 - w),
          24 + Math.random() * Math.max(1, this.height - 48 - w),
          w,
          w,
        ),
      );
    }

    const blockers = Math.min(6, Math.max(0, this.stats.level - 1) + (this.config.difficulty === "hard" ? 3 : 1));
    for (let i = 0; i < blockers; i += 1) {
      const w = 36 + Math.random() * 70;
      const h = 16 + Math.random() * 20;
      this.scene.obstacles.push(
        Scene.entity(Math.random() * Math.max(1, this.width - w), Math.random() * Math.max(1, this.height - h), w, h),
      );
    }
  }

  protected updateWorld(dt: number): void {
    const player = this.scene.player;
    if (!player) return;

    const axis = this.axis();
    const speed = speedFor(this.config);
    let dx = axis.x * speed * dt;
    let dy = axis.y * speed * dt;

    if (this.pointer?.active) {
      const targetX = this.pointer.x - player.w / 2;
      const targetY = this.pointer.y - player.h / 2;
      const diffX = targetX - player.x;
      const diffY = targetY - player.y;
      const distance = Math.hypot(diffX, diffY);
      if (distance > 2) {
        const step = Math.min(distance, speed * dt);
        dx = (diffX / distance) * step;
        dy = (diffY / distance) * step;
      }
    }

    const prevX = player.x;
    const prevY = player.y;
    player.x += dx;
    player.y += dy;
    this.clampToBoard(player);

    for (const obstacle of this.scene.obstacles) {
      if (rectsOverlap(player, obstacle)) {
        player.x = prevX;
        player.y = prevY;
        break;
      }
    }

    for (const coin of this.scene.coins) {
      if (!coin.alive) continue;
      if (rectsOverlap(player, coin)) {
        coin.alive = false;
        this.stats.coins += 1;
        this.stats.score += coinScore();
      }
    }
    this.scene.coins = this.scene.coins.filter((coin) => coin.alive);

    if (this.stats.coins >= this.stats.coinsTotal) this.completeLevel();
  }

  protected renderWorld(): void {
    for (const obstacle of this.scene.obstacles) drawObstacle(this.ctx, obstacle, this.palette);
    for (const coin of this.scene.coins) drawCoin(this.ctx, coin, this.palette, this.elapsed * 4 + coin.x);
    if (this.scene.player) drawPlayer(this.ctx, this.scene.player, this.palette);
    void RULES;
  }
}
