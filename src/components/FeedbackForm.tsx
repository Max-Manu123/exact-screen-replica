import { useState } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { FEEDBACK_TYPES, sendFeedback, type FeedbackType } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export function FeedbackForm() {
  const { t } = useI18n();
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === "loading") return; // prevents duplicate submissions
    setError(null);
    if (message.trim().length === 0) {
      setError(t("feedback.empty"));
      return;
    }
    setState("loading");
    try {
      await sendFeedback({ type, message, rating });
      setState("done");
      setMessage("");
      setRating(null);
    } catch {
      setState("idle"); // message preserved on failure
      setError(t("feedback.error"));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("feedback.intro")}</p>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t("feedback.type")}</p>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_TYPES.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={type === option ? "default" : "outline"}
              onClick={() => setType(option)}
            >
              {t(`feedback.${option}`)}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="feedback-message">
          {t("feedback.message")}
        </label>
        <Textarea
          id="feedback-message"
          rows={4}
          value={message}
          placeholder={t("feedback.messagePlaceholder")}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t("feedback.rating")}</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value}`}
              onClick={() => setRating(rating === value ? null : value)}
              className="p-1"
            >
              <Star
                className={cn(
                  "size-5",
                  rating !== null && value <= rating ? "fill-primary text-primary" : "text-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {state === "done" && <p className="text-sm text-primary">{t("feedback.success")}</p>}

      <Button type="submit" disabled={state === "loading"}>
        {state === "loading" ? t("common.loading") : t("feedback.send")}
      </Button>
    </form>
  );
}
