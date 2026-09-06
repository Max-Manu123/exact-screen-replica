import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, RotateCcw } from "lucide-react";


import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { createGameInstance } from "@/lib/engine/pipeline";
import type { GameConfig, GameStats, GameStatus } from "@/lib/engine/types";
import type { GameEngine } from "@/lib/engine/GameEngine";
import { track } from "@/lib/analytics";
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
      else {
        await node.requestFullscreen();
        track("fullscreen_used", { game_type: config.type });
      }
    } catch {
      /* fullscreen may be blocked by the browser; keep playing inline */
    }
  }, [config.type]);


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

  const play = useCallback(() => {
    engineRef.current?.start();
    track("game_played", { game_type: config.type });
  }, [config.type]);
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

        {coarse && (
          <TouchControls 
            engineRef={engineRef} 
            showShoot={config.type === "shooter"}
            canvasRef={canvasRef}
          />
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

        {!coarse && (
          <span className="text-xs text-muted-foreground">
            {config.type === "shooter" ? t("game.pcHintShooter") : t("game.pcHintMove")}
          </span>
        )}

      </div>
    </div>
  );
}

function TouchControls({
  engineRef,
  showShoot,
  canvasRef,
}: {
  engineRef: React.MutableRefObject<GameEngine | null>;
  showShoot: boolean;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const { t } = useI18n();
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);
  const shootButtonRef = useRef<HTMLButtonElement | null>(null);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const joystickPointerId = useRef<number | null>(null);
  const shootPointerId = useRef<number | null>(null);

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
    event.stopPropagation();
    joystickPointerId.current = event.pointerId;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setJoystickPosition({ x: 0, y: 0 });
    handleJoystickMove(event.clientX, event.clientY);
  };

  const handleJoystickMoveEvent = (event: React.PointerEvent) => {
    event.preventDefault();
    if (joystickPointerId.current === event.pointerId) {
      handleJoystickMove(event.clientX, event.clientY);
    }
  };

  const handleJoystickEnd = (event: React.PointerEvent) => {
    event.preventDefault();
    if (joystickPointerId.current === event.pointerId) {
      joystickPointerId.current = null;
      setJoystickPosition({ x: 0, y: 0 });
      engineRef.current?.setVirtualAxis(0, 0);
    }
  };

  const handleShootStart = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    shootPointerId.current = event.pointerId;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    engineRef.current?.setVirtualShoot(true);
  };

  const handleShootEnd = (event: React.PointerEvent) => {
    event.preventDefault();
    if (shootPointerId.current === event.pointerId) {
      shootPointerId.current = null;
      engineRef.current?.setVirtualShoot(false);
    }
  };

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine?.setVirtualAxis(0, 0);
      engine?.setVirtualShoot(false);
    };
  }, [engineRef]);

  return (
    <>
      {/* Virtual Joystick - positioned inside canvas */}
      <div
        ref={joystickRef}
        className="absolute bottom-4 left-4 z-10 touch-none select-none rounded-full border-2 border-border bg-card/80"
        style={{ 
          width: 'min(20vw, 120px)', 
          height: 'min(20vw, 120px)',
          maxWidth: '120px',
          maxHeight: '120px'
        }}
        onPointerDown={handleJoystickStart}
        onPointerMove={handleJoystickMoveEvent}
        onPointerUp={handleJoystickEnd}
        onPointerCancel={handleJoystickEnd}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={t("controls.move")}
      >
        {/* Joystick knob */}
        <div
          ref={joystickKnobRef}
          className="absolute rounded-full bg-primary/50"
          style={{
            left: "50%",
            top: "50%",
            width: '40%',
            height: '40%',
            transform: `translate(calc(-50% + ${joystickPosition.x * 40}px), calc(-50% + ${joystickPosition.y * 40}px))`,
          }}
        />
      </div>

      {/* Shoot button - positioned inside canvas */}
      {showShoot && (
        <button
          ref={shootButtonRef}
          type="button"
          className="absolute bottom-4 right-4 z-10 touch-none select-none rounded-full border border-primary bg-primary/20 text-sm font-semibold text-foreground active:bg-primary active:text-primary-foreground"
          style={{
            width: 'min(18vw, 100px)',
            height: 'min(18vw, 100px)',
            maxWidth: '100px',
            maxHeight: '100px'
          }}
          onPointerDown={handleShootStart}
          onPointerUp={handleShootEnd}
          onPointerCancel={handleShootEnd}
          onContextMenu={(event) => event.preventDefault()}
        >
          {t("controls.shoot")}
        </button>
      )}
    </>
  );
}
