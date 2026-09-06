import type { Entity } from "./types";

/** Holds every entity of the active level. Created and destroyed with each level/restart. */
export class Scene {
  player: Entity | null = null;
  coins: Entity[] = [];
  enemies: Entity[] = [];
  obstacles: Entity[] = [];
  bullets: Entity[] = [];
  powerUps: Entity[] = [];

  reset() {
    this.player = null;
    this.coins = [];
    this.enemies = [];
    this.obstacles = [];
    this.bullets = [];
    this.powerUps = [];
  }

  destroy() {
    this.reset();
  }

  static entity(x: number, y: number, w: number, h: number, extra: Partial<Entity> = {}): Entity {
    return { x, y, w, h, vx: 0, vy: 0, alive: true, ...extra };
  }
}
