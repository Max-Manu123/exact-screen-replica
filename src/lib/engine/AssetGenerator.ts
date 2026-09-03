import type { Entity, Theme } from "./types";

/** Locally generated (canvas-drawn) assets — no external asset APIs. */
export interface Palette {
  player: string;
  playerAccent: string;
  coin: string;
  coinAccent: string;
  enemy: string;
  enemyAccent: string;
  obstacle: string;
  bullet: string;
  hud: string;
}

const PALETTES: Record<Theme, Palette> = {
  forest: {
    player: "#7fe3b0",
    playerAccent: "#134e37",
    coin: "#ffd76a",
    coinAccent: "#b07d15",
    enemy: "#e8735a",
    enemyAccent: "#5b1d13",
    obstacle: "#4b7d5a",
    bullet: "#d8ffe9",
    hud: "#eafff5",
  },
  space: {
    player: "#8fd7ff",
    playerAccent: "#0d2c47",
    coin: "#ffe98a",
    coinAccent: "#a97f1a",
    enemy: "#c58bff",
    enemyAccent: "#3a1a5c",
    obstacle: "#5a6b9c",
    bullet: "#ccf3ff",
    hud: "#eaf6ff",
  },
  city: {
    player: "#ffd28f",
    playerAccent: "#43290b",
    coin: "#ffe07a",
    coinAccent: "#8e6a10",
    enemy: "#ff8f7a",
    enemyAccent: "#4b1a12",
    obstacle: "#8f96a8",
    bullet: "#fff0d6",
    hud: "#fff6ea",
  },
  desert: {
    player: "#ffe2a8",
    playerAccent: "#4d3212",
    coin: "#ffd45e",
    coinAccent: "#8b6212",
    enemy: "#d97a4e",
    enemyAccent: "#4a2211",
    obstacle: "#b98b56",
    bullet: "#fff3dc",
    hud: "#fff5e3",
  },
  ice: {
    player: "#c9f2ff",
    playerAccent: "#123a4d",
    coin: "#ffeeb0",
    coinAccent: "#8b7a20",
    enemy: "#7fa8ff",
    enemyAccent: "#16264f",
    obstacle: "#9fc8dd",
    bullet: "#ffffff",
    hud: "#f2fbff",
  },
};

export function paletteFor(theme: Theme): Palette {
  return PALETTES[theme] ?? PALETTES.forest;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawPlayer(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette, facingUp = false) {
  ctx.save();
  ctx.shadowColor = palette.player;
  ctx.shadowBlur = 18;
  ctx.fillStyle = palette.player;
  roundRect(ctx, e.x, e.y, e.w, e.h, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = palette.playerAccent;
  const eyeY = facingUp ? e.y + e.h * 0.28 : e.y + e.h * 0.35;
  ctx.beginPath();
  ctx.arc(e.x + e.w * 0.34, eyeY, Math.max(1.6, e.w * 0.07), 0, Math.PI * 2);
  ctx.arc(e.x + e.w * 0.66, eyeY, Math.max(1.6, e.w * 0.07), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCoin(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette, phase = 0) {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2 + Math.sin(phase) * 2;
  const r = e.w / 2;
  ctx.save();
  ctx.shadowColor = palette.coin;
  ctx.shadowBlur = 14;
  ctx.fillStyle = palette.coin;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = palette.coinAccent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette) {
  ctx.save();
  ctx.shadowColor = palette.enemy;
  ctx.shadowBlur = 12;
  ctx.fillStyle = palette.enemy;
  ctx.beginPath();
  ctx.moveTo(e.x + e.w / 2, e.y);
  ctx.lineTo(e.x + e.w, e.y + e.h * 0.75);
  ctx.lineTo(e.x + e.w / 2, e.y + e.h);
  ctx.lineTo(e.x, e.y + e.h * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = palette.enemyAccent;
  ctx.beginPath();
  ctx.arc(e.x + e.w / 2, e.y + e.h * 0.55, Math.max(2, e.w * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawObstacle(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette) {
  ctx.save();
  ctx.fillStyle = palette.obstacle;
  roundRect(ctx, e.x, e.y, e.w, e.h, 6);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#000000";
  roundRect(ctx, e.x + 3, e.y + e.h * 0.6, e.w - 6, e.h * 0.3, 4);
  ctx.fill();
  ctx.restore();
}

export function drawBullet(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette) {
  ctx.save();
  ctx.shadowColor = palette.bullet;
  ctx.shadowBlur = 10;
  ctx.fillStyle = palette.bullet;
  roundRect(ctx, e.x, e.y, e.w, e.h, 3);
  ctx.fill();
  ctx.restore();
}

/** Small deterministic thumbnail used by game cards. */
export function drawThumbnail(ctx: CanvasRenderingContext2D, theme: Theme, width: number, height: number) {
  const palette = paletteFor(theme);
  ctx.fillStyle = palette.obstacle;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = palette.coin;
  ctx.beginPath();
  ctx.arc(width * 0.7, height * 0.35, Math.min(width, height) * 0.12, 0, Math.PI * 2);
  ctx.fill();
}
