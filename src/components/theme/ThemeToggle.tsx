'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { revealTheme } from '@/features/motion/theme-reveal';
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

/*
 * The theme lives on <html data-theme>. It is external state as far as React is
 * concerned, so it is read with useSyncExternalStore instead of being mirrored into
 * useState inside an effect.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function writeTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode can refuse storage. The theme still applies for this visit.
  }
  listeners.forEach((notify) => notify());
}

/** The app's theme, for other controls that switch it (the online-test settings). */
export function useTheme(): Theme {
  return useSyncExternalStore<Theme>(subscribe, readTheme, () => 'light');
}

export function ThemeToggle() {
  const theme = useTheme();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={(event) => revealTheme(() => writeTheme(next), event.currentTarget)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="text-muted hover:text-fg hover:bg-raised rounded-control inline-flex size-5 items-center justify-center transition-colors duration-150 active:scale-95"
    >
      <Icon aria-hidden size={20} strokeWidth={2} />
    </button>
  );
}
