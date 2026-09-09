import type { Difficulty, GameConfig, GameType, Theme } from "./types";

export const THEME_HINTS: Record<Theme, string[]> = {
  forest: ["forest", "jungle", "wood", "tree", "nature", "woods", "bush", "green", "floresta", "selva", "arvore", "mata", "bosque"],
  space: ["space", "galaxy", "star", "planet", "cosmic", "orbit", "nebula", "void", "astro", "espaco", "galaxia", "nave", "planeta", "estrela"],
  city: ["city", "street", "urban", "town", "rooftop", "building", "neon", "downtown", "metropolis", "cidade", "rua", "urbano", "predio", "metropole"],
  desert: ["desert", "sand", "dune", "pyramid", "oasis", "sahara", "deserto", "areia", "duna", "piramide"],
  ice: ["ice", "snow", "frozen", "winter", "arctic", "frost", "glacier", "tundra", "gelo", "neve", "congelado", "inverno", "artico", "glacial"],
};

export const DIFFICULTY_HINTS: Record<Difficulty, string[]> = {
  easy: ["easy", "simple", "casual", "relaxing", "kids", "beginner", "chill", "facil", "simples", "tranquilo", "criancas", "iniciante", "calmo"],
  normal: ["normal", "balanced", "medium", "standard", "moderate", "equilibrado", "medio", "moderado"],
  hard: ["hard", "difficult", "hardcore", "challenging", "insane", "brutal", "intense", "extreme", "tough", "dificil", "desafiador", "intenso", "extremo", "brutal"],
};

export const CHARACTER_HINTS: Record<GameConfig["character"], string[]> = {
  astronaut: ["astronaut", "astronauta", "spaceman", "cosmonaut", "cosmonauta"],
  ninja: ["ninja", "shinobi", "stealth", "shadow warrior", "samurai", "furtivo"],
  robot: ["robot", "robo", "robos", "mech", "cyborg", "android", "bot", "android"],
  soldier: ["soldier", "soldado", "marine", "military", "militar", "army", "trooper", "commando", "combatente"],
};

export const COLLECTIBLE_HINTS: Record<GameConfig["collectibleType"], string[]> = {
  coin: ["coin", "coins", "moeda", "moedas", "gold", "ouro", "currency", "dinheiro", "money"],
  gem: ["gem", "gems", "joia", "joias", "jewel", "jewels", "ruby", "emerald", "sapphire"],
  crystal: ["crystal", "crystals", "cristal", "cristais", "shard", "shards", "fragment", "quartz"],
};

export const OBSTACLE_HINTS: Record<GameConfig["obstacleType"], string[]> = {
  rock: ["rock", "rocks", "pedra", "pedras", "stone", "boulder", "rocha", "rochas"],
  spike: ["spike", "spikes", "espinho", "espinhos", "trap", "traps", "armadilha", "armadilhas", "thorn"],
  meteor: ["meteor", "meteors", "meteorito", "meteoritos", "fireball", "asteroid", "asteroide", "comet", "cometa"],
  barrier: ["barrier", "barriers", "barreira", "barreiras", "wall", "parede", "block", "bloco", "fence"],
};

export const WEAPON_HINTS: Record<GameConfig["weapon"], string[]> = {
  blaster: ["blaster", "laser", "raio", "beam", "plasma", "phaser", "energy"],
  pistol: ["pistol", "pistola", "revolver", "handgun", "sidearm"],
  shotgun: ["shotgun", "escopeta", "spread", "shot", "buckshot", "scatter"],
  rifle: ["rifle", "fuzil", "sniper", "carbine", "assault rifle", "automatic"],
};

export const ENEMY_HINTS: Record<GameConfig["enemyType"], string[]> = {
  robot: ["robot", "robots", "robo", "robos", "mech", "android", "cyborg", "droid"],
  alien: ["alien", "aliens", "alienigena", "alienigenas", "extraterrestre", "xenomorph", "martian"],
  drone: ["drone", "drones", "uav", "voador", "quadcopter", "flyer", "hoverbot"],
  monster: ["monster", "monsters", "monstro", "monstros", "beast", "fera", "creature", "criatura", "horror"],
};

