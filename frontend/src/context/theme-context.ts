import { createContext } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  /** Flip between light and dark. */
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/** localStorage key + attribute helpers, shared with the no-flash script in index.html. */
export const THEME_STORAGE_KEY = 'crane.theme';
