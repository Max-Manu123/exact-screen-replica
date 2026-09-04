import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Coins,
  Crosshair,
  Gamepad2,
  Plus,
  Share2,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShareModal } from "@/components/ShareModal";
import { useI18n } from "@/i18n";
import { deleteGame, listGames, type GameRecord } from "@/lib/games";

export const Route = createFileRoute("/_authenticated/games")({
  head: () => ({
    meta: [
      { title: "My Games — GameForge AI" },
      { name: "description", content: "All games you've created with GameForge AI." },
    ],
  }),
  component: GamesPage,
});

const TYPE_ICONS = {
  coin_collector: Coins,
  dodge: Shield,
  shooter: Crosshair,
} as const;

function GamesPage() {
  const { t } = useI18n();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareGame, setShareGame] = useState<GameRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteGame(deleteId);
      setGames((prev) => prev.filter((g) => g.id !== deleteId));
      toast.success(t("myGames.deleted"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("myGames.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("myGames.subtitle")}</p>
        </div>
        <Button asChild size="sm">
          <Link to="/create">
            <Plus className="mr-1 size-4" />
            {t("dashboard.createGame")}
          </Link>
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="panel h-40 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-border py-20 text-center">
          <Gamepad2 className="size-12 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">{t("myGames.empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("myGames.createFirst")}</p>
          </div>
          <Button asChild>
            <Link to="/create">
              <Plus className="mr-1 size-4" />
              {t("dashboard.createGame")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => {
            const Icon = TYPE_ICONS[game.game_type as keyof typeof TYPE_ICONS] ?? Gamepad2;
            const date = new Date(game.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            return (
              <div
                key={game.id}
                className="panel group flex flex-col gap-4 rounded-2xl p-4 transition-shadow hover:shadow-glow"
              >
                {/* Title + type */}
                <div className="flex items-start gap-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate font-semibold text-foreground group-hover:text-primary transition-colors"
                      title={game.name}
                    >
                      {game.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{t(`templates.${game.game_type}`)}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{date}</span>
                  <span
                    className={
                      game.is_public
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {game.is_public ? t("myGames.public") : t("myGames.private")}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-auto flex gap-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link to="/game/$id" params={{ id: game.id }}>
                      {t("myGames.play")}
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShareGame(game)}
                    aria-label={t("myGames.share")}
                  >
                    <Share2 className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(game.id)}
                    aria-label={t("myGames.delete")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share modal */}
      {shareGame && (
        <ShareModal
          game={shareGame}
          open={!!shareGame}
          onOpenChange={(open) => !open && setShareGame(null)}
          onChanged={(updated) =>
            setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
          }
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("myGames.delete")}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the game. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? t("common.loading") : t("myGames.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
