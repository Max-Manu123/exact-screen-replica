import type { Difficulty, Entity, GameConfig, GameType } from "./types";

/** Central place for scoring, difficulty scaling, collisions and win/lose rules. */
export const DIFFICULTY_FACTOR: Record<Difficulty, number> = {
  easy: 0.8,
  normal: 1,
  hard: 1.25,
};

export const OBJECTIVE_KEY: Record<GameType, string> = {
  coin_collector: "game.objectiveCoin",
  dodge: "game.objectiveDodge",
  shooter: "game.objectiveShooter",
};

export const RULES = {
  coinScore: 10,
  enemyScore: 25,
  enemyXp: 12,
  enemyCoin: 1,
  levelBonus: 50,
  survivalScorePerSecond: 10,
  playerBaseSpeed: 260,
  bulletSpeed: 520,
  fireCooldown: 0.22,
};

export function speedFor(config: GameConfig): number {
  return RULES.playerBaseSpeed * config.playerSpeed;
}

export function difficultyFactor(config: GameConfig): number {
  return DIFFICULTY_FACTOR[config.difficulty] ?? 1;
}

/** Difficulty ramp used by Dodge and Shooter: grows with level and elapsed time. */
export function progression(config: GameConfig, level: number, elapsed: number): number {
  const levelStep = 0.18 * Math.max(0, level - 1);
  const timeStep = Math.min(1.2, elapsed / 25);
  return difficultyFactor(config) * (1 + levelStep + timeStep);
}

export function rectsOverlap(a: Entity, b: Entity): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function coinScore(): number {
  return RULES.coinScore;
}

export function enemyReward(): { score: number; xp: number; coins: number } {
  return { score: RULES.enemyScore, xp: RULES.enemyXp, coins: RULES.enemyCoin };
}

export function coinsForLevel(config: GameConfig, level: number): number {
  return Math.min(40, config.coins + Math.max(0, level - 1) * 2);
}

export function enemiesForWave(config: GameConfig, wave: number): number {
  return Math.min(24, config.enemies + Math.max(0, wave - 1) * 2);
}
