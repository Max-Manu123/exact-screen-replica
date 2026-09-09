import { drawObstacle, drawPlayer } from "../AssetGenerator";
import { GameEngine } from "../GameEngine";
import { RULES, progression, rectsOverlap, speedFor } from "../GameRulesEngine";
import { Scene } from "../Scene";
import type { Entity } from "../types";

/** Lane-based obstacle spawning for fairness. */
const LANES = 5;

function laneX(lane: number, width: number, obstacleW: number): number {
  const laneWidth = width / LANES;
  return lane * laneWidth + (laneWidth - obstacleW) / 2;
}

/** Pattern types for obstacle formation variety. */
type ObstaclePattern = "single" | "pair" | "wall_gap" | "zigzag" | "rain";

function pickPattern(wave: number, seed: number): ObstaclePattern {
  const patterns: ObstaclePattern[] = ["single", "pair", "wall_gap", "zigzag", "rain"];
  // Early game: simpler patterns
  if (wave <= 1) return patterns[seed % 2]!;
  if (wave <= 2) return patterns[seed % 3]!;
  return patterns[seed % patterns.length]!;
}

/** Falling-obstacle survival: difficulty ramps up with time and level. */
export class DodgeGame extends GameEngine {
  private spawnTimer = 0;
  private levelTarget = 0;
  private levelStart = 0;
  private screenShake = 0;
  private recentLanes: number[] = [];
  private patternSeed = 0;

  protected setupLevel(): void {
    const size = 30;
    this.scene.player = Scene.entity(this.width / 2 - size / 2, this.height - size - 18, size, size);
    this.spawnTimer = 0.3; // First obstacle very quickly for immediate action
    this.stats.coinsTotal = 0;
    this.levelTarget = 12 + this.stats.level * 6;
    this.levelStart = this.elapsed;
    this.screenShake = 0;
    this.recentLanes = [];
    this.patternSeed = Math.floor(this.elapsed * 7) + this.stats.level * 13;
  }

  private spawnObstacle() {
    const ramp = progression(this.config, this.stats.level, this.elapsed - this.levelStart);
    const pattern = pickPattern(this.stats.level, this.patternSeed);
    this.patternSeed += 1;

    const baseSpeed = (140 + Math.random() * 90) * ramp * this.config.obstacleSpeed;
    const w = 22 + Math.random() * 46;

    switch (pattern) {
      case "single": {
        // One obstacle in a random lane, avoiding recent lanes
        const lane = this.pickSafeLane();
        const obstacle = Scene.entity(laneX(lane, this.width, w), -40, w, 18);
        obstacle.vy = baseSpeed;
        this.scene.obstacles.push(obstacle);
        this.recentLanes.push(lane);
        if (this.recentLanes.length > 2) this.recentLanes.shift();
        break;
      }
      case "pair": {
        // Two obstacles, always leaving at least 2 lanes open
        const lane1 = this.pickSafeLane();
        let lane2 = this.pickSafeLane();
        if (lane2 === lane1) lane2 = (lane2 + 2) % LANES;
        for (const lane of [lane1, lane2]) {
          const ow = 22 + Math.random() * 30;
          const obstacle = Scene.entity(laneX(lane, this.width, ow), -40, ow, 18);
          obstacle.vy = baseSpeed;
          this.scene.obstacles.push(obstacle);
        }
        this.recentLanes = [lane1, lane2];
        break;
      }
      case "wall_gap": {
        // Wall with a gap - 3-4 lanes blocked, 1-2 open
        const gapLane = Math.floor(Math.random() * LANES);
        const gapLane2 = (gapLane + 2 + Math.floor(Math.random() * 2)) % LANES;
        for (let lane = 0; lane < LANES; lane++) {
          if (lane === gapLane || lane === gapLane2) continue;
          const ow = this.width / LANES - 4;
          const obstacle = Scene.entity(laneX(lane, this.width, ow), -40, ow, 18);
          obstacle.vy = baseSpeed * 0.8; // Slower wall so player can react
          this.scene.obstacles.push(obstacle);
        }
        this.recentLanes = [gapLane];
        break;
      }
      case "zigzag": {
        // Alternating single obstacles in a zigzag
        const lane = this.patternSeed % LANES;
        const obstacle = Scene.entity(laneX(lane, this.width, w), -40, w, 18);
        obstacle.vy = baseSpeed * 1.1;
        obstacle.vx = (lane < LANES / 2 ? 1 : -1) * 30 * ramp;
        this.scene.obstacles.push(obstacle);
        this.recentLanes = [lane];
        break;
      }
      case "rain": {
        // Multiple obstacles spread across lanes (but never all lanes)
        const count = Math.min(3, Math.ceil(this.config.obstacles / 4));
        const usedLanes = new Set<number>();
        for (let i = 0; i < count; i++) {
          let lane = Math.floor(Math.random() * LANES);
          let attempts = 0;
          while (usedLanes.has(lane) && attempts < 3) {
            lane = (lane + 1) % LANES;
            attempts++;
          }
          usedLanes.add(lane);
          const ow = 22 + Math.random() * 30;
          const obstacle = Scene.entity(laneX(lane, this.width, ow), -40 - i * 60, ow, 18);
          obstacle.vy = baseSpeed;
          this.scene.obstacles.push(obstacle);
        }
        this.recentLanes = Array.from(usedLanes);
        break;
      }
    }
  }

