'use client';

import { Plus, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { AssistantContext } from '@/core/ports/assistant';
import { cn } from '@/lib/cn';
import type { PathIndexEntry } from './learner-situation';
import { pageGuide } from './page-guide';
import {
  isPlanRoute,
  PLANNER_KEY,
  resetPlanner,
  setScoutMode,
  useScoutMode,
} from './planner/planner-store';
import { ScoutMark } from './ScoutMark';
import {
  appendMessage,
  clearHistory,
  restoreHistory,
  setTutorOpen,
  settleTutorFocus,
  takeQueuedQuestion,
  tutorHiddenOn,
  type TutorMessage,
  useHistory,
  useQueuedQuestion,
  useTutorDocked,
  useTutorFocusRequest,
  useTutorOpen,
  useTutorScope,
  useTutorWithheld,
} from './tutor-store';

// The panel, its providers, the Markdown renderer and the app guide arrive on the first
// open, not with every page: the button alone is all a page pays for
// (tests/e2e/bundle-budget.spec.ts).
const ScoutPanel = lazy(() => import('./ScoutPanel').then((m) => ({ default: m.ScoutPanel })));
const PlannerPanel = lazy(() =>
  import('./planner/PlannerPanel').then((m) => ({ default: m.PlannerPanel })),
);

const TUTOR_STARTERS = [
  'Explain this step in plain words',
  'Show me a smaller example',
  'Why does this work?',
  'Give me a hint, not the answer',
];

/** Below md Scout is a full screen, not a card. */
const PHONE = '(max-width: 47.99rem)';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const ICON_BUTTON = cn(
  'text-muted hover:text-fg hover:bg-raised rounded-control inline-flex size-5 shrink-0 items-center justify-center',
  'transition-press active:scale-98',
  FOCUS,
);

/*
 * The shortcut's label follows the keyboard: the Command sign on a Mac, Ctrl elsewhere.
 * The server cannot know, so it renders none and the client fills it in.
 */
const noSubscribe = () => () => {};
function useShortcutLabel(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘J' : 'Ctrl J'),
    () => null,
  );
}

/**
 * Holds a value as it was when the panel mounted. The focus request is spent as soon as the
 * panel mounts, but the question box arrives later, with the lazy chunk, and still needs it.
 */
function KeepFirst({
  value,
  children,
}: {
  value: boolean;
  children: (value: boolean) => React.ReactNode;
}) {
  const [kept] = useState(value);
  return children(kept);
}

/** The trigger: top right of a page, or docked in a lesson's own bar. */
export function AskScoutButton({
  className,
  labelClassName,
  showShortcut = false,
  onClick,
}: {
  className?: string;
  /** A tight bar hides the words on a phone; the mark and the accessible name stay. */
  labelClassName?: string;
  /** The shortcut beside the words, from md up, where there is a keyboard to press it on. */
  showShortcut?: boolean;
  onClick: () => void;
}) {
  const shortcut = useShortcutLabel();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ask Scout AI"
      aria-keyshortcuts="Meta+J Control+J"
      title="Ask Scout AI"
      className={cn(
        'border-border bg-surface text-fg hover:border-border-strong hover:bg-raised inline-flex items-center gap-1 rounded-full border text-sm font-medium',
        'transition-press active:scale-98',
        FOCUS,
        className,
      )}
    >
      <ScoutMark size={16} />
      <span className={labelClassName}>Ask Scout AI</span>
      {showShortcut && shortcut ? (
        <kbd className="text-faint font-sans text-sm font-normal max-md:hidden">{shortcut}</kbd>
      ) : null}
    </button>
  );
}

/**
 * Scout AI, the study assistant: in the app's navigation (ScoutNavButton), a lesson's bar,
 * or the corner of any other page, and on Command or Ctrl and J. It opens the
 * same assistant as the coding simulator. In a lesson it is a tutor that knows the step on
 * screen (tutor-store.ts); on any other page it is a guide that knows what the page offers
 * (page-guide.ts). Either way it carries a map of the whole app (app-guide.ts), so it can
 * say where anything is from anywhere. It answers in Markdown with highlighted code, and connects the same three
 * ways: your Claude account through MCP, your API key, or Claude Code on this machine.
 */
