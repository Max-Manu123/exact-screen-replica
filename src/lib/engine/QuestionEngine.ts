import { DIFFICULTY_HINTS, THEME_HINTS, normalize, type SemanticResult } from "./SemanticMapper";
import { LIMITS } from "./LevelDesignEngine";
import type { Difficulty, GameType, Theme } from "./types";
import { DIFFICULTIES, THEMES } from "./types";

export type QuestionKey = "theme" | "difficulty" | "coins" | "enemies" | "obstacles" | "enemies_scope";

export interface QuestionOption {
  value: string | number;
  /** i18n key, or raw label when `label` is set. */
  labelKey?: string;
  label?: string;
}

export interface Question {
  key: QuestionKey;
  /** i18n key of the question text. */
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
 * Asks only for genuinely missing, important details — never more than three.
 * Anything with a safe default stays a default.
 */
export function buildQuestions(prompt: string, mapped: SemanticResult): Question[] {
  const text = normalize(prompt);
  const questions: Question[] = [];

  if (!mentions(text, THEME_HINTS)) questions.push(THEME_QUESTION);
  if (!mentions(text, DIFFICULTY_HINTS)) questions.push(DIFFICULTY_QUESTION);

  const byType: Record<GameType, Question | null> = {
    coin_collector: mapped.coins === null ? countQuestion("coins", [10, 20, 30]) : null,
    dodge: mapped.obstacles === null ? countQuestion("obstacles", [5, 10, 15]) : null,
    shooter: mapped.enemies === null ? countQuestion("enemies", [4, 8, 12]) : null,
  };
  const typeQuestion = byType[mapped.type];
  if (typeQuestion) questions.push(typeQuestion);

  // Ask for enemy scope if shooter has enemies but scope is ambiguous
  if (mapped.type === "shooter" && mapped.enemies !== null && mapped.enemiesScope === null) {
    questions.push(ENEMIES_SCOPE_QUESTION);
  }

  return questions.slice(0, 3);
}

function clamp(value: unknown, key: "coins" | "enemies" | "obstacles"): number | null {
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) return null;
  const limits = LIMITS[key];
  return Math.min(limits.max, Math.max(limits.min, Math.round(numeric)));
}

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
  return next;
}
