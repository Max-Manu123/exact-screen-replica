import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import type { Answers, Question } from "@/lib/engine/QuestionEngine";
import type { Difficulty, Theme } from "@/lib/engine/types";

/** Smart follow-up questions (max 3). Answers are preserved when going back. */
export function QuestionFlow({
  questions,
  answers,
  onAnswers,
  onDone,
  onCancel,
}: {
  questions: Question[];
  answers: Answers;
  onAnswers: (answers: Answers) => void;
  onDone: (answers: Answers) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  const question = questions[index];
  if (!question) return null;

  const current = answers[question.key];

  const setAnswer = (value: string | number) => {
    setError(null);
    onAnswers({ ...answers, [question.key]: value } as Answers);
  };

  const next = () => {
    if (current === undefined) {
      setError(t("questions.invalid"));
      return;
    }
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setCustom("");
      setError(null);
    } else {
      onDone(answers);
    }
  };

  const applyCustom = () => {
    const parsed = Number.parseInt(custom, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t("questions.invalid"));
      return;
    }
    const min = question.min ?? 1;
    const max = question.max ?? 99;
    setAnswer(Math.min(max, Math.max(min, parsed)));
  };

  const isSelected = (value: string | number) =>
    current === value || current === String(value) || current === Number(value);

  return (
    <div className="panel space-y-5 rounded-2xl p-5">
      <div>
        <p className="eyebrow">{t("questions.step", { current: index + 1, total: questions.length })}</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">{t(question.titleKey)}</h2>
        <p className="text-sm text-muted-foreground">{t("questions.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {question.options.map((option) => (
          <Button
            key={String(option.value)}
            type="button"
            variant={isSelected(option.value) ? "default" : "outline"}
            size="sm"
            onClick={() => setAnswer(option.value as Theme | Difficulty | number)}
          >
            {option.labelKey ? t(option.labelKey) : option.label}
          </Button>
        ))}
      </div>

      {question.kind === "number" && (
        <div className="flex max-w-xs gap-2">
          <Input
            inputMode="numeric"
            placeholder={t("questions.custom")}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
          />
          <Button type="button" variant="secondary" onClick={applyCustom}>
            OK
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (index === 0 ? onCancel() : setIndex(index - 1))}
        >
          {t("questions.back")}
        </Button>
        <Button type="button" onClick={next}>
          {index + 1 < questions.length ? t("questions.continue") : t("questions.generate")}
        </Button>
        <Button type="button" variant="outline" onClick={() => onDone(answers)}>
          {t("questions.skip")}
        </Button>
      </div>
    </div>
  );
}
