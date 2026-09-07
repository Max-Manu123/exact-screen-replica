import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bell, Sparkles } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QuestionFlow } from "@/components/QuestionFlow";
import { WaitlistModal } from "@/components/WaitlistModal";
import { useI18n } from "@/i18n";
import { track } from "@/lib/analytics";
import { analyzePrompt, GenerationError, type Answers, type Question } from "@/lib/engine/pipeline";
import { detectUnsupportedGenre } from "@/lib/engine/GameTypeDetector";
import { canGenerateGame } from "@/lib/games";

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

type Stage = "prompt" | "questions" | "unsupported";

function CreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { prompt: prefill } = Route.useSearch();

  const [prompt, setPrompt] = useState(prefill ?? "");
  const [stage, setStage] = useState<Stage>("prompt");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [unsupportedGenre, setUnsupportedGenre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (prefill) setPrompt(prefill);
  }, [prefill]);

  const genres = [
    { emoji: "🔫", name: t("create.genreShooter"), desc: t("create.genreShooterDesc") },
    { emoji: "🪙", name: t("create.genreCoin"), desc: t("create.genreCoinDesc") },
    { emoji: "🏃", name: t("create.genreDodge"), desc: t("create.genreDodgeDesc") },
  ];

  const examples = [
    { emoji: "🔫", text: t("create.exampleShooter") },
    { emoji: "🪙", text: t("create.exampleCoin") },
    { emoji: "🏃", text: t("create.exampleDodge") },
  ];

  const showUnsupported = (clean: string) => {
    const genre = detectUnsupportedGenre(clean);
    setUnsupportedGenre(genre);
    setStage("unsupported");
    track("unsupported_game_type", { detected_type: genre ?? "unknown" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    // Check daily limit before proceeding
    const { allowed } = await canGenerateGame();
    if (!allowed) {
      track("daily_limit_reached");
      setWaitlistOpen(true);
      return;
    }

    setLoading(true);

    try {
      const analysis = analyzePrompt(clean);
      track("game_generation_started", { game_type: analysis.type });
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
      else if (code === "unknown_type") showUnsupported(clean);
      else setError(t("common.error"));
    } finally {
      setLoading(false);
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

  if (stage === "unsupported") {
    const genreLabel = unsupportedGenre
      ? t(`create.genre_${unsupportedGenre}`)
      : t("create.notDetected");
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="panel rounded-2xl p-6">
          <h1 className="text-xl font-semibold text-foreground">
            {t("create.unsupportedTitle").replace("{genre}", genreLabel)}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("create.unsupportedText")}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-foreground">
            <span>🔫 {t("create.genreShooter")}</span>
            <span>•</span>
            <span>🪙 {t("create.genreCoin")}</span>
            <span>•</span>
            <span>🏃 {t("create.genreDodge")}</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => setWaitlistOpen(true)}>
              <Bell className="mr-2 size-4" />
              {t("create.notifyMe")}
            </Button>
            <Button variant="outline" onClick={() => setStage("prompt")}>
              {t("create.back")}
            </Button>
          </div>
        </div>
        <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="eyebrow">{t("brand.name")}</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">{t("create.createTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("create.createSubtitle")}</p>
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

        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={loading}>
          <Sparkles className="mr-2 size-4" />
          {loading ? t("common.loading") : t("create.cta")}
        </Button>
      </form>

      {/* Supported genres */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">{t("create.genresIntro")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {genres.map((genre) => (
            <div key={genre.name} className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-semibold text-foreground">
                {genre.emoji} {genre.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{genre.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Clickable prompt examples */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">{t("create.examplesTitle")}</p>
        <div className="grid gap-2">
          {examples.map((example) => (
            <button
              key={example.text}
              type="button"
              onClick={() => {
                setPrompt(`${example.text}`);
                setError(null);
                textareaRef.current?.focus();
              }}
              className="rounded-xl border border-border bg-card p-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card/80 hover:text-foreground"
            >
              {example.emoji} {example.text}
            </button>
          ))}
        </div>
      </div>

      {/* Free-form ideas are welcome */}
      <div className="rounded-xl border border-dashed border-border p-4">
        <p className="text-sm font-semibold text-foreground">{t("create.otherIdeaTitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("create.otherIdeaText")}</p>
      </div>

      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </div>
  );
}
