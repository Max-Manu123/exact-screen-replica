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

const BASE: Record<Difficulty, { coins: number; enemies: number; obstacles: number; levels: number; waves: number; playerSpeed: number; obstacleSpeed: number }> = {
  easy: { coins: 8, enemies: 4, obstacles: 4, levels: 2, waves: 2, playerSpeed: 1.15, obstacleSpeed: 0.8 },
  normal: { coins: 12, enemies: 6, obstacles: 7, levels: 3, waves: 3, playerSpeed: 1, obstacleSpeed: 1 },
  hard: { coins: 18, enemies: 9, obstacles: 11, levels: 4, waves: 4, playerSpeed: 0.9, obstacleSpeed: 1.3 },
};

const DEFAULTS = {
  character: "astronaut" as const,
  collectibleType: "coin" as const,
  obstacleType: "rock" as const,
  enemyType: "robot" as const,
  weapon: "blaster" as const,
  powerUps: [] as ("health" | "shield" | "speed" | "double_score")[],
  boss: { enabled: false, type: "giant_robot" as const, health: 10 },
};

const WEAPON_STATS: Record<GameConfig["weapon"], { cooldown: number; bulletSpeed: number; damage: number; spread?: number }> = {
  blaster: { cooldown: 0.25, bulletSpeed: 400, damage: 1 },
  pistol: { cooldown: 0.4, bulletSpeed: 350, damage: 2 },
  shotgun: { cooldown: 0.6, bulletSpeed: 300, damage: 1, spread: 3 },
  rifle: { cooldown: 0.15, bulletSpeed: 450, damage: 0.8 },
};

/** Builds a fully validated level configuration. Never produces NaN/Infinity/impossible levels. */
export function designLevel(mapped: SemanticResult): GameConfig {
  const type: GameType = GAME_TYPES.includes(mapped.type) ? mapped.type : "coin_collector";
  const difficulty: Difficulty = DIFFICULTIES.includes(mapped.difficulty) ? mapped.difficulty : "normal";
  const base = BASE[difficulty];

  // Handle enemy scope: if "total", distribute across waves; if "per_wave", use directly
  let enemies = safeInt(mapped.enemies ?? base.enemies, base.enemies, LIMITS.enemies.min, LIMITS.enemies.max);
  if (mapped.enemiesScope === "total" && mapped.enemies !== null) {
    // Distribute total enemies across waves
    enemies = Math.max(1, Math.round(enemies / base.waves));
  }

  return {
    type,
    theme: THEMES.includes(mapped.theme) ? mapped.theme : "forest",
    difficulty,
    playerSpeed: base.playerSpeed,
    coins: safeInt(mapped.coins ?? base.coins, base.coins, LIMITS.coins.min, LIMITS.coins.max),
    enemies,
    obstacles: safeInt(mapped.obstacles ?? base.obstacles, base.obstacles, LIMITS.obstacles.min, LIMITS.obstacles.max),
    levels: safeInt(base.levels, base.levels, LIMITS.levels.min, LIMITS.levels.max),
    waves: safeInt(base.waves, base.waves, LIMITS.waves.min, LIMITS.waves.max),
    weapon: mapped.weapon ?? DEFAULTS.weapon,
    obstacleSpeed: base.obstacleSpeed,
    character: mapped.character ?? DEFAULTS.character,
    collectibleType: mapped.collectibleType ?? DEFAULTS.collectibleType,
    obstacleType: mapped.obstacleType ?? DEFAULTS.obstacleType,
    enemyType: mapped.enemyType ?? DEFAULTS.enemyType,
    powerUps: mapped.powerUps ?? DEFAULTS.powerUps,
    boss: {
      enabled: mapped.bossEnabled ?? DEFAULTS.boss.enabled,
      type: DEFAULTS.boss.type,
      health: DEFAULTS.boss.health,
    },
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
    weapon: ["blaster", "pistol", "shotgun", "rifle"].includes(raw.weapon as string)
      ? (raw.weapon as GameConfig["weapon"])
      : DEFAULTS.weapon,
    obstacleSpeed: typeof raw.obstacleSpeed === "number" && Number.isFinite(raw.obstacleSpeed) 
      ? Math.min(2, Math.max(0.5, raw.obstacleSpeed)) 
      : base.obstacleSpeed,
    character: ["astronaut", "ninja", "soldier", "robot"].includes(raw.character as string) 
      ? (raw.character as GameConfig["character"]) 
      : DEFAULTS.character,
    collectibleType: ["coin", "gem", "crystal"].includes(raw.collectibleType as string)
      ? (raw.collectibleType as GameConfig["collectibleType"])
      : DEFAULTS.collectibleType,
    obstacleType: ["rock", "spike", "meteor", "barrier"].includes(raw.obstacleType as string)
      ? (raw.obstacleType as GameConfig["obstacleType"])
      : DEFAULTS.obstacleType,
    enemyType: ["robot", "alien", "drone", "monster"].includes(raw.enemyType as string)
      ? (raw.enemyType as GameConfig["enemyType"])
      : DEFAULTS.enemyType,
    powerUps: Array.isArray(raw.powerUps) && raw.powerUps.every((p): p is "health" | "shield" | "speed" | "double_score" => 
      ["health", "shield", "speed", "double_score"].includes(p)
    ) ? raw.powerUps : DEFAULTS.powerUps,
    boss: typeof raw.boss === "object" && raw.boss !== null
      ? {
          enabled: typeof raw.boss.enabled === "boolean" ? raw.boss.enabled : DEFAULTS.boss.enabled,
          type: ["giant_robot", "alien_boss"].includes(raw.boss.type as string) 
            ? (raw.boss.type as GameConfig["boss"]["type"]) 
            : DEFAULTS.boss.type,
          health: typeof raw.boss.health === "number" && Number.isFinite(raw.boss.health) 
            ? Math.max(1, raw.boss.health) 
            : DEFAULTS.boss.health,
        }
      : DEFAULTS.boss,
  };
}
