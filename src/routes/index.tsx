import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WaitlistModal } from "@/components/WaitlistModal";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GameForge AI — Turn Your Ideas Into Playable Games" },
      {
        name: "description",
        content:
          "Describe a game idea and GameForge AI builds a playable 2D browser game you can edit, save and share with a public link.",
      },
      { property: "og:title", content: "GameForge AI — Turn Your Ideas Into Playable Games" },
      {
        property: "og:description",
        content: "Describe your idea, generate a playable 2D game, then edit and share it instantly.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useI18n();
  const [waitlist, setWaitlist] = useState(false);

  return (
    <div className="min-h-screen bg-background bg-hero-glow">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="text-sm font-semibold text-gradient-brand">✦ {t("brand.name")}</span>
        <div className="flex items-center gap-2">
          <a href="#how" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
            {t("nav.howItWorks")}
          </a>
          <a href="#pricing" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
            {t("nav.pricing")}
          </a>
          <Button asChild size="sm" variant="outline">
            <Link to="/auth">{t("nav.signIn")}</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl">
          <span className="text-gradient-brand">{t("landing.headline")}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          {t("landing.subheadline")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/create">
              {t("landing.ctaPrimary")} <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#how">{t("landing.ctaSecondary")}</a>
          </Button>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold text-foreground">{t("landing.howItWorksTitle")}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((step) => (
            <div key={step} className="panel rounded-2xl p-5">
              <p className="eyebrow">0{step}</p>
              <h3 className="mt-2 font-semibold text-foreground">{t(`landing.step${step}Title`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(`landing.step${step}Text`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold text-foreground">{t("landing.shareTitle")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{t("landing.shareText")}</p>
      </section>

      <section id="pricing" className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold text-foreground">{t("landing.pricingTitle")}</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">{t("landing.pricingSubtitle")}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="panel rounded-2xl p-6">
            <h3 className="font-semibold text-foreground">{t("pricing.free")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("pricing.freeText")}</p>
            <Button asChild className="mt-4 w-full" variant="outline">
              <Link to="/create">{t("landing.ctaPrimary")}</Link>
            </Button>
          </div>
          <div className="panel rounded-2xl p-6 shadow-glow">
            <h3 className="font-semibold text-foreground">{t("pricing.pro")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("pricing.proText")}</p>
            <Button className="mt-4 w-full" onClick={() => setWaitlist(true)}>
              {t("pricing.goPro")}
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
        {t("landing.footer")}
      </footer>

      <WaitlistModal open={waitlist} onOpenChange={setWaitlist} source="landing" />
    </div>
  );
}
