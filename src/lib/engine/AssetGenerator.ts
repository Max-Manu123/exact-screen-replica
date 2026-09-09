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

export function drawPlayer(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette, facingUp = false, character: "astronaut" | "ninja" | "robot" | "soldier" = "astronaut") {
  ctx.save();
  ctx.shadowColor = palette.player;
  ctx.shadowBlur = 18;
  ctx.fillStyle = palette.player;
  roundRect(ctx, e.x, e.y, e.w, e.h, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = palette.playerAccent;

  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  const eyeSize = Math.max(1.6, e.w * 0.07);

  switch (character) {
    case "astronaut":
      // Helmet with visor
      ctx.fillStyle = palette.playerAccent;
      const visorY = facingUp ? e.y + e.h * 0.28 : e.y + e.h * 0.35;
      ctx.beginPath();
      ctx.arc(e.x + e.w * 0.34, visorY, eyeSize, 0, Math.PI * 2);
      ctx.arc(e.x + e.w * 0.66, visorY, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "ninja":
      // Headband and eyes
      ctx.fillStyle = palette.playerAccent;
      ctx.fillRect(e.x + e.w * 0.1, e.y + e.h * 0.25, e.w * 0.8, e.h * 0.15);
      ctx.fillStyle = "#000000";
      const ninjaEyeY = facingUp ? e.y + e.h * 0.35 : e.y + e.h * 0.4;
      ctx.beginPath();
      ctx.arc(e.x + e.w * 0.35, ninjaEyeY, eyeSize * 1.2, 0, Math.PI * 2);
      ctx.arc(e.x + e.w * 0.65, ninjaEyeY, eyeSize * 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "robot":
      // Antenna and rectangular eyes
      ctx.strokeStyle = palette.playerAccent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, e.y);
      ctx.lineTo(cx, e.y - e.h * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, e.y - e.h * 0.2, e.w * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.playerAccent;
      const robotEyeY = facingUp ? e.y + e.h * 0.3 : e.y + e.h * 0.35;
      ctx.fillRect(e.x + e.w * 0.25, robotEyeY, e.w * 0.2, e.h * 0.12);
      ctx.fillRect(e.x + e.w * 0.55, robotEyeY, e.w * 0.2, e.h * 0.12);
      break;

    case "soldier":
      // Helmet and eyes
      ctx.fillStyle = palette.playerAccent;
      ctx.beginPath();
      ctx.arc(cx, e.y + e.h * 0.2, e.w * 0.3, Math.PI, 0);
      ctx.fill();
      const soldierEyeY = facingUp ? e.y + e.h * 0.35 : e.y + e.h * 0.4;
      ctx.beginPath();
      ctx.arc(e.x + e.w * 0.35, soldierEyeY, eyeSize, 0, Math.PI * 2);
      ctx.arc(e.x + e.w * 0.65, soldierEyeY, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  ctx.restore();
}

export function drawCoin(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette, phase = 0, collectibleType: "coin" | "gem" | "crystal" = "coin") {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2 + Math.sin(phase) * 2;
  const r = e.w / 2;
  ctx.save();
  ctx.shadowColor = palette.coin;
  ctx.shadowBlur = 14;
  ctx.fillStyle = palette.coin;

  switch (collectibleType) {
    case "coin":
      // Classic coin with inner circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = palette.coinAccent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case "gem":
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = palette.coinAccent;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;

    case "crystal":
      // Hexagonal crystal
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = palette.coinAccent;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
  }

  ctx.restore();
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette, enemyType: "robot" | "alien" | "drone" | "monster" = "robot") {
  ctx.save();
  ctx.shadowColor = palette.enemy;
  ctx.shadowBlur = 12;
  ctx.fillStyle = palette.enemy;

  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;

  switch (enemyType) {
    case "robot":
      // Classic triangle enemy
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
      ctx.arc(cx, e.y + e.h * 0.55, Math.max(2, e.w * 0.12), 0, Math.PI * 2);
      ctx.fill();
      break;

    case "alien":
      // Rounded alien shape with antennae
      ctx.beginPath();
      ctx.arc(cx, cy, e.w * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = palette.enemyAccent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - e.w * 0.2, e.y);
      ctx.lineTo(cx - e.w * 0.25, e.y - e.h * 0.15);
      ctx.moveTo(cx + e.w * 0.2, e.y);
      ctx.lineTo(cx + e.w * 0.25, e.y - e.h * 0.15);
      ctx.stroke();
      ctx.fillStyle = palette.enemyAccent;
      ctx.beginPath();
      ctx.arc(cx - e.w * 0.1, cy - e.h * 0.05, Math.max(2, e.w * 0.08), 0, Math.PI * 2);
      ctx.arc(cx + e.w * 0.1, cy - e.h * 0.05, Math.max(2, e.w * 0.08), 0, Math.PI * 2);
      ctx.fill();
      break;

    case "drone":
      // Small, fast drone shape
      ctx.beginPath();
      ctx.moveTo(cx, e.y);
      ctx.lineTo(e.x + e.w, cy);
      ctx.lineTo(cx, e.y + e.h);
      ctx.lineTo(e.x, cy);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = palette.enemyAccent;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, e.w * 0.15), 0, Math.PI * 2);
      ctx.fill();
      break;

    case "monster":
      // Larger, bulkier monster
      ctx.beginPath();
      ctx.moveTo(e.x + e.w * 0.2, e.y);
      ctx.lineTo(e.x + e.w * 0.8, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.4);
      ctx.lineTo(e.x + e.w * 0.8, e.y + e.h);
      ctx.lineTo(e.x + e.w * 0.2, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = palette.enemyAccent;
      ctx.beginPath();
      ctx.arc(cx - e.w * 0.15, cy, Math.max(2, e.w * 0.1), 0, Math.PI * 2);
      ctx.arc(cx + e.w * 0.15, cy, Math.max(2, e.w * 0.1), 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  ctx.restore();
}

export function drawObstacle(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette, obstacleType: "rock" | "spike" | "meteor" | "barrier" = "rock") {
  ctx.save();
  ctx.fillStyle = palette.obstacle;

  switch (obstacleType) {
    case "rock":
      // Rounded rock with shadow
      roundRect(ctx, e.x, e.y, e.w, e.h, 6);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#000000";
      roundRect(ctx, e.x + 3, e.y + e.h * 0.6, e.w - 6, e.h * 0.3, 4);
      ctx.fill();
      break;

    case "spike":
      // Triangular spike
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2, e.y + e.h * 0.3);
      ctx.lineTo(e.x + e.w * 0.7, e.y + e.h);
      ctx.lineTo(e.x + e.w * 0.3, e.y + e.h);
      ctx.closePath();
      ctx.fill();
      break;

    case "meteor":
      // Jagged meteor shape
      ctx.beginPath();
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      const r = e.w / 2;
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const radius = r * (0.7 + Math.random() * 0.3);
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = "#ff6600";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "barrier":
      // Rectangular barrier with stripes
      roundRect(ctx, e.x, e.y, e.w, e.h, 2);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#000000";
      for (let i = 0; i < 3; i++) {
        const offset = i * e.h * 0.25;
        ctx.fillRect(e.x, e.y + offset, e.w, e.h * 0.1);
      }
      break;
  }

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

export function drawPowerUp(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette, phase = 0) {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2 + Math.sin(phase) * 2;
  const r = e.w / 2;
  const type = e.powerUpType ?? "health";
  
  ctx.save();
  ctx.shadowColor = palette.coin;
  ctx.shadowBlur = 12;
  
  // Color based on type
  switch (type) {
    case "health":
      ctx.fillStyle = "#ff4444";
      break;
    case "shield":
      ctx.fillStyle = "#44aaff";
      break;
    case "speed":
      ctx.fillStyle = "#44ff44";
      break;
    case "double_score":
      ctx.fillStyle = "#ffaa44";
      break;
  }
  
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  
  // Icon based on type
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(10, r)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  let icon = "";
  switch (type) {
    case "health":
      icon = "+";
      break;
    case "shield":
      icon = "S";
      break;
    case "speed":
      icon = "⚡";
      break;
    case "double_score":
      icon = "×2";
      break;
  }
  
  ctx.fillText(icon, cx, cy);
  ctx.restore();
}

export function drawBoss(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette, bossType: "giant_robot" | "alien_boss" = "giant_robot") {
  ctx.save();
  ctx.shadowColor = palette.enemy;
  ctx.shadowBlur = 20;
  ctx.fillStyle = palette.enemy;

  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;

  switch (bossType) {
    case "giant_robot":
      // Large mechanical robot with armor plates
      ctx.beginPath();
      ctx.moveTo(cx, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.3);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.7);
      ctx.lineTo(cx, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h * 0.7);
      ctx.lineTo(e.x, e.y + e.h * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = palette.enemyAccent;
      // Armor plates
      ctx.fillRect(e.x + e.w * 0.2, e.y + e.h * 0.3, e.w * 0.2, e.h * 0.15);
      ctx.fillRect(e.x + e.w * 0.6, e.y + e.h * 0.3, e.w * 0.2, e.h * 0.15);
      // Core
      ctx.beginPath();
      ctx.arc(cx, e.y + e.h * 0.55, e.w * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "alien_boss":
      // Large alien with multiple eyes
      ctx.beginPath();
      ctx.arc(cx, cy, e.w * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = palette.enemyAccent;
      // Multiple eyes
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const eyeX = cx + Math.cos(angle) * e.w * 0.2;
        const eyeY = cy + Math.sin(angle) * e.w * 0.2;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, e.w * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      // Central eye
      ctx.beginPath();
      ctx.arc(cx, cy, e.w * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

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
