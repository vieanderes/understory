'use client';

import type { EditorView } from '@codemirror/view';
import {
  ArrowRightToLine,
  ChevronLeft,
  ChevronRight,
  ListIndentDecrease,
  ListIndentIncrease,
  Play,
  Redo2,
  Undo2,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { moveCaret, selectLineAtCaret, selectWordAtCaret, trackpadSteps } from './cursor';
import type { EditorLanguage } from './extensions';
import { insertSnippet, nextField } from './snippet';
import type { Suggestion } from './suggestions';
import {
  PINNED_KEYS,
  pressSymbolKey,
  symbolKeysFor,
  type SymbolAction,
  type SymbolKey,
} from './symbols';
import { useVisualViewport } from './useVisualViewport';

const ICON: Record<SymbolAction, typeof Undo2> = {
  indent: ListIndentIncrease,
  outdent: ListIndentDecrease,
  undo: Undo2,
  redo: Redo2,
};

/** One row of keys (`h-6`) and the 4 px above and below it: `h-7`. */
export const SYMBOL_BAR_HEIGHT = 56;
/** Both rows while typing: 4 + 48 + 4 + 48 + 4. The editor keeps the caret clear of it. */
export const EXTENDED_BAR_HEIGHT = 108;

/** A drag across the cursor keys moves one character per 12 px, one line per 24 px. */
const COLUMN_PX = 12;
const LINE_PX = 24;
/** Holding a cursor key repeats it, as a hardware arrow key does. */
const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 70;
/** Held this long, a key types its partner instead: the iOS keyboard's own long press. */
const LONG_PRESS_MS = 400;

const KEY =
  'rounded-control border-border bg-surface text-fg hover:bg-raised transition-press relative inline-flex h-6 shrink-0 items-center justify-center border font-mono text-base select-none active:scale-98 disabled:pointer-events-none disabled:opacity-40';

interface SymbolBarProps {
  viewRef: RefObject<EditorView | null>;
  /** While the editor has focus and the keyboard is up, the rows ride on top of it. */
  editorFocused: boolean;
  disabled?: boolean;
  /** Picks the order of the symbol keys (symbols.ts). */
  language?: EditorLanguage;
  /** Inside the full-screen editor the rows sit at its foot instead of riding the keyboard. */
  expanded?: boolean;
  /** For the suggestion row, which shows while typing (docs/MOBILE-EDITING.md). */
  suggestions?: readonly Suggestion[];
  /** A block from a suggestion is being filled: the Next key moves to its next gap. */
  fieldsActive?: boolean;
  onRun?: () => void;
  runLabel?: string;
}

/**
 * A key of the rows. A key must not take focus, or the on-screen keyboard closes and the
 * cursor is lost: the default of the press is cancelled, and the input goes in through
 * the EditorView, never through the DOM. The key acts when the finger lifts, not when it
 * lands, so that a swipe along the row scrolls it without typing: a scroll ends in
 * `pointercancel`, never in `pointerup`. It cannot wait for `click`, because WebKit sends
 * no click at all after a cancelled touch press. `click` is left for the keyboard, where
 * it is the only event.
 */
function PressKey({
  viewRef,
  onPress,
  onLongPress,
  children,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
  viewRef: RefObject<EditorView | null>;
  onPress: (view: EditorView) => void;
  /** Held for LONG_PRESS_MS, the key does this instead, once, and the lift does nothing. */
  onLongPress?: (view: EditorView) => void;
}) {
  /** A press that slides off the key does nothing. */
  const pressed = useRef(false);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(hold.current), []);
  function act(action: (view: EditorView) => void) {
    const view = viewRef.current;
    if (view) action(view);
  }
  function release() {
    clearTimeout(hold.current);
    pressed.current = false;
  }
  return (
    <button
      type="button"
      {...rest}
      onPointerDown={(event) => {
        event.preventDefault();
        pressed.current = true;
        clearTimeout(hold.current);
        if (onLongPress) {
          hold.current = setTimeout(() => {
            pressed.current = false;
            act(onLongPress);
          }, LONG_PRESS_MS);
        }
      }}
      onMouseDown={(event) => event.preventDefault()}
      onPointerUp={() => {
        if (pressed.current) act(onPress);
        release();
      }}
      onPointerCancel={release}
      onPointerLeave={release}
      // iOS opens its own callout on a held button. The long press is ours.
      onContextMenu={onLongPress ? (event) => event.preventDefault() : undefined}
      // `detail` counts pointer clicks. Zero means Enter or Space on the key.
      onClick={(event) => {
        if (event.detail === 0) act(onPress);
      }}
    >
      {children}
    </button>
  );
}

