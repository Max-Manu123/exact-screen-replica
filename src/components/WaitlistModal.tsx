import { useState } from "react";

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
import { isValidEmail, joinWaitlist } from "@/lib/games";

export function WaitlistModal({
  open,
  onOpenChange,
  source = "landing",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "duplicate">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === "loading") return; // no double submits
    setError(null);
    if (!isValidEmail(email)) {
      setError(t("waitlist.invalidEmail"));
      return;
    }
    setState("loading");
    try {
      const result = await joinWaitlist(email, source);
      setState(result === "duplicate" ? "duplicate" : "done");
    } catch {
      setState("idle");
      setError(t("common.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("waitlist.title")}</DialogTitle>
          <DialogDescription>{t("waitlist.text")}</DialogDescription>
        </DialogHeader>

        {state === "done" || state === "duplicate" ? (
          <div className="space-y-2">
            <p className="font-medium text-foreground">
              {state === "duplicate" ? t("waitlist.already") : t("waitlist.success")}
            </p>
            <p className="text-sm text-muted-foreground">{t("waitlist.successText")}</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t("waitlist.emailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={state === "loading"} className="w-full">
              {state === "loading" ? t("common.loading") : t("waitlist.notifyMe")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
