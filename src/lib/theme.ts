export type Theme = 'light' | 'dark';
export type ThemeChoice = Theme | 'system';

export const THEME_STORAGE_KEY = 'understory:theme';

/**
 * Runs synchronously in <head>, before first paint, so a dark-mode reader never sees a
 * light flash. Kept as a string because it must not wait for the React bundle.
 * A display preference is the one thing stored outside the event log: it has to be
 * readable before any JavaScript module loads.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem('${THEME_STORAGE_KEY}');var d=c==='dark'||((!c||c==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): Theme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}
