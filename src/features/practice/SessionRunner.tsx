'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { Figure } from '@/components/ui/Figure';
import type { CompiledLesson } from '@/core/content/compiled';
import type { Interest } from '@/core/profile/interests';
import { buildPathExam, type ExamItem } from '@/core/exam';
import { calibrationGap } from '@/core/gamification';
import {
  buildCheckpoint,
  buildSession,
  CHECKPOINT_MINUTES,
  TEST_OUT_MINUTES,
  testOutPassed,
  type CatalogPart,
  type SessionItem,
  type SessionMinutes,
} from '@/core/practice';
import { uuidv7 } from '@/core/util';
import { useCatalog } from '@/features/catalog/useCatalog';
import { renderable } from '@/features/lesson-player/gradable';
import { StepTicks, type TickState } from '@/features/lesson-player/parts/StepTicks';
import { RecallCardView } from '@/features/lesson-player/RecallCardView';
import { LAB_IDS } from '@/features/lesson-player/registry';
import { StepRunner } from '@/features/lesson-player/StepRunner';
import { ExamResult } from '@/features/exam/ExamResult';
import { examStages } from '@/features/exam/stages';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import type { PathSummary } from '@/lib/content';
import { currentDevice } from './device';
import { loadLesson, parseCardKey } from './lessons';
import { Title } from '@/features/motion/Title';
import { AskScoutButton } from '@/features/tutor/StudyAssistant';
import { dockTutorTrigger, setTutorOpen } from '@/features/tutor/tutor-store';

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

/** A skipped item (its content changed under the schedule) counts neither way. */
type Outcome = 'right' | 'wrong' | 'skipped';

interface Plan {
  sessionId: string;
  seed: number;
  startedAt: string;
  /** The exam's items with their stages, for the result screen. */
  exam?: readonly ExamItem[];
  /** How many confidence-rated answers existed before the session, to isolate this one. */
  answersBefore: number;
  items: readonly SessionItem[];
  nextDueDate: string | null;
}

const SOURCE_LABEL = {
  due: 'Due',
  interleave: 'Mixed in',
  probe: 'Probe',
  'first-look': 'First look',
} as const;

/**
 * What kind of session: open practice across the course, or a finite mixed review of one
 * part. A test-out is a longer checkpoint whose score is recorded. An exam is a path's final
 * exam: the test-out's length and pass mark over the path's required lessons.
 */
export type SessionKind =
  | { kind: 'practice'; minutes: SessionMinutes; topics?: readonly Interest[] }
  | { kind: 'checkpoint'; partId: string }
  | { kind: 'test-out'; partId: string }
  | { kind: 'exam'; path: PathSummary; onRetake: () => void };

const minutesOf = (session: SessionKind): SessionMinutes =>
  session.kind === 'practice'
    ? session.minutes
    : session.kind === 'checkpoint'
      ? CHECKPOINT_MINUTES
      : TEST_OUT_MINUTES;

const partIdOf = (session: SessionKind): string | undefined =>
  session.kind === 'checkpoint' || session.kind === 'test-out' ? session.partId : undefined;

/**
 * One practice session, from a fixed queue to a closing screen. The queue is built once,
 * when the log and the index are both ready, from a random seed that is written into the
 * session_started event, so the same session can be rebuilt later from the log alone.
 */
