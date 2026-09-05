import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, RotateCcw } from "lucide-react";


import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { createGameInstance } from "@/lib/engine/pipeline";
import type { GameConfig, GameStats, GameStatus } from "@/lib/engine/types";
import type { GameEngine } from "@/lib/engine/GameEngine";
import { cn } from "@/lib/utils";

const OBJECTIVE_TEXT: Record<string, string> = {
  "game.objectiveCoin": "game.objectiveCoin",
  "game.objectiveDodge": "game.objectiveDodge",
  "game.objectiveShooter": "game.objectiveShooter",
};

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(query.matches || navigator.maxTouchPoints > 0);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return coarse;
}

export function GameCanvas({ config, className }: { config: GameConfig; className?: string }) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [stats, setStats] = useState<GameStats | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const coarse = useCoarsePointer();

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const node = wrapperRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      /* fullscreen may be blocked by the browser; keep playing inline */
    }
  }, []);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createGameInstance(canvas, config, {
      onStatus: setStatus,
      onStats: setStats,
    });
    engineRef.current = engine;
    engine.initialize();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // A new config rebuilds the game from template + config.
  }, [config]);

  const play = useCallback(() => engineRef.current?.start(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const restart = useCallback(() => engineRef.current?.restart(), []);

  const overlay = useMemo(() => {
    if (status === "ready") return t("game.ready");
    if (status === "paused") return t("game.paused");
    if (status === "game_over") return t("game.gameOver");
    if (status === "level_complete") return t("game.levelComplete");
    if (status === "completed") return t("game.completed");
    return null;
  }, [status, t]);

  const objectiveKey = stats?.objectiveKey ?? "game.objectiveCoin";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t("game.score")}: <strong className="text-foreground">{stats?.score ?? 0}</strong>
        </span>
        {config.type !== "dodge" && (
          <span>
            {t("game.coins")}: <strong className="text-foreground">{stats?.coins ?? 0}</strong>
            {stats?.coinsTotal ? `/${stats.coinsTotal}` : ""}
          </span>
        )}
        <span>
          {t("game.level")}: <strong className="text-foreground">{stats?.level ?? 1}</strong>/{config.levels}
        </span>
        {config.type === "shooter" && (
          <>
            <span>
              {t("game.wave")}: <strong className="text-foreground">{stats?.wave ?? 1}</strong>/{config.waves}
            </span>
            <span>
              {t("game.xp")}: <strong className="text-foreground">{stats?.xp ?? 0}</strong>
            </span>
            <span>
              {t("game.lives")}: <strong className="text-foreground">{stats?.lives ?? 0}</strong>
            </span>
          </>
        )}
        <span>
          {t("game.time")}: <strong className="text-foreground">{Math.floor(stats?.time ?? 0)}s</strong>
        </span>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card shadow-panel">
        <canvas
          ref={canvasRef}
          className="block h-[52vh] max-h-[560px] min-h-[260px] w-full touch-none"
          aria-label={t("game.objective")}
        />
        {overlay && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 px-4 text-center backdrop-blur-sm">
            <p className="text-lg font-semibold text-foreground">{overlay}</p>
            <p className="text-xs text-muted-foreground">{t(OBJECTIVE_TEXT[objectiveKey] ?? objectiveKey)}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {status === "playing" ? (
          <Button onClick={pause} variant="secondary" size="sm">
            <Pause className="mr-1 size-4" /> {t("preview.pause")}
          </Button>
        ) : (
          <Button onClick={play} size="sm">
            <Play className="mr-1 size-4" />
            {status === "paused" ? t("preview.resume") : t("preview.play")}
          </Button>
        )}
        <Button onClick={restart} variant="outline" size="sm">
          <RotateCcw className="mr-1 size-4" /> {t("preview.restart")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("game.controlsHint")}</span>
      </div>

      {coarse && <TouchControls engineRef={engineRef} showShoot={config.type === "shooter"} />}
    </div>
  );
}

function TouchControls({
  engineRef,
  showShoot,
}: {
  engineRef: React.MutableRefObject<GameEngine | null>;
  showShoot: boolean;
}) {
  const { t } = useI18n();
  const held = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const setAxis = (x: number, y: number) => {
    held.current = { x, y };
    engineRef.current?.setVirtualAxis(x, y);
  };

  const dirProps = (x: number, y: number) => ({
    onPointerDown: (event: React.PointerEvent) => {
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      setAxis(x, y);
    },
    onPointerUp: () => setAxis(0, 0),
    onPointerCancel: () => setAxis(0, 0),
    onPointerLeave: () => setAxis(0, 0),
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  });

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine?.setVirtualAxis(0, 0);
      engine?.setVirtualShoot(false);
    };
  }, [engineRef]);

  const padClass =
    "flex size-16 select-none items-center justify-center rounded-xl border border-border bg-card/80 text-lg font-semibold text-foreground active:bg-primary active:text-primary-foreground";

  return (
    <div className="flex items-end justify-between gap-4 pt-1">
      <div className="grid grid-cols-3 grid-rows-3 gap-1" aria-label={t("controls.move")}>
        <span />
        <button type="button" className={padClass} {...dirProps(0, -1)}>
          ↑
        </button>
        <span />
        <button type="button" className={padClass} {...dirProps(-1, 0)}>
          ←
        </button>
        <span />
        <button type="button" className={padClass} {...dirProps(1, 0)}>
          →
        </button>
        <span />
        <button type="button" className={padClass} {...dirProps(0, 1)}>
          ↓
        </button>
        <span />
      </div>
      {showShoot && (
        <button
          type="button"
          className="size-20 select-none rounded-full border border-primary bg-primary/20 text-sm font-semibold text-foreground active:bg-primary active:text-primary-foreground"
          onPointerDown={(event) => {
            event.preventDefault();
            engineRef.current?.setVirtualShoot(true);
          }}
          onPointerUp={() => engineRef.current?.setVirtualShoot(false)}
          onPointerCancel={() => engineRef.current?.setVirtualShoot(false)}
          onPointerLeave={() => engineRef.current?.setVirtualShoot(false)}
        >
          {t("controls.shoot")}
        </button>
      )}
    </div>
  );
}
