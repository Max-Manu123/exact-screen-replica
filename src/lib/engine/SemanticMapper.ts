import type { Difficulty, GameConfig, GameType, Theme } from "./types";

export const THEME_HINTS: Record<Theme, string[]> = {
  forest: ["forest", "jungle", "wood", "tree", "nature", "floresta", "selva", "arvore", "mata"],
  space: ["space", "galaxy", "star", "alien", "planet", "spaceship", "cosmic", "espaco", "galaxia", "nave", "planeta"],
  city: ["city", "street", "urban", "town", "rooftop", "cidade", "rua", "urbano", "predio"],
  desert: ["desert", "sand", "dune", "pyramid", "deserto", "areia", "duna", "piramide"],
  ice: ["ice", "snow", "frozen", "winter", "arctic", "gelo", "neve", "congelado", "inverno", "artico"],
};

export const DIFFICULTY_HINTS: Record<Difficulty, string[]> = {
  easy: ["easy", "simple", "casual", "relaxing", "kids", "facil", "simples", "tranquilo", "criancas"],
  normal: ["normal", "balanced", "medium", "equilibrado", "medio"],
  hard: ["hard", "difficult", "hardcore", "challenging", "insane", "brutal", "dificil", "desafiador"],
};

export const CHARACTER_HINTS: Record<GameConfig["character"], string[]> = {
  astronaut: ["astronaut", "astronauta", "space", "espaco", "nave"],
  ninja: ["ninja", "stealth", "furtivo", "shadow"],
  robot: ["robot", "robo", "mech", "cyborg", "android"],
  soldier: ["soldier", "soldado", "marine", "military", "militar"],
};

export const COLLECTIBLE_HINTS: Record<GameConfig["collectibleType"], string[]> = {
  coin: ["coin", "coins", "moeda", "moedas", "gold", "ouro"],
  gem: ["gem", "gems", "gem", "joia", "crystal", "cristal"],
  crystal: ["crystal", "crystals", "cristal", "cristais", "shard"],
};

export const OBSTACLE_HINTS: Record<GameConfig["obstacleType"], string[]> = {
  rock: ["rock", "rocks", "pedra", "pedras", "stone"],
  spike: ["spike", "spikes", "espinho", "espinhos", "trap"],
  meteor: ["meteor", "meteors", "meteor", "meteorito", "fireball"],
  barrier: ["barrier", "barriers", "barreira", "barreiras", "wall", "parede"],
};

export const WEAPON_HINTS: Record<GameConfig["weapon"], string[]> = {
  blaster: ["blaster", "laser", "raio", "beam"],
  pistol: ["pistol", "pistola", "gun", "arma"],
  shotgun: ["shotgun", "escopeta", "spread", "shot"],
  rifle: ["rifle", "rifle", "sniper", "rifle"],
};

export const ENEMY_HINTS: Record<GameConfig["enemyType"], string[]> = {
  robot: ["robot", "robots", "robo", "robos", "mech"],
  alien: ["alien", "aliens", "alien", "extraterrestre"],
  drone: ["drone", "drones", "uav", "voador"],
  monster: ["monster", "monsters", "monstro", "monstros", "beast", "fera"],
};

export const POWERUP_HINTS: Record<GameConfig["powerUps"][number], string[]> = {
  health: ["health", "vida", "life", "cura", "heal"],
  shield: ["shield", "escudo", "protection", "protecao"],
  speed: ["speed", "velocidade", "fast", "rapido", "boost"],
  double_score: ["double", "score", "pontos", "x2", "bonus", "bônus"],
};

const DEFAULT_THEME: Record<GameType, Theme> = {
  coin_collector: "forest",
  dodge: "city",
  shooter: "space",
};

