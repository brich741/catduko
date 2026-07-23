import type { Settings } from "../core/schema";

let mediaQuery: MediaQueryList | null = null;
let onSystemChange: (() => void) | null = null;

function applyEffectiveTheme(theme: Settings["theme"]): void {
  const effective =
    theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
  document.documentElement.dataset.theme = effective;
}

/** Applies the current theme setting and keeps it in sync with OS changes while "system" is selected. */
export function initTheme(getTheme: () => Settings["theme"]): void {
  applyEffectiveTheme(getTheme());

  if (!mediaQuery) {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  }
  if (onSystemChange) mediaQuery.removeEventListener("change", onSystemChange);
  onSystemChange = () => {
    if (getTheme() === "system") applyEffectiveTheme("system");
  };
  mediaQuery.addEventListener("change", onSystemChange);
}

export function updateTheme(theme: Settings["theme"]): void {
  applyEffectiveTheme(theme);
}
