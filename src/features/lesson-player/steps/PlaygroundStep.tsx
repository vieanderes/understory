'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import type { CompiledPlaygroundStep } from '@/core/content/compiled';
import { playgroundFields, type PlaygroundField } from '@/core/content/schema';
import {
  buildPlaygroundDocument,
  compileComponent,
  evaluateChecks,
  mergeSources,
  type BuildOptions,
  type PlaygroundSources,
  type ProbeReport,
} from '@/core/playground';
import { clearDraft, draftKey, readDraft, writeDraft } from '@/features/editor/draft-store';
import { LazyCodeEditor } from '@/features/editor/LazyCodeEditor';
import { Checklist } from '@/features/playground/Checklist';
import { DomTree } from '@/features/playground/DomTree';
import { createPreviewStore, nextNonce } from '@/features/playground/preview-store';
import { PreviewFrame } from '@/features/playground/PreviewFrame';
import { reactKit, serverKitState, type ReactKitState } from '@/features/playground/react-kit';
import { cn } from '@/lib/cn';
import type { StepProps } from '../contract';
import { Feedback } from '../parts/Feedback';
import { HintLadder } from '../parts/HintLadder';
import { RichText } from '../parts/RichText';

/** Long enough to finish a tag, short enough that the page feels live. */
const RENDER_DELAY_MS = 250;
const MIN_LINES = 6;

const FIELD_LABEL: Record<PlaygroundField, string> = {
  html: 'HTML',
  css: 'CSS',
  js: 'JavaScript',
  jsx: 'Component',
};

/** The editor's grammar per field. A component file may carry types, so it is TSX. */
const FIELD_LANGUAGE = { html: 'html', css: 'css', js: 'js', jsx: 'tsx' } as const;

type Files = PlaygroundSources;

function starterOf(step: CompiledPlaygroundStep): Files {
  return mergeSources({ html: step.html, css: step.css, js: step.js, jsx: step.jsx }, {});
}

/**
 * The page for the frame, or null while a React page waits for React. `react` is the
 * kit's state; a page without a component never looks at it.
 */
function pageFor(files: Files, react: ReactKitState, probe?: BuildOptions['probe']): string | null {
  const options: BuildOptions = probe ? { probe } : {};
  if (files.jsx === undefined) return buildPlaygroundDocument(files, options);
  if (react.status !== 'ready') return null;
  const { runtime, transpiler } = react.kit;
  return buildPlaygroundDocument(files, {
    ...options,
    react: { runtime, component: compileComponent(transpiler, files.jsx) },
  });
}

/** A draft is the learner's own edits. Anything that does not look like one is ignored. */
function parseDraft(
  text: string | null,
  starter: Files,
  editable: readonly PlaygroundField[],
): Files {
  if (text === null) return starter;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return starter;
    const draft: Partial<Files> = {};
    for (const field of editable) {
      const value = (parsed as Record<string, unknown>)[field];
      if (typeof value === 'string' && starter[field] !== undefined) draft[field] = value;
    }
    return mergeSources(starter, draft);
  } catch {
    return starter;
  }
}

function feedbackLine(passed: number, total: number, hints: number): string {
  if (passed < total)
    return `${passed} of ${total} checks pass. The open ones say what is missing.`;
  if (hints === 0) return 'Every check passes, with no hints.';
  return `Every check passes, with ${hints === 1 ? '1 hint' : `${hints} hints`}.`;
}

/**
 * Build · Live. The learner edits real HTML, CSS or JavaScript and the page beside it
 * redraws as they type. With checks, a checklist ticks as the page meets each one, and
 * Check hands the results to the player like any scored step. Without checks, the step
 * is a sandbox and the player offers Continue.
 */
