import type { GameType } from "./types";

/** Keyword sets (English + Portuguese) used to score a prompt per game type. */
const KEYWORDS: Record<GameType, string[]> = {
  coin_collector: [
    "coin",
    "coins",
    "collect",
    "collecting",
    "collector",
    "gather",
    "pick up",
    "treasure",
    "treasures",
    "gem",
    "gems",
    "loot",
    "item",
    "items",
    "star",
    "stars",
    "coletar",
    "coleta",
    "colecionar",
    "moeda",
    "moedas",
    "pegar",
    "juntar",
    "tesouro",
    "tesouros",
    "objetos",
    "itens",
  ],
  dodge: [
    "dodge",
    "dodging",
    "avoid",
    "avoiding",
    "escape",
    "survive",
    "survival",
    "obstacle",
    "obstacles",
    "falling",
    "run away",
    "runner",
    "desviar",
    "desvie",
    "evitar",
    "escapar",
    "fugir",
    "sobreviver",
    "obstaculo",
    "obstaculos",
    "obstáculo",
    "obstáculos",
  ],
  shooter: [
    "shoot",
    "shooting",
    "shooter",
    "shot",
    "shots",
    "gun",
    "guns",
    "weapon",
    "weapons",
    "bullet",
    "bullets",
    "enemy",
    "enemies",
    "alien",
    "aliens",
    "monster",
    "monsters",
    "destroy",
    "battle",
    "war",
    "spaceship",
    "atirar",
    "tiro",
    "tiros",
    "arma",
    "armas",
    "inimigo",
    "inimigos",
    "alienigena",
    "alienígena",
    "destruir",
    "batalha",
    "nave",
  ],
};

export interface DetectionResult {
  type: GameType | null;
  scores: Record<GameType, number>;
  confidence: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Local, deterministic game-type detection. No external API involved. */
export function detectGameType(prompt: string): DetectionResult {
  const text = normalize(prompt ?? "");
  const scores: Record<GameType, number> = { coin_collector: 0, dodge: 0, shooter: 0 };

  if (text.length > 0) {
    for (const type of Object.keys(KEYWORDS) as GameType[]) {
      for (const keyword of KEYWORDS[type]) {
        const needle = normalize(keyword);
        if (!needle) continue;
        const pattern = new RegExp(`(^|\\s)${needle}(\\s|$)`, "g");
        const matches = text.match(pattern);
        if (matches) scores[type] += matches.length;
        else if (needle.length > 4 && text.includes(needle)) scores[type] += 0.5;
      }
    }
  }

  const entries = (Object.keys(scores) as GameType[]).map((type) => ({ type, score: scores[type] }));
  entries.sort((a, b) => b.score - a.score);
  const best = entries[0];
  const total = entries.reduce((sum, entry) => sum + entry.score, 0);

  if (!best || best.score <= 0) {
    return { type: null, scores, confidence: 0 };
  }

  return { type: best.type, scores, confidence: total > 0 ? best.score / total : 0 };
}

/**
 * Genres users often ask for that V1 does not support yet. Only used when the
 * supported-type detection above finds nothing, so a "shooter with a football
 * as an obstacle" is still detected as a shooter.
 */
const UNSUPPORTED_KEYWORDS: Record<string, string[]> = {
  football: ["football", "soccer", "futebol", "gol", "goals", "goal", "penalty", "penalti"],
  racing: ["racing", "race", "car race", "corrida", "kart", "drift", "rally"],
  platformer: ["platformer", "plataforma", "jump", "jumping", "mario", "pular", "salto"],
  puzzle: ["puzzle", "quebra cabeca", "sudoku", "match 3", "tetris", "enigma"],
  fighting: ["fighting", "fight game", "luta", "boxe", "boxing", "karate", "combate"],
  rpg: ["rpg", "role playing", "quest", "dungeon", "masmorra"],
  sports: ["basketball", "tennis", "volleyball", "basquete", "tenis", "golf", "baseball"],
};

/** Returns the unsupported genre key detected in a prompt, or null. */
export function detectUnsupportedGenre(prompt: string): string | null {
  const text = normalize(prompt ?? "");
  if (!text) return null;
  let best: { key: string; score: number } | null = null;
  for (const key of Object.keys(UNSUPPORTED_KEYWORDS)) {
    let score = 0;
    for (const keyword of UNSUPPORTED_KEYWORDS[key]!) {
      const needle = normalize(keyword);
      if (!needle) continue;
      const pattern = new RegExp(`(^|\\s)${needle}(\\s|$)`, "g");
      const matches = text.match(pattern);
      if (matches) score += matches.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { key, score };
  }
  return best ? best.key : null;
}
