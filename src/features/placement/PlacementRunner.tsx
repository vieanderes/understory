'use client';

import { ChevronLeft, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ActionBar } from '@/components/layout/ActionBar';
import { Button, buttonClass } from '@/components/ui/Button';
import { Figure } from '@/components/ui/Figure';
import type { CompiledStep } from '@/core/content/compiled';
import type { CompiledPlacementItem, CompiledPlacementRung } from '@/core/content/placement-schema';
import { gradeStep, type Answer } from '@/core/grading';
import {
  answerPlacement,
  undoPlacement,
  currentPlacementItem,
  placementOutcome,
  startPlacement,
  type PlacementSession,
  type StartedAs,
} from '@/core/placement';
import type { Confidence } from '@/core/progress';
import type { Submission } from '@/features/lesson-player/contract';
import { toGradable } from '@/features/lesson-player/gradable';
import { ConfidenceControl } from '@/features/lesson-player/parts/ConfidenceControl';
import { RichText } from '@/features/lesson-player/parts/RichText';
import { STEP_COMPONENTS } from '@/features/lesson-player/registry';
import { STEP_KIND } from '@/features/lesson-player/StepRunner';
import { requestPersistence } from '@/features/store/client';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { withholdTutor } from '@/features/tutor/tutor-store';
import { cn } from '@/lib/cn';
import { Title } from '@/features/motion/Title';

export interface EntryModule {
  id: string;
  title: string;
  href: string;
}

/** B1 caps the ladder at 10 items. Shown as a ceiling, because it often stops sooner. */
const MAX_ITEMS = 10;

const STARTS: readonly { value: StartedAs; label: string; note: string }[] = [
  { value: 'new', label: 'New to code', note: 'Starts with the very first steps.' },
  { value: 'ai-builder', label: 'I build with AI', note: 'Starts where gaps often hide.' },
  { value: 'experienced', label: 'Experienced', note: 'Starts in the middle and climbs.' },
];

interface Props {
  rungs: readonly CompiledPlacementRung[];
  /** The course's modules in course order, with where each one starts. */
  modules: readonly EntryModule[];
}

/**
 * The first-session placement ladder (LEARNING-SCIENCE.md B1). One question sets the
 * starting rung, then short items climb or drop the staircase. Nothing is marked right
 * or wrong until the end, because feedback between items slows the ladder and moves it.
 */
export function PlacementRunner({ rungs, modules }: Props) {
  const store = useStore();
  const { status, state } = useProgress();
  const [startedAs, setStartedAs] = useState<StartedAs | null>(null);
  const [session, setSession] = useState<PlacementSession | null>(null);

  // Placement measures where the learner starts, so the study assistant stays away and
  // never sits on the Next button. Undone on unmount.
  useEffect(() => withholdTutor(), []);

  const current = session ? currentPlacementItem(session, rungs) : null;
  const finished = session !== null && current === null;
  const item = current
    ? rungs.find((r) => r.rung === current.rung)?.items.find((i) => i.id === current.id)
    : undefined;

  const recorded = useRef(false);
  useEffect(() => {
    if (!finished || !session || recorded.current) return;
    recorded.current = true;
    const outcome = placementOutcome(session, rungs);
    void store.record('placement_completed', {
      startedAs: session.startedAs,
      thetaByModule: outcome.thetaByModule,
      assumedConcepts: [...outcome.assumedConcepts],
    });
    void requestPersistence();
  }, [finished, session, rungs, store]);

  function begin() {
    if (!startedAs) return;
    setSession(startPlacement(startedAs, state.placementsCompleted, rungs.length));
  }

  function answer(correct: boolean, confidence: Confidence) {
    if (!session || !current) return;
    void store.record('placement_answered', {
      itemId: current.id,
      moduleId: current.moduleId,
      rung: current.rung,
      correct,
      confidence,
    });
    setSession(answerPlacement(session, rungs, { itemId: current.id, correct, confidence }));
  }

  // Back takes the last answer back, or from the first question returns to the start.
  function back() {
    if (!session) return;
    setSession(session.answers.length === 0 ? null : undoPlacement(session, rungs.length));
  }

  const answered = session?.answers.length ?? 0;

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <header className="rule-b bg-bg sticky top-0 z-20">
        <div className="frame flex h-8 items-center gap-2">
          <Link
            href="/"
            aria-label="Leave placement"
            title="Leave placement"
            className="text-muted hover:text-fg hover:bg-raised rounded-control -ml-1 inline-flex size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out"
          >
            <X aria-hidden size={20} strokeWidth={2} />
          </Link>
          <p className="t-label flex-1">Find your level</p>
          <p className="t-label t-figure shrink-0 text-right">
            {session && !finished ? `${answered + 1} / ${MAX_ITEMS}` : ''}
          </p>
        </div>
      </header>

      <main id="content" className="frame flex-1 pt-4 pb-4">
        {!session ? (
          <Intro
            value={startedAs}
            onChange={setStartedAs}
            onBegin={begin}
            ready={status === 'ready'}
          />
        ) : finished ? (
          <Results session={session} rungs={rungs} modules={modules} />
        ) : item ? (
          <PlacementItem key={item.id} item={item} onAnswer={answer} onBack={back} />
        ) : (
          <p className="t-label">Loading</p>
        )}
      </main>
    </div>
  );
}

