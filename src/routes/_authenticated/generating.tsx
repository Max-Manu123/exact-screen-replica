import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { generateGame, PIPELINE_STEPS } from "@/lib/engine/pipeline";
import type { Answers } from "@/lib/engine/pipeline";
import { incrementDailyGenerationCount, insertGame } from "@/lib/games";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

const searchSchema = z.object({
  prompt: z.string().optional(),
  answers: z.string().default("{}"),
});

export const Route = createFileRoute("/_authenticated/generating")({
  head: () => ({
    meta: [{ title: "Generating — GameForge AI" }],
  }),
  validateSearch: searchSchema,
  component: GeneratingPage,
});

type Stage = "running" | "saving" | "error";

function GeneratingPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { prompt, answers: answersRaw } = Route.useSearch();

  const [completedStep, setCompletedStep] = useState(-1);
  const [stage, setStage] = useState<Stage>("running");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const didRun = useRef(false);

  const run = () => {
    setStage("running");
    setCompletedStep(-1);
    setErrorMessage(null);
    didRun.current = true;

    let parsedAnswers: Answers = {};
    try {
      parsedAnswers = JSON.parse(answersRaw) as Answers;
    } catch {
      // invalid JSON — use empty answers
    }

    generateGame(
      prompt,
      (stepIndex) => setCompletedStep(stepIndex),
      350,
      parsedAnswers,
    )
      .then(async (result) => {
        setStage("saving");
        // Increment daily limit only after successful generation
        await incrementDailyGenerationCount();
        const record = await insertGame({
          name: result.name,
          original_prompt: result.prompt,
          game_type: result.type,
          game_config: result.config,
        });
        track("game_saved", { game_type: result.type });
        await navigate({ to: "/game/$id", params: { id: record.id } });
      })
      .catch((err: unknown) => {
        console.error(err);
        setStage("error");
        const code = (err as { code?: string })?.code;
        if (code === "empty_prompt" || code === "short_prompt") {
          setErrorMessage(t("create.shortPrompt"));
        } else {
          setErrorMessage(t("generating.error"));
        }
      });
  };

  useEffect(() => {
    if (!didRun.current) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSteps = PIPELINE_STEPS.length;
  const progress = stage === "saving"
    ? 100
    : Math.round(((completedStep + 1) / totalSteps) * 90);

  if (stage === "error") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-20 text-center">
        <AlertCircle className="size-12 text-destructive" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("generating.error")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {errorMessage ?? t("common.error")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={run}>
            <RotateCcw className="mr-2 size-4" />
            {t("generating.tryAgain")}
          </Button>
          <Button variant="outline" onClick={() => void navigate({ to: "/create" })}>
            {t("create.title")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-16">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary mb-4">
          <Sparkles className="size-7" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t("generating.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2 px-4">"{prompt}"</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {PIPELINE_STEPS.map((stepKey, index) => {
          const done = completedStep >= index;
          const active = completedStep === index - 1 && stage === "running";
          return (
            <div
              key={stepKey}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-all duration-300",
                done
                  ? "border-primary/30 bg-primary/5"
                  : active
                    ? "border-border bg-card"
                    : "border-transparent bg-transparent opacity-40",
              )}
            >
              {done ? (
                <CheckCircle2 className="size-5 shrink-0 text-primary" />
              ) : active ? (
                <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
              ) : (
                <div className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/30" />
              )}
              <span
                className={cn(
                  "text-sm font-medium",
                  done || active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t(stepKey)}
              </span>
            </div>
          );
        })}

        {/* Saving step */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3 transition-all duration-300",
            stage === "saving"
              ? "border-primary/30 bg-primary/5"
              : "border-transparent bg-transparent opacity-40",
          )}
        >
          {stage === "saving" ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
          ) : (
            <div className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/30" />
          )}
          <span
            className={cn(
              "text-sm font-medium",
              stage === "saving" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {t("common.saving")}
          </span>
        </div>
      </div>
    </div>
  );
}
