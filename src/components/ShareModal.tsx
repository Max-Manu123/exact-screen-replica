import { useState } from "react";
import { Copy, Lock, Globe } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { publicUrlForSlug, updateGame, type GameRecord } from "@/lib/games";

export function ShareModal({
  game,
  open,
  onOpenChange,
  onChanged,
}: {
  game: GameRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: (game: GameRecord) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const url = publicUrlForSlug(game.share_slug);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const togglePrivacy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await updateGame(game.id, { is_public: !game.is_public });
      onChanged?.(next);
      toast.success(next.is_public ? t("share.nowPublic") : t("share.nowPrivate"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.text")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
            <Button variant="secondary" onClick={copy} aria-label={t("share.copyLink")}>
              <Copy className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${game.name} — ${url}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("share.whatsapp")}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(game.name)}&url=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("share.x")}
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={togglePrivacy} disabled={busy}>
              {game.is_public ? <Lock className="mr-1 size-4" /> : <Globe className="mr-1 size-4" />}
              {game.is_public ? t("share.makePrivate") : t("share.makePublic")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {game.is_public ? t("myGames.public") : t("myGames.private")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
