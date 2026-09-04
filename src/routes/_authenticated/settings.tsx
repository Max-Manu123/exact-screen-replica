import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FeedbackForm } from "@/components/FeedbackForm";
import { useI18n } from "@/i18n";
import type { Language } from "@/i18n";
import { useAppearance } from "@/hooks/use-appearance";
import { signOut } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — GameForge AI" },
      { name: "description", content: "Manage your GameForge AI preferences." },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-4 rounded-2xl p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const { appearance, setAppearance } = useAppearance();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(console.error);
  }, []);

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out.");
    void navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
      </div>

      {/* Appearance */}
      <Section title={t("settings.appearance")}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setAppearance("dark")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
              appearance === "dark"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Moon className="size-4" /> {t("settings.dark")}
          </button>
          <button
            type="button"
            onClick={() => setAppearance("light")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
              appearance === "light"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sun className="size-4" /> {t("settings.light")}
          </button>
        </div>
      </Section>

      {/* Language */}
      <Section title={t("settings.language")}>
        <div className="flex gap-3">
          {(["en", "pt"] as Language[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                language === lang
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "en" ? "🇺🇸 English" : "🇧🇷 Português"}
            </button>
          ))}
        </div>
      </Section>

      {/* Feedback */}
      <Section title={t("feedback.title")}>
        <FeedbackForm />
      </Section>

      {/* Account */}
      <Section title={t("settings.profile")}>
        <div className="space-y-4">
          {email && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("settings.signedInAs")}</span>
              <span className="font-medium text-foreground">{email}</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            {t("nav.logout")}
          </Button>
        </div>
      </Section>

      {/* About */}
      <Section title={t("settings.about")}>
        <p className="text-sm text-muted-foreground">{t("settings.aboutText")}</p>
        <p className="text-xs text-muted-foreground/60">{t("brand.version")}</p>
      </Section>
    </div>
  );
}
