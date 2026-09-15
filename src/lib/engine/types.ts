export type GameType = "coin_collector" | "dodge" | "shooter";
export type Theme = "forest" | "space" | "city" | "desert" | "ice";
export type Difficulty = "easy" | "normal" | "hard";

export const GAME_TYPES: GameType[] = ["coin_collector", "dodge", "shooter"];
export const THEMES: Theme[] = ["forest", "space", "city", "desert", "ice"];
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

export type WeaponType = "blaster" | "pistol" | "shotgun" | "rifle";
export type CharacterType = "astronaut" | "ninja" | "soldier" | "robot";
export type CollectibleType = "coin" | "gem" | "crystal";
export type ObstacleType = "rock" | "spike" | "meteor" | "barrier";
export type EnemyType = "robot" | "alien" | "drone" | "monster";
export type PowerUpType = "health" | "shield" | "speed" | "double_score";
export type BossType = "giant_robot" | "alien_boss" | "monster_king" | "drone_lord";

/** Encounter / spawn pattern descriptors (derived, not user-facing). */
export type EncounterStyle =
  | "balanced"
  | "aggressive"
  | "side_pressure"
  | "mixed"
  | "elite"
  | "rush";

export type SpawnPattern = "grid" | "wave" | "stream" | "spread" | "cluster";
export type CollectiblePattern = "scatter" | "cluster" | "trail" | "risk_reward" | "spread";

/** Rich intent retained on GameConfig so templates can adopt GameSpec incrementally. */
export interface GameIntent {
  combat?: {
    weapon: WeaponType;
    damage: number;
    fireRate: number;
    projectileSpeed: number;
    spread: number;
    precision: number;
  };
  enemies: Array<{
    type: EnemyType;
    behavior: "chase" | "patrol" | "strafe" | "ranged" | "swarm" | "charge";
    health: number;
    speed: number;
    damage: number;
    attackCooldown: number;
  }>;
  pacing: "slow" | "normal" | "fast";
  aggression: number;
  seed: number;
}

/** Structured, serialisable game description. Games are rebuilt from template + config. */
export interface GameConfig {
  // ── Core Game Identity (what the game IS) ──
  type: GameType;
  theme: Theme;
  difficulty: Difficulty;
  /** Character type for visual representation. */
  character: CharacterType;

  // ── Gameplay Parameters (how the game PLAYS) ──
  /** Player tuning (0.6 - 1.6 speed factor). */
  playerSpeed: number;
  /** Coin Collector / Shooter reward count. */
  coins: number;
  /** Shooter enemy count per wave. */
  enemies: number;
  /** Dodge obstacle density. */
  obstacles: number;
  /** Dodge obstacle speed multiplier (0.5 - 2.0). */
  obstacleSpeed: number;
  levels: number;
  waves: number;

  // ── Genre-Specific Identity ──
  /** Weapon for Shooter (disabled by default for Collector/Dodge). */
  weapon: WeaponType;
  /** Collectible type for Coin Collector. */
  collectibleType: CollectibleType;
  /** Obstacle type for Dodge. */
  obstacleType: ObstacleType;
  /** Primary enemy type for Shooter. */
  enemyType: EnemyType;
  /** Secondary enemy types for composition variety. Empty = single type. */
  enemyMix: EnemyType[];
  /** Power-ups enabled. */
  powerUps: PowerUpType[];
  /** Boss configuration. */
  boss: {
    enabled: boolean;
    type: BossType;
    health: number;
  };

  // ── Derived gameplay parameters (not exposed in UI, set by LevelDesignEngine) ──
  /** How encounters are structured in the shooter. */
  encounterStyle: EncounterStyle;
  /** How enemies spawn spatially. */
  spawnPattern: SpawnPattern;
  /** Enemy aggression multiplier (0.5 - 2.0). */
  aggression: number;
  /** How quickly difficulty ramps between waves/levels (0.5 - 2.0). */
  progressionRate: number;
  /** How collectibles are arranged in Coin Collector. */
  collectiblePattern: CollectiblePattern;
  /** Whether the game starts with immediate action. */
  immediateStart: boolean;

  /** Rich prompt-derived intent used by templates for behaviour and combat. */
  gameIntent?: GameIntent;

  // ── Determinism Seed ──
  /** Seed for deterministic generation (derived from prompt + identity). */
  seed?: number;
}

export type GameStatus = "ready" | "playing" | "paused" | "game_over" | "level_complete" | "completed";
export type ObjectiveState = "pending" | "active" | "completed" | "failed";

export interface GameStats {
  score: number;
  coins: number;
  coinsTotal: number;
  level: number;
  levels: number;
  lives: number;
  wave: number;
  waves: number;
  objectiveState: ObjectiveState;
  shielded: boolean;
  shieldTimer: number;
  speedBoost: boolean;
  speedTimer: number;
  doubleScore: boolean;
  doubleScoreTimer: number;
  xp: number;
  time: number;
  objectiveKey: string;
}

export interface GameHooks {
  onStatus?: (status: GameStatus) => void;
  onStats?: (stats: GameStats) => void;
}

export interface Entity {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  alive: boolean;
  hp?: number;
  cooldown?: number;
  damage?: number;
  powerUpType?: PowerUpType;
  /** Visual variant index for enemy composition. */
  variant?: number;
  /** Whether this entity should render with a specific enemy type. */
  enemyKind?: EnemyType;
  /** Hit flash timer for feedback. */
  hitFlash?: number;
  /** Spawn delay (seconds before the entity becomes active). */
  spawnDelay?: number;
}
