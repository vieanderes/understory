'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTheme, writeTheme } from '@/components/theme/ThemeToggle';
import { setPrefs, usePrefs } from './prefs';

/** The platform's shortcut list, as this editor implements it. */
export const SHORTCUTS: [string, string][] = [
  ['⌘ F / Ctrl F', 'Find'],
  ['⌘ G / ⇧ ⌘ G', 'Find next / previous'],
  ['⌘ S / Ctrl S', 'Save'],
  ['F9', 'Run code'],
  ['⌘ / / Ctrl /', 'Toggle comment'],
  ['Ctrl Space', 'Simple autocomplete'],
  ['⌥ ↑ / ⌥ ↓', 'Move line up / down'],
  ['Ctrl Shift M', 'Leave the editor'],
];

interface SettingsPopoverProps {
  onClose: () => void;
}

/**
 * Editor settings from the left rail: dark theme, Default or Vim editing and the keyboard
 * shortcuts, as on the platform. Escape or a click outside closes it.
 */
export function SettingsPopover({ onClose }: SettingsPopoverProps) {
  const theme = useTheme();
  const prefs = usePrefs();
  const [view, setView] = useState<'settings' | 'shortcuts'>('settings');
  const ref = useRef<HTMLDivElement>(null);
  const modeId = useId();
  const themeId = useId();

  // Listens to the document for a click outside: an event subscription, not state.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button, select')?.focus();
    const onDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Editor settings"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="bg-surface text-fg rounded-panel shadow-float absolute bottom-0 left-full z-40 ml-1 flex w-40 flex-col gap-1 p-2"
    >
      {view === 'settings' ? (
        <>
          <div className="flex items-center">
            <h2 className="text-base font-semibold">Editor settings</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="text-muted hover:text-fg rounded-control ml-auto inline-flex size-4 items-center justify-center"
            >
              <X aria-hidden size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="rule-t flex min-h-5 items-center gap-1 pt-1">
            <span id={themeId} className="text-sm">
              Dark theme
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={theme === 'dark'}
              aria-labelledby={themeId}
              onClick={() => writeTheme(theme === 'dark' ? 'light' : 'dark')}
              className={
                theme === 'dark'
                  ? 'bg-fg ml-auto flex h-3 w-5 items-center justify-end rounded-full p-0.5'
                  : 'bg-border-strong ml-auto flex h-3 w-5 items-center justify-start rounded-full p-0.5'
              }
            >
              <span className="bg-surface size-2 rounded-full" />
            </button>
          </div>
          <div className="rule-t flex min-h-5 items-center gap-1 pt-1">
            <label htmlFor={modeId} className="text-sm">
              Editor mode
            </label>
            <select
              id={modeId}
              value={prefs.vim ? 'vim' : 'default'}
              onChange={(event) => setPrefs({ vim: event.target.value === 'vim' })}
              className="bg-surface border-border rounded-control ml-auto h-4 border px-1 text-sm"
            >
              <option value="default">Default</option>
              <option value="vim">Vim</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => setView('shortcuts')}
            className="rule-t hover:bg-raised flex min-h-5 items-center pt-1 text-left text-sm underline underline-offset-4"
          >
            Keyboard shortcuts
            <ChevronRight aria-hidden size={16} strokeWidth={2} className="ml-auto" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setView('settings')}
            className="text-muted hover:text-fg flex min-h-4 items-center gap-0.5 text-sm"
          >
            <ChevronLeft aria-hidden size={16} strokeWidth={2} />
            Editor settings
          </button>
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          <dl className="flex flex-col gap-0.5 text-sm">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={action} className="flex gap-1">
                <dt className="text-muted min-w-0 flex-1">{action}</dt>
                <dd className="font-mono">{keys}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
