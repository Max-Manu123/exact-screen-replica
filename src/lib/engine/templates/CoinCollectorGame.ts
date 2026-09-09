import { drawCoin, drawObstacle, drawPlayer } from "../AssetGenerator";
import { GameEngine } from "../GameEngine";
import { RULES, coinScore, coinsForLevel, rectsOverlap, speedFor } from "../GameRulesEngine";
import { Scene } from "../Scene";
import type { CollectiblePattern, Entity } from "../types";

/** Deterministic hash for layout placement. */
function hashNum(n: number): number {
  let h = n * 374761393 + 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/** Generate intentional coin layouts based on the pattern type. */
function generateLayout(
  pattern: CollectiblePattern,
  total: number,
  width: number,
  height: number,
  level: number,
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const margin = 30;
  const w = 18;

  switch (pattern) {
    case "cluster": {
      // 3-4 clusters of coins
      const clusterCount = Math.max(2, Math.ceil(total / 6));
      const perCluster = Math.ceil(total / clusterCount);
      let idx = 0;
      for (let c = 0; c < clusterCount && idx < total; c++) {
        const cx = margin + hashNum(c * 31 + level) * (width - margin * 2);
        const cy = margin + hashNum(c * 47 + level) * (height - margin * 2);
        for (let i = 0; i < perCluster && idx < total; i++, idx++) {
          const angle = (i / perCluster) * Math.PI * 2;
          const r = 20 + (i % 2) * 15;
          positions.push({
            x: Math.max(margin, Math.min(width - margin - w, cx + Math.cos(angle) * r)),
            y: Math.max(margin, Math.min(height - margin - w, cy + Math.sin(angle) * r)),
          });
        }
      }
      break;
    }
    case "trail": {
      // Winding trail across the screen
      const segments = total;
      for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const x = margin + t * (width - margin * 2);
        const y = margin + (0.3 + 0.4 * Math.sin(t * Math.PI * 3 + level)) * (height - margin * 2);
        positions.push({ x: Math.max(margin, Math.min(width - margin - w, x)), y });
      }
      break;
    }
    case "risk_reward": {
      // Some coins near obstacles (risky), some safe
      const safeCount = Math.floor(total * 0.4);
      const riskyCount = total - safeCount;
      // Safe coins in center area
      for (let i = 0; i < safeCount; i++) {
        positions.push({
          x: width * 0.3 + hashNum(i * 13 + level) * width * 0.4,
          y: height * 0.3 + hashNum(i * 17 + level) * height * 0.4,
        });
      }
      // Risky coins near edges
      for (let i = 0; i < riskyCount; i++) {
        const onEdge = i % 2 === 0;
        positions.push({
          x: onEdge
            ? margin + hashNum(i * 23 + level) * (width * 0.2)
            : width - margin - w - hashNum(i * 29 + level) * (width * 0.2),
          y: margin + hashNum(i * 31 + level) * (height - margin * 2),
        });
      }
      break;
    }
    case "spread": {
      // Even spread with slight variation
      const cols = Math.ceil(Math.sqrt(total * (width / height)));
      const rows = Math.ceil(total / cols);
      const cellW = (width - margin * 2) / cols;
      const cellH = (height - margin * 2) / rows;
      for (let i = 0; i < total; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.push({
          x: margin + col * cellW + cellW / 2 - w / 2 + (hashNum(i + level * 7) - 0.5) * cellW * 0.4,
          y: margin + row * cellH + cellH / 2 - w / 2 + (hashNum(i * 3 + level * 11) - 0.5) * cellH * 0.4,
        });
      }
      break;
    }
    case "scatter":
    default: {
      // Semi-random scatter (not fully random - deterministic)
      for (let i = 0; i < total; i++) {
        positions.push({
          x: margin + hashNum(i * 41 + level * 53) * (width - margin * 2 - w),
          y: margin + hashNum(i * 59 + level * 67) * (height - margin * 2 - w),
        });
      }
      break;
    }
  }

  return positions;
}

/** Top-down coin collecting: collect every coin in the level to advance. */
export class CoinCollectorGame extends GameEngine {
  private collectFlashes: { x: number; y: number; t: number }[] = [];
  private scorePopups: { x: number; y: number; text: string; t: number; vy: number }[] = [];
  private screenShake = 0;