export function normalize(text: string): string {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function pickFromHints<T extends string>(text: string, hints: Record<T, string[]>): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const key of Object.keys(hints) as T[]) {
    let score = 0;
    for (const hint of hints[key]) if (text.includes(hint)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best;
}

/** Reads an explicit small number from the prompt ("10 coins", "5 inimigos"). */
function readCount(text: string, words: string[]): number | null {
  for (const word of words) {
    const match = text.match(new RegExp(`(\\d{1,3})\\s+${word}`)) ?? text.match(new RegExp(`${word}\\s+(\\d{1,3})`));
    if (match) {
      const value = Number.parseInt(match[1] ?? "", 10);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

/** Interprets vague quantity expressions like "uns 20", "pode ser 50", "quero muitos". */
function interpretVagueQuantity(text: string, context: string): number | null {
  const lower = text.toLowerCase();
  
  // Patterns for vague expressions
  const vaguePatterns = [
    { pattern: /uns\s+(\d+)/, extract: 1 },
    { pattern: /pode\s+ser\s+(\d+)/, extract: 1 },
    { pattern: /cerca\s+de\s+(\d+)/, extract: 1 },
    { pattern: /aproximadamente\s+(\d+)/, extract: 1 },
    { pattern: /por\s+a[ií]\s+(\d+)/, extract: 1 },
    { pattern: /uns?\s+(\d+)/, extract: 1 },
  ];
  
  for (const { pattern, extract } of vaguePatterns) {
    const match = lower.match(pattern);
    if (match && match[extract]) {
      const value = Number.parseInt(match[extract], 10);
      if (Number.isFinite(value)) return value;
    }
  }
  
  // Handle "muitos", "poucos", etc. based on context
  if (lower.includes("muitos") || lower.includes("many")) {
    // Return a high but safe value based on context
    if (context.includes("enemies") || context.includes("inimigos")) return 15;
    if (context.includes("coins") || context.includes("moedas")) return 25;
    if (context.includes("obstacles") || context.includes("obstáculos")) return 12;
  }
  
  if (lower.includes("poucos") || lower.includes("few")) {
    if (context.includes("enemies") || context.includes("inimigos")) return 4;
    if (context.includes("coins") || context.includes("moedas")) return 8;
    if (context.includes("obstacles") || context.includes("obstáculos")) return 5;
  }
  
  if (lower.includes("apenas") || lower.includes("only") || lower.includes("just")) {
    const match = lower.match(/(?:apenas|only|just)\s+(\d+)/);
    if (match && match[1]) return Number.parseInt(match[1], 10);
  }
  
  return null;
}

export interface SemanticResult {
  type: GameType;
  theme: Theme;
  difficulty: Difficulty;
  coins: number | null;
  enemies: number | null;
  obstacles: number | null;
  name: string;
  /** Whether enemy count is total across game or per wave (null = ambiguous) */
  enemiesScope: "total" | "per_wave" | null;
  character: GameConfig["character"] | null;
  collectibleType: GameConfig["collectibleType"] | null;
  obstacleType: GameConfig["obstacleType"] | null;
  weapon: GameConfig["weapon"] | null;
  enemyType: GameConfig["enemyType"] | null;
  powerUps: GameConfig["powerUps"] | null;
  bossEnabled: boolean | null;
}

/** Turns free text into a structured (still unvalidated) description. */
export function mapPrompt(prompt: string, type: GameType): SemanticResult {
  const text = normalize(prompt);
  const theme = pickFromHints<Theme>(text, THEME_HINTS) ?? DEFAULT_THEME[type];
  const difficulty = pickFromHints<Difficulty>(text, DIFFICULTY_HINTS) ?? "normal";

  let coins = readCount(text, ["coins", "coin", "moedas", "moeda", "itens", "items"]);
  let enemies = readCount(text, ["enemies", "enemy", "aliens", "inimigos", "inimigo"]);
  let obstacles = readCount(text, ["obstacles", "obstaculos", "obstacle"]);

  // Try vague interpretation if exact count not found
  if (coins === null) coins = interpretVagueQuantity(text, "coins");
  if (enemies === null) enemies = interpretVagueQuantity(text, "enemies");
  if (obstacles === null) obstacles = interpretVagueQuantity(text, "obstacles");

  // Detect enemy scope (total vs per wave)
  let enemiesScope: "total" | "per_wave" | null = null;
  if (enemies !== null) {
    if (text.includes("no total") || text.includes("total") || text.includes("no jogo")) {
      enemiesScope = "total";
    } else if (text.includes("por wave") || text.includes("por onda") || text.includes("cada wave") || text.includes("em cada wave")) {
      enemiesScope = "per_wave";
    }
  }

  // Detect new features
  const character = pickFromHints<GameConfig["character"]>(text, CHARACTER_HINTS);
  const collectibleType = pickFromHints<GameConfig["collectibleType"]>(text, COLLECTIBLE_HINTS);
  const obstacleType = pickFromHints<GameConfig["obstacleType"]>(text, OBSTACLE_HINTS);
  const weapon = pickFromHints<GameConfig["weapon"]>(text, WEAPON_HINTS);
  const enemyType = pickFromHints<GameConfig["enemyType"]>(text, ENEMY_HINTS);
  
  // Detect power-ups (can have multiple)
  const detectedPowerUps: GameConfig["powerUps"] = [];
  for (const [powerUp, hints] of Object.entries(POWERUP_HINTS)) {
    for (const hint of hints) {
      if (text.includes(hint)) {
        detectedPowerUps.push(powerUp as GameConfig["powerUps"][number]);
        break;
      }
    }
  }
  const powerUps = detectedPowerUps.length > 0 ? detectedPowerUps : null;
  
  // Detect boss
  let bossEnabled: boolean | null = null;
  if (text.includes("boss") || text.includes("chefe") || text.includes("final boss")) {
    bossEnabled = true;
  }

  return {
    type,
    theme,
    difficulty,
    coins,
    enemies,
    obstacles,
    name: suggestName(prompt, type, theme),
    enemiesScope,
    character,
    collectibleType,
    obstacleType,
    weapon,
    enemyType,
    powerUps,
    bossEnabled,
  };
}

const NAME_WORDS: Record<Theme, string> = {
  forest: "Forest",
  space: "Space",
  city: "City",
  desert: "Desert",
  ice: "Frozen",
};

const NAME_SUFFIX: Record<GameType, string> = {
  coin_collector: "Treasure Run",
  dodge: "Dodge Rush",
  shooter: "Strike Force",
};

export function suggestName(prompt: string, type: GameType, theme: Theme): string {
  const clean = (prompt ?? "").trim().replace(/\s+/g, " ");
  const fallback = `${NAME_WORDS[theme]} ${NAME_SUFFIX[type]}`;
  if (clean.length === 0) return fallback;
  return fallback;
}

/** Config type is exported for convenience of pipeline consumers. */
export type { GameConfig };