function Intro({
  value,
  onChange,
  onBegin,
  ready,
}: {
  value: StartedAs | null;
  onChange: (value: StartedAs) => void;
  onBegin: () => void;
  ready: boolean;
}) {
  return (
    <section aria-labelledby="start-title" className="step-in flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-2">
        <Title id="start-title">
          Find your level. <span className="text-muted">About 8 minutes.</span>
        </Title>
        <p className="text-muted prose-measure">
          Up to 10 short questions, from a first line of code to two requests racing. They get
          harder when you answer well and easier when you don&apos;t. Nothing is locked, whatever
          the result.
        </p>
      </div>
      <fieldset className="prose-measure flex min-w-0 flex-col gap-1">
        <legend className="mb-1 font-medium">Where are you starting from?</legend>
        {STARTS.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                'rounded-control flex min-h-6 cursor-pointer flex-col justify-center border px-2 py-1 transition-colors duration-150 ease-out',
                'has-focus-visible:outline-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
                selected ? 'border-accent bg-accent-tint' : 'border-border hover:bg-raised',
              )}
            >
              <input
                type="radio"
                name="started-as"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="font-medium">{option.label}</span>
              <span className="text-muted text-sm">{option.note}</span>
            </label>
          );
        })}
      </fieldset>
      <Button
        variant="primary"
        className="self-start"
        onClick={onBegin}
        disabled={value === null || !ready}
      >
        Start
      </Button>
    </section>
  );
}

function PlacementItem({
  item,
  onAnswer,
  onBack,
}: {
  item: CompiledPlacementItem;
  onAnswer: (correct: boolean, confidence: Confidence) => void;
  onBack: () => void;
}) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = item as CompiledStep;
  const StepComponent = STEP_COMPONENTS[step.type];
  const canAnswer = submission !== null && confidence !== null;

  // Focus lands where the new question starts, for keyboard and screen reader users.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function next() {
    if (!submission || !confidence) return;
    const gradable = toGradable(step);
    if (!gradable) return;
    onAnswer(gradeStep(gradable, submission as Answer).correct, confidence);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (['TEXTAREA', 'BUTTON', 'A', 'SUMMARY'].includes(target.tagName)) return;
      e.preventDefault();
      next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <section aria-labelledby="step-kind" className="step-in flex flex-col gap-3">
        <h2 id="step-kind" ref={headingRef} tabIndex={-1} className="t-label outline-none">
          {STEP_KIND[step.type]}
        </h2>
        {StepComponent ? (
          <StepComponent
            step={step as never}
            phase="answering"
            reveal={false}
            seed={0}
            onSubmissionChange={setSubmission}
            requestCheck={next}
          />
        ) : null}
      </section>

      {/* Like a lesson: Back alone on the left; how sure beside Next on the right, set just
          before moving on. On a phone how sure takes its own row above. */}
      <ActionBar className="flex-wrap gap-y-1 sm:flex-nowrap">
        <Button
          variant="quiet"
          onClick={onBack}
          aria-label="Previous question"
          title="Previous question"
        >
          <ChevronLeft aria-hidden size={16} strokeWidth={2} />
          <span className="max-sm:sr-only">Back</span>
        </Button>
        <div className="ml-auto flex items-center gap-2 max-sm:contents">
          <ConfidenceControl
            value={confidence}
            onChange={setConfidence}
            className="max-sm:order-first max-sm:w-full"
          />
          <Button variant="primary" onClick={next} disabled={!canAnswer} className="max-sm:ml-auto">
            Next
          </Button>
        </div>
      </ActionBar>
    </>
  );
}

