import type { SemanticResult } from "./SemanticMapper";
import type {
  CollectiblePattern,
  Difficulty,
  EncounterStyle,
  GameConfig,
  GameType,
  SpawnPattern,
} from "./types";
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
  enemyMix: [] as ("robot" | "alien" | "drone" | "monster")[],
  encounterStyle: "balanced" as const,
  spawnPattern: "grid" as const,
  aggression: 1,
  progressionRate: 1,
  collectiblePattern: "scatter" as const,
  immediateStart: true,
};

/** Deterministic hash for encounter style selection. */
function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Derive encounter style from prompt semantics. */
function deriveEncounterStyle(mapped: SemanticResult, seed: number): EncounterStyle {
  if (mapped.pacing === "fast") {
    const styles: EncounterStyle[] = ["rush", "aggressive", "side_pressure"];
    return styles[seed % styles.length]!;
  }
  if (mapped.intensity === "high") {
    const styles: EncounterStyle[] = ["aggressive", "elite", "mixed"];
    return styles[seed % styles.length]!;
  }
  if (mapped.difficulty === "easy") {
    return "balanced";
  }
  const styles: EncounterStyle[] = ["balanced", "mixed", "side_pressure", "aggressive"];
  return styles[seed % styles.length]!;
}

/** Derive spawn pattern from encounter style and enemy type. */
function deriveSpawnStyle(encounterStyle: EncounterStyle, enemyType: GameConfig["enemyType"], seed: number): SpawnPattern {
  if (encounterStyle === "rush") return "stream";
  if (encounterStyle === "side_pressure") return "spread";
  if (encounterStyle === "elite") return "cluster";
  if (enemyType === "drone") return "spread";
  if (enemyType === "monster") return "cluster";
  const patterns: SpawnPattern[] = ["grid", "wave", "spread"];
  return patterns[seed % patterns.length]!;
}

/** Derive collectible layout pattern from prompt. */
function deriveCollectiblePattern(mapped: SemanticResult, seed: number): CollectiblePattern {
  if (mapped.difficulty === "hard") {
    const patterns: CollectiblePattern[] = ["risk_reward", "trail", "cluster"];
    return patterns[seed % patterns.length]!;
  }
  if (mapped.difficulty === "easy") {
    return "scatter";
  }
  const patterns: CollectiblePattern[] = ["scatter", "cluster", "trail", "spread"];
  return patterns[seed % patterns.length]!;
}

/** Derive aggression from difficulty + pacing. */
function deriveAggression(mapped: SemanticResult): number {
  let base = 1;
  if (mapped.difficulty === "hard") base = 1.4;
  else if (mapped.difficulty === "easy") base = 0.7;
  if (mapped.pacing === "fast") base += 0.3;
  if (mapped.intensity === "high") base += 0.2;
  return Math.min(2, Math.max(0.5, base));
}

/** Derive progression rate from difficulty. */
function deriveProgressionRate(mapped: SemanticResult): number {
  if (mapped.difficulty === "hard") return 1.4;
  if (mapped.difficulty === "easy") return 0.7;
  return 1;
}

/** Derive enemy mix: dominant type + complementary variants. */
function deriveEnemyMix(mapped: SemanticResult): GameConfig["enemyMix"][] {
  if (mapped.allEnemyTypes.length <= 1) {
    // Single type: add complementary variants unless "only" was specified
    if (mapped.onlyEnemies) return [];
    const primary = mapped.enemyType ?? mapped.allEnemyTypes[0] ?? "robot";
    const allTypes: GameConfig["enemyType"][] = ["robot", "alien", "drone", "monster"];
    // Pick 1 complementary type based on a deterministic seed
    const complement = allTypes.filter((t) => t !== primary);
    return [complement[0]!, complement[2]!].slice(0, 1);
  }
  // Multiple types mentioned: use all, with the first as primary
  return mapped.allEnemyTypes.slice(1);
}

/** Derive boss type from enemy type. */
function deriveBossType(enemyType: GameConfig["enemyType"]): GameConfig["boss"]["type"] {
  switch (enemyType) {
    case "alien": return "alien_boss";
    case "monster": return "monster_king";
    case "drone": return "drone_lord";
    default: return "giant_robot";
  }
}

/** Derive boss health from difficulty. */
function deriveBossHealth(difficulty: Difficulty): number {
  if (difficulty === "hard") return 18;
  if (difficulty === "easy") return 8;
  return 12;
}

/** Derive default power-ups based on genre and difficulty. */
function deriveDefaultPowerUps(type: GameType, difficulty: Difficulty): GameConfig["powerUps"] {
  if (type === "shooter") {
    if (difficulty === "hard") return ["health", "shield"];
    if (difficulty === "easy") return ["health"];
    return ["health", "speed"];
  }
  if (type === "dodge") {
    if (difficulty === "hard") return ["shield", "speed"];
    return ["shield"];
  }
  return ["double_score", "speed"];
}