  protected setupLevel(): void {
    const size = 30;
    this.scene.player = Scene.entity(this.width / 2 - size / 2, this.height / 2 - size / 2, size, size);

    const total = coinsForLevel(this.config, this.stats.level);
    this.stats.coinsTotal = total;
    this.stats.coins = 0;
    this.collectFlashes = [];
    this.scorePopups = [];
    this.screenShake = 0;

    // Generate intentional coin layout
    const positions = generateLayout(
      this.config.collectiblePattern,
      total,
      this.width,
      this.height,
      this.stats.level,
    );

    const w = 18;
    for (let i = 0; i < total && i < positions.length; i += 1) {
      const pos = positions[i]!;
      this.scene.coins.push(Scene.entity(pos.x, pos.y, w, w));
    }

    // Place obstacles that don't overlap coins
    const blockers = Math.min(8, Math.max(0, this.stats.level - 1) + (this.config.difficulty === "hard" ? 4 : this.config.difficulty === "easy" ? 1 : 2));
    for (let i = 0; i < blockers; i += 1) {
      const ow = 36 + hashNum(i * 73 + this.stats.level) * 70;
      const oh = 16 + hashNum(i * 89 + this.stats.level) * 20;
      let ox = hashNum(i * 97 + this.stats.level * 3) * Math.max(1, this.width - ow);
      let oy = hashNum(i * 101 + this.stats.level * 5) * Math.max(1, this.height - oh);

      // Avoid placing on top of coins
      let attempts = 0;
      while (attempts < 5 && this.overlapsCoins(ox, oy, ow, oh)) {
        ox = hashNum(i * 103 + attempts * 7 + this.stats.level) * Math.max(1, this.width - ow);
        oy = hashNum(i * 107 + attempts * 11 + this.stats.level) * Math.max(1, this.height - oh);
        attempts++;
      }

      this.scene.obstacles.push(Scene.entity(ox, oy, ow, oh));
    }
  }

  private overlapsCoins(x: number, y: number, w: number, h: number): boolean {
    for (const coin of this.scene.coins) {
      if (!coin.alive) continue;
      if (x < coin.x + coin.w + 10 && x + w + 10 > coin.x && y < coin.y + coin.h + 10 && y + h + 10 > coin.y) {
        return true;
      }
    }
    return false;
  }

  protected updateWorld(dt: number): void {
    const player = this.scene.player;
    if (!player) return;

    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 3);

    // Update collect flashes
    this.collectFlashes = this.collectFlashes.filter((f) => {
      f.t -= dt;
      return f.t > 0;
    });

    // Update score popups
    this.scorePopups = this.scorePopups.filter((p) => {
      p.y += p.vy * dt;
      p.t -= dt;
      return p.t > 0;
    });

    const axis = this.axis();
    const speed = speedFor(this.config);
    let speedMult = 1;
    if (this.stats.speedBoost) speedMult = 1.5;

    const dx = axis.x * speed * speedMult * dt;
    const dy = axis.y * speed * speedMult * dt;

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
        const gain = coinScore();
        const finalGain = this.stats.doubleScore ? gain * 2 : gain;
        this.stats.score += finalGain;

        // Visual feedback
        this.collectFlashes.push({ x: coin.x + coin.w / 2, y: coin.y + coin.h / 2, t: 0.3 });
        this.scorePopups.push({
          x: coin.x + coin.w / 2,
          y: coin.y,
          text: `+${finalGain}`,
          t: 0.6,
          vy: -30,
        });
      }
    }
    this.scene.coins = this.scene.coins.filter((coin) => coin.alive);

    if (this.stats.coins >= this.stats.coinsTotal) this.completeLevel();
  }

  protected renderWorld(): void {
    const ctx = this.ctx;

    if (this.screenShake > 0) {
      const shake = this.screenShake * 3;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    for (const obstacle of this.scene.obstacles) drawObstacle(ctx, obstacle, this.palette, this.config.obstacleType);
    for (const coin of this.scene.coins) drawCoin(ctx, coin, this.palette, this.elapsed * 4 + coin.x, this.config.collectibleType);
    if (this.scene.player) drawPlayer(ctx, this.scene.player, this.palette, false, this.config.character);

    // Collect flash bursts
    for (const f of this.collectFlashes) {
      ctx.save();
      ctx.globalAlpha = f.t * 2;
      ctx.fillStyle = this.palette.coin;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 6 + (1 - f.t / 0.3) * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Score popups
    for (const p of this.scorePopups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.t / 0.6);
      ctx.fillStyle = this.palette.hud;
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }

    if (this.screenShake > 0) ctx.restore();

    void RULES;
  }
}
