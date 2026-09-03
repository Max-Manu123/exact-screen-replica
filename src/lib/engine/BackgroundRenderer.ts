import type { Theme } from "./types";

interface Decoration {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

const SKY: Record<Theme, [string, string]> = {
  forest: ["#0d2a1f", "#154634"],
  space: ["#080a1f", "#141a3d"],
  city: ["#15161f", "#2a2334"],
  desert: ["#2b1d10", "#553417"],
  ice: ["#0e2333", "#1d4a63"],
};

/** Deterministic pseudo-random generator so a theme always looks the same. */
function seeded(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export class BackgroundRenderer {
  private decorations: Decoration[] = [];
  private theme: Theme;
  private width = 0;
  private height = 0;

  constructor(theme: Theme) {
    this.theme = theme;
  }

  setTheme(theme: Theme) {
    if (theme === this.theme) return;
    this.theme = theme;
    this.build(this.width, this.height);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.build(width, height);
  }

  private build(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      this.decorations = [];
      return;
    }
    const random = seeded(this.theme.length * 7919);
    const count = this.theme === "space" ? 70 : 30;
    this.decorations = Array.from({ length: count }, () => ({
      x: random() * width,
      y: random() * height,
      size: 2 + random() * (this.theme === "space" ? 2 : 26),
      alpha: 0.15 + random() * 0.5,
    }));
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number, elapsed: number) {
    if (width !== this.width || height !== this.height) this.resize(width, height);
    const [top, bottom] = SKY[this.theme] ?? SKY.forest;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    for (const dot of this.decorations) {
      ctx.globalAlpha = dot.alpha;
      switch (this.theme) {
        case "space": {
          ctx.fillStyle = "#ffffff";
          const twinkle = 0.6 + 0.4 * Math.sin(elapsed * 2 + dot.x);
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, dot.size * twinkle * 0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "forest": {
          ctx.fillStyle = "#0b3b28";
          ctx.beginPath();
          ctx.moveTo(dot.x, dot.y + dot.size);
          ctx.lineTo(dot.x + dot.size * 0.5, dot.y);
          ctx.lineTo(dot.x + dot.size, dot.y + dot.size);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "city": {
          ctx.fillStyle = "#20222f";
          ctx.fillRect(dot.x, height - dot.size * 3, dot.size, dot.size * 3);
          ctx.fillStyle = "#f7d98c";
          ctx.globalAlpha = dot.alpha * 0.6;
          ctx.fillRect(dot.x + dot.size * 0.3, height - dot.size * 2.4, dot.size * 0.25, dot.size * 0.25);
          break;
        }
        case "desert": {
          ctx.fillStyle = "#6d4520";
          ctx.beginPath();
          ctx.ellipse(dot.x, height - dot.size, dot.size * 2, dot.size, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "ice": {
          ctx.fillStyle = "#bfe6ff";
          ctx.beginPath();
          ctx.arc(dot.x, (dot.y + elapsed * 12) % height, dot.size * 0.25, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
    ctx.restore();

    // Ground line for side-view themes.
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, height - 6, width, 6);
    ctx.restore();
  }
}