function Results({
  session,
  rungs,
  modules,
}: {
  session: PlacementSession;
  rungs: readonly CompiledPlacementRung[];
  modules: readonly EntryModule[];
}) {
  const outcome = placementOutcome(session, rungs);
  const band = new Set(rungs.find((r) => r.rung === outcome.finalRung)?.moduleBand ?? []);
  const entries = modules.filter((m) => band.has(m.id)).slice(0, 3);
  const first = entries[0] ?? modules[0];
  const right = session.answers.filter((a) => a.correct).length;
  const missed = session.answers
    .filter((a) => !a.correct)
    .map((a) => rungs.find((r) => r.rung === a.rung)?.items.find((i) => i.id === a.itemId))
    .filter((i): i is CompiledPlacementItem => i !== undefined);

  return (
    <section aria-labelledby="result-title" className="step-in flex flex-col gap-6 py-2">
      <div className="flex flex-col gap-2">
        <p className="t-label">Placement · Done</p>
        <Title id="result-title">
          {first ? (
            <>
              Start with {first.title}. <span className="text-muted">Skip what you know.</span>
            </>
          ) : (
            'Done.'
          )}
        </Title>
        <p className="text-muted prose-measure">
          Concepts below your level are marked assumed. Practice checks them now and then over the
          next two weeks, so a gap still shows up. Nothing is locked.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        <Figure label="Level" value={String(outcome.finalRung)} unit={`/ ${rungs.length}`} />
        <Figure label="Right" value={String(right)} unit={`/ ${session.answers.length}`} />
        <Figure label="Assumed" value={String(outcome.assumedConcepts.length)} unit="concepts" />
      </dl>

      <div className="flex flex-wrap gap-1">
        {first ? (
          <Link href={first.href} className={buttonClass('primary')}>
            Start {first.title}
          </Link>
        ) : null}
        <Link href="/progress#mastery" className={buttonClass('quiet')}>
          See your progress
        </Link>
      </div>

      {entries.length > 1 ? (
        <nav aria-labelledby="entries-title" className="flex flex-col gap-1">
          <h2 id="entries-title" className="t-label">
            Also at your level
          </h2>
          <ul className="flex flex-col">
            {entries.slice(1).map((entry) => (
              <li key={entry.id}>
                <Link
                  href={entry.href}
                  className="hover:text-accent inline-flex min-h-5 items-center underline-offset-4 hover:underline"
                >
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {missed.length > 0 ? (
        <section aria-labelledby="missed-title" className="prose-measure flex flex-col gap-3">
          <h2 id="missed-title" className="t-label">
            Worth a second look
          </h2>
          <ul className="flex flex-col gap-3">
            {missed.map((missedItem) => {
              const choices =
                missedItem.type === 'bug-hunt' ? missedItem.reasons : missedItem.choices;
              const answer = choices.find((c) => c.correct);
              const question =
                missedItem.type === 'bug-hunt' ? missedItem.prompt : missedItem.question;
              return (
                <li key={missedItem.id} className="rule-t flex flex-col gap-1 pt-2">
                  <RichText value={question} className="font-medium" />
                  {answer ? (
                    <>
                      <RichText inline value={answer.text} />
                      <RichText value={answer.feedback} className="text-muted text-sm" />
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