export function SessionRunner({ session }: { session: SessionKind }) {
  const minutes = minutesOf(session);
  const store = useStore();
  const { status, state } = useProgress();
  const { catalog, failed } = useCatalog();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [lesson, setLesson] = useState<CompiledLesson | null>(null);
  const [loadError, setLoadError] = useState(false);
  const planning = useRef(false);

  // A review session asks Scout AI from its own bar, like a lesson; its footer holds Check.
  // An exam, checkpoint or test-out has no assistant at all (StudyAssistant hides there).
  const practice = session.kind === 'practice';
  useEffect(() => (practice ? dockTutorTrigger() : undefined), [practice]);

  // Build the queue once. `state` keeps changing as answers are recorded; the plan must not.
  useEffect(() => {
    if (plan || planning.current || status !== 'ready' || !catalog) return;
    planning.current = true;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const device = currentDevice();
    const now = new Date();
    const part = partOf(catalog.parts, partIdOf(session));
    const exam =
      session.kind === 'exam'
        ? buildPathExam({ catalog, stages: examStages(session.path), device, seed })
        : undefined;
    const built = exam
      ? { items: exam, nextDueDate: null }
      : part
        ? buildCheckpoint({ state, catalog, concepts: part.concepts, now, minutes, device, seed })
        : session.kind === 'practice'
          ? buildSession({
              state,
              catalog,
              now,
              minutes,
              device,
              seed,
              ...(session.topics ? { topics: session.topics } : {}),
            })
          : { items: [], nextDueDate: null };
    const sessionId = uuidv7(now.getTime(), { next: () => Math.random() });
    // The plan is derived from external state (the log and the index) exactly once.

    setPlan({
      sessionId,
      seed,
      startedAt: now.toISOString(),
      ...(exam ? { exam } : {}),
      answersBefore: state.calibrationAnswers.length,
      items: built.items,
      nextDueDate: built.nextDueDate,
    });
    if (built.items.length > 0) {
      void store.record('session_started', { sessionId, kind: 'practice', minutes, device, seed });
    }
  }, [plan, status, catalog, state, minutes, store, session]);

  const item = plan?.items[index];
  const parsed = useMemo(() => (item ? parseCardKey(item.cardKey) : null), [item]);
  const finished = plan !== null && index >= plan.items.length;

  // Fetch the lesson that holds the current item.
  useEffect(() => {
    if (!catalog || !parsed) return;
    let cancelled = false;
    loadLesson(catalog, parsed.lessonId)
      .then((loaded) => !cancelled && setLesson(loaded))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [catalog, parsed]);

  const right = outcomes.filter((o) => o === 'right').length;
  const scored = outcomes.filter((o) => o !== 'skipped').length;
  const passed = testOutPassed(right, scored);

  const recorded = useRef(false);
  useEffect(() => {
    if (!finished || !plan || plan.items.length === 0 || recorded.current) return;
    recorded.current = true;
    void store.record('session_finished', { sessionId: plan.sessionId, items: plan.items.length });
    if (session.kind === 'test-out' && scored > 0) {
      void store.record('test_out_attempted', {
        moduleId: session.partId,
        score: right / scored,
        passed,
      });
    }
    if (session.kind === 'exam' && scored > 0) {
      void store.record('path_exam_attempted', {
        pathId: session.path.id,
        seed: plan.seed,
        right,
        total: scored,
        startedAt: plan.startedAt,
        finishedAt: new Date().toISOString(),
        lessonIds: session.path.lessonIds,
      });
    }
  }, [finished, plan, store, session, right, scored, passed]);

  function next(outcome: Outcome) {
    setOutcomes((all) => [...all, outcome]);
    setLoadError(false);
    setIndex((i) => i + 1);
  }

  const current = lesson && parsed && lesson.id === parsed.lessonId ? lesson : null;
  const card =
    current && parsed?.kind === 'lesson'
      ? current.recall.find((c) => c.id === parsed.id)
      : undefined;
  const rawStep =
    current && parsed?.kind === 'skill' ? current.steps.find((s) => s.id === parsed.id) : undefined;
  const step = rawStep ? renderable(rawStep, (id) => LAB_IDS.has(id)) : undefined;
  // Content can change under a schedule: a card or step that no longer exists is skipped.
  const missing = current !== null && parsed !== null && !card && !step;

  useEffect(() => {
    if (!missing && !loadError) return;
    // Skipping is a reaction to external content, not to a render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOutcomes((all) => [...all, 'skipped']);
    setLoadError(false);
    setIndex((i) => i + 1);
  }, [missing, loadError]);

  const ticks: TickState[] = (plan?.items ?? []).map((_, i) =>
    i < outcomes.length
      ? outcomes[i] === 'right'
        ? 'right'
        : outcomes[i] === 'wrong'
          ? 'wrong'
          : 'done'
      : i === index
        ? 'current'
        : 'todo',
  );

  const sessionAnswers = state.calibrationAnswers.slice(plan?.answersBefore ?? 0);
  const gap = calibrationGap(sessionAnswers).gapPoints;
  const part = partOf(catalog?.parts, partIdOf(session));
  const exitHref =
    session.kind === 'practice'
      ? '/practise'
      : session.kind === 'exam'
        ? `/paths/${session.path.id}`
        : `/learn#part-${session.partId}`;
  const heading =
    session.kind === 'practice'
      ? `Practice · ${minutes} min`
      : session.kind === 'exam'
        ? `Final exam · ${session.path.name}`
        : `${session.kind === 'checkpoint' ? 'Checkpoint' : 'Test out'} · ${part?.title ?? ''}`;

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <header className="rule-b bg-bg sticky top-0 z-20">
        <div className="frame flex h-8 items-center gap-2">
          <Link
            href={exitHref}
            aria-label="Leave session"
            title="Leave session"
            className="text-muted hover:text-fg hover:bg-raised rounded-control -ml-1 inline-flex size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out"
          >
            <X aria-hidden size={20} strokeWidth={2} />
          </Link>
          <StepTicks
            ticks={ticks}
            label={
              plan
                ? `Item ${Math.min(index + 1, plan.items.length)} of ${plan.items.length}`
                : 'Session'
            }
          />
          <p className="t-label t-figure w-6 shrink-0 text-right">
            {plan && !finished ? `${index + 1}/${plan.items.length}` : ''}
          </p>
          {practice ? (
            <AskScoutButton
              onClick={() => setTutorOpen(true)}
              className="-mr-1 h-4 px-1 sm:pr-1.5"
              labelClassName="max-sm:sr-only"
            />
          ) : null}
        </div>
      </header>

      <main id="content" className="frame flex-1 pt-4 pb-4">
        {failed ? (
          <p className="text-muted">
            The course index could not be loaded. Check the connection and reload.
          </p>
        ) : !plan ? (
          <p className="t-label">Building your session</p>
        ) : finished && session.kind === 'exam' && plan.exam && scored > 0 ? (
          <ExamResult
            path={session.path}
            items={plan.exam}
            outcomes={outcomes.map((o) => (o === 'skipped' ? null : o === 'right'))}
            right={right}
            total={scored}
            passed={passed}
            onRetake={session.onRetake}
          />
        ) : finished ? (
          <section aria-labelledby="closing-title" className="step-in flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <p className="t-label">{heading}</p>
              <Title id="closing-title">
                {plan.items.length === 0 ? (
                  session.kind === 'practice' && (session.topics?.length ?? 0) > 0 ? (
                    <>
                      Nothing here yet.{' '}
                      <span className="text-muted">These topics have no items to practise.</span>
                    </>
                  ) : session.kind === 'practice' ? (
                    <>
                      Nothing due.{' '}
                      <span className="text-muted">
                        {plan.nextDueDate ? `Next: ${DAY.format(new Date(plan.nextDueDate))}.` : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      Nothing to review yet.{' '}
                      <span className="text-muted">
                        {session.kind === 'exam'
                          ? 'The path has no scored steps on this device.'
                          : 'The part has no scored steps here.'}
                      </span>
                    </>
                  )
                ) : session.kind === 'test-out' ? (
                  passed ? (
                    'Passed.'
                  ) : (
                    <>
                      Not yet. <span className="text-muted">Everything stays open.</span>
                    </>
                  )
                ) : (
                  'Done.'
                )}
              </Title>
            </div>
            {plan.items.length > 0 ? (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
                  <Figure
                    label={session.kind === 'test-out' ? 'Score' : 'Strengthened'}
                    value={
                      session.kind === 'test-out'
                        ? `${scored > 0 ? Math.round((right / scored) * 100) : 0}%`
                        : String(right)
                    }
                    unit={session.kind === 'test-out' ? '80% passes' : `/ ${plan.items.length}`}
                  />
                  <Figure
                    label="Calibration"
                    value={gap === undefined ? '··' : `${gap > 0 ? '+' : ''}${Math.round(gap)}`}
                    unit={gap === undefined ? undefined : 'pts'}
                    note={
                      gap === undefined
                        ? 'Needs 5 answers with a stated confidence'
                        : gap > 5
                          ? 'Sure more often than right'
                          : gap < -5
                            ? 'Right more often than sure'
                            : 'Confidence matched accuracy'
                    }
                  />
                  <Figure
                    label="Next due"
                    value={plan.nextDueDate ? DAY.format(new Date(plan.nextDueDate)) : 'Soon'}
                  />
                </dl>
                <p className="text-muted prose-measure text-sm">
                  {session.kind === 'test-out'
                    ? passed
                      ? `Every lesson of ${part?.title ?? 'the part'} now counts as done. Its cards come back later to check the claim.`
                      : 'The items you missed point to the lessons worth taking first.'
                    : session.kind === 'checkpoint'
                      ? 'A whole part, mixed and weakest first. Each recall cost more than in a lesson, and that is what makes it last.'
                      : 'If it felt harder than a lesson, that is the mixing at work. Switching between topics makes each recall cost more, and what costs more to recall lasts longer.'}
                </p>
              </>
            ) : null}
            <div className="flex flex-wrap gap-1">
              <Link href="/" className={buttonClass('primary', 'lg')}>
                Done
              </Link>
              {session.kind === 'test-out' && passed ? (
                <Link href={`/milestone/${session.partId}`} className={buttonClass('quiet')}>
                  See the milestone
                </Link>
              ) : null}
            </div>
          </section>
        ) : card && current && item ? (
          <RecallCardView
            key={item.cardKey}
            lessonId={current.id}
            card={card}
            label={
              <>
                Recall · {SOURCE_LABEL[item.source]} · {current.title}
              </>
            }
            onRated={(rating) => next(rating >= 3 ? 'right' : 'wrong')}
          />
        ) : step && current && item ? (
          <SessionStep
            key={item.cardKey}
            lesson={current}
            step={step}
            item={item}
            testOut={session.kind === 'test-out' || session.kind === 'exam'}
            onDone={next}
          />
        ) : (
          <p className="t-label">Loading</p>
        )}
      </main>
    </div>
  );
}

function SessionStep({
  lesson,
  step,
  item,
  testOut,
  onDone,
}: {
  lesson: CompiledLesson;
  step: CompiledLesson['steps'][number];
  item: SessionItem;
  testOut: boolean;
  onDone: (outcome: Outcome) => void;
}) {
  const { state } = useProgress();
  const outcome = useRef<Outcome>('wrong');
  return (
    <div className="flex flex-col gap-2">
      <p className="t-label">
        {SOURCE_LABEL[item.source]} · {lesson.title}
      </p>
      <StepRunner
        lessonId={lesson.id}
        step={step}
        mode={state.modeByModule[lesson.moduleId] ?? 'guided'}
        context={testOut ? 'test-out' : item.source === 'probe' ? 'probe' : 'practice'}
        onResult={(result) => {
          outcome.current = result.grade.correct ? 'right' : 'wrong';
        }}
        onContinue={() => onDone(outcome.current)}
      />
    </div>
  );
}

function partOf(
  parts: readonly CatalogPart[] | undefined,
  id: string | undefined,
): CatalogPart | undefined {
  return id === undefined ? undefined : parts?.find((part) => part.id === id);
}