/**
 * Left and right, which are also a trackpad: a drag across either moves the caret by
 * characters sideways and by lines up and down. Holding one repeats it. The keys take
 * no part in scrolling (`touch-none`), so a drag is never taken for a swipe of the row.
 */
function CursorKeys({
  viewRef,
  disabled,
}: {
  viewRef: SymbolBarProps['viewRef'];
  disabled: boolean;
}) {
  const drag = useRef<{
    x: number;
    y: number;
    columns: number;
    lines: number;
    acted: boolean;
  } | null>(null);
  const timers = useRef<{
    delay?: ReturnType<typeof setTimeout>;
    every?: ReturnType<typeof setInterval>;
  }>({});

  function stopRepeat() {
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.every);
    timers.current = {};
  }
  useEffect(() => stopRepeat, []);

  function move(direction: 'left' | 'right' | 'up' | 'down', times = 1) {
    const view = viewRef.current;
    if (!view) return;
    for (let i = 0; i < times; i += 1) moveCaret(view, direction);
  }

  function key(direction: 'left' | 'right', label: string, Icon: typeof ChevronLeft): ReactNode {
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        data-key={`cursor-${direction}`}
        className={`${KEY} w-6 touch-none`}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, columns: 0, lines: 0, acted: false };
          stopRepeat();
          timers.current.delay = setTimeout(() => {
            timers.current.every = setInterval(() => {
              if (drag.current) drag.current.acted = true;
              move(direction);
            }, REPEAT_EVERY_MS);
          }, REPEAT_DELAY_MS);
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state) return;
          const columns = trackpadSteps(event.clientX - state.x, COLUMN_PX, state.columns);
          const lines = trackpadSteps(event.clientY - state.y, LINE_PX, state.lines);
          if (columns === 0 && lines === 0) return;
          stopRepeat();
          state.acted = true;
          state.columns += columns;
          state.lines += lines;
          move(columns > 0 ? 'right' : 'left', Math.abs(columns));
          move(lines > 0 ? 'down' : 'up', Math.abs(lines));
        }}
        onPointerUp={() => {
          stopRepeat();
          if (drag.current && !drag.current.acted) move(direction);
          drag.current = null;
        }}
        onPointerCancel={() => {
          stopRepeat();
          drag.current = null;
        }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          if (event.detail === 0) move(direction);
        }}
      >
        <Icon aria-hidden size={20} strokeWidth={2} />
      </button>
    );
  }

  return (
    <>
      {key('left', 'Move left', ChevronLeft)}
      {key('right', 'Move right', ChevronRight)}
    </>
  );
}

/**
 * One row of the characters a phone keyboard buries, and while the learner types, a
 * second row above it: suggestions on the left, the cursor keys and Run fixed on the
 * right. Why these and not more: docs/MOBILE-EDITING.md.
 */
