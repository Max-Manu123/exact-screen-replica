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
    <div
      ref={wrapperRef}
      className={cn(
        "flex flex-col gap-3",
        isFullscreen && "h-screen w-screen justify-center bg-background p-2 sm:p-4",
        className,
      )}
    >

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

      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl border border-border bg-card shadow-panel",
          isFullscreen && "min-h-0 flex-1",
        )}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "block w-full touch-none",
            isFullscreen ? "h-full" : "h-[52vh] max-h-[560px] min-h-[260px]",
          )}
          style={{ 
            touchAction: isFullscreen ? "none" : "auto",
            maxWidth: "100%",
            maxHeight: isFullscreen ? "100%" : "560px"
          }}
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
        <Button onClick={toggleFullscreen} variant="outline" size="sm">
          {isFullscreen ? (
            <>
              <Minimize className="mr-1 size-4" /> {t("game.exitFullscreen")}
            </>
          ) : (
            <>
              <Maximize className="mr-1 size-4" /> {t("game.fullscreen")}
            </>
          )}
        </Button>

        {!coarse && config.type === "shooter" && (
          <span className="text-xs text-muted-foreground">
            Coloque o mouse sobre o canvas e clique com o botão esquerdo para atirar
          </span>
        )}
        {!coarse && config.type !== "shooter" && (
          <span className="text-xs text-muted-foreground">{t("game.controlsHint")}</span>
        )}
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
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });

  const handleJoystickMove = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxDistance = rect.width / 2;
    
    const normalizedDistance = Math.min(distance, maxDistance) / maxDistance;
    const angle = Math.atan2(deltaY, deltaX);
    
    const x = Math.cos(angle) * normalizedDistance;
    const y = Math.sin(angle) * normalizedDistance;
    
    setJoystickPosition({ x, y });
    engineRef.current?.setVirtualAxis(x, y);
  };

  const handleJoystickStart = (event: React.PointerEvent) => {
    event.preventDefault();
    setJoystickActive(true);
    handleJoystickMove(event.clientX, event.clientY);
  };

  const handleJoystickMoveEvent = (event: React.PointerEvent) => {
    event.preventDefault();
    if (joystickActive) {
      handleJoystickMove(event.clientX, event.clientY);
    }
  };

  const handleJoystickEnd = () => {
    setJoystickActive(false);
    setJoystickPosition({ x: 0, y: 0 });
    engineRef.current?.setVirtualAxis(0, 0);
  };

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine?.setVirtualAxis(0, 0);
      engine?.setVirtualShoot(false);
    };
  }, [engineRef]);

  return (
    <div className="flex items-end justify-between gap-4 pt-1">
      {/* Virtual Joystick */}
      <div
        ref={joystickRef}
        className="relative size-32 select-none rounded-full border-2 border-border bg-card/80"
        onPointerDown={handleJoystickStart}
        onPointerMove={handleJoystickMoveEvent}
        onPointerUp={handleJoystickEnd}
        onPointerCancel={handleJoystickEnd}
        onPointerLeave={handleJoystickEnd}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={t("controls.move")}
      >
        {/* Joystick knob */}
        <div
          className="absolute size-12 rounded-full bg-primary/50 transition-transform"
          style={{
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${joystickPosition.x * 40}px), calc(-50% + ${joystickPosition.y * 40}px))`,
          }}
        />
      </div>

      {/* Shoot button */}
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
