'use client';

import { BookOpen, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AskScoutButton } from '@/features/tutor/StudyAssistant';
import { dockTutorTrigger, setTutorOpen, setTutorScope } from '@/features/tutor/tutor-store';
import { stepText } from '@/features/tutor/step-text';
import { ActionBar } from '@/components/layout/ActionBar';
import { Button } from '@/components/ui/Button';
import { codeSpans, InlineCode } from '@/components/ui/InlineCode';
import type { CompiledLesson, CompiledStep } from '@/core/content/compiled';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { renderable } from './gradable';
import { LessonSummary } from './LessonSummary';
import { StepTicks, type TickState } from './parts/StepTicks';
import { RecallStage } from './RecallStage';
import { LAB_IDS, preloadStep } from './registry';
import { StepRunner, type StepResult } from './StepRunner';
import { Title } from '@/features/motion/Title';
import type { LessonOnPath } from '@/features/paths/links';
import { usePathParam } from '@/features/paths/usePathParam';

interface LessonPlayerProps {
  lesson: CompiledLesson;
  moduleTitle: string;
  exitHref: string;
  solutionsUrl?: string;
  next: { href: string; title: string } | null;
  /** The paths that list this lesson, so a lesson opened from a path returns to it. */
  paths?: readonly LessonOnPath[];
}

type Stage = 'opening' | 'steps' | 'recall' | 'summary';

/**
 * A lesson from its opening to its closing screen: why it matters, the steps in
 * order, the recall cards, then a clear stopping point. It fills the screen: no places,
 * no tab bar, one way out.
 */