export function SymbolBar({
  viewRef,
  editorFocused,
  disabled = false,
  language = 'js',
  expanded = false,
  suggestions = [],
  fieldsActive = false,
  onRun,
  runLabel = 'Run',
}: SymbolBarProps) {
  const viewport = useVisualViewport();
  const docked = !expanded && editorFocused && viewport.keyboard > 0;
  const extended = docked || expanded;

  function renderKey(key: SymbolKey) {
    const Icon = key.kind === 'action' ? ICON[key.action] : null;
    const alt = key.alt;
    return (
      <PressKey
        viewRef={viewRef}
        key={key.label}
        aria-label={key.label}
        title={alt ? `${key.label}. Hold for ${alt.label.toLowerCase()}` : key.label}
        data-key={key.kind === 'text' ? key.text : key.action}
        disabled={disabled}
        onPress={(view) => pressSymbolKey(view, key)}
        onLongPress={alt ? (view) => pressSymbolKey(view, key, true) : undefined}
        className={`${KEY} w-5`}
      >
        {Icon ? (
          <Icon aria-hidden size={20} strokeWidth={2} />
        ) : key.kind === 'text' ? (
          key.text
        ) : null}
        {alt?.kind === 'text' ? (
          // The partner a long press types, small in the corner as on a keyboard key.
          <span aria-hidden className="key-alt text-muted absolute">
            {alt.text}
          </span>
        ) : null}
      </PressKey>
    );
  }

  function chip(id: string, label: ReactNode, act: (view: EditorView) => void, ariaLabel?: string) {
    return (
      <PressKey
        viewRef={viewRef}
        key={id}
        aria-label={ariaLabel}
        disabled={disabled}
        onPress={act}
        className={`${KEY} min-w-5 gap-0.5 px-1 whitespace-pre`}
      >
        {label}
      </PressKey>
    );
  }

  const chips: ReactNode[] = [];
  if (fieldsActive) {
    chips.push(
      chip(
        'next-field',
        <>
          <ArrowRightToLine aria-hidden size={20} strokeWidth={2} />
          <span className="font-sans text-sm font-medium">Next</span>
        </>,
        (view) => void nextField(view),
        'Next gap',
      ),
    );
  }
  if (suggestions.length > 0) {
    for (const suggestion of suggestions) {
      chips.push(
        chip(`suggest-${suggestion.label}`, suggestion.label, (view) => {
          // The row may be a frame behind the typing. A stale chip does nothing.
          if (view.state.selection.main.head !== suggestion.to) return;
          insertSnippet(view, suggestion.template, suggestion.from, suggestion.to);
        }),
      );
    }
  } else if (!fieldsActive) {
    chips.push(
      chip(
        'select-word',
        <span className="font-sans text-sm font-medium">Select word</span>,
        (view) => void selectWordAtCaret(view),
      ),
      chip(
        'select-line',
        <span className="font-sans text-sm font-medium">Select line</span>,
        (view) => void selectLineAtCaret(view),
      ),
    );
  }

  const vv: CSSProperties = {
    '--vv-top': `${viewport.top}px`,
    '--vv-left': `${viewport.left}px`,
    '--vv-width': `${viewport.width}px`,
    '--vv-height': `${viewport.height}px`,
  } as CSSProperties;

  return (
    // The outer box keeps its place in the page while the rows are docked: no jump.
    <div className={expanded ? undefined : 'h-7'} data-testid="symbol-bar">
      <div data-docked={docked} style={vv} className="symbol-bar flex flex-col gap-0.5 py-0.5">
        {extended ? (
          <div
            role="toolbar"
            aria-label="Suggestions"
            aria-orientation="horizontal"
            className="flex h-6 items-center gap-0.5"
          >
            <div className="symbol-row flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
              {chips}
            </div>
            <div className="border-border flex shrink-0 items-center gap-0.5 border-l pl-0.5">
              <CursorKeys viewRef={viewRef} disabled={disabled} />
              {onRun && !expanded ? (
                <PressKey
                  viewRef={viewRef}
                  aria-label={runLabel}
                  title={runLabel}
                  disabled={disabled}
                  onPress={() => onRun()}
                  className={`${KEY} w-5`}
                >
                  <Play aria-hidden size={20} strokeWidth={2} />
                </PressKey>
              ) : null}
            </div>
          </div>
        ) : null}
        <div
          role="toolbar"
          aria-label="Symbols"
          aria-orientation="horizontal"
          className="flex h-6 items-center gap-0.5"
        >
          <div className="symbol-row flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {symbolKeysFor(language).map(renderKey)}
          </div>
          <div className="border-border flex shrink-0 items-center gap-0.5 border-l pl-0.5">
            {PINNED_KEYS.map(renderKey)}
          </div>
        </div>
      </div>
    </div>
  );
}
