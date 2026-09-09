import {
  DIFFICULTY_HINTS,
  THEME_HINTS,
  WEAPON_HINTS,
  CHARACTER_HINTS,
  ENEMY_HINTS,
  COLLECTIBLE_HINTS,
  OBSTACLE_HINTS,
  normalize,
  type SemanticResult,
} from "./SemanticMapper";
import { LIMITS } from "./LevelDesignEngine";
import type { Difficulty, EnemyType, GameType, Theme } from "./types";
import { DIFFICULTIES, THEMES } from "./types";

export type QuestionKey =
  | "theme"
  | "difficulty"
  | "coins"
  | "enemies"
  | "obstacles"
  | "enemies_scope"
  | "weapon"
  | "character"
  | "enemy_type"
  | "collectible_type"
  | "obstacle_type"
  | "boss";

export interface QuestionOption {
  value: string | number;
  labelKey?: string;
  label?: string;
}

export interface Question {
  key: QuestionKey;
  titleKey: string;
  kind: "option" | "number";
  options: QuestionOption[];
  min?: number;
  max?: number;
}

export interface Answers {
  theme?: Theme;
  difficulty?: Difficulty;
  coins?: number;
  enemies?: number;
  obstacles?: number;
  enemies_scope?: "total" | "per_wave";
  weapon?: string;
  character?: string;
  enemy_type?: string;
  collectible_type?: string;
  obstacle_type?: string;
  boss?: boolean;
}

function mentions(text: string, hints: Record<string, string[]>): boolean {
  return Object.values(hints).some((list) => list.some((hint) => text.includes(hint)));
}

const THEME_QUESTION: Question = {
  key: "theme",
  titleKey: "questions.theme",
  kind: "option",
  options: THEMES.map((theme) => ({ value: theme, labelKey: `themes.${theme}` })),
};

const DIFFICULTY_QUESTION: Question = {
  key: "difficulty",
  titleKey: "questions.difficulty",
  kind: "option",
  options: DIFFICULTIES.map((difficulty) => ({ value: difficulty, labelKey: `difficulty.${difficulty}` })),
};

const ENEMIES_SCOPE_QUESTION: Question = {
  key: "enemies_scope",
  titleKey: "questions.enemiesScope",
  kind: "option",
  options: [
    { value: "total", label: "Total no jogo" },
    { value: "per_wave", label: "Por wave" },
  ],
};

const WEAPON_QUESTION: Question = {
  key: "weapon",
  titleKey: "questions.weapon",
  kind: "option",
  options: [
    { value: "blaster", label: "Blaster" },
    { value: "pistol", label: "Pistol" },
    { value: "shotgun", label: "Shotgun" },
    { value: "rifle", label: "Rifle" },
  ],
};

const CHARACTER_QUESTION: Question = {
  key: "character",
  titleKey: "questions.character",
  kind: "option",
  options: [
    { value: "astronaut", label: "Astronaut" },
    { value: "ninja", label: "Ninja" },
    { value: "soldier", label: "Soldier" },
    { value: "robot", label: "Robot" },
  ],
};

const ENEMY_TYPE_QUESTION: Question = {
  key: "enemy_type",
  titleKey: "questions.enemyType",
  kind: "option",
  options: [
    { value: "robot", label: "Robot" },
    { value: "alien", label: "Alien" },
    { value: "drone", label: "Drone" },
    { value: "monster", label: "Monster" },
  ],
};

const COLLECTIBLE_TYPE_QUESTION: Question = {
  key: "collectible_type",
  titleKey: "questions.collectibleType",
  kind: "option",
  options: [
    { value: "coin", label: "Coin" },
    { value: "gem", label: "Gem" },
    { value: "crystal", label: "Crystal" },
  ],
};

const OBSTACLE_TYPE_QUESTION: Question = {
  key: "obstacle_type",
  titleKey: "questions.obstacleType",
  kind: "option",
  options: [
    { value: "rock", label: "Rock" },
    { value: "spike", label: "Spike" },
    { value: "meteor", label: "Meteor" },
    { value: "barrier", label: "Barrier" },
  ],
};

function countQuestion(key: "coins" | "enemies" | "obstacles", values: number[]): Question {
  const limits = LIMITS[key];
  return {
    key,
    titleKey: `questions.${key}`,
    kind: "number",
    options: values.map((value) => ({ value, label: String(value) })),
    min: limits.min,
    max: limits.max,
  };
}

/**
 * Smart question builder: asks only for genuinely missing, important details.
 * Questions depend on genre, what the user already specified, and what matters
 * most for that genre. Never more than 3 questions.
 */
