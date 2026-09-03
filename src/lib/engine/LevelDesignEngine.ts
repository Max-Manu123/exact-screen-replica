import type { SemanticResult } from "./SemanticMapper";
import type { Difficulty, GameConfig, GameType } from "./types";
import { DIFFICULTIES, GAME_TYPES, THEMES } from "./types";

export const LIMITS = {
  coins: { min: 3, max: 40 },
  enemies: { min: 2, max: 24 },
  obstacles: { min: 2, max: 20 },
  levels: { min: 1, max: 5 },
  waves: { min: 1, max: 5 },
} as const;

function safeInt(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

const BASE: Record<Difficulty, { coins: number; enemies: number; obstacles: number; levels: number; waves: number; playerSpeed: number }> = {
  easy: { coins: 8, enemies: 4, obstacles: 4, levels: 2, waves: 2, playerSpeed: 1.15 },
  normal: { coins: 12, enemies: 6, obstacles: 7, levels: 3, waves: 3, playerSpeed: 1 },
  hard: { coins: 18, enemies: 9, obstacles: 11, levels: 4, waves: 4, playerSpeed: 0.9 },
};

/** Builds a fully validated level configuration. Never produces NaN/Infinity/impossible levels. */
export function designLevel(mapped: SemanticResult): GameConfig {
  const type: GameType = GAME_TYPES.includes(mapped.type) ? mapped.type : "coin_collector";
  const difficulty: Difficulty = DIFFICULTIES.includes(mapped.difficulty) ? mapped.difficulty : "normal";
  const base = BASE[difficulty];

  return {
    type,
    theme: THEMES.includes(mapped.theme) ? mapped.theme : "forest",
    difficulty,
    playerSpeed: base.playerSpeed,
    coins: safeInt(mapped.coins ?? base.coins, base.coins, LIMITS.coins.min, LIMITS.coins.max),
    enemies: safeInt(mapped.enemies ?? base.enemies, base.enemies, LIMITS.enemies.min, LIMITS.enemies.max),
    obstacles: safeInt(mapped.obstacles ?? base.obstacles, base.obstacles, LIMITS.obstacles.min, LIMITS.obstacles.max),
    levels: safeInt(base.levels, base.levels, LIMITS.levels.min, LIMITS.levels.max),
    waves: safeInt(base.waves, base.waves, LIMITS.waves.min, LIMITS.waves.max),
    weapon: "blaster",
  };
}

/** Re-validates any config coming from the database or the editor. */
export function sanitizeConfig(input: unknown): GameConfig {
  const raw = (input ?? {}) as Partial<GameConfig>;
  const type: GameType = GAME_TYPES.includes(raw.type as GameType) ? (raw.type as GameType) : "coin_collector";
  const difficulty: Difficulty = DIFFICULTIES.includes(raw.difficulty as Difficulty)
    ? (raw.difficulty as Difficulty)
    : "normal";
  const base = BASE[difficulty];
  const speed = typeof raw.playerSpeed === "number" && Number.isFinite(raw.playerSpeed) ? raw.playerSpeed : base.playerSpeed;

  return {
    type,
    theme: THEMES.includes(raw.theme as never) ? (raw.theme as GameConfig["theme"]) : "forest",
    difficulty,
    playerSpeed: Math.min(1.6, Math.max(0.6, speed)),
    coins: safeInt(raw.coins, base.coins, LIMITS.coins.min, LIMITS.coins.max),
    enemies: safeInt(raw.enemies, base.enemies, LIMITS.enemies.min, LIMITS.enemies.max),
    obstacles: safeInt(raw.obstacles, base.obstacles, LIMITS.obstacles.min, LIMITS.obstacles.max),
    levels: safeInt(raw.levels, base.levels, LIMITS.levels.min, LIMITS.levels.max),
    waves: safeInt(raw.waves, base.waves, LIMITS.waves.min, LIMITS.waves.max),
    weapon: "blaster",
  };
}
