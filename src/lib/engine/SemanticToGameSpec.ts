import type { SemanticResult } from "./SemanticMapper";
import type { EnemyType, GameType } from "./types";
import type { EnemySpec, GameSpec } from "./GameSpec";

/**
 * Converts the existing semantic parser output into the richer GameSpec layer.
 *
 * This is intentionally an adapter: the existing SemanticMapper and GameConfig
 * pipeline remain untouched until GameSpec has been validated.
 */
export function semanticToGameSpec(result: SemanticResult, seed?: number): GameSpec {
  const resolvedSeed = seed ?? hashString(result.name);
  const character = result.character ?? defaultCharacter(result.type);
  const difficulty = result.difficulty;
  const pacing = result.pacing ?? (difficulty === "hard" ? "fast" : "normal");

  const enemies = result.allEnemyTypes.length > 0
    ? result.allEnemyTypes
    : result.enemyType
      ? [result.enemyType]
      : [];

  const enemySpecs = enemies.map((enemyType, index) =>
    createEnemySpec(enemyType, result, index),
  );

  return {
    identity: {
      type: result.type,
      theme: result.theme,
      difficulty,
      character,
    },

    objective: {
      type: objectiveFor(result.type),
      target: result.type === "coin_collector" ? result.coins ?? undefined : undefined,
    },

    player: {
      movement: movementFor(character, difficulty, result),
      health: difficulty === "hard" ? 2 : difficulty === "easy" ? 4 : 3,
    },

    combat: result.type === "shooter"
      ? combatFor(result)
      : undefined,

    enemies: enemySpecs.length > 0
      ? { types: enemySpecs }
      : undefined,

    encounter: {
      spawnPattern: spawnPatternFor(result),
      pacing,
      aggression: aggressionFor(result),
      waves: result.type === "shooter" ? 5 : 1,
      progressionRate: progressionFor(result),
    },

    boss: result.type === "shooter"
      ? {
          enabled: result.bossEnabled ?? false,
          type: bossFor(result),
          health: difficulty === "hard" ? 20 : difficulty === "easy" ? 12 : 16,
        }
      : undefined,

    collectibles: result.type === "coin_collector"
      ? {
          type: result.collectibleType ?? "coin",
          amount: result.coins ?? 20,
          pattern: result.pacing === "fast" ? "trail" : "scatter",
        }
      : undefined,

    seed: resolvedSeed,
  };
}

function defaultCharacter(type: GameType) {
  switch (type) {
    case "shooter":
      return "soldier" as const;
    case "dodge":
      return "ninja" as const;
    case "coin_collector":
      return "astronaut" as const;
  }
}

function objectiveFor(type: GameType): GameSpec["objective"]["type"] {
  switch (type) {
    case "coin_collector":
      return "collect";
    case "dodge":
      return "survive";
    case "shooter":
      return "eliminate";
  }
}

function movementFor(
  character: GameSpec["identity"]["character"],
  difficulty: GameSpec["identity"]["difficulty"],
  result: SemanticResult,
): GameSpec["player"]["movement"] {
  const characterSpeed = {
    astronaut: 1,
    ninja: 1.18,
    soldier: 1.05,
    robot: 0.92,
  }[character];

  const difficultySpeed = difficulty === "hard" ? 1.08 : difficulty === "easy" ? 0.94 : 1;
  const pacingSpeed = result.pacing === "fast" ? 1.1 : result.pacing === "slow" ? 0.9 : 1;
  const speed = characterSpeed * difficultySpeed * pacingSpeed;

  return {
    speed,
    acceleration: character === "ninja" ? 18 : 14,
    maxSpeed: 260 * speed,
    friction: character === "robot" ? 0.86 : 0.9,
    dash: character === "ninja"
      ? { enabled: true, speed: 520, cooldown: 1.5 }
      : { enabled: false, speed: 0, cooldown: 0 },
  };
}

function combatFor(result: SemanticResult): NonNullable<GameSpec["combat"]> {
  const weapon = result.weapon ?? "blaster";
  const stats = {
    blaster: { damage: 1, fireRate: 4, projectileSpeed: 400, spread: 0.03, precision: 0.9 },
    pistol: { damage: 2, fireRate: 2.5, projectileSpeed: 350, spread: 0.06, precision: 0.82 },
    shotgun: { damage: 1, fireRate: 1.5, projectileSpeed: 300, spread: 0.24, precision: 0.55 },
    rifle: { damage: 2.5, fireRate: 2, projectileSpeed: 500, spread: 0.025, precision: 0.96 },
  }[weapon];

  // "sniper" is already recognized as a rifle by SemanticMapper. Treat a
  // slow/tactical prompt as a precision profile without inventing a new weapon.
  const sniperProfile = weapon === "rifle" && result.pacing === "slow";

  return {
    weapon,
    damage: sniperProfile ? 4 : stats.damage,
    fireRate: sniperProfile ? 1 : stats.fireRate,
    projectileSpeed: sniperProfile ? 600 : stats.projectileSpeed,
    spread: sniperProfile ? 0.008 : stats.spread,
    precision: sniperProfile ? 0.99 : stats.precision,
  };
}

function createEnemySpec(
  type: EnemyType,
  result: SemanticResult,
  index: number,
): EnemySpec {
  const base = {
    robot: { behavior: "chase" as const, health: 1, speed: 1, damage: 1, attackCooldown: 1.2 },
    alien: { behavior: "swarm" as const, health: 1, speed: 1.2, damage: 1, attackCooldown: 1 },
    drone: { behavior: "ranged" as const, health: 0.5, speed: 1.5, damage: 1, attackCooldown: 2 },
    monster: { behavior: "charge" as const, health: 2, speed: 0.7, damage: 2, attackCooldown: 1.8 },
  }[type];

  const aggressive = result.intensity === "high" || result.difficulty === "hard";
  const speedMultiplier = aggressive ? 1.12 : 1;

  return {
    ...base,
    speed: base.speed * speedMultiplier,
    damage: base.damage * (aggressive ? 1.15 : 1),
    attackCooldown: Math.max(0.5, base.attackCooldown - index * 0.05),
  };
}

function spawnPatternFor(result: SemanticResult): GameSpec["encounter"]["spawnPattern"] {
  if (result.pacing === "fast") return "stream";
  if (result.allEnemyTypes.length >= 2) return "mixed";
  if (result.intensity === "high") return "wave";
  return "spread";
}

function aggressionFor(result: SemanticResult): number {
  if (result.intensity === "high") return 1.5;
  if (result.pacing === "fast") return 1.3;
  if (result.pacing === "slow") return 0.75;
  return 1;
}

function progressionFor(result: SemanticResult): number {
  if (result.difficulty === "hard") return 1.35;
  if (result.difficulty === "easy") return 0.75;
  return result.pacing === "fast" ? 1.2 : 1;
}

function bossFor(result: SemanticResult): GameSpec["boss"]["type"] {
  const primary = result.enemyType ?? result.allEnemyTypes[0];
  switch (primary) {
    case "robot":
      return "giant_robot";
    case "alien":
      return "alien_boss";
    case "monster":
      return "monster_king";
    case "drone":
      return "drone_lord";
    default:
      return "giant_robot";
  }
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}
