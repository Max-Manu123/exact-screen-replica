import { detectGameType } from "./GameTypeDetector";
import { designLevel } from "./LevelDesignEngine";
import { mapPrompt, suggestName } from "./SemanticMapper";
import type { GameConfig, GameHooks, GameType } from "./types";
import { GameEngine } from "./GameEngine";
import { CoinCollectorGame } from "./templates/CoinCollectorGame";
import { DodgeGame } from "./templates/DodgeGame";
import { ShooterGame } from "./templates/ShooterGame";

export const PIPELINE_STEPS = [
  "generating.step1",
  "generating.step2",
  "generating.step3",
  "generating.step4",
  "generating.step5",
] as const;

export class GenerationError extends Error {
  code: "empty_prompt" | "short_prompt" | "unknown_type";

  constructor(code: GenerationError["code"]) {
    super(code);
    this.code = code;
  }
}

export interface GenerationResult {
  name: string;
  type: GameType;
  config: GameConfig;
  prompt: string;
}

/** Runs the real generation pipeline. `onStep` reports the completed step index. */
export async function generateGame(
  prompt: string,
  onStep?: (stepIndex: number) => void,
  delayMs = 320,
): Promise<GenerationResult> {
  const clean = (prompt ?? "").trim();
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));

  if (clean.length === 0) throw new GenerationError("empty_prompt");
  if (clean.length < 12) throw new GenerationError("short_prompt");

  // 1. Understanding the idea
  onStep?.(0);
  await wait();

  // 2. Detect game type
  const detection = detectGameType(clean);
  if (!detection.type) throw new GenerationError("unknown_type");
  onStep?.(1);
  await wait();

  // 3. Semantic mapping → structured configuration
  const mapped = mapPrompt(clean, detection.type);
  onStep?.(2);
  await wait();

  // 4. Level design + validation
  const config = designLevel(mapped);
  onStep?.(3);
  await wait();

  // 5. Ready for the template
  onStep?.(4);
  await wait();

  return {
    name: suggestName(clean, config.type, config.theme),
    type: config.type,
    config,
    prompt: clean,
  };
}

/** Builds the right template instance from template + config. */
export function createGameInstance(
  canvas: HTMLCanvasElement,
  config: GameConfig,
  hooks: GameHooks = {},
): GameEngine {
  switch (config.type) {
    case "dodge":
      return new DodgeGame(canvas, config, hooks);
    case "shooter":
      return new ShooterGame(canvas, config, hooks);
    case "coin_collector":
    default:
      return new CoinCollectorGame(canvas, config, hooks);
  }
}

export { detectGameType, designLevel, mapPrompt };
