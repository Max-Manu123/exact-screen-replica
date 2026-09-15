import type { GameSpec } from "./GameSpec";
import type { GameConfig, SpawnPattern } from "./types";

/**
 * Compatibility adapter between the richer GameSpec layer and the existing
 * GameConfig consumed by the templates.
 *
 * The legacy config remains the compatibility layer, but important intent
 * now changes real shooter parameters instead of being stored as metadata only.
 */
export function gameSpecToConfig(spec: GameSpec, legacy: GameConfig): GameConfig {
  const enemyTypes = spec.enemies?.types ?? [];
  const primaryEnemy = enemyTypes[0]?.type ?? legacy.enemyType;
  const enemyMix = enemyTypes.slice(1).map((enemy) => enemy.type);
  const behaviorPattern = patternForBehaviors(enemyTypes);
  const pacingPattern = patternForPacing(spec.encounter.pacing);
  const spawnPattern = behaviorPattern ?? pacingPattern ?? spec.encounter.spawnPattern;
  const combat = spec.combat;
  const isSniper = combat?.weapon === "rifle" && combat.precision >= 0.95;
  const aggression = clamp(
    spec.encounter.aggression * (isSniper ? 0.78 : combat?.weapon === "shotgun" ? 1.08 : 1),
    0.5,
    2,
  );

  return {
    ...legacy,
    type: spec.identity.type,
    theme: spec.identity.theme,
    difficulty: spec.identity.difficulty,
    character: spec.identity.character,
    playerSpeed: clamp(spec.player.movement.speed * (isSniper ? 0.96 : 1), 0.6, 1.6),
    coins: spec.objective.target ?? legacy.coins,
    enemies: isSniper ? Math.max(3, legacy.enemies - 1) : legacy.enemies,
    weapon: combat?.weapon ?? legacy.weapon,
    enemyType: primaryEnemy,
    enemyMix,
    waves: spec.encounter.waves,
    boss: spec.boss
      ? { enabled: spec.boss.enabled, type: spec.boss.type, health: spec.boss.health }
      : legacy.boss,
    spawnPattern,
    encounterStyle: encounterStyleFor(enemyTypes, spec.encounter.pacing, legacy.encounterStyle),
    aggression,
    progressionRate: clamp(spec.encounter.progressionRate * (isSniper ? 0.85 : 1), 0.5, 2),
    gameIntent: {
      combat: spec.combat,
      enemies: enemyTypes,
      pacing: spec.encounter.pacing,
      aggression: spec.encounter.aggression,
      seed: spec.seed,
    },
    seed: spec.seed,
  };
}

function patternForBehaviors(enemies: NonNullable<GameSpec["enemies"]>["types"]): SpawnPattern | undefined {
  const behaviors = enemies.map((enemy) => enemy.behavior);
  if (behaviors.includes("swarm")) return "stream";
  if (behaviors.includes("charge")) return "spread";
  if (behaviors.includes("ranged")) return "cluster";
  if (behaviors.includes("strafe")) return "wave";
  return undefined;
}

function patternForPacing(pacing: GameSpec["encounter"]["pacing"]): SpawnPattern | undefined {
  if (pacing === "fast") return "stream";
  if (pacing === "slow") return "cluster";
  return undefined;
}

function encounterStyleFor(
  enemies: NonNullable<GameSpec["enemies"]>["types"],
  pacing: GameSpec["encounter"]["pacing"],
  fallback: GameConfig["encounterStyle"],
): GameConfig["encounterStyle"] {
  const behaviors = enemies.map((enemy) => enemy.behavior);
  if (behaviors.includes("swarm")) return "rush";
  if (behaviors.includes("charge")) return "aggressive";
  if (behaviors.includes("ranged")) return "elite";
  if (behaviors.includes("strafe")) return "mixed";
  if (pacing === "fast") return "rush";
  if (pacing === "slow") return "elite";
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
