import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from '../context/theme-context.js';

/**
 * Access the theme context.
 *
 * Returns: `{ theme, toggle }`.
 * Raises: Error if used outside a `<ThemeProvider>`.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx;
}
