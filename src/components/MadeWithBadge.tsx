import { useState } from "react";
import { X } from "lucide-react";

import { useI18n } from "@/i18n";

/**
 * "Made with GameForge AI" badge. Closable for the current view only
 * (no persistence) and always links to the real landing route.
 */
export function MadeWithBadge() {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-border bg-card/90 py-1 pl-3 pr-1 text-xs shadow-glow backdrop-blur">
      <a href="/" className="font-medium text-foreground hover:text-primary">
        ✦ {t("badge.label")}
      </a>
      <button
        type="button"
        aria-label={t("badge.close")}
        onClick={() => setHidden(true)}
        className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
