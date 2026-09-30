'use client';

import { useRouter } from 'next/navigation';
import { Suspense, use, useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import {
  createAttempt,
  endsAt,
  isTimeUp,
  type AttemptAction,
  type AttemptState,
  type CompiledTask,
  type TestSpec,
} from '@/core/online-test';
import { useSecondClock } from '@/features/assessment/attempt-store';
import { useStore } from '@/features/store/StoreProvider';
import {
  dispatchAttempt,
  newAttemptId,
  readAttempt,
  useAttempt,
  useReport,
  writeAttempt,
} from './attempt-store';
import { Dialog } from './Dialog';
import { Ide } from './Ide';
import { IntroScreen } from './IntroScreen';
import { Outro } from './Outro';
import { ensureScoring, useScoringProgress } from './scoring';
import { tasksPromise, useServices } from './services';
import { Tour } from './Tour';

export const HUB_HREF = '/practise/online-test';
export const reportHref = (attemptId: string): string => `${HUB_HREF}/report?id=${attemptId}`;

interface RunnerProps {
  spec: TestSpec;
}

/**
 * One online test from the intro page to the outro (docs/ONLINE-TEST.md, "Flow"). The
 * sitting itself is the attempt reducer in core, stored so a reload resumes it.
 */
const noSubscribe = () => () => {};

export function OnlineTestRunner({ spec }: RunnerProps) {
  const services = useServices();
  // The attempt lives in this browser's storage and the tasks come from the bundle by
  // fetch, so nothing of the test renders on the server: it shows the loading line.
  const client = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  if (!client) return <Centred>Loading your test...</Centred>;
  return (
    <Suspense fallback={<Centred>Loading your test...</Centred>}>
      <Sitting spec={spec} tasksPromise={tasksPromise(services, spec.taskIds)} />
    </Suspense>
  );
}

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-bg text-fg flex min-h-dvh flex-col items-center justify-center gap-1 p-2"
      role="status"
    >
      {children}
    </div>
  );
}

function ScoringScreen({
  attempt,
  tasks,
}: {
  attempt: AttemptState;
  tasks: readonly CompiledTask[];
}) {
  const services = useServices();
  const store = useStore();
  const progress = useScoringProgress(attempt.id);
  // Starts work outside React; its progress comes back through an external store.
  useEffect(() => {
    void ensureScoring(attempt, tasks, services, (payload) =>
      store.record('online_test_submitted', payload),
    );
  }, [attempt, tasks, services, store]);
  return (
    <Centred>
      <p className="text-lg font-medium">Evaluating your solutions</p>
      <p className="text-muted t-figure">
        Task {progress?.task ?? 1} of {tasks.length}
        {progress && progress.total > 0 ? ` · test case ${progress.done} of ${progress.total}` : ''}
      </p>
    </Centred>
  );
}

function Sitting({
  spec,
  tasksPromise: promise,
}: RunnerProps & { tasksPromise: Promise<CompiledTask[]> }) {
  const tasks = use(promise);
  const router = useRouter();
  const attempt = useAttempt(spec.key);
  const report = useReport(attempt?.phase === 'submitted' ? attempt.id : null);
  const now = useSecondClock();
  const [helpOpen, setHelpOpen] = useState(false);

  const dispatch = (action: AttemptAction) => dispatchAttempt(spec.key, action);

  function start({ assistant, guided }: { assistant: boolean; guided: boolean }) {
    const starters = Object.fromEntries(
      tasks.map((t) => [t.id, t.starters[spec.languages[0] ?? 'js']]),
    );
    writeAttempt(
      createAttempt(newAttemptId(), { ...spec, assistant, guided }, starters, Date.now()),
      spec.key,
    );
    dispatch({ type: 'tour-started' });
  }

  function submit(reason: 'candidate' | 'time-up') {
    const current = readAttempt(spec.key);
    if (!current) return;
    const at = reason === 'time-up' ? (endsAt(current) ?? Date.now()) : Date.now();
    dispatch({ type: 'submitted', at, reason });
  }

  // At zero the code is submitted as it stands, as on the platform. A timer, not a check
  // on each tick: it fires even when the tab slept and the clock stood still.
  const timeUp = useEffectEvent(() => submit('time-up'));
  const phase = attempt?.phase;
  const end = attempt ? endsAt(attempt) : undefined;
  useEffect(() => {
    if (phase !== 'running' || end === undefined) return;
    const id = setTimeout(timeUp, Math.max(0, end - Date.now()));
    return () => clearTimeout(id);
  }, [phase, end]);

  if (!attempt || attempt.phase === 'intro') {
    return <IntroScreen spec={spec} exitHref={HUB_HREF} onStart={start} />;
  }

  if (attempt.phase === 'submitted') {
    if (!report) return <ScoringScreen attempt={attempt} tasks={tasks} />;
    return (
      <Outro
        attemptId={attempt.id}
        onDone={() => router.push(reportHref(attempt.id))}
        onAgain={() => writeAttempt(null, spec.key)}
      />
    );
  }

  // Between the clock reaching zero and the submit timer firing: a second at most.
  if (attempt.phase === 'running' && now > 0 && isTimeUp(attempt, now)) {
    return <Centred>Time is up. Saving your solutions...</Centred>;
  }

  return (
    <>
      <Ide
        attempt={attempt}
        tasks={tasks}
        now={
          attempt.phase === 'running' && now > 0 ? now : (attempt.startedAt ?? attempt.createdAt)
        }
        dispatch={dispatch}
        onSubmit={() => submit('candidate')}
        onQuit={() => {
          dispatch({ type: 'quit', at: Date.now() });
          router.push(HUB_HREF);
        }}
        onHelp={() => setHelpOpen(true)}
      />
      {attempt.phase === 'tour' ? (
        <Tour onDone={() => dispatch({ type: 'tour-finished' })} />
      ) : null}
      {helpOpen ? <Tour finishLabel="Close" onDone={() => setHelpOpen(false)} /> : null}
      <Dialog
        open={attempt.phase === 'ready'}
        title="Are you ready to start?"
        confirmLabel="Let's start"
        cancelLabel="Go back"
        onCancel={() => router.push(HUB_HREF)}
        onConfirm={() => dispatch({ type: 'started', at: Date.now() })}
      >
        <p>This loads your test and starts the timer.</p>
      </Dialog>
    </>
  );
}