  /** Pick a lane that doesn't completely block the player. */
  private pickSafeLane(): number {
    let lane = Math.floor(Math.random() * LANES);
    // Avoid blocking the same lanes repeatedly
    if (this.recentLanes.length >= 2) {
      let attempts = 0;
      while (this.recentLanes.includes(lane) && attempts < 4) {
        lane = (lane + 1) % LANES;
        attempts++;
      }
    }
    return lane;
  }

  protected updateWorld(dt: number): void {
    const player = this.scene.player;
    if (!player) return;

    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 3);

    const ramp = progression(this.config, this.stats.level, this.elapsed - this.levelStart);
    const speed = speedFor(this.config);
    let speedMult = 1;
    if (this.stats.speedBoost) speedMult = 1.5;

    const axis = this.axis();
    player.x += axis.x * speed * speedMult * dt;
    player.y += axis.y * speed * 0.6 * dt;
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

    // Spawn obstacles
    const spawnInterval = Math.max(0.18, 0.95 / (ramp * (0.6 + this.config.obstacles / 12)));
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnInterval;
      this.spawnObstacle();
    }

    for (const obstacle of this.scene.obstacles) {
      obstacle.x += (obstacle.vx ?? 0) * dt;
      obstacle.y += obstacle.vy * dt;
      if (obstacle.y > this.height + 40) {
        obstacle.alive = false;
        this.stats.score += 5;
      } else if (rectsOverlap(player, obstacle)) {
        if (this.stats.shielded) {
          this.stats.shielded = false;
          this.stats.shieldTimer = 0;
          obstacle.alive = false;
          this.screenShake = 0.15;
        } else {
          this.gameOver();
          return;
        }
      }
    }
    this.scene.obstacles = this.scene.obstacles.filter((obstacle) => obstacle.alive);

    this.stats.score += RULES.survivalScorePerSecond * dt;
    this.stats.score = Math.round(this.stats.score);

    if (this.elapsed - this.levelStart >= this.levelTarget) this.completeLevel();
  }

  protected renderWorld(): void {
    const ctx = this.ctx;

    if (this.screenShake > 0) {
      const shake = this.screenShake * 4;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    for (const obstacle of this.scene.obstacles) drawObstacle(ctx, obstacle, this.palette, this.config.obstacleType);
    if (this.scene.player) drawPlayer(ctx, this.scene.player, this.palette, false, this.config.character);

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

    if (this.screenShake > 0) ctx.restore();

    // Survival timer
    const remaining = Math.max(0, this.levelTarget - (this.elapsed - this.levelStart));
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = this.palette.hud;
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillText(`${Math.ceil(remaining)}s`, this.width - 44, 22);
    ctx.restore();
  }
}
