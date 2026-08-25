import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ThemeContext,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemeContextValue,
} from '../context/theme-context.js';

/** Read the initial theme from the <html data-theme> the no-flash script set, else default. */
function initialTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  return attr === 'light' ? 'light' : 'dark';
}

/**
 * Theme provider (light / dark).
 *
 * Purpose: Own the active theme, apply it to `<html data-theme>` (which the CSS
 *   token overrides key off), and persist the choice. The initial value comes
 *   from the inline script in index.html, so there is no flash on load.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
