import type { GameSpec } from "./GameSpec";
import type { GameConfig } from "./types";

/**
 * Compatibility adapter between the richer GameSpec layer and the existing
 * GameConfig consumed by the templates.
 *
 * The legacy config is intentionally kept as the source of counts/limits so
 * existing generation behaviour remains stable while GameSpec starts driving
 * identity, combat, encounter design, and enemy intent.
 */
export function gameSpecToConfig(spec: GameSpec, legacy: GameConfig): GameConfig {
  const enemyTypes = spec.enemies?.types ?? [];
  const primaryEnemy = enemyTypes[0]?.type ?? legacy.enemyType;
  const enemyMix = enemyTypes.slice(1).map((enemy) => enemy.type);

  return {
    ...legacy,
    type: spec.identity.type,
    theme: spec.identity.theme,
    difficulty: spec.identity.difficulty,
    character: spec.identity.character,
    playerSpeed: clamp(spec.player.movement.speed, 0.6, 1.6),
    coins: spec.objective.target ?? legacy.coins,
    enemies: legacy.enemies,
    weapon: spec.combat?.weapon ?? legacy.weapon,
    enemyType: primaryEnemy,
    enemyMix,
    waves: spec.encounter.waves,
    boss: spec.boss
      ? {
          enabled: spec.boss.enabled,
          type: spec.boss.type,
          health: spec.boss.health,
        }
      : legacy.boss,
    spawnPattern: spec.encounter.spawnPattern,
    aggression: clamp(spec.encounter.aggression, 0.5, 2),
    progressionRate: clamp(spec.encounter.progressionRate, 0.5, 2),
    // Keep the richer intent attached to the config so templates can consume
    // it incrementally without another pipeline rewrite.
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
