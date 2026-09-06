import { BackgroundRenderer } from "./BackgroundRenderer";
import { paletteFor, type Palette } from "./AssetGenerator";
import { OBJECTIVE_KEY } from "./GameRulesEngine";
import { Scene } from "./Scene";
import type { GameConfig, GameHooks, GameStats, GameStatus, ObjectiveState } from "./types";

interface Transition {
  remaining: number;
  run: () => void;
}

/**
 * Base game engine: single game loop, lifecycle, input, pause system,
 * objective system and clean destruction. Templates only implement
 * setupLevel / updateWorld / renderWorld.
 */
export abstract class GameEngine {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected config: GameConfig;
  protected scene = new Scene();
  protected palette: Palette;
  protected background: BackgroundRenderer;
  protected keys = new Set<string>();
  protected pointer: { x: number; y: number; active: boolean } | null = null;
  protected width = 0;
  protected height = 0;
  protected elapsed = 0;
  /** Virtual (touch) input, fed by on-screen controls. */
  protected virtual = { x: 0, y: 0, shoot: false };

  private hooks: GameHooks;
  private rafId: number | null = null;
  private lastTime = 0;
  private destroyed = false;
  private status: GameStatus = "ready";
  private transition: Transition | null = null;
  private resizeObserver: ResizeObserver | null = null;

  protected stats: GameStats;

  constructor(canvas: HTMLCanvasElement, config: GameConfig, hooks: GameHooks = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.canvas = canvas;
    this.ctx = ctx;
    this.config = config;
    this.hooks = hooks;
    this.palette = paletteFor(config.theme);
    this.background = new BackgroundRenderer(config.theme);
    this.stats = {
      score: 0,
      coins: 0,
      coinsTotal: 0,
      level: 1,
      levels: config.levels,
      wave: 1,
      waves: config.waves,
      xp: 0,
      lives: 1,
      time: 0,
      objectiveKey: OBJECTIVE_KEY[config.type],
      objectiveState: "pending",
      shielded: false,
      shieldTimer: 0,
      speedBoost: false,
      speedTimer: 0,
      doubleScore: false,
      doubleScoreTimer: 0,
    };
  }

  /* ---------------- lifecycle ---------------- */