export function LessonPlayer({
  lesson,
  moduleTitle,
  exitHref,
  solutionsUrl,
  next: courseNext,
  paths = [],
}: LessonPlayerProps) {
  const pathId = usePathParam();
  const onThisPath = paths.find((p) => p.id === pathId);
  const next = onThisPath ? onThisPath.next : courseNext;
  const exit = onThisPath ? `/paths/${onThisPath.id}` : exitHref;
  const store = useStore();
  const { state } = useProgress();
  const mode = state.modeByModule[lesson.moduleId] ?? 'guided';

  const steps = useMemo(
    () => lesson.steps.map((s) => renderable(s, (id) => LAB_IDS.has(id))),
    [lesson.steps],
  );

  const [stage, setStage] = useState<Stage>('opening');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<StepResult[]>([]);
  const [firstCompletion, setFirstCompletion] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = steps[index];

  // `#<step-id>` opens the lesson at that step. Nothing in Understory is locked, so a
  // deep link into a lesson is a feature: Signal, the map and practice all use it.
  useEffect(() => {
    const target = window.location.hash.slice(1);
    const at = steps.findIndex((s) => s.id === target);
    if (at < 0) return;
    // Reading the URL is a one-off sync with an external system, done once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(at);
    setStage('steps');
  }, [steps]);

  useEffect(() => {
    if (stage === 'opening') headingRef.current?.focus();
  }, [stage]);

  // The top bar holds the assistant's trigger, so the floating one steps aside and never
  // sits on the fixed footer. A registration with an external store, undone on unmount.
  useEffect(() => dockTutorTrigger(), []);

  // Tells the study assistant what is on screen, so it answers about this step. Publishing
  // to an external store, not mirroring state: the assistant lives outside the player.
  useEffect(() => {
    const current = stage === 'steps' ? step : undefined;
    setTutorScope({
      key: lesson.id,
      title: lesson.title,
      onScreen: current ? stepText(current) : `${lesson.objective}\n\n${lesson.opening.text}`,
      ...(current && 'language' in current && typeof current.language === 'string'
        ? { language: current.language }
        : {}),
    });
    return () => setTutorScope(null);
  }, [lesson, stage, step]);

  // The next step's chunk is fetched while this one is read, so a code step never waits.
  useEffect(() => {
    if (stage === 'steps') preloadStep(steps[index + 1]?.type);
  }, [stage, steps, index]);

  function advance() {
    if (index + 1 < steps.length) setIndex(index + 1);
    else setStage(lesson.recall.length > 0 ? 'recall' : 'summary');
  }

  async function finishLesson() {
    if (!state.completedLessons.has(lesson.id)) {
      setFirstCompletion(true);
      await store.record('lesson_completed', { lessonId: lesson.id });
    }
    setStage('summary');
  }

  const ticks: TickState[] = steps.map((s, i) => {
    if (stage === 'opening') return 'todo';
    if (stage === 'steps' && i === index) return 'current';
    if (stage === 'steps' && i > index) return 'todo';
    return tickOf(results, s);
  });

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <header className="rule-b bg-bg sticky top-0 z-20">
        <div className="frame flex h-8 items-center gap-2">
          <Link
            href={exit}
            aria-label="Leave lesson"
            title="Leave lesson"
            className="text-muted hover:text-fg hover:bg-raised rounded-control -ml-1 inline-flex size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out"
          >
            <X aria-hidden size={20} strokeWidth={2} />
          </Link>
          <StepTicks
            ticks={ticks}
            label={
              stage === 'steps' ? `Step ${index + 1} of ${steps.length}` : `${steps.length} steps`
            }
          />
          <p className="t-label t-figure w-6 shrink-0 text-right">
            {stage === 'steps'
              ? `${index + 1}/${steps.length}`
              : stage === 'recall'
                ? 'Recall'
                : ''}
          </p>
          {/* The same lesson as one page to read, at any step. */}
          <Link
            href={`/lectures/${lesson.moduleSlug}/${lesson.slug}`}
            aria-label="Read as a lecture"
            title="Read as a lecture"
            className="text-muted hover:text-fg hover:bg-raised rounded-control inline-flex size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out"
          >
            <BookOpen aria-hidden size={20} strokeWidth={2} />
          </Link>
          <AskScoutButton
            onClick={() => setTutorOpen(true)}
            className="-mr-1 h-4 px-1 sm:pr-1.5"
            labelClassName="max-sm:sr-only"
          />
        </div>
      </header>

      {/* Clips the sideways slide of an arriving step, so a phone never scrolls sideways. */}
      <main id="content" className="frame flex-1 overflow-x-clip pt-4 pb-4">
        {stage === 'opening' ? (
          <section className="step-in flex max-w-3xl flex-col gap-3 py-4">
            <p className="t-label">
              {moduleTitle} · <span className="t-figure">{lesson.minutes} min</span>
              {lesson.level === 'advanced' ? ' · Advanced' : ''}
            </p>
            <Title ref={headingRef} tabIndex={-1} className="outline-none">
              <span className="rich-inline">{codeSpans(lesson.title)}</span>
            </Title>
            <div className="rule-t pt-2">
              <p className="pt-1 text-lg">{lesson.opening.text}</p>
            </div>
            <p className="text-muted prose-measure">
              After this lesson you can: <InlineCode text={lowerFirst(lesson.objective)} />
            </p>
          </section>
        ) : null}

        {stage === 'steps' && step ? (
          <StepRunner
            key={step.id}
            lessonId={lesson.id}
            step={step}
            mode={mode}
            context="lesson"
            solutionsUrl={solutionsUrl}
            // Going back and answering again replaces the step's earlier result.
            onResult={(result) =>
              setResults((all) => [...all.filter((r) => r.stepId !== result.stepId), result])
            }
            onContinue={advance}
            {...(index > 0 ? { onBack: () => setIndex(index - 1) } : {})}
          />
        ) : null}

        {stage === 'recall' ? <RecallStage lesson={lesson} onDone={finishLesson} /> : null}

        {stage === 'summary' ? (
          <LessonSummary
            lesson={lesson}
            results={results}
            next={next}
            exitHref={exit}
            firstCompletion={firstCompletion}
          />
        ) : null}
      </main>

      {stage === 'opening' ? (
        <ActionBar className="justify-end">
          <Button variant="primary" onClick={() => setStage('steps')}>
            Begin
          </Button>
        </ActionBar>
      ) : null}
    </div>
  );
}

function tickOf(results: readonly StepResult[], step: CompiledStep): TickState {
  const result = results.find((r) => r.stepId === step.id);
  if (!result) return 'done';
  return result.grade.correct ? 'right' : 'wrong';
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
