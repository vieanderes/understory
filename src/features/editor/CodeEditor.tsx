'use client';

import { Annotation, Compartment, EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { ChevronDown, Maximize2, Minimize2, Play } from 'lucide-react';
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/Button';
import { lockedFrame, locateRegion, parseLineRange } from '@/core/content/editable';
import { editableRegion } from './editable-region';
import {
  baseExtensions,
  editingExtensions,
  examKeymap,
  focusAfter,
  hasLazyGrammar,
  languageExtension,
  loadLazyGrammar,
  phoneExtensions,
  readOnlyExtension,
  saveKeymap,
  touchExtensions,
  type EditorLanguage,
} from './extensions';
import { hasFields } from './snippet';
import { suggest, type AssistMode } from './suggestions';
import { EXTENDED_BAR_HEIGHT, SYMBOL_BAR_HEIGHT, SymbolBar } from './SymbolBar';
import { editorTheme, largeTextTheme } from './theme';
import type { EditorTypecheck } from './typecheck-types';
import { COARSE_POINTER, PHONE_WIDTH, useMediaQuery } from './useMediaQuery';
import { useVisualViewport } from './useVisualViewport';

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: EditorLanguage;
  readOnly?: boolean;
  ariaLabel: string;
  /** The editor never gets shorter than this many lines, however little code it holds. */
  minLines?: number;
  /** Cmd or Ctrl with Enter, pressed inside the editor. */
  onRun?: () => void;
  /** Checks the code as it is typed and lists the type errors under the editor. */
  typecheck?: EditorTypecheck;
  /**
   * What the suggestion row above a phone keyboard may offer. `unplugged` (the default)
   * finishes words the learner started; `live` adds the language's vocabulary.
   * docs/MOBILE-EDITING.md, section 4. `exam` is the online test's editor
   * (docs/ONLINE-TEST.md): a fold gutter, find and replace, a completion list on
   * Ctrl-Space only, four-space indents, F9 to run and Ctrl-Shift-M to leave.
   */
  assist?: AssistMode;
  /** Vim keys. Loaded the first time it is turned on, and switched without a new editor. */
  vim?: boolean;
  /** Cmd or Ctrl with S, pressed inside the editor. Without it the key is the browser's. */
  onSave?: () => void;
  /**
   * Ctrl-Shift-M in the `exam` editor, where Tab indents. Without it, focus moves to the
   * next thing on the page that takes focus.
   */
  onLeave?: () => void;
  /** `large` sets code at the section size, for the online test's accessibility mode. */
  fontScale?: 'default' | 'large';
  /** Words the step knows about, such as its tables and columns. `live` only. */
  vocabulary?: readonly string[];
  /** The name of what `onRun` does, on the Run key and in the full-screen header. */
  runLabel?: string;
  /** One line on the last run, shown in the full-screen editor, where the results are out of sight. */
  runStatus?: string;
  /**
   * The row above the editor: its label and the step's own controls. On a touch screen the
   * Full screen key joins it at the end. Replaced by the full-screen header when open.
   */
  header?: ReactNode;
  /** The step's task, which the full-screen editor keeps one tap away. */
  task?: ReactNode;
  /** Locks the starter outside these lines ("5-9"). docs/CONTENT-GUIDE.md, "Editable region". */
  editableRegion?: { starter: string; lines: string };
  /** Names the document. A new name swaps in `value` with a fresh undo history. */
  documentKey?: string;
}

/*
 * The checker's client, its CodeMirror extension and the list of errors: a chunk of their
 * own, fetched only when a type-checked step is on screen. The compiler itself is a
 * separate worker file (src/adapters/typecheck/).
 */
const TypecheckLayer = lazy(() => import('./typecheck/TypecheckLayer'));

/**
 * Says so when the checker's chunk cannot be fetched, instead of taking the editor down.
 * LazyCodeEditor has its own boundary for the editor chunk; this one lives here so the
 * lesson route does not carry it.
 */
class CheckerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? (
      <p role="status" className="text-muted font-mono text-sm">
        Types are not checked: the checker did not load. The tests still run.
      </p>
    ) : (
      this.props.children
    );
  }
}

/** Marks a change that came from the `value` prop, so it is not reported back as typing. */
const fromProp = Annotation.define<boolean>();

/** The online test indents by four in every language. */
const EXAM_TAB_SIZE = 4;

/*
 * The online test's extras and Vim: chunks of their own, fetched on first use and kept
 * for every editor after (tests/e2e/bundle-budget.spec.ts).
 */
let examModule: typeof import('./exam') | null = null;
let vimModule: typeof import('./vim') | null = null;

