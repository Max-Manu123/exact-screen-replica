import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Lock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GameCanvas } from "@/components/GameCanvas";
import { MadeWithBadge } from "@/components/MadeWithBadge";

import { getPublicGame, type PublicGame } from "@/lib/public-games.functions";
import type { GameConfig } from "@/lib/engine/types";
import { sanitizeConfig } from "@/lib/engine/LevelDesignEngine";

export const Route = createFileRoute("/play/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Play — GameForge AI` },
      {
        name: "description",
        content: `Play a game created with GameForge AI. Share slug: ${params.slug}`,
      },
    ],
  }),
  component: PublicPlayPage,
});

type LoadState = "loading" | "ok" | "private" | "not_found";

function PublicPlayPage() {
  const { slug } = Route.useParams();
  const [state, setState] = useState<LoadState>("loading");
  const [game, setGame] = useState<PublicGame | null>(null);

  useEffect(() => {
    getPublicGame({ data: { slug } })
      .then((result) => {
        if (result.status === "ok") {
          setGame(result.game);
          setState("ok");
        } else {
          setState(result.status);
        }
      })
      .catch(() => setState("not_found"));
  }, [slug]);

  // The public page lives outside the authenticated layout, so we need to
  // wrap with I18nProvider here (the root already provides it, but this is safe).
  return (
    <div className="min-h-screen bg-background bg-hero-glow">
      {/* Minimal nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <a href="/" className="text-sm font-semibold text-gradient-brand">
          ✦ GameForge AI
        </a>
        <Button asChild size="sm">
          <Link to="/create">
            <Sparkles className="mr-1 size-3.5" />
            Create your own
          </Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 pt-4">
        {state === "loading" && <LoadingState />}
        {state === "not_found" && <NotFoundState />}
        {state === "private" && <PrivateState />}
        {state === "ok" && game && <PlayState game={game} />}
      </main>

      <MadeWithBadge />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading game…</p>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
      <p className="text-6xl">🎮</p>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Game not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This game link doesn't exist or has been removed.
        </p>
      </div>
      <Button asChild>
        <a href="/">
          Create your own game <ArrowRight className="ml-1 size-4" />
        </a>
      </Button>
    </div>
  );
}

function PrivateState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Lock className="size-7" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">This game is private</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The creator hasn't made this game public yet.
        </p>
      </div>
      <Button asChild>
        <a href="/">
          Create your own game <ArrowRight className="ml-1 size-4" />
        </a>
      </Button>
    </div>
  );
}

function PlayState({ game }: { game: PublicGame }) {
  const config: GameConfig = sanitizeConfig(game.game_config);

  return (
    <div className="space-y-6">
      {/* Game header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{game.name}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(game.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Canvas */}
      <GameCanvas config={config} />

      {/* CTA */}
      <div className="panel rounded-2xl p-6 text-center">
        <p className="font-semibold text-foreground">Create your own game with GameForge AI</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe your idea and turn it into a playable 2D game in seconds.
        </p>
        <Button asChild className="mt-4">
          <a href="/">
            <Sparkles className="mr-2 size-4" />
            Create your game
            <ArrowRight className="ml-2 size-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