export function PlaygroundStep({
  step,
  phase,
  grade,
  reveal,
  lessonId,
  onSubmissionChange,
}: StepProps<CompiledPlaygroundStep>) {
  const starter = useMemo(() => starterOf(step), [step]);
  const fields = useMemo(() => playgroundFields(step), [step]);
  const isReact = step.jsx !== undefined;
  const editable = step.editable;
  const [key] = useState(() =>
    draftKey(lessonId ?? (typeof window === 'undefined' ? '' : window.location.pathname), step.id),
  );
  // Read while the state is created, so the first paint already shows the learner's page.
  const [files, setFiles] = useState<Files>(() =>
    typeof window === 'undefined' ? starter : parseDraft(readDraft(key), starter, editable),
  );
  const [rendered, setRendered] = useState(() => ({ files, nonce: nextNonce() }));
  const [store] = useState(() => createPreviewStore(rendered.nonce));
  const [active, setActive] = useState<PlaygroundField>(editable[0] ?? fields[0] ?? 'html');
  const [hintsShown, setHintsShown] = useState(0);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const report = useSyncExternalStore<ProbeReport | null>(
    store.subscribe,
    store.getSnapshot,
    () => null,
  );
  const react = useSyncExternalStore(reactKit.subscribe, reactKit.getSnapshot, serverKitState);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hints = useRef(0);

  const checks = step.checks;
  const checked = phase === 'checked';
  const results = checks && report ? evaluateChecks(checks, report.facts) : null;
  const passed = results?.filter((result) => result.passed).length ?? 0;

  const doc = useMemo(
    () => pageFor(rendered.files, react, { nonce: rendered.nonce, checks: checks ?? [] }),
    [rendered, checks, react],
  );

  // React and sucrase load with the first React playground; the store keeps them.
  useEffect(() => {
    if (isReact) reactKit.load();
  }, [isReact]);

  // Every report the frame sends becomes the step's current answer. This subscribes to
  // the frame, an outside source, and forwards to the player; it mirrors nothing.
  useEffect(() => {
    if (!checks) return;
    return store.subscribe(() => {
      const latest = store.getSnapshot();
      if (!latest) return;
      onSubmissionChange({
        type: 'playground',
        results: evaluateChecks(checks, latest.facts),
        hintsUsed: hints.current,
      });
    });
  }, [store, checks, onSubmissionChange]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function render(next: Files) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const nonce = nextNonce();
      store.expect(nonce);
      setRendered({ files: next, nonce });
    }, RENDER_DELAY_MS);
  }

  function edit(field: PlaygroundField, value: string) {
    const next = { ...files, [field]: value };
    setFiles(next);
    const draft: Partial<Files> = {};
    for (const name of editable) draft[name] = next[name];
    writeDraft(key, JSON.stringify(draft));
    render(next);
  }

  function reset() {
    clearDraft(key);
    setFiles(starter);
    setConfirmingReset(false);
    render(starter);
  }

  function showHint() {
    const next = Math.min(step.hints?.length ?? 0, hintsShown + 1);
    setHintsShown(next);
    hints.current = next;
    // The answer already reported must carry the new count, or Check would score it too well.
    const latest = store.getSnapshot();
    if (checks && latest) {
      onSubmissionChange({
        type: 'playground',
        results: evaluateChecks(checks, latest.facts),
        hintsUsed: next,
      });
    }
  }

  const changed = editable.some((field) => files[field] !== starter[field]);
  const showSolution = reveal && grade !== undefined && !grade.correct && step.solution;
  const solutionFiles = step.solution ? mergeSources(starter, step.solution) : starter;
  const solutionDoc = useMemo(
    () => (showSolution ? pageFor(solutionFiles, react) : null),
    [showSolution, solutionFiles, react],
  );
  const activeReadOnly = checked || !editable.includes(active);

  // The editor's header row. On a phone the editor adds its Full screen key at the end.
  const header = (
    <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-2 gap-y-1">
      {fields.length > 1 ? (
        <Segmented
          label="File"
          hideLabel
          options={fields.map((field) => ({ value: field, label: FIELD_LABEL[field] }))}
          value={active}
          onChange={setActive}
        />
      ) : (
        <p className="t-label">{FIELD_LABEL[fields[0] ?? 'html']}</p>
      )}
      <div className="ml-auto flex items-center gap-1">
        {confirmingReset ? (
          <>
            <p className="text-sm">Restore the starter?</p>
            <Button variant="secondary" size="md" onClick={reset}>
              Restore
            </Button>
            <Button variant="quiet" size="md" autoFocus onClick={() => setConfirmingReset(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button
            variant="quiet"
            size="md"
            disabled={checked || !changed}
            onClick={() => setConfirmingReset(true)}
          >
            <RotateCcw aria-hidden size={16} strokeWidth={2} />
            Reset
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="challenge-grid grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12">
      {/* The task spans both columns, so the editor and the page below it start on one line. */}
      <RichText value={step.prompt} className="col-span-4 max-w-3xl md:col-span-12" />

      <div className="col-span-4 flex min-w-0 flex-col gap-3 md:col-span-6">
        <div className="flex flex-col gap-1">
          <LazyCodeEditor
            header={header}
            task={<RichText value={step.prompt} />}
            // One document per file: a tab swaps the document, its grammar and its undo.
            documentKey={active}
            value={files[active] ?? ''}
            onChange={(value) => edit(active, value)}
            language={FIELD_LANGUAGE[active]}
            readOnly={activeReadOnly}
            // A playground is for trying: the phone row may offer tags, properties and values.
            assist="live"
            ariaLabel={`${FIELD_LABEL[active]} of your page${activeReadOnly && !checked ? ', read only' : ''}`}
            minLines={Math.max(MIN_LINES, (files[active] ?? '').split('\n').length + 1)}
          />
          {!editable.includes(active) ? (
            <p className="text-muted font-mono text-sm">Read only in this step</p>
          ) : null}
        </div>
      </div>

      {/* Second in the source, so a phone reads prompt, editor, page, checks. */}
      <div className="col-span-4 min-w-0 md:col-span-6 md:col-start-7 md:row-span-2 md:row-start-2">
        <div className="flex flex-col gap-3 md:sticky md:top-10">
          <section aria-labelledby="playground-page" className="flex flex-col gap-1">
            {/* As tall as the editor's header row beside it, so the page and the editor
                share a top edge: the file tabs when there are several files (48 px and their
                hairline border), else a label. */}
            <div
              className={cn(
                'flex items-center',
                fields.length > 1 ? 'box-content min-h-6 py-px' : 'min-h-5',
              )}
            >
              <h3 id="playground-page" className="t-label">
                Your page · live
              </h3>
            </div>
            {doc === null ? (
              <ReactLoading state={react} className="h-30 md:h-50" />
            ) : (
              <PreviewFrame doc={doc} title="Your page" store={store} className="h-30 md:h-50" />
            )}
            {report && report.errors.length > 0 ? (
              <p role="status" className="text-danger font-mono text-sm break-words">
                {isReact ? 'Your component stopped' : 'Your script stopped'}: {report.errors[0]}
              </p>
            ) : null}
            {report?.warnings?.[0] !== undefined ? (
              <p role="status" className="text-muted font-mono text-sm break-words">
                React warns: {report.warnings[0]}
              </p>
            ) : null}
          </section>
          {step.showTree ? <DomTree report={report} /> : null}
        </div>
      </div>

      <div className="col-span-4 flex min-w-0 flex-col gap-3 md:col-span-6">
        {checks ? <Checklist checks={checks} results={results} explain={checked} /> : null}

        {checked && grade ? (
          <Feedback verdict={grade.correct ? 'right' : 'wrong'}>
            <p>{feedbackLine(passed, checks?.length ?? 0, hintsShown)}</p>
          </Feedback>
        ) : null}

        {showSolution ? (
          <section
            aria-labelledby="playground-solution"
            className="rule-t flex flex-col gap-1 pt-2"
          >
            <h3 id="playground-solution" className="t-label">
              Solution
            </h3>
            {editable
              .filter((field) => step.solution?.[field] !== undefined)
              .map((field) => (
                <LazyCodeEditor
                  key={field}
                  value={solutionFiles[field] ?? ''}
                  language={FIELD_LANGUAGE[field]}
                  readOnly
                  ariaLabel={`${FIELD_LABEL[field]} of the solution`}
                  minLines={1}
                />
              ))}
            {solutionDoc === null ? (
              <ReactLoading state={react} className="h-30" />
            ) : (
              <PreviewFrame doc={solutionDoc} title="The solution page" className="h-30" />
            )}
          </section>
        ) : null}

        {checks && step.hints ? (
          <HintLadder
            hints={step.hints}
            shown={hintsShown}
            onShowHint={showHint}
            solution="hidden"
            disabled={checked}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Holds the preview's place while React loads, and offers another try if it could not. */
function ReactLoading({ state, className }: { state: ReactKitState; className: string }) {
  return (
    <div
      className={cn(
        'border-border rounded-panel bg-surface flex flex-col items-center justify-center gap-1 border p-2',
        className,
      )}
    >
      {state.status === 'failed' ? (
        <>
          <p role="status" className="text-muted text-center text-sm">
            React could not load. It needs a connection the first time.
          </p>
          <Button variant="secondary" size="md" onClick={reactKit.load}>
            Try again
          </Button>
        </>
      ) : (
        <p role="status" className="text-muted text-sm">
          Loading React
        </p>
      )}
    </div>
  );
}