  initialize() {
    this.handleResize();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.canvas);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerEnd);
    this.canvas.addEventListener("pointercancel", this.onPointerEnd);

    this.resetGame();
    this.render();
    this.emitStats();
    this.setStatus("ready");
  }

  start() {
    if (this.destroyed) return;
    if (this.status === "playing") return;
    if (this.status === "game_over" || this.status === "completed") {
      this.restart();
      return;
    }
    if (this.status === "paused") {
      this.resume();
      return;
    }
    this.stats.objectiveState = "active";
    this.setStatus("playing");
    this.emitStats();
    this.runLoop();
  }

  pause() {
    if (this.status !== "playing") return;
    this.setStatus("paused");
    this.keys.clear();
    this.pointer = null;
    this.virtual = { x: 0, y: 0, shoot: false };
  }

  resume() {
    if (this.status !== "paused") return;
    this.setStatus("playing");
    this.lastTime = 0;
    this.runLoop();
  }

  restart() {
    if (this.destroyed) return;
    this.stopLoop();
    this.transition = null;
    this.resetGame();
    this.stats.objectiveState = "active";
    this.setStatus("playing");
    this.emitStats();
    this.lastTime = 0;
    this.runLoop();
  }

  destroy() {
    this.destroyed = true;
    this.stopLoop();
    this.transition = null;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerEnd);
    this.canvas.removeEventListener("pointercancel", this.onPointerEnd);

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.keys.clear();
    this.pointer = null;
    this.virtual = { x: 0, y: 0, shoot: false };
    this.scene.destroy();
  }

  getStatus(): GameStatus {
    return this.status;
  }

  getStats(): GameStats {
    return { ...this.stats };
  }

  /* ---------------- loop ---------------- */

  private runLoop() {
    if (this.rafId !== null || this.destroyed) return; // only one active loop
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private frame = (timestamp: number) => {
    if (this.destroyed) return;
    this.rafId = null;
    const dt = this.lastTime === 0 ? 0 : Math.min(0.05, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    if (this.status === "paused") {
      this.render();
      return; // loop halts until resume()
    }

    if (this.transition) {
      this.transition.remaining -= dt;
      if (this.transition.remaining <= 0) {
        const run = this.transition.run;
        this.transition = null;
        run();
      }
    }

    if (this.status === "playing") {
      this.elapsed += dt;
      this.stats.time = this.elapsed;
      this.updateWorld(dt);
      this.emitStats();
    }

    this.render();

    if (this.status === "game_over" || this.status === "completed") {
      if (!this.transition) {
        this.stopLoop();
        return;
      }
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  protected render() {
    this.background.render(this.ctx, this.width, this.height, this.elapsed);
    this.renderWorld();
  }

  /* ---------------- state helpers ---------------- */

  protected setStatus(status: GameStatus) {
    this.status = status;
    this.hooks.onStatus?.(status);
  }

  protected setObjective(state: ObjectiveState) {
    this.stats.objectiveState = state;
  }

  protected emitStats() {
    this.hooks.onStats?.({ ...this.stats });
  }

  protected after(seconds: number, run: () => void) {
    this.transition = { remaining: seconds, run };
  }

  protected gameOver() {
    if (this.status === "game_over") return;
    this.setObjective("failed");
    this.setStatus("game_over");
    this.emitStats();
  }

  protected completeLevel() {
    if (this.status !== "playing") return;
    this.stats.score += 50;
    if (this.stats.level >= this.stats.levels) {
      this.setObjective("completed");
      this.setStatus("completed");
      this.emitStats();
      return;
    }
    this.setStatus("level_complete");
    this.emitStats();
    this.after(1.4, () => {
      this.stats.level += 1;
      this.stats.wave = 1;
      this.buildLevel();
      this.setStatus("playing");
      this.emitStats();
    });
  }

  private resetGame() {
    this.elapsed = 0;
    this.stats = {
      score: 0,
      coins: 0,
      coinsTotal: 0,
      level: 1,
      levels: this.config.levels,
      wave: 1,
      waves: this.config.waves,
      xp: 0,
      lives: 1,
      time: 0,
      objectiveKey: OBJECTIVE_KEY[this.config.type],
      objectiveState: "pending",
      shielded: false,
      shieldTimer: 0,
      speedBoost: false,
      speedTimer: 0,
      doubleScore: false,
      doubleScoreTimer: 0,
    };
    this.buildLevel();
  }

  private buildLevel() {
    this.scene.destroy();
    this.scene = new Scene();
    this.setupLevel();
  }

  /** Applies a new config (editor) and rebuilds the game from template + config. */
  applyConfig(config: GameConfig) {
    this.config = config;
    this.palette = paletteFor(config.theme);
    this.background.setTheme(config.theme);
    this.stats.levels = config.levels;
    this.stats.waves = config.waves;
    this.stopLoop();
    this.transition = null;
    this.resetGame();
    this.setStatus("ready");
    this.emitStats();
    this.render();
  }

  /* ---------------- input ---------------- */

  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "spacebar"].includes(key)) {
      if (this.status === "playing") event.preventDefault();
    }
    this.keys.add(key === "spacebar" ? " " : key);
  };

  private onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.keys.delete(key === "spacebar" ? " " : key);
  };

  private onBlur = () => {
    this.keys.clear();
    this.pointer = null;
    this.virtual = { x: 0, y: 0, shoot: false };
  };

  private onPointer = (event: PointerEvent) => {
    if (event.type === "pointermove" && event.buttons === 0 && event.pointerType !== "mouse") return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = {
      x: ((event.clientX - rect.left) / rect.width) * this.width,
      y: ((event.clientY - rect.top) / rect.height) * this.height,
      active: true,
    };
  };

  private onPointerEnd = () => {
    this.pointer = null;
  };

  /** On-screen control input: continuous while pressed, zeroed on release/cancel. */
  setVirtualAxis(x: number, y: number) {
    this.virtual.x = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
    this.virtual.y = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
  }

  setVirtualShoot(active: boolean) {
    this.virtual.shoot = active === true;
  }

  protected axis(): { x: number; y: number } {
    let x = this.virtual.x;
    let y = this.virtual.y;
    if (this.keys.has("arrowleft") || this.keys.has("a")) x -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) x += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) y -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) y += 1;
    return { x, y };
  }

  protected shootPressed(): boolean {
    return this.virtual.shoot || this.keys.has(" ") || this.keys.has("f") || this.pointer?.active === true;
  }

  private handleResize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(320, Math.round(rect.width || 640));
    const height = Math.max(240, Math.round(rect.height || 400));
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const changed = width !== this.width || height !== this.height;
    this.width = width;
    this.height = height;
    this.background.resize(width, height);
    if (changed) this.onResized();
    if (this.status !== "playing") this.render();
  }

  /** Templates can clamp entities after a resize. */
  protected onResized() {
    const player = this.scene.player;
    if (player) {
      player.x = Math.min(player.x, Math.max(0, this.width - player.w));
      player.y = Math.min(player.y, Math.max(0, this.height - player.h));
    }
  }

  protected clampToBoard(entity: { x: number; y: number; w: number; h: number }) {
    entity.x = Math.max(0, Math.min(this.width - entity.w, entity.x));
    entity.y = Math.max(0, Math.min(this.height - entity.h, entity.y));
  }

  protected abstract setupLevel(): void;
  protected abstract updateWorld(dt: number): void;
  protected abstract renderWorld(): void;
}