export function buildQuestions(prompt: string, mapped: SemanticResult): Question[] {
  const text = normalize(prompt);
  const questions: Question[] = [];

  if (mapped.type === "shooter") {
    // Priority for shooter: weapon > enemy type > theme > difficulty > enemy count
    if (!mentions(text, WEAPON_HINTS)) questions.push(WEAPON_QUESTION);
    if (mapped.enemyType === null && !mentions(text, ENEMY_HINTS)) questions.push(ENEMY_TYPE_QUESTION);
    if (!mentions(text, THEME_HINTS)) questions.push(THEME_QUESTION);
    if (!mentions(text, DIFFICULTY_HINTS)) questions.push(DIFFICULTY_QUESTION);
    if (mapped.enemies === null) questions.push(countQuestion("enemies", [4, 8, 12]));

    // Ask for enemy scope if shooter has enemies but scope is ambiguous
    if (mapped.enemies !== null && mapped.enemiesScope === null) {
      questions.push(ENEMIES_SCOPE_QUESTION);
    }
  } else if (mapped.type === "dodge") {
    // Priority for dodge: obstacle type > theme > difficulty > obstacle count
    if (mapped.obstacleType === null && !mentions(text, OBSTACLE_HINTS)) questions.push(OBSTACLE_TYPE_QUESTION);
    if (!mentions(text, THEME_HINTS)) questions.push(THEME_QUESTION);
    if (!mentions(text, DIFFICULTY_HINTS)) questions.push(DIFFICULTY_QUESTION);
    if (mapped.obstacles === null) questions.push(countQuestion("obstacles", [5, 10, 15]));
  } else {
    // coin_collector
    // Priority: collectible type > theme > difficulty > coin count
    if (mapped.collectibleType === null && !mentions(text, COLLECTIBLE_HINTS)) questions.push(COLLECTIBLE_TYPE_QUESTION);
    if (!mentions(text, THEME_HINTS)) questions.push(THEME_QUESTION);
    if (!mentions(text, DIFFICULTY_HINTS)) questions.push(DIFFICULTY_QUESTION);
    if (mapped.coins === null) questions.push(countQuestion("coins", [10, 20, 30]));
  }

  return questions.slice(0, 3);
}

function clamp(value: unknown, key: "coins" | "enemies" | "obstacles"): number | null {
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) return null;
  const limits = LIMITS[key];
  return Math.min(limits.max, Math.max(limits.min, Math.round(numeric)));
}

const VALID_WEAPONS = ["blaster", "pistol", "shotgun", "rifle"];
const VALID_CHARACTERS = ["astronaut", "ninja", "soldier", "robot"];
const VALID_ENEMIES = ["robot", "alien", "drone", "monster"];
const VALID_COLLECTIBLES = ["coin", "gem", "crystal"];
const VALID_OBSTACLES = ["rock", "spike", "meteor", "barrier"];

/** Merges answers into the semantic result, rejecting unsafe values. */
export function applyAnswers(mapped: SemanticResult, answers: Answers | undefined): SemanticResult {
  if (!answers) return mapped;
  const next: SemanticResult = { ...mapped };

  if (answers.theme && THEMES.includes(answers.theme)) next.theme = answers.theme;
  if (answers.difficulty && DIFFICULTIES.includes(answers.difficulty)) next.difficulty = answers.difficulty;

  for (const key of ["coins", "enemies", "obstacles"] as const) {
    if (answers[key] !== undefined) {
      const value = clamp(answers[key], key);
      if (value !== null) next[key] = value;
    }
  }

  if (answers.enemies_scope && (answers.enemies_scope === "total" || answers.enemies_scope === "per_wave")) {
    next.enemiesScope = answers.enemies_scope;
  }
  if (answers.weapon && VALID_WEAPONS.includes(answers.weapon)) next.weapon = answers.weapon as SemanticResult["weapon"];
  if (answers.character && VALID_CHARACTERS.includes(answers.character)) next.character = answers.character as SemanticResult["character"];
  if (answers.enemy_type && VALID_ENEMIES.includes(answers.enemy_type)) {
    const picked = answers.enemy_type as EnemyType;
    next.enemyType = picked;
    if (!next.allEnemyTypes.includes(picked)) next.allEnemyTypes = [picked, ...next.allEnemyTypes];
  }
  if (answers.collectible_type && VALID_COLLECTIBLES.includes(answers.collectible_type)) {
    next.collectibleType = answers.collectible_type as SemanticResult["collectibleType"];
  }
  if (answers.obstacle_type && VALID_OBSTACLES.includes(answers.obstacle_type)) {
    next.obstacleType = answers.obstacle_type as SemanticResult["obstacleType"];
  }
  if (answers.boss !== undefined) next.bossEnabled = answers.boss;

  return next;
}
