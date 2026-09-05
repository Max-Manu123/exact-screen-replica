export type GameType = "coin_collector" | "dodge" | "shooter";
export type Theme = "forest" | "space" | "city" | "desert" | "ice";
export type Difficulty = "easy" | "normal" | "hard";

export const GAME_TYPES: GameType[] = ["coin_collector", "dodge", "shooter"];
export const THEMES: Theme[] = ["forest", "space", "city", "desert", "ice"];
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

/** Structured, serialisable game description. Games are rebuilt from template + config. */
export interface GameConfig {
  type: GameType;
  theme: Theme;
  difficulty: Difficulty;
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
  weapon: "blaster";
  /** Character type for visual representation. */
  character: "astronaut" | "ninja" | "soldier" | "robot";
}

export type GameStatus = "ready" | "playing" | "paused" | "game_over" | "level_complete" | "completed";
export type ObjectiveState = "pending" | "active" | "completed" | "failed";

export interface GameStats {
  score: number;
  coins: number;
  coinsTotal: number;
  level: number;
  levels: number;
  wave: number;
  waves: number;
  xp: number;
  lives: number;
  time: number;
  objectiveKey: string;
  objectiveState: ObjectiveState;
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
}