export const POWERUP_HINTS: Record<GameConfig["powerUps"][number], string[]> = {
  health: ["health", "vida", "life", "cura", "heal", "medkit", "recover", "recuperar"],
  shield: ["shield", "escudo", "protection", "protecao", "barrier", "deflect"],
  speed: ["speed", "velocidade", "fast", "rapido", "boost", "turbo", "acelerar"],
  double_score: ["double", "score", "pontos", "x2", "bonus", "bonus", "multiplier", "multiplicador"],
};

/** Pacing / intensity words that affect encounter style and aggression. */
const PACING_FAST = ["fast", "rapid", "quick", "speed", "rush", "frantic", "frenetic", "rapidamente", "veloz", "acelerado", "rapido", "corrida"];
const PACING_SLOW = ["slow", "tactical", "careful", "deliberate", "methodical", "lento", "tatico", "cuidadoso", "devagar"];
const PACING_INTENSE = ["intense", "brutal", "extreme", "hardcore", "furious", "overwhelming", "intenso", "furioso", "extremo"];

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
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickFromHints<T extends string>(text: string, hints: Record<T, string[]>): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const key of Object.keys(hints) as T[]) {
    let score = 0;
    for (const hint of hints[key]) {
      if (text.includes(hint)) score += hint.length > 4 ? 1.5 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best;
}

/** Detect ALL enemy types mentioned in the prompt (for composition). */
function detectAllEnemies(text: string): GameConfig["enemyType"][] {
  const found: GameConfig["enemyType"][] = [];
  for (const key of Object.keys(ENEMY_HINTS) as GameConfig["enemyType"][]) {
    for (const hint of ENEMY_HINTS[key]) {
      if (text.includes(hint)) {
        if (!found.includes(key)) found.push(key);
        break;
      }
    }
  }
  return found;
}

/** Reads an explicit number from the prompt ("10 coins", "5 inimigos", "10000 enemies"). */
function readCount(text: string, words: string[]): number | null {
  for (const word of words) {
    const match = text.match(new RegExp(`(\\d{1,6})\\s+${word}`)) ?? text.match(new RegExp(`${word}\\s+(\\d{1,6})`));
    if (match) {
      const value = Number.parseInt(match[1] ?? "", 10);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

/** Interprets vague quantity expressions. */
function interpretVagueQuantity(text: string, context: string): number | null {
  const lower = text;

  if (lower.includes("muitos") || lower.includes("many") || lower.includes("a lot of") || lower.includes("lots of")) {
    if (context.includes("enemies")) return 15;
    if (context.includes("coins")) return 25;
    if (context.includes("obstacles")) return 12;
  }
  if (lower.includes("poucos") || lower.includes("few") || lower.includes("a few")) {
    if (context.includes("enemies")) return 4;
    if (context.includes("coins")) return 8;
    if (context.includes("obstacles")) return 5;
  }

  return null;
}

/** Detect "only" / "apenas" / "just" modifier. */
export function hasOnlyModifier(text: string, entityWord: string): boolean {
  const patterns = [
    new RegExp(`(?:only|apenas|just|somente)\\s+${entityWord}`),
    new RegExp(`${entityWord}\\s+(?:only|apenas|somente)`),
    new RegExp(`(?:only|apenas|just|somente)\\s+\\w+\\s+${entityWord}`),
  ];
  return patterns.some((p) => p.test(text));
}

export interface SemanticResult {
  type: GameType;
  theme: Theme;
  difficulty: Difficulty;
  coins: number | null;
  enemies: number | null;
  obstacles: number | null;
  name: string;
  enemiesScope: "total" | "per_wave" | null;
  character: GameConfig["character"] | null;
  collectibleType: GameConfig["collectibleType"] | null;
  obstacleType: GameConfig["obstacleType"] | null;
  weapon: GameConfig["weapon"] | null;
  enemyType: GameConfig["enemyType"] | null;
  allEnemyTypes: GameConfig["enemyType"][];
  onlyEnemies: boolean;
  powerUps: GameConfig["powerUps"] | null;
  bossEnabled: boolean | null;
  pacing: "fast" | "normal" | "slow" | null;
  intensity: "high" | "normal" | null;
}

/** Turns free text into a structured (still unvalidated) description. */
export function mapPrompt(prompt: string, type: GameType): SemanticResult {
  const text = normalize(prompt);
  const theme = pickFromHints<Theme>(text, THEME_HINTS) ?? DEFAULT_THEME[type];
  const difficulty = pickFromHints<Difficulty>(text, DIFFICULTY_HINTS) ?? "normal";

  let coins = readCount(text, ["coins", "coin", "moedas", "moeda", "itens", "items", "gems", "crystals", "cristais"]);
  let enemies = readCount(text, ["enemies", "enemy", "aliens", "inimigos", "inimigo", "robots", "drones", "monsters"]);
  let obstacles = readCount(text, ["obstacles", "obstaculos", "obstacle", "meteors", "barriers", "spikes", "rocks"]);

  if (coins === null) coins = interpretVagueQuantity(text, "coins");
  if (enemies === null) enemies = interpretVagueQuantity(text, "enemies");
  if (obstacles === null) obstacles = interpretVagueQuantity(text, "obstacles");

  let enemiesScope: "total" | "per_wave" | null = null;
  if (enemies !== null) {
    if (text.includes("no total") || text.includes("total") || text.includes("no jogo")) {
      enemiesScope = "total";
    } else if (text.includes("por wave") || text.includes("por onda") || text.includes("cada wave") || text.includes("em cada wave")) {
      enemiesScope = "per_wave";
    }
  }

  const character = pickFromHints<GameConfig["character"]>(text, CHARACTER_HINTS);
  const collectibleType = pickFromHints<GameConfig["collectibleType"]>(text, COLLECTIBLE_HINTS);
  const obstacleType = pickFromHints<GameConfig["obstacleType"]>(text, OBSTACLE_HINTS);
  const weapon = pickFromHints<GameConfig["weapon"]>(text, WEAPON_HINTS);
  const enemyType = pickFromHints<GameConfig["enemyType"]>(text, ENEMY_HINTS);
  const allEnemyTypes = detectAllEnemies(text);

  // Detect "only" modifier for enemies
  const onlyEnemies = allEnemyTypes.length === 1
    ? hasOnlyModifier(text, allEnemyTypes[0]!)
    : false;

  // Detect power-ups
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
  if (text.includes("boss") || text.includes("chefe") || text.includes("final boss") || text.includes("boss final")) {
    bossEnabled = true;
  }

  // Detect pacing
  let pacing: "fast" | "normal" | "slow" | null = null;
  if (PACING_FAST.some((w) => text.includes(w))) pacing = "fast";
  else if (PACING_SLOW.some((w) => text.includes(w))) pacing = "slow";

  // Detect intensity
  let intensity: "high" | "normal" | null = null;
  if (PACING_INTENSE.some((w) => text.includes(w)) || difficulty === "hard") intensity = "high";

  return {
    type,
    theme,
    difficulty,
    coins,
    enemies,
    obstacles,
    name: suggestName(prompt, type, theme, {
      character,
      weapon,
      enemyType,
      collectibleType,
      obstacleType,
      bossEnabled,
      pacing,
    }),
    enemiesScope,
    character,
    collectibleType,
    obstacleType,
    weapon,
    enemyType,
    allEnemyTypes,
    onlyEnemies,
    powerUps,
    bossEnabled,
    pacing,
    intensity,
  };
}

// ── Deterministic naming system ──

const THEME_NAME_WORDS: Record<Theme, string[]> = {
  forest: ["Forest", "Wild", "Jungle", "Verdant", "Overgrown"],
  space: ["Space", "Cosmic", "Stellar", "Galactic", "Void", "Astral", "Neon"],
  city: ["City", "Urban", "Neon", "Metro", "Shadow", "Dark"],
  desert: ["Desert", "Sand", "Dune", "Sunscorched", "Arid"],
  ice: ["Frozen", "Ice", "Arctic", "Glacial", "Frost", "Tundra"],
};

const CHARACTER_NAME_WORDS: Record<GameConfig["character"], string[]> = {
  astronaut: ["Astronaut", "Cosmonaut", "Spaceman"],
  ninja: ["Ninja", "Shadow", "Shinobi"],
  soldier: ["Soldier", "Marine", "Commando"],
  robot: ["Robot", "Mech", "Cyborg", "Bot"],
};

const WEAPON_NAME_WORDS: Record<GameConfig["weapon"], string[]> = {
  blaster: ["Blast", "Laser", "Plasma"],
  pistol: ["Pistol", "Sidearm"],
  shotgun: ["Shotgun", "Scatter"],
  rifle: ["Rifle", "Sniper", "Assault"],
};

const ENEMY_NAME_WORDS: Record<GameConfig["enemyType"], string[]> = {
  robot: ["Robot", "Mech", "Droid"],
  alien: ["Alien", "Xeno", "Martian"],
  drone: ["Drone", "Swarmer"],
  monster: ["Monster", "Beast", "Horror"],
};

const COLLECTIBLE_NAME_WORDS: Record<GameConfig["collectibleType"], string[]> = {
  coin: ["Coin", "Gold", "Treasure"],
  gem: ["Gem", "Jewel", "Ruby"],
  crystal: ["Crystal", "Shard", "Fragment"],
};

const OBSTACLE_NAME_WORDS: Record<GameConfig["obstacleType"], string[]> = {
  rock: ["Rock", "Stone", "Boulder"],
  spike: ["Spike", "Thorn", "Trap"],
  meteor: ["Meteor", "Asteroid", "Comet"],
  barrier: ["Barrier", "Wall", "Block"],
};

const GENRE_SUFFIX: Record<GameType, string[]> = {
  shooter: ["Assault", "Strike", "Blaster", "Onslaught", "Fury", "Combat"],
  dodge: ["Rush", "Escape", "Survival", "Dodge", "Storm"],
  coin_collector: ["Run", "Hunt", "Quest", "Trail", "Gather"],
};

/** Deterministic hash so the same prompt always gets the same name. */
function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickFromArray<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

interface NameContext {
  character: GameConfig["character"] | null;
  weapon: GameConfig["weapon"] | null;
  enemyType: GameConfig["enemyType"] | null;
  collectibleType: GameConfig["collectibleType"] | null;
  obstacleType: GameConfig["obstacleType"] | null;
  bossEnabled: boolean | null;
  pacing: "fast" | "normal" | "slow" | null;
}

export function suggestName(
  prompt: string,
  type: GameType,
  theme: Theme,
  context: NameContext = {
    character: null,
    weapon: null,
    enemyType: null,
    collectibleType: null,
    obstacleType: null,
    bossEnabled: null,
    pacing: null,
  },
): string {
  const clean = normalize(prompt);
  const seed = hashString(clean);
  const suffix = pickFromArray(GENRE_SUFFIX[type], seed);

  // Build name from available semantic concepts, prioritizing the most distinctive
  const parts: string[] = [];

  // Theme adjective (always present)
  const themeWord = pickFromArray(THEME_NAME_WORDS[theme], seed);
  parts.push(themeWord);

  // For shooters: character + enemy or weapon + enemy
  if (type === "shooter") {
    if (context.enemyType) {
      const enemyWord = pickFromArray(ENEMY_NAME_WORDS[context.enemyType], seed >> 3);
      // "Neon Robot Assault" or "Shadow Alien Strike"
      if (context.character) {
        const charWord = pickFromArray(CHARACTER_NAME_WORDS[context.character], seed >> 5);
        // Use character as adjective, enemy as subject
        return `${themeWord} ${enemyWord} ${suffix}`;
      }
      return `${themeWord} ${enemyWord} ${suffix}`;
    }
    if (context.weapon) {
      const weaponWord = pickFromArray(WEAPON_NAME_WORDS[context.weapon], seed >> 3);
      return `${themeWord} ${weaponWord} ${suffix}`;
    }
    return `${themeWord} ${suffix}`;
  }

  // For dodge: obstacle type + theme
  if (type === "dodge") {
    if (context.obstacleType) {
      const obstacleWord = pickFromArray(OBSTACLE_NAME_WORDS[context.obstacleType], seed >> 3);
      if (context.pacing === "fast") {
        return `${obstacleWord} Rush`;
      }
      return `${themeWord} ${obstacleWord} ${suffix}`;
    }
    if (context.pacing === "fast") {
      return `${themeWord} Rush`;
    }
    return `${themeWord} ${suffix}`;
  }

  // For coin collector: collectible type + theme
  if (type === "coin_collector") {
    if (context.collectibleType) {
      const collectibleWord = pickFromArray(COLLECTIBLE_NAME_WORDS[context.collectibleType], seed >> 3);
      return `${themeWord} ${collectibleWord} ${suffix}`;
    }
    return `${themeWord} ${suffix}`;
  }

  return `${themeWord} ${suffix}`;
}

/** Config type is exported for convenience of pipeline consumers. */
export type { GameConfig };
