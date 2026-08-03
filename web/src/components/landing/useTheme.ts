import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "eunomia-theme";

/** Light is the default and dark is a preference — that decision is in the landing spec.
 *
 *  The dark values already exist as tokens (`:root[data-theme="dark"] .lp`); what was missing
 *  was anything to set that attribute. Order of precedence: an explicit past choice, then the
 *  operating system, then light.
 *
 *  Scoped to the landing on purpose: the tokens live under `.lp`, so flipping the attribute
 *  cannot disturb the dashboard, which keeps its own dark shell until its own redesign. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch {
      // Private mode / blocked storage: fall through to the OS preference.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      // Not being able to remember the choice is not a reason to fail setting it.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
