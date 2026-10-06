'use client';

import { Plus, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { Segmented } from '@/components/ui/Segmented';
import type { AssistantContext } from '@/core/ports/assistant';
import { cn } from '@/lib/cn';
import type { PathIndexEntry } from './learner-situation';
import { pageGuide } from './page-guide';
import { PLANNER_KEY, resetPlanner, setScoutMode, useScoutMode } from './planner/planner-store';
import { ScoutMark } from './ScoutMark';
import {
  appendMessage,
  clearHistory,
  restoreHistory,
  setTutorOpen,
  settleTutorFocus,
  type TutorMessage,
  useHistory,
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

const MODES = [
  { value: 'ask', label: 'Ask' },
  { value: 'plan', label: 'Plan' },
] as const;

const TUTOR_STARTERS = [
  'Explain this step in plain words',
  'Show me a smaller example',
  'Why does this work?',
  'Give me a hint, not the answer',
];

/**
 * Pages with an assistant of their own (the coding simulator), or none on purpose: a timed
 * exam, checkpoint or test-out measures what you know without help, and print has no screen.
 */
const HIDDEN = [
  /^\/practise\/online-test\//,
  /^\/practise\/(exam|checkpoint|test-out)\//,
  /^\/print\//,
];

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

  // Plan mode has one conversation, the same on every page, so planning goes on while the
  // learner looks around the course.
  const mode = useScoutMode();
  const planning = mode === 'plan';
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

  if (withheld || HIDDEN.some((pattern) => pattern.test(pathname))) return null;

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
        // On a phone the sheet covers the page: the dimmed page behind marks where it ends,
        // and a tap there closes it. Desktop keeps the page in view and usable.
        <div
          aria-hidden
          onClick={close}
          className="scout-scrim bg-scrim fixed inset-0 z-40 md:hidden print:hidden"
        />
      ) : null}
      {open ? (
        <aside
          aria-label="Scout AI"
          data-from={docked ? 'top' : 'bottom'}
          // From lg up the panel docks beside the page instead of floating over it
          // (globals.css gives the page and its footer the room).
          data-dock={shell ? 'shell' : 'focus'}
          data-enter={opening ? '' : undefined}
          className={cn(
            'scout-sheet bg-surface text-fg shadow-float rounded-t-panel md:rounded-panel pb-safe fixed z-40 flex flex-col overflow-hidden md:pb-0 print:hidden',
            // A bottom sheet on a phone, edge to edge and clear of the home indicator. On
            // a tablet a card that grows from the button that opened it:
            // up from the bottom-right corner, or down from a lesson's bar.
            docked
              ? 'inset-x-0 bottom-0 md:inset-x-auto md:top-9 md:right-3 md:bottom-auto md:w-50'
              : 'inset-x-0 bottom-0 md:inset-x-auto md:right-3 md:bottom-3 md:w-50',
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
            <Segmented
              label="Scout mode"
              hideLabel
              inline
              options={MODES}
              value={mode}
              onChange={setScoutMode}
              className="ml-0.5 w-15 shrink-0"
            />
            <p className="text-muted min-w-0 flex-1 truncate text-sm">
              {planning ? null : (
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
