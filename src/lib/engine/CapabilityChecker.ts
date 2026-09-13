import type { GameType, WeaponType, EnemyType, CharacterType, CollectibleType, ObstacleType, Theme } from "./types";

export type CapabilityStatus = "supported" | "adaptable" | "partial" | "unsupported";

export interface CapabilityCheck {
  status: CapabilityStatus;
  reason?: string;
  suggestion?: string;
}

/** Capability map for V1 - what we can fully support */
const CAPABILITIES = {
  genres: ["coin_collector", "dodge", "shooter"] as GameType[],
  weapons: ["blaster", "pistol", "shotgun", "rifle"] as WeaponType[],
  enemies: ["robot", "alien", "drone", "monster"] as EnemyType[],
  characters: ["astronaut", "ninja", "soldier", "robot"] as CharacterType[],
  collectibles: ["coin", "gem", "crystal"] as CollectibleType[],
  obstacles: ["rock", "spike", "meteor", "barrier"] as ObstacleType[],
  themes: ["forest", "space", "city", "desert", "ice"] as Theme[],
  mechanics: [
    "movement",
    "collection",
    "dodging",
    "shooting",
    "waves",
    "boss",
    "powerups",
    "obstacles",
    "exploration",
    "survival",
  ],
};

/** Unsupported genres that users might request */
const UNSUPPORTED_GENRES = [
  "platformer",
  "rpg",
  "racing",
  "tower defense",
  "beat em up",
  "fighting",
  "puzzle",
  "sports",
  "adventure",
  "survival shooter",
  "metroidvania",
  "sandbox",
  "simulation",
  "strategy",
  "rts",
  "moba",
  "battle royale",
];

/** Mechanics that are not supported in V1 */
const UNSUPPORTED_MECHANICS = [
  "multiplayer",
  "crafting",
  "trading",
  "inventory",
  "dialogue",
  "npcs",
  "quests",
  "skill tree",
  "leveling",
  "equipment",
  "parry",
  "stamina",
  "combo",
  "stealth",
  "hacking",
  "building",
  "farming",
  "cooking",
  "fishing",
  "driving",
  "flying",
  "swimming",
  "climbing",
  "parkour",
  "grappling",
  "teleportation",
  "time travel",
  "gravity manipulation",
  "physics puzzles",
  "portal mechanics",
  "cooperative",
  "competitive",
  "leaderboards",
  "marketplace",
  "economy",
  "currency trading",
];

/**
 * Check if a genre request is supported
 */
export function checkGenre(genre: string): CapabilityCheck {
  const normalized = genre.toLowerCase().trim();

  // Direct match
  if (CAPABILITIES.genres.includes(normalized as GameType)) {
    return { status: "supported" };
  }

  // Check for unsupported genres
  for (const unsupported of UNSUPPORTED_GENRES) {
    if (normalized.includes(unsupported) || unsupported.includes(normalized)) {
      return {
        status: "unsupported",
        reason: `"${genre}" is not available in V1. Supported genres: Coin Collector, Dodge, Shooter.`,
        suggestion: "Try describing the gameplay instead (e.g., 'collect coins', 'survive obstacles', 'shoot enemies').",
      };
    }
  }

  // Unknown genre - might be adaptable
  return {
    status: "adaptable",
    reason: `"${genre}" is not a predefined genre, but may be adaptable to one of the supported genres.`,
    suggestion: "The system will interpret your prompt to match the closest supported genre.",
  };
}

/**
 * Check if a character request is supported
 */
export function checkCharacter(character: string): CapabilityCheck {
  const normalized = character.toLowerCase().trim();

  // Direct match
  if (CAPABILITIES.characters.includes(normalized as CharacterType)) {
    return { status: "supported" };
  }

  // Unknown character - adaptable (we can represent it visually)
  return {
    status: "adaptable",
    reason: `"${character}" is not a predefined character type, but can be visually represented.`,
    suggestion: "The character will be adapted visually, but may not have specialized mechanics.",
  };
}

/**
 * Check if an enemy request is supported
 */
export function checkEnemy(enemy: string): CapabilityCheck {
  const normalized = enemy.toLowerCase().trim();

  // Direct match
  if (CAPABILITIES.enemies.includes(normalized as EnemyType)) {
    return { status: "supported" };
  }

  // Unknown enemy - adaptable (we can represent it visually with existing types)
  return {
    status: "adaptable",
    reason: `"${enemy}" is not a predefined enemy type, but can be visually represented.`,
    suggestion: "The enemy will be adapted to one of the supported types (robot, alien, drone, monster).",
  };
}

/**
 * Check if a weapon request is supported
 */
export function checkWeapon(weapon: string): CapabilityCheck {
  const normalized = weapon.toLowerCase().trim();

  // Direct match
  if (CAPABILITIES.weapons.includes(normalized as WeaponType)) {
    return { status: "supported" };
  }

  // Unknown weapon - partial (we can't create new weapon mechanics)
  return {
    status: "partial",
    reason: `"${weapon}" is not a predefined weapon type.`,
    suggestion: `Supported weapons: Blaster, Pistol, Shotgun, Rifle. The closest match will be used.`,
  };
}

/**
 * Check if a theme request is supported
 */
export function checkTheme(theme: string): CapabilityCheck {
  const normalized = theme.toLowerCase().trim();

  // Direct match
  if (CAPABILITIES.themes.includes(normalized as Theme)) {
    return { status: "supported" };
  }

  // Unknown theme - adaptable (we can adapt visuals)
  return {
    status: "adaptable",
    reason: `"${theme}" is not a predefined theme, but can be visually adapted.`,
    suggestion: "The theme will be adapted to one of the supported themes (forest, space, city, desert, ice).",
  };
}

/**
 * Check if mechanics are supported
 */
export function checkMechanics(text: string): CapabilityCheck {
  const normalized = text.toLowerCase();

  for (const unsupported of UNSUPPORTED_MECHANICS) {
    if (normalized.includes(unsupported)) {
      return {
        status: "partial",
        reason: `"${unsupported}" mechanics are not available in V1.`,
        suggestion: "The game will be generated without this mechanic. Focus on movement, collection, dodging, or shooting.",
      };
    }
  }

  return { status: "supported" };
}

/**
 * Comprehensive capability check for a prompt
 */
export function checkPromptCapabilities(prompt: string): {
  overall: CapabilityStatus;
  checks: CapabilityCheck[];
  warnings: string[];
} {
  const checks: CapabilityCheck[] = [];
  const warnings: string[] = [];
  const normalized = prompt.toLowerCase();

  // Check for unsupported genres
  const genreCheck = checkGenre(normalized);
  checks.push(genreCheck);
  if (genreCheck.status === "unsupported") {
    return {
      overall: "unsupported",
      checks,
      warnings: [genreCheck.reason || "Unsupported genre requested"],
    };
  }

  // Check for unsupported mechanics
  const mechanicsCheck = checkMechanics(normalized);
  checks.push(mechanicsCheck);
  if (mechanicsCheck.status === "partial" && mechanicsCheck.reason) {
    warnings.push(mechanicsCheck.reason);
  }

  // Determine overall status
  let overall: CapabilityStatus = "supported";
  if (warnings.length > 0) overall = "partial";
  if (genreCheck.status === "adaptable") overall = "adaptable";

  return { overall, checks, warnings };
}
