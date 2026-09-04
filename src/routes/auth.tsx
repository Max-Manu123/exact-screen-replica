import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSafeInternalPath } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { isValidEmail } from "@/lib/games";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GameForge AI" },
      { name: "description", content: "Sign in to create, save and share your GameForge AI games." },
      { property: "og:title", content: "Sign in — GameForge AI" },
      { property: "og:description", content: "Sign in to create, save and share your GameForge AI games." },
    ],
  }),
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleAvailable, setGoogleAvailable] = useState(true);

  const goAfterAuth = () => {
    if (isSafeInternalPath(redirect)) {
      void router.navigate({ href: redirect });
      return;
    }
    void router.navigate({ to: "/dashboard" });
  };

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) goAfterAuth();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) goAfterAuth();
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirect]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!isValidEmail(email) || password.length < 6) {
      setError(t("auth.invalid"));
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (result.data.session) {
        if (mode === "signup") toast.success(t("auth.signedUp"));
        goAfterAuth();
      } else {
        toast.success(t("auth.signedUp"));
      }
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    try {
      await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth${
          isSafeInternalPath(redirect) ? `?redirect=${encodeURIComponent(redirect)}` : ""
        }`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      const unavailable =
        message.includes("provider") ||
        message.includes("unsupported") ||
        message.includes("not enabled") ||
        message.includes("disabled");
      if (unavailable) {
        setGoogleAvailable(false);
        toast.error(t("auth.googleUnavailable"));
      } else {
        toast.error(t("common.error"));
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-hero-glow px-4">
      <div className="panel w-full max-w-sm rounded-2xl p-6">
        <Link to="/" className="text-sm font-semibold text-gradient-brand">
          ✦ {t("brand.name")}
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          {mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
        </h1>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? t("common.loading") : mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
          </Button>
        </form>

        {googleAvailable && (
          <>
            <div className="my-4 text-center text-xs uppercase text-muted-foreground">{t("auth.or")}</div>
            <Button variant="outline" className="w-full" onClick={google}>
              {t("auth.google")}
            </Button>
          </>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? t("auth.toSignUp") : t("auth.toSignIn")}
        </button>
      </div>
    </div>
  );
}
