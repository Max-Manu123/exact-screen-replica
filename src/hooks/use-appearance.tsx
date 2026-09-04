import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Appearance = "dark" | "light";

const STORAGE_KEY = "gameforge.appearance";

const AppearanceContext = createContext<{
  appearance: Appearance;
  setAppearance: (next: Appearance) => void;
} | null>(null);

function apply(appearance: Appearance) {
  const root = document.documentElement;
  root.classList.toggle("light", appearance === "light");
  root.classList.toggle("dark", appearance === "dark");
  root.style.colorScheme = appearance;
}

export function readStoredAppearance(): Appearance {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setState] = useState<Appearance>("dark");

  useEffect(() => {
    const stored = readStoredAppearance();
    setState(stored);
    apply(stored);
  }, []);

  const setAppearance = useCallback((next: Appearance) => {
    setState(next);
    apply(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo(() => ({ appearance, setAppearance }), [appearance, setAppearance]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/** Applies the stored appearance once after hydration. */
export function useAppearanceEffect() {
  useEffect(() => {
    apply(readStoredAppearance());
  }, []);
}

export function useAppearance(): { appearance: Appearance; setAppearance: (next: Appearance) => void } {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used inside AppearanceProvider");
  return ctx;
}
