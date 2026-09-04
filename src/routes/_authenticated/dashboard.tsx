import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Clock, Coins, Crosshair, Gamepad2, Plus, Shield, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { listGames, type GameRecord } from "@/lib/games";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GameForge AI" },
      { name: "description", content: "Your GameForge AI dashboard." },
    ],
  }),
  component: DashboardPage,
});

const EXAMPLE_PROMPTS = [
  "A coin collector game in a space station with 3 levels",
  "A dodge game where I avoid falling ice blocks in an arctic tundra",
  "A shooter game in a city, 3 waves of enemies, hard difficulty",
];

const TYPE_ICONS = {
  coin_collector: Coins,
  dodge: Shield,
  shooter: Crosshair,
} as const;

function GameTypeBadge({ type }: { type: string }) {
  const { t } = useI18n();
  const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS] ?? Gamepad2;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      <Icon className="size-3" />
      {t(`templates.${type}`)}
    </span>
  );
}

function RecentGameCard({ game }: { game: GameRecord }) {
  const { t } = useI18n();
  const date = new Date(game.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="panel group flex flex-col gap-3 rounded-2xl p-4 transition-shadow hover:shadow-glow">
      <div className="flex items-start justify-between gap-2">
        <h3
          className="line-clamp-1 font-semibold text-foreground group-hover:text-primary transition-colors"
          title={game.name}
        >
          {game.name}
        </h3>
        <GameTypeBadge type={game.game_type} />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3 shrink-0" />
        {date}
      </p>
      <div className="mt-auto flex gap-2">
        <Button asChild size="sm" className="flex-1">
          <Link to="/game/$id" params={{ id: game.id }}>
            {t("myGames.play")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { t } = useI18n();
  const [recentGames, setRecentGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listGames()
      .then((games) => setRecentGames(games.slice(0, 4)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      {/* Hero create box */}
      <section className="panel rounded-3xl bg-hero-glow p-8">
        <p className="eyebrow">{t("brand.version")}</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">
          {t("dashboard.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>

        <Button asChild size="lg" className="mt-6">
          <Link to="/create">
            <Sparkles className="mr-2 size-4" />
            {t("dashboard.createGame")}
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>

        {/* Example prompts */}
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("dashboard.examples")}</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <Link
                key={prompt}
                to="/create"
                search={{ prompt }}
                className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {prompt}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Recent games */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("dashboard.recent")}</h2>
          {recentGames.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/games">
                {t("nav.myGames")} <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          )}
        </div>

        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="panel h-32 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : recentGames.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
            <Gamepad2 className="size-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-foreground">{t("myGames.empty")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("myGames.createFirst")}</p>
            </div>
            <Button asChild size="sm">
              <Link to="/create">
                <Plus className="mr-1 size-4" />
                {t("dashboard.createGame")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentGames.map((game) => (
              <RecentGameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
