import type {
  BossType,
  CharacterType,
  CollectiblePattern,
  CollectibleType,
  Difficulty,
  EnemyType,
  GameType,
  SpawnPattern,
  Theme,
  WeaponType,
} from "./types";

/**
 * Rich, genre-independent description of a generated game.
 *
 * GameSpec sits above GameConfig: it describes player intent and gameplay
 * design, while GameConfig remains the compatibility layer used by the
 * existing templates and engine.
 */
export interface GameSpec {
  identity: {
    type: GameType;
    theme: Theme;
    difficulty: Difficulty;
    character: CharacterType;
  };

  objective: {
    type: "collect" | "survive" | "eliminate";
    target?: number;
  };

  player: {
    movement: {
      speed: number;
      acceleration: number;
      maxSpeed: number;
      friction: number;
      dash?: {
        enabled: boolean;
        speed: number;
        cooldown: number;
      };
    };
    health: number;
  };

  combat?: {
    weapon: WeaponType;
    damage: number;
    fireRate: number;
    projectileSpeed: number;
    spread: number;
    /** Higher precision means less weapon spread / more accurate shots. */
    precision: number;
  };

  enemies?: {
    types: EnemySpec[];
  };

  encounter: {
    spawnPattern: SpawnPattern;
    pacing: "slow" | "normal" | "fast";
    aggression: number;
    waves: number;
    progressionRate: number;
  };

  boss?: {
    enabled: boolean;
    type: BossType;
    health: number;
  };

  collectibles?: {
    type: CollectibleType;
    amount: number;
    pattern: CollectiblePattern;
  };

  seed: number;
}

export interface EnemySpec {
  type: EnemyType;
  behavior:
    | "chase"
    | "patrol"
    | "strafe"
    | "ranged"
    | "swarm"
    | "charge";
  health: number;
  speed: number;
  damage: number;
  attackCooldown: number;
}
