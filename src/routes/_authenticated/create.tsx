import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QuestionFlow } from "@/components/QuestionFlow";
import { useI18n } from "@/i18n";
import { analyzePrompt, GenerationError, type Answers, type Question } from "@/lib/engine/pipeline";

const searchSchema = z.object({ prompt: z.string().optional() });

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create — GameForge AI" },
      { name: "description", content: "Describe your game idea and let GameForge AI build it." },
    ],
  }),
  validateSearch: searchSchema,
  component: CreatePage,
});

type Stage = "prompt" | "questions";

function CreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { prompt: prefill } = Route.useSearch();

  const [prompt, setPrompt] = useState(prefill ?? "");
  const [stage, setStage] = useState<Stage>("prompt");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (prefill) setPrompt(prefill);
  }, [prefill]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = prompt.trim();
    if (!clean) {
      setError(t("create.emptyPrompt"));
      return;
    }
    if (clean.length < 12) {
      setError(t("create.shortPrompt"));
      return;
    }

    try {
      const analysis = analyzePrompt(clean);
      if (analysis.questions.length > 0) {
        setQuestions(analysis.questions);
        setAnswers({});
        setStage("questions");
      } else {
        // No questions needed — go straight to generating
        void navigate({ to: "/generating", search: { prompt: clean, answers: "{}" } });
      }
    } catch (err) {
      const code = err instanceof GenerationError ? err.code : (err as { code?: string })?.code;
      if (code === "empty_prompt") setError(t("create.emptyPrompt"));
      else if (code === "short_prompt") setError(t("create.shortPrompt"));
      else if (code === "unknown_type") setError(t("create.notDetected"));
      else setError(t("common.error"));
    }
  };

  const handleQuestionsDone = (finalAnswers: Answers) => {
    const clean = prompt.trim();
    void navigate({
      to: "/generating",
      search: { prompt: clean, answers: JSON.stringify(finalAnswers) },
    });
  };

  if (stage === "questions") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="eyebrow">{t("create.title")}</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{t("questions.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("questions.subtitle")}</p>
        </div>
        <QuestionFlow
          questions={questions}
          answers={answers}
          onAnswers={setAnswers}
          onDone={handleQuestionsDone}
          onCancel={() => setStage("prompt")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="eyebrow">{t("brand.name")}</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">{t("create.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("create.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          ref={textareaRef}
          id="game-prompt"
          rows={5}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setError(null);
          }}
          placeholder={t("dashboard.promptPlaceholder")}
          className="resize-none text-base"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" size="lg" className="w-full sm:w-auto">
          <Sparkles className="mr-2 size-4" />
          {t("create.cta")}
        </Button>
      </form>

      {/* Quick-pick examples */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">{t("dashboard.examples")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            "A coin collector in a magical forest, 5 coins per level, 3 levels",
            "A space shooter game with 3 waves of alien enemies, hard",
            "A dodge game on ice where I avoid falling rocks",
            "Collect coins in a city skyline, normal difficulty",
          ].map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setPrompt(example);
                setError(null);
                textareaRef.current?.focus();
              }}
              className="rounded-xl border border-border bg-card p-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card/80 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
