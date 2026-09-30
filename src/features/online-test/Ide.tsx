'use client';

import { Bot, Check, CircleHelp, Compass, Contrast, LogOut, Settings } from 'lucide-react';
import {
  lazy,
  Suspense,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import {
  clockLabel,
  codeOf,
  LANGUAGE_LABEL,
  renderRun,
  runExamples,
  secondsRemaining,
  signatureLine,
  SIGNATURE_SLOT,
  RUN_LIMIT_MS,
  type AttemptAction,
  type AttemptState,
  type CompiledTask,
  type RunTranscript,
  type TaskLanguage,
} from '@/core/online-test';
import { useMediaQuery } from '@/features/editor/useMediaQuery';
import { cn } from '@/lib/cn';
import { setAssistantDraft } from './assistant-draft';
import { Dialog } from './Dialog';
import { GuidePanel } from './GuidePanel';
import { Mark } from './Mark';
import { setPrefs, usePrefs } from './prefs';
import { useServices } from './services';
import { SettingsPopover } from './SettingsPopover';
import { SolutionPanel, type SolutionFile } from './SolutionPanel';
import { Splitter } from './Splitter';
import { TaskPanel } from './TaskPanel';
import { TestOutput } from './TestOutput';

const AssistantPanel = lazy(() =>
  import('./assistant/AssistantPanel').then((m) => ({ default: m.AssistantPanel })),
);

/** The last minutes turn the clock to the danger colour: time is information here. */
const WARN_SECONDS = 5 * 60;
const ROW_PX = 24;
/** Top bar, footer, the solution header, the tabs row and the hint bar. */
const CHROME_PX = 40 + 32 + 48 + 48 + 24;

interface IdeProps {
  attempt: AttemptState;
  tasks: CompiledTask[];
  now: number;
  dispatch: (action: AttemptAction) => void;
  onSubmit: () => void;
  onQuit: () => void;
  onHelp: () => void;
}

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

function useViewportHeight(): number {
  return useSyncExternalStore(
    subscribeResize,
    () => window.innerHeight,
    () => 800,
  );
}

function transcriptText(transcript: RunTranscript | undefined): string {
  if (!transcript) return '';
  const lines = [
    ...transcript.header,
    ...transcript.blocks.flatMap((b) => b.lines),
    ...transcript.footer,
  ];
  return lines.map((l) => (l.label ? `${l.label} ${l.text}` : l.text)).join('\n');
}

function statementText(task: CompiledTask, language: TaskLanguage): string {
  const html = task.statementHtml.replace(
    SIGNATURE_SLOT,
    `\n${signatureLine(task.signature, language)}\n`,
  );
  return html
    .replace(/<li>/g, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

type Pane = 'task' | 'code' | 'output' | 'guide' | 'assistant';
type Side = 'guide' | 'assistant' | null;

function RailButton({
  label,
  onClick,
  pressed,
  tour,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  tour?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      data-tour={tour}
      onClick={onClick}
      className={cn(
        'rounded-control inline-flex size-5 items-center justify-center transition-colors',
        pressed ? 'bg-sunken text-fg' : 'text-muted hover:text-fg hover:bg-raised',
      )}
    >
      {children}
    </button>
  );
}

/**
 * The test itself, laid out as the platform's IDE: a top bar with the one clock and
 * Submit, a rail with the task tabs and tools, the task, the solution with its files and
 * the Test Output, and a footer with the save status. On a phone the panes stack behind
 * a switch.
 */
export function Ide({ attempt, tasks, now, dispatch, onSubmit, onQuit, onHelp }: IdeProps) {
  const services = useServices();
  const prefs = usePrefs();
  const phone = useMediaQuery('(max-width: 47.99rem)');
  const wide = useMediaQuery('(min-width: 80rem)');
  const viewport = useViewportHeight();

  const [taskWidth, setTaskWidth] = useState(360);
  const [outputHeight, setOutputHeight] = useState(240);
  const [taskCollapsed, setTaskCollapsed] = useState(false);
  const [solutionCollapsed, setSolutionCollapsed] = useState(false);
  const [file, setFile] = useState<SolutionFile>('solution');
  const [pane, setPaneState] = useState<Pane>('task');
  const setPane = (next: Pane) => {
    if (next === 'guide') dispatch({ type: 'guide-opened' });
    setPaneState(next);
  };
  /** Opens a side panel, or closes it when it is already the one showing. */
  const toggleSide = (id: 'guide' | 'assistant', keepOpen = false) => {
    if (id === 'guide') dispatch({ type: 'guide-opened' });
    setSide((current) => (current === id && !keepOpen ? null : id));
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The right-hand column: the guide or the assistant, whichever the test opens with.
  const [side, setSide] = useState<Side>(
    phone ? null : attempt.spec.guided ? 'guide' : attempt.spec.assistant ? 'assistant' : null,
  );

  const [dialog, setDialog] = useState<null | 'submit' | 'quit' | { language: TaskLanguage }>(null);
  const [transcripts, setTranscripts] = useState<Record<string, RunTranscript>>({});
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const runToken = useRef(0);

  const task = tasks[attempt.activeTask] ?? tasks[0]!;
  const draft = attempt.drafts[task.id];
  const { language, code } = codeOf(attempt, task.id);
  const left = secondsRemaining(attempt, now);
  const transcript = transcripts[`${task.id}:${language}`];
  const rows = Math.floor((viewport - CHROME_PX - outputHeight) / ROW_PX);

  // Proctoring signals come from the browser, so the listeners are subscriptions; each
  // event is recorded as a fact in the attempt, never mirrored into React state.
  const proctoring = attempt.spec.proctoring;
  const record = useEffectEvent((kind: 'hidden' | 'visible' | 'blur' | 'focus') =>
    dispatch({ type: 'integrity', event: { at: Date.now(), kind } }),
  );
  useEffect(() => {
    if (!proctoring) return;
    const onVisibility = () => record(document.visibilityState === 'hidden' ? 'hidden' : 'visible');
    const onBlur = () => record('blur');
    const onFocus = () => record('focus');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [proctoring]);

  async function run() {
    if (running) return;
    const token = ++runToken.current;
    setRunning(true);
    if (phone) setPane('output');
    dispatch({ type: 'code-run', taskId: task.id, at: Date.now() });
    try {
      const compileErrors = language === 'ts' ? await services.typeErrors(code) : [];
      const runner = await services.runner();
      const cases =
        compileErrors.length > 0
          ? []
          : await runExamples(runner, task, language, code, draft?.input ?? '');
      const hidden = task.tests.reduce((sum, t) => sum + t.cases.length, 0);
      const next = renderRun(cases, { limitMs: RUN_LIMIT_MS, hiddenTests: hidden, compileErrors });
      if (token === runToken.current)
        setTranscripts((all) => ({ ...all, [`${task.id}:${language}`]: next }));
    } catch {
      setTranscripts((all) => ({
        ...all,
        [`${task.id}:${language}`]: {
          status: 'failed',
          header: [{ text: 'The code tools could not be loaded. Try again.', tone: 'error' }],
          blocks: [],
          footer: [],
        },
      }));
    } finally {
      if (token === runToken.current) setRunning(false);
    }
  }

  function changeLanguage(next: TaskLanguage) {
    dispatch({
      type: 'language-set',
      taskId: task.id,
      language: next,
      starter: task.starters[next],
    });
    setDialog(null);
  }

  const assistantContext = useMemo(
    () => ({
      taskTitle: task.title,
      statement: statementText(task, language),
      language: LANGUAGE_LABEL[language],
      code,
      output: transcriptText(transcript),
    }),
    [task, language, code, transcript],
  );

  const taskPanel = (
    <TaskPanel
      task={task}
      number={attempt.activeTask + 1}
      language={language}
      collapsed={!phone && taskCollapsed}
      onToggle={() => setTaskCollapsed((c) => !c)}
      large={prefs.accessibility}
      {...(proctoring
        ? {
            onCopyBlocked: () =>
              dispatch({
                type: 'integrity',
                event: { at: Date.now(), kind: 'copy-blocked', taskId: task.id },
              }),
          }
        : {})}
    />
  );

  const solutionPanel = (
    <SolutionPanel
      task={task}
      number={attempt.activeTask + 1}
      language={language}
      languages={attempt.spec.languages}
      code={code}
      input={draft?.input ?? ''}
      file={file}
      onFile={setFile}
      onCode={(next) => {
        dispatch({ type: 'code-edited', taskId: task.id, code: next, at: Date.now() });
        setSaved(true);
      }}
      onInput={(text) => {
        dispatch({ type: 'input-edited', taskId: task.id, text });
        setSaved(true);
      }}
      onLanguage={(next) => setDialog({ language: next })}
      onRun={() => void run()}
      onSave={() => setSaved(true)}
      onPaste={(chars) =>
        dispatch({
          type: 'integrity',
          event: { at: Date.now(), kind: 'paste', chars, taskId: task.id },
        })
      }
      vim={prefs.vim}
      large={prefs.accessibility}
      rows={phone ? 16 : rows}
      collapsed={!phone && solutionCollapsed}
      onToggle={() => setSolutionCollapsed((c) => !c)}
      compact={phone || !wide}
      readOnly={left === 0}
    />
  );

  const output = (
    <TestOutput
      transcript={transcript ?? null}
      running={running}
      onRun={() => void run()}
      large={prefs.accessibility}
    />
  );

  // Always within reach for practice. The test's own setting only opens it at the start,
  // as an employer's test would show it (docs/ONLINE-TEST.md, "The assistant").
  const guide = (
    <GuidePanel
      taskId={task.id}
      language={language}
      step={attempt.guideSteps?.[task.id] ?? 0}
      onStep={(index) => dispatch({ type: 'guide-step', taskId: task.id, index })}
      onPrompt={(text) => {
        setAssistantDraft(text);
        if (phone) setPane('assistant');
        else setSide('assistant');
      }}
      onUseCode={(next) => {
        dispatch({ type: 'code-edited', taskId: task.id, code: next, at: Date.now() });
        setSaved(true);
        setFile('solution');
      }}
      onAddInput={(lines) => {
        const current = (draft?.input ?? '').trimEnd();
        dispatch({
          type: 'input-edited',
          taskId: task.id,
          text: [current, ...lines].filter((l) => l.length > 0).join('\n'),
        });
        setFile('input');
        setSaved(true);
      }}
    />
  );

  const assistant = (
    <Suspense fallback={<p className="text-muted p-2 text-sm">Loading the assistant...</p>}>
      <AssistantPanel
        context={assistantContext}
        greeting="How can I help with this task?"
        suggestions={[
          'Clarify one rule of the task for me',
          'Which edge cases should I test?',
          'Review my code for bugs. Do not rewrite it.',
        ]}
        transcript={attempt.assistant.filter((m) => m.taskId === task.id)}
        onMessage={(message) =>
          dispatch({ type: 'assistant-message', message: { ...message, taskId: task.id } })
        }
      />
    </Suspense>
  );

  const languageDialog = typeof dialog === 'object' && dialog !== null ? dialog.language : null;

  return (
    <div className="bg-bg text-fg flex h-dvh flex-col overflow-hidden">
      <header className="rule-b bg-surface grid h-5 shrink-0 grid-cols-3 items-center px-2">
        <Mark />
        <p
          role="timer"
          aria-label={`Time remaining: ${clockLabel(left)}`}
          data-tour="timer"
          className={cn(
            't-figure flex items-center justify-center gap-0.5 px-1 font-medium',
            left <= WARN_SECONDS ? 'text-danger' : 'text-fg',
          )}
        >
          {clockLabel(left)}
        </p>
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            className="h-4"
            data-tour="submit"
            onClick={() => setDialog('submit')}
          >
            <Check aria-hidden size={16} strokeWidth={2} />
            <span className="max-sm:sr-only">Submit Assessment</span>
            <span className="sm:hidden">Submit</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Test"
          className="bg-surface border-border relative flex w-6 shrink-0 flex-col items-center gap-0.5 border-r py-0.5"
        >
          <div
            role="tablist"
            aria-label="Tasks"
            data-tour="tasks"
            className="flex flex-col gap-0.5"
          >
            {tasks.map((t, index) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={index === attempt.activeTask}
                aria-label={`Task ${index + 1}`}
                onClick={() => {
                  dispatch({ type: 'task-selected', index });
                  setFile('solution');
                }}
                className={cn(
                  't-figure rounded-control inline-flex size-5 items-center justify-center text-sm font-semibold',
                  index === attempt.activeTask ? 'bg-sunken text-fg' : 'text-muted hover:bg-raised',
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="mt-auto flex flex-col items-center gap-0.5">
            {!phone ? (
              <>
                <RailButton
                  label="Guide"
                  pressed={side === 'guide'}
                  onClick={() => toggleSide('guide')}
                >
                  <Compass aria-hidden size={20} strokeWidth={2} />
                </RailButton>
                <RailButton
                  label="Assistant"
                  pressed={side === 'assistant'}
                  onClick={() => toggleSide('assistant')}
                >
                  <Bot aria-hidden size={20} strokeWidth={2} />
                </RailButton>
              </>
            ) : null}
            <RailButton
              label="Accessibility mode"
              pressed={prefs.accessibility}
              tour="accessibility"
              onClick={() => setPrefs({ accessibility: !prefs.accessibility })}
            >
              <Contrast aria-hidden size={20} strokeWidth={2} />
            </RailButton>
            <div className="relative">
              <RailButton
                label="Editor settings"
                pressed={settingsOpen}
                tour="settings"
                onClick={() => setSettingsOpen((o) => !o)}
              >
                <Settings aria-hidden size={20} strokeWidth={2} />
              </RailButton>
              {settingsOpen ? <SettingsPopover onClose={() => setSettingsOpen(false)} /> : null}
            </div>
            <RailButton label="Help" onClick={onHelp}>
              <CircleHelp aria-hidden size={20} strokeWidth={2} />
            </RailButton>
            <RailButton label="Quit the test" tour="exit" onClick={() => setDialog('quit')}>
              <LogOut aria-hidden size={20} strokeWidth={2} />
            </RailButton>
          </div>
        </nav>

        {phone ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <Segmented<Pane>
              label="Show"
              hideLabel
              className="rule-b bg-surface shrink-0 p-0.5"
              value={pane}
              onChange={setPane}
              options={[
                { value: 'task', label: 'Task' },
                { value: 'code', label: 'Code' },
                { value: 'output', label: 'Output' },
                { value: 'guide', label: 'Guide' },
                { value: 'assistant', label: 'AI' },
              ]}
            />
            <div className="min-h-0 flex-1" data-tour="output">
              {pane === 'task' ? taskPanel : null}
              {pane === 'code' ? solutionPanel : null}
              {pane === 'output' ? output : null}
              {pane === 'guide' ? guide : null}
              <div hidden={pane !== 'assistant'} className="h-full">
                {assistant}
              </div>
            </div>
          </div>
        ) : (
          <main id="content" className="flex min-w-0 flex-1">
            <div
              className="min-h-0 shrink-0"
              style={taskCollapsed ? undefined : { width: `${taskWidth}px` }}
            >
              {taskPanel}
            </div>
            {taskCollapsed ? null : (
              <Splitter
                orientation="vertical"
                label="Resize the task panel"
                value={taskWidth}
                min={240}
                max={720}
                onChange={setTaskWidth}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1">{solutionPanel}</div>
              <Splitter
                orientation="horizontal"
                label="Resize the test output"
                value={outputHeight}
                min={96}
                max={Math.max(160, viewport - 320)}
                onChange={setOutputHeight}
                invert
                tour="output"
              />
              <div className="shrink-0" style={{ height: `${outputHeight}px` }}>
                {output}
              </div>
            </div>
            {side ? (
              <aside
                aria-label={side === 'guide' ? 'Guide' : 'Assistant'}
                className="border-border bg-surface flex w-45 shrink-0 flex-col border-l"
              >
                <div role="tablist" aria-label="Side panel" className="rule-b flex h-6 shrink-0">
                  {(['guide', 'assistant'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={side === id}
                      onClick={() => toggleSide(id, true)}
                      className={cn(
                        'flex-1 border-b-2 text-sm font-medium',
                        side === id
                          ? 'border-accent text-fg'
                          : 'text-muted hover:text-fg border-transparent',
                      )}
                    >
                      {id === 'guide' ? 'Guide' : 'Assistant'}
                    </button>
                  ))}
                </div>
                {side === 'guide' ? guide : null}
                {/* Kept mounted while hidden, so a reply streaming in is not cut off. */}
                <div hidden={side !== 'assistant'} className="flex min-h-0 flex-1 flex-col">
                  {assistant}
                </div>
              </aside>
            ) : null}
          </main>
        )}
      </div>

      <footer className="rule-t bg-surface text-muted flex h-4 shrink-0 items-center gap-2 px-2 text-sm">
        <p aria-live="polite" data-tour="autosave">
          {saved ? 'All changes saved' : 'You will see save status here'}
        </p>
        <p className="ml-auto hidden md:block">
          {attempt.spec.title} · {LANGUAGE_LABEL[language]}
        </p>
      </footer>

      <Dialog
        open={dialog === 'submit'}
        title="Submit your assessment?"
        confirmLabel="Submit Assessment"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          onSubmit();
        }}
      >
        <p>
          Your solutions will be saved. You cannot change them after submitting. Submitting ends the
          test for every task.
        </p>
      </Dialog>
      <Dialog
        open={dialog === 'quit'}
        title="Quit the test?"
        confirmLabel="Quit anyway"
        tone="quiet"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          onQuit();
        }}
      >
        <p>You can come back to the test later, but quitting does not put the timer on hold.</p>
      </Dialog>
      <Dialog
        open={languageDialog !== null}
        title="Change the language?"
        confirmLabel="Confirm"
        onCancel={() => setDialog(null)}
        onConfirm={() => languageDialog && changeLanguage(languageDialog)}
      >
        <p>
          You are about to change the programming language to{' '}
          {languageDialog ? LANGUAGE_LABEL[languageDialog] : ''}. The editor shows that
          language&apos;s solution, and your {LANGUAGE_LABEL[language]} solution is kept. Switch
          back to bring it back.
        </p>
      </Dialog>
    </div>
  );
}