/** Builds a fully validated level configuration. Never produces NaN/Infinity/impossible levels. */
export function designLevel(mapped: SemanticResult): GameConfig {
  const type: GameType = GAME_TYPES.includes(mapped.type) ? mapped.type : "coin_collector";
  const difficulty: Difficulty = DIFFICULTIES.includes(mapped.difficulty) ? mapped.difficulty : "normal";
  const base = BASE[difficulty];

  // Handle enemy scope: if "total", distribute across waves; if "per_wave", use directly
  let enemies = safeInt(mapped.enemies ?? base.enemies, base.enemies, LIMITS.enemies.min, LIMITS.enemies.max);
  if (mapped.enemiesScope === "total" && mapped.enemies !== null) {
    const waves = base.waves;
    enemies = Math.max(LIMITS.enemies.min, Math.round(enemies / waves));
  }

  const seed = hashString(JSON.stringify({ type, theme: mapped.theme, difficulty, weapon: mapped.weapon, enemyType: mapped.enemyType, pacing: mapped.pacing }));

  const encounterStyle = deriveEncounterStyle(mapped, seed);
  const spawnPattern = deriveSpawnStyle(encounterStyle, mapped.enemyType ?? "robot", seed >> 2);
  const aggression = deriveAggression(mapped);
  const progressionRate = deriveProgressionRate(mapped);
  const collectiblePattern = deriveCollectiblePattern(mapped, seed >> 3);
  const enemyMix = deriveEnemyMix(mapped) as GameConfig["enemyMix"];
  const bossType = deriveBossType(mapped.enemyType ?? "robot");
  const bossHealth = deriveBossHealth(difficulty);

  // Default power-ups if user didn't specify any
  const powerUps = mapped.powerUps ?? deriveDefaultPowerUps(type, difficulty);

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
    enemyMix,
    powerUps,
    boss: {
      enabled: mapped.bossEnabled ?? DEFAULTS.boss.enabled,
      type: bossType,
      health: bossHealth,
    },
    encounterStyle,
    spawnPattern,
    aggression,
    progressionRate,
    collectiblePattern,
    immediateStart: true,
  };
}

/** Re-validates any config coming from the database or the editor. Migrates missing fields. */
export function sanitizeConfig(input: unknown): GameConfig {
  const raw = (input ?? {}) as Partial<GameConfig>;
  const type: GameType = GAME_TYPES.includes(raw.type as GameType) ? (raw.type as GameType) : "coin_collector";
  const difficulty: Difficulty = DIFFICULTIES.includes(raw.difficulty as Difficulty)
    ? (raw.difficulty as Difficulty)
    : "normal";
  const base = BASE[difficulty];
  const speed = typeof raw.playerSpeed === "number" && Number.isFinite(raw.playerSpeed) ? raw.playerSpeed : base.playerSpeed;

  // Migrate old boss.type values to new ones
  let bossType: GameConfig["boss"]["type"] = DEFAULTS.boss.type;
  if (raw.boss && typeof raw.boss === "object") {
    const rawType = (raw.boss as { type?: string }).type;
    if (rawType && ["giant_robot", "alien_boss", "monster_king", "drone_lord"].includes(rawType)) {
      bossType = rawType as GameConfig["boss"]["type"];
    }
  }

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
    enemyMix: Array.isArray(raw.enemyMix)
      ? (raw.enemyMix.filter((t): t is GameConfig["enemyMix"][number] =>
          ["robot", "alien", "drone", "monster"].includes(t as string)) as GameConfig["enemyMix"])
      : DEFAULTS.enemyMix,
    powerUps: Array.isArray(raw.powerUps) && raw.powerUps.every((p): p is "health" | "shield" | "speed" | "double_score" =>
      ["health", "shield", "speed", "double_score"].includes(p))
      ? raw.powerUps
      : DEFAULTS.powerUps,
    boss: typeof raw.boss === "object" && raw.boss !== null
      ? {
          enabled: typeof raw.boss.enabled === "boolean" ? raw.boss.enabled : DEFAULTS.boss.enabled,
          type: bossType,
          health: typeof raw.boss.health === "number" && Number.isFinite(raw.boss.health)
            ? Math.max(1, Math.min(30, raw.boss.health))
            : DEFAULTS.boss.health,
        }
      : DEFAULTS.boss,
    // Derived fields - migrate gracefully
    encounterStyle: ["balanced", "aggressive", "side_pressure", "mixed", "elite", "rush"].includes(raw.encounterStyle as string)
      ? (raw.encounterStyle as EncounterStyle)
      : DEFAULTS.encounterStyle,
    spawnPattern: ["grid", "wave", "stream", "spread", "cluster"].includes(raw.spawnPattern as string)
      ? (raw.spawnPattern as SpawnPattern)
      : DEFAULTS.spawnPattern,
    aggression: typeof raw.aggression === "number" && Number.isFinite(raw.aggression)
      ? Math.min(2, Math.max(0.5, raw.aggression))
      : DEFAULTS.aggression,
    progressionRate: typeof raw.progressionRate === "number" && Number.isFinite(raw.progressionRate)
      ? Math.min(2, Math.max(0.5, raw.progressionRate))
      : DEFAULTS.progressionRate,
    collectiblePattern: ["scatter", "cluster", "trail", "risk_reward", "spread"].includes(raw.collectiblePattern as string)
      ? (raw.collectiblePattern as CollectiblePattern)
      : DEFAULTS.collectiblePattern,
    immediateStart: typeof raw.immediateStart === "boolean" ? raw.immediateStart : DEFAULTS.immediateStart,
  };
}
