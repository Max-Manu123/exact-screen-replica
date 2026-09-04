import { useCallback, useEffect, useState } from "react";

export type Appearance = "dark" | "light";

const STORAGE_KEY = "gameforge.appearance";

function apply(appearance: Appearance) {
  const root = document.documentElement;
  root.classList.toggle("light", appearance === "light");
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

/** Applies the stored appearance once after hydration. */
export function useAppearanceEffect() {
  useEffect(() => {
    apply(readStoredAppearance());
  }, []);
}

export function useAppearance(): { appearance: Appearance; setAppearance: (next: Appearance) => void } {
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

  return { appearance, setAppearance };
}
