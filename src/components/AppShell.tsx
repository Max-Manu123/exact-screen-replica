import { Link, useRouter } from "@tanstack/react-router";
import { Gamepad2, LayoutDashboard, LogOut, Menu, Settings, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { signOut } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/create", labelKey: "nav.create", icon: Sparkles },
  { to: "/games", labelKey: "nav.myGames", icon: Gamepad2 },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    await signOut();
    router.navigate({ to: "/" });
  };

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, labelKey, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          activeProps={{ className: "bg-muted text-foreground" }}
        >
          <Icon className="size-4" />
          {t(labelKey)}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-border p-4 md:flex">
        <div className="space-y-6">
          <Link to="/" className="block text-sm font-semibold text-gradient-brand">
            ✦ {t("brand.name")}
          </Link>
          {nav}
        </div>
        <Button variant="ghost" size="sm" className="justify-start" onClick={logout}>
          <LogOut className="mr-2 size-4" /> {t("nav.logout")}
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 md:hidden">
          <Link to="/" className="text-sm font-semibold text-gradient-brand">
            ✦ {t("brand.name")}
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setOpen((value) => !value)} aria-label={t("nav.dashboard")}>
            <Menu className="size-5" />
          </Button>
        </header>
        {open && (
          <div className="border-b border-border p-3 md:hidden">
            {nav}
            <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={logout}>
              <LogOut className="mr-2 size-4" /> {t("nav.logout")}
            </Button>
          </div>
        )}
        <main className={cn("flex-1 px-4 py-6 md:px-8")}>{children}</main>
      </div>
    </div>
  );
}