export function StudyAssistant({
  shell = false,
  paths = [],
  latestNews,
}: {
  /** In the app shell a phone's tab bar is the bottom edge, so the button sits above it. */
  shell?: boolean;
  /** Every path by its lesson ids, so Scout can say where the learner is and what is next. */
  paths?: readonly PathIndexEntry[];
  /** The newest news edition, YYYY-MM-DD. */
  latestNews?: string;
}) {
  const pathname = usePathname();
  const scope = useTutorScope();
  const open = useTutorOpen();
  const docked = useTutorDocked();
  const withheld = useTutorWithheld();
  // True only for the render in which the learner opened the panel; spent once it mounts.
  const opening = useTutorFocusRequest();
  // A question a page asked on the learner's behalf (askTutor), waiting for the panel.
  const queued = useQueuedQuestion();

  // Scout plans only where a "Plan with Scout" control opened it, on Learn or the builder.
  // Its conversation is kept, so planning again from there picks up where it was left.
  const mode = useScoutMode();
  const planning = mode === 'plan' && isPlanRoute(pathname);
  const key = planning ? PLANNER_KEY : (scope?.key ?? `page:${pathname}`);
  const history = useHistory(key);
  // "New chat" never loses a conversation by surprise: the cleared one waits here until the
  // next question, so Undo can put it back.
  const [cleared, setCleared] = useState<{
    key: string;
    messages: TutorMessage[];
    undoPlanner?: () => void;
  } | null>(null);
  const canUndo = cleared?.key === key && history.length === 0;

  // Command or Ctrl and J opens and closes Scout AI from anywhere; Escape closes it. A
  // document listener, not state. Never animated beyond the sheet's own short entrance.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        setTutorOpen(false);
        return;
      }
      if (event.key.toLowerCase() !== 'j' || !(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      setTutorOpen(!open);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // The first render after an open carries the focus and the entrance; then both are spent,
  // so a layout that remounts the panel neither slides it in again nor takes focus.
  useEffect(() => {
    if (open) settleTutorFocus();
  }, [open]);

  // Planning ends when Scout closes or the learner leaves Learn and the builder, and a
  // question asked from the page is a question about the page. Either way: the usual Scout.
  useEffect(() => {
    if (mode === 'plan' && (!open || queued || !isPlanRoute(pathname))) setScoutMode('ask');
  }, [mode, open, queued, pathname]);

  // On a phone Scout fills the screen. The keyboard covers the bottom of the layout
  // viewport without resizing it (iOS), so the panel follows the visual viewport: its
  // question box stays just above the keys and nothing behind it scrolls into view.
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = sheet.current;
    const viewport = window.visualViewport;
    if (!open || !element || !viewport) return;
    const phone = window.matchMedia(PHONE);
    const fit = () => {
      if (!phone.matches) {
        element.style.removeProperty('top');
        element.style.removeProperty('height');
        return;
      }
      element.style.top = `${viewport.offsetTop}px`;
      element.style.height = `${viewport.height}px`;
    };
    fit();
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    phone.addEventListener('change', fit);
    return () => {
      viewport.removeEventListener('resize', fit);
      viewport.removeEventListener('scroll', fit);
      phone.removeEventListener('change', fit);
    };
  }, [open]);

  // In a lesson Scout tutors the step on screen; anywhere else it guides: which option on
  // the page fits, where to start, what each part is for.
  const guide = useMemo(() => (scope ? null : pageGuide(pathname)), [scope, pathname]);

  const context = useMemo<AssistantContext>(
    () =>
      scope
        ? {
            mode: 'tutor',
            taskTitle: scope.title,
            statement: scope.onScreen,
            language: scope.language ?? '',
            code: scope.code ?? '',
            output: '',
          }
        : {
            mode: 'guide',
            taskTitle: guide?.title ?? 'Understory',
            statement: guide?.offers ?? '',
            language: '',
            code: '',
            output: '',
          },
    [scope, guide],
  );

  // On a phone the sheet covers the page a link opens, so following one closes it; desktop
  // keeps the conversation beside the page.
  const followLink = useCallback(() => {
    if (window.innerWidth < 768) setTutorOpen(false);
  }, []);

  if (withheld || tutorHiddenOn(pathname)) return null;

  const close = () => setTutorOpen(false);

  return (
    <>
      {open || docked ? null : (
        // Bottom right, the same margin from both screen edges; on a phone in the app shell
        // the tab bar is the bottom edge. Both clear the home indicator (globals.css).
        <span
          className={cn(
            'fixed right-2 z-30 md:right-3 md:bottom-3 print:hidden',
            shell ? 'scout-fab-shell' : 'scout-fab',
          )}
        >
          <AskScoutButton
            className="shadow-float h-5 px-1.5 max-md:size-6 max-md:justify-center max-md:px-0"
            labelClassName="max-md:sr-only"
            showShortcut
            onClick={() => setTutorOpen(true)}
          />
        </span>
      )}
      {open ? (
        <aside
          ref={sheet}
          aria-label="Scout AI"
          data-from={docked ? 'top' : 'bottom'}
          // From lg up the panel docks beside the page instead of floating over it
          // (globals.css gives the page and its footer the room).
          data-dock={shell ? 'shell' : 'focus'}
          data-enter={opening ? '' : undefined}
          className={cn(
            'scout-sheet bg-surface text-fg md:shadow-float md:rounded-panel pt-safe pb-safe fixed z-40 flex flex-col overflow-hidden md:pt-0 md:pb-0 print:hidden',
            // The whole screen on a phone, clear of the notch and the home indicator. On a
            // tablet a card that grows from the button that opened it: up from the
            // bottom-right corner, or down from a lesson's bar.
            docked
              ? 'inset-0 md:inset-x-auto md:top-9 md:right-3 md:bottom-auto md:left-auto md:w-50'
              : 'inset-0 md:inset-x-auto md:top-auto md:right-3 md:bottom-3 md:left-auto md:w-50',
            // Docked: a second card on the shell's desk, or a full-height column beside a
            // focus screen, ruled off from it and flat, since it no longer floats.
            shell
              ? 'xl:border-border xl:shadow-edge xl:top-1 xl:right-1 xl:bottom-1 xl:w-(--scout-dock) xl:border'
              : 'lg:border-border lg:top-0 lg:right-0 lg:bottom-0 lg:w-(--scout-dock) lg:rounded-none lg:border-l lg:shadow-none',
          )}
        >
          <header
            className={cn(
              'rule-b flex h-6 shrink-0 items-center gap-1 pr-1 pl-2',
              // Beside a focus screen its rule continues the screen's own header rule.
              !shell && 'lg:box-content lg:h-8',
            )}
          >
            <ScoutMark size={20} />
            <h2 className="text-sm font-semibold">Scout AI</h2>
            <p className="text-muted min-w-0 flex-1 truncate text-sm">
              {planning ? (
                'Planning a path'
              ) : (
                <>
                  <span className="sr-only">on </span>
                  {scope?.title ?? guide?.title}
                </>
              )}
            </p>
            {history.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setCleared({
                    key,
                    messages: history,
                    ...(planning ? { undoPlanner: resetPlanner() } : {}),
                  });
                  clearHistory(key);
                }}
                aria-label="New chat"
                title="New chat. You can undo it."
                className={ICON_BUTTON}
              >
                <Plus aria-hidden size={16} strokeWidth={2} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={close}
              aria-label="Close Scout AI"
              title="Close (Esc)"
              className={ICON_BUTTON}
            >
              <X aria-hidden size={16} strokeWidth={2} />
            </button>
          </header>
          {canUndo ? (
            <div
              role="status"
              className="rule-b text-muted flex h-5 shrink-0 items-center justify-between gap-1 pr-1 pl-2 text-sm"
            >
              <span>Conversation cleared.</span>
              <button
                type="button"
                onClick={() => {
                  restoreHistory(key, cleared.messages);
                  cleared.undoPlanner?.();
                  setCleared(null);
                }}
                className={cn(
                  'text-fg hover:bg-raised rounded-control inline-flex h-4 items-center px-1 font-medium',
                  'transition-press active:scale-98',
                  FOCUS,
                )}
              >
                Undo
              </button>
            </div>
          ) : null}
          <KeepFirst value={opening}>
            {(focusOnOpen) => (
              <Suspense
                fallback={
                  <div className="text-muted flex items-center gap-1 p-2 text-sm">
                    <ScoutMark size={16} thinking />
                    Opening Scout AI…
                  </div>
                }
              >
                {planning ? (
                  <PlannerPanel
                    pathname={pathname}
                    paths={paths}
                    {...(latestNews ? { latestNews } : {})}
                    onFollowLink={followLink}
                    transcript={history}
                    onMessage={(message) => appendMessage(key, message)}
                    thinkingMark={<ScoutMark size={16} thinking />}
                    autoFocus={false}
                  />
                ) : (
                  <ScoutPanel
                    pathname={pathname}
                    paths={paths}
                    {...(latestNews ? { latestNews } : {})}
                    onFollowLink={followLink}
                    context={context}
                    queued={queued}
                    takeQueued={takeQueuedQuestion}
                    transcript={history}
                    onMessage={(message) => appendMessage(key, message)}
                    {...(guide
                      ? {
                          greeting: 'Where do you want to go?',
                          intro:
                            'Scout AI knows the whole app and this page. Ask where something is, where to start, or what to do next.',
                          placeholder: 'Ask Scout AI about the course',
                          suggestions: guide.starters,
                        }
                      : {
                          greeting: 'What would you like to understand?',
                          intro:
                            'Scout AI sees the step you are on. Ask about an idea, the code or the exercise.',
                          placeholder: 'Ask Scout AI about this step',
                          suggestions: TUTOR_STARTERS,
                        })}
                    thinkingMark={<ScoutMark size={16} thinking />}
                    autoFocus={focusOnOpen}
                  />
                )}
              </Suspense>
            )}
          </KeepFirst>
        </aside>
      ) : null}
    </>
  );
}
