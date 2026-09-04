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

export interface SemanticResult {
  type: GameType;
  theme: Theme;
  difficulty: Difficulty;
  coins: number | null;
  enemies: number | null;
  obstacles: number | null;
  name: string;
}

/** Turns free text into a structured (still unvalidated) description. */
export function mapPrompt(prompt: string, type: GameType): SemanticResult {
  const text = normalize(prompt);
  const theme = pickFromHints<Theme>(text, THEME_HINTS) ?? DEFAULT_THEME[type];
  const difficulty = pickFromHints<Difficulty>(text, DIFFICULTY_HINTS) ?? "normal";

  return {
    type,
    theme,
    difficulty,
    coins: readCount(text, ["coins", "coin", "moedas", "moeda", "itens", "items"]),
    enemies: readCount(text, ["enemies", "enemy", "aliens", "inimigos", "inimigo"]),
    obstacles: readCount(text, ["obstacles", "obstaculos", "obstacle"]),
    name: suggestName(prompt, type, theme),
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