/**
 * CodeMirror 6 behind a small, controlled-ish API. The document lives in CodeMirror:
 * `value` seeds it and replaces it only when it differs from what is typed (Reset),
 * because pushing every keystroke back through React would fight the cursor.
 *
 * This module is the only door to CodeMirror. It is reached through `LazyCodeEditor`,
 * so none of it is in the bundle of a learner who never opens a code step.
 */
export default function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  ariaLabel,
  minLines = 8,
  onRun,
  typecheck,
  assist = 'unplugged',
  vocabulary,
  runLabel = 'Run',
  runStatus,
  header,
  task,
  editableRegion: region,
  documentKey,
  vim = false,
  onSave,
  onLeave,
  fontScale = 'default',
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [compartments] = useState(() => ({
    language: new Compartment(),
    editing: new Compartment(),
    wrapping: new Compartment(),
    touch: new Compartment(),
    typecheck: new Compartment(),
    region: new Compartment(),
    exam: new Compartment(),
    vim: new Compartment(),
    scale: new Compartment(),
  }));
  const [focused, setFocused] = useState(false);
  const coarse = useMediaQuery(COARSE_POINTER);
  const phone = useMediaQuery(PHONE_WIDTH);
  const viewport = useVisualViewport();
  const [expandRequested, setExpanded] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const taskId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  /** The state the suggestion row reads. Only kept while there is a row to read it. */
  const [assistState, setAssistState] = useState<EditorState | null>(null);
  const assisted = coarse && !readOnly;
  // A step that is checked turns read-only, and a read-only editor has nothing to expand for.
  const expanded = expandRequested && assisted;
  const docked = assisted && !expanded && focused && viewport.keyboard > 0;

  // Read by the scroll margin at every scroll: the rows cover the keyboard's top edge
  // when docked, sit in the page at rest, and take no space from the full-screen editor.
  const barHeight = useRef(SYMBOL_BAR_HEIGHT);
  const assistOn = useRef(assisted);
  useEffect(() => {
    barHeight.current = expanded ? 0 : docked ? EXTENDED_BAR_HEIGHT : SYMBOL_BAR_HEIGHT;
    assistOn.current = assisted;
  });

  // The view is created once. It reaches the latest callbacks through this ref.
  const callbacks = useRef({ onChange, onRun, onSave, onLeave });
  useEffect(() => {
    callbacks.current = { onChange, onRun, onSave, onLeave };
  });

  const editing = (isReadOnly: boolean) =>
    isReadOnly ? readOnlyExtension(true) : editingExtensions(() => callbacks.current.onRun?.());
  const regionStarter = region?.starter;
  const regionLines = region?.lines;
  const locking = (isReadOnly: boolean) =>
    regionStarter !== undefined && regionLines !== undefined && !isReadOnly
      ? editableRegion(regionStarter, regionLines)
      : [];
  const wrapping = (isPhone: boolean) => (isPhone ? phoneExtensions() : []);
  const exam = assist === 'exam';
  const grammar = () => languageExtension(language, exam ? EXAM_TAB_SIZE : undefined);
  // The keys are here at once; search, folding and completion join when their chunk arrives.
  const examExtension = () =>
    exam
      ? [
          examKeymap(
            () => callbacks.current.onRun?.(),
            (view) => {
              const leave = callbacks.current.onLeave;
              if (!leave) return focusAfter(view);
              view.contentDOM.blur();
              leave();
            },
          ),
          examModule?.examExtensions(language) ?? [],
        ]
      : [];
  const scale = () => (fontScale === 'large' ? largeTextTheme(minLines) : []);

  // Built from the props of the render that calls it: at mount, and for a new document.
  const createState = (doc: string) =>
    EditorState.create({
      doc,
      // With a region, the caret waits at the start of the first line to write.
      selection: EditorSelection.cursor(regionStart(doc, region) ?? 0),
      extensions: [
        // First, so Vim sees every key before the other keymaps do.
        compartments.vim.of(vim && vimModule ? vimModule.vimExtensions() : []),
        baseExtensions(ariaLabel),
        editorTheme(minLines),
        compartments.scale.of(scale()),
        compartments.language.of(grammar()),
        compartments.editing.of(editing(readOnly)),
        compartments.wrapping.of(wrapping(phone)),
        compartments.touch.of(coarse ? touchExtensions(() => barHeight.current) : []),
        compartments.typecheck.of([]),
        compartments.region.of(locking(readOnly)),
        compartments.exam.of(examExtension()),
        saveKeymap(() => {
          const save = callbacks.current.onSave;
          if (!save) return false;
          save();
          return true;
        }),
        EditorView.updateListener.of((update) => {
          if (update.focusChanged) setFocused(update.view.hasFocus);
          if (
            assistOn.current &&
            (update.docChanged ||
              update.selectionSet ||
              update.transactions.some((tr) => tr.effects.length > 0))
          ) {
            setAssistState(update.state);
          }
          if (!update.docChanged) return;
          if (update.transactions.some((tr) => tr.annotation(fromProp))) return;
          callbacks.current.onChange?.(update.state.doc.toString());
        }),
      ],
    });

  // A layout effect, so the editor is in the box before the browser paints the frame
  // in which the placeholder goes away.
  useLayoutEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const view = new EditorView({ parent, state: createState(value) });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Created once per mount. Later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      annotations: fromProp.of(true),
      // A Reset replaces locked lines too.
      filter: false,
    });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: [
        compartments.language.reconfigure(grammar()),
        compartments.editing.reconfigure(editing(readOnly)),
        compartments.wrapping.reconfigure(wrapping(phone)),
        compartments.touch.reconfigure(coarse ? touchExtensions(() => barHeight.current) : []),
        compartments.region.reconfigure(locking(readOnly)),
        compartments.exam.reconfigure(examExtension()),
        compartments.scale.reconfigure(scale()),
      ],
    });
    // `editing` and `examExtension` close over a ref only; `locking` over the two region
    // values listed; `grammar` and `scale` over `language`, `exam`, `fontScale`, `minLines`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    compartments,
    language,
    readOnly,
    phone,
    coarse,
    regionStarter,
    regionLines,
    exam,
    fontScale,
    minLines,
  ]);

  // The online test's extras arrive in their own chunk, and are swapped in when they do.
  useEffect(() => {
    if (!exam || examModule) return;
    let live = true;
    void import('./exam')
      .then((module) => {
        examModule = module;
        if (!live) return;
        viewRef.current?.dispatch({ effects: compartments.exam.reconfigure(examExtension()) });
      })
      // Without them the editor still edits, runs and saves.
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // `examExtension` reads `language` and `exam`, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compartments, exam, language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!vim) {
      view?.dispatch({ effects: compartments.vim.reconfigure([]) });
      return;
    }
    if (vimModule) {
      view?.dispatch({ effects: compartments.vim.reconfigure(vimModule.vimExtensions()) });
      return;
    }
    let live = true;
    void import('./vim')
      .then((module) => {
        vimModule = module;
        if (!live) return;
        viewRef.current?.dispatch({
          effects: compartments.vim.reconfigure(module.vimExtensions()),
        });
      })
      // Without Vim the editor still edits with the ordinary keys.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [compartments, vim]);

  // Another document in the same view (a playground's file tabs): a fresh state, so undo
  // never crosses from one file into another, and the header around the view stays
  // mounted, focus and all. The type checker is not carried over; no tabbed editor has one.
  const shownDocument = useRef(documentKey);
  useEffect(() => {
    if (shownDocument.current === documentKey) return;
    shownDocument.current = documentKey;
    viewRef.current?.setState(createState(value));
    setAssistState(null);
    // Only a new key starts a new document; `value` and the rest are read as they are now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentKey]);

  // HTML, CSS and SQL grammars load on first use; the language is swapped in once they arrive.
  useEffect(() => {
    if (!hasLazyGrammar(language)) return;
    let live = true;
    void loadLazyGrammar(language)
      .then(() => {
        if (!live) return;
        viewRef.current?.dispatch({
          effects: compartments.language.reconfigure(grammar()),
        });
      })
      // Without the grammar the editor still edits; it only shows no colours.
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // `grammar` reads `language` and `exam`, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compartments, language, exam]);

  const extended = docked || expanded;
  const suggestions = useMemo(
    () =>
      extended && assistState ? suggest(assistState, { language, mode: assist, vocabulary }) : [],
    [extended, assistState, language, assist, vocabulary],
  );
  const fieldsActive = extended && assistState !== null && hasFields(assistState);

  // The page behind the full-screen editor must not scroll under the learner's thumb.
  useEffect(() => {
    if (!expanded) return;
    const root = document.documentElement;
    root.classList.add('editor-open');
    return () => root.classList.remove('editor-open');
  }, [expanded]);

  // Back from full screen, focus returns to the key that opened it.
  useEffect(() => {
    if (expanded || !returnFocus.current) return;
    returnFocus.current = false;
    frame.current?.querySelector<HTMLElement>('[data-key="expand"]')?.focus();
  }, [expanded]);

  function expand() {
    setExpanded(true);
    // Inside the tap, so iOS lets the focus raise the keyboard.
    viewRef.current?.focus();
  }

  function collapse() {
    returnFocus.current = true;
    setExpanded(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // CodeMirror marks Escape as handled when it ends a block's gaps. The next one closes.
    if (!expanded || event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    collapse();
  }

  const vv = {
    '--vv-top': `${viewport.top}px`,
    '--vv-left': `${viewport.left}px`,
    '--vv-width': viewport.width > 0 ? `${viewport.width}px` : '100vw',
    '--vv-height': viewport.height > 0 ? `${viewport.height}px` : '100dvh',
  } as CSSProperties;

  // A header button that does not take focus: the keyboard stays up and the caret stays put.
  const keepFocus = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();

  return (
    <div
      ref={frame}
      className={expanded ? 'editor-expanded' : 'flex flex-col gap-1'}
      data-keyboard={viewport.keyboard > 0}
      style={expanded ? vv : undefined}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? `${ariaLabel}, full screen` : undefined}
      onKeyDown={onKeyDown}
    >
      {expanded ? (
        <div className="flex shrink-0 flex-col gap-0.5">
          <div className="flex h-6 items-center gap-1">
            {task ? (
              <Button
                variant="quiet"
                size="md"
                className="-ml-1 px-1"
                aria-expanded={taskOpen}
                aria-controls={taskId}
                onMouseDown={keepFocus}
                onClick={() => setTaskOpen((open) => !open)}
              >
                <ChevronDown
                  aria-hidden
                  size={16}
                  strokeWidth={2}
                  className={taskOpen ? 'transition-press rotate-180' : 'transition-press'}
                />
                Task
              </Button>
            ) : null}
            <p role="status" className="t-label min-w-0 flex-1 truncate">
              {runStatus ?? (task ? '' : ariaLabel)}
            </p>
            {onRun ? (
              <Button
                variant="secondary"
                size="md"
                onMouseDown={keepFocus}
                onClick={() => callbacks.current.onRun?.()}
              >
                <Play aria-hidden size={16} strokeWidth={2} />
                {runLabel}
              </Button>
            ) : null}
            <Button variant="quiet" size="md" className="-mr-1 px-1" onClick={collapse}>
              <Minimize2 aria-hidden size={16} strokeWidth={2} />
              Done
            </Button>
          </div>
          {task ? (
            // Two lines of the task while closed, as a reminder; all of it, scrolling, when open.
            <div id={taskId} data-open={taskOpen} className="editor-task">
              {task}
            </div>
          ) : null}
        </div>
      ) : header !== undefined || assisted ? (
        <div className="flex min-h-5 items-center gap-1">
          <div className="min-w-0 flex-1">{header}</div>
          {assisted ? (
            <Button
              variant="quiet"
              size="md"
              className="-mr-1 w-5 px-0"
              aria-label="Full screen"
              title="Full screen"
              data-key="expand"
              onClick={expand}
            >
              <Maximize2 aria-hidden size={20} strokeWidth={2} />
            </Button>
          ) : null}
        </div>
      ) : null}
      <div
        ref={host}
        data-testid="code-editor"
        className={expanded ? 'min-h-0 flex-1' : undefined}
      />
      {typecheck ? (
        // Nothing holds the space: the editor works before the checker arrives, and
        // without it. A checker that cannot load must never take the editor down.
        <CheckerBoundary>
          <Suspense fallback={null}>
            <TypecheckLayer
              viewRef={viewRef}
              compartment={compartments.typecheck}
              tests={typecheck.tests}
              handleRef={typecheck.handleRef}
            />
          </Suspense>
        </CheckerBoundary>
      ) : null}
      {assisted ? (
        <SymbolBar
          viewRef={viewRef}
          editorFocused={focused}
          expanded={expanded}
          language={language}
          suggestions={suggestions}
          fieldsActive={fieldsActive}
          onRun={onRun ? () => callbacks.current.onRun?.() : undefined}
          runLabel={runLabel}
        />
      ) : null}
    </div>
  );
}

/** The first place to type in a locked starter: after the indent of its first open line. */
function regionStart(doc: string, region: CodeEditorProps['editableRegion']): number | null {
  const range = region && parseLineRange(region.lines);
  const frame = range && region && lockedFrame(region.starter, range);
  const found = frame ? locateRegion(doc, frame) : null;
  if (!found) return null;
  const line = doc.slice(found.from, found.to).split('\n')[0] ?? '';
  return found.from + line.length - line.trimStart().length;
}
