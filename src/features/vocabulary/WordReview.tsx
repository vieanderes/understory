'use client';

import { ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { Figure } from '@/components/ui/Figure';
import { ProgressLine } from '@/components/ui/ProgressLine';
import type { CompiledDrillWord } from '@/core/content/glossary-schema';
import { retrievability, schedule } from '@/core/scheduling';
import { mulberry32 } from '@/core/util/rng';
import {
  buildSpeedRound,
  buildWordSession,
  ratingForAnswer,
  retryOf,
  SPEED_ROUND_SECONDS,
  type DrillItem,
  type SessionItem,
} from '@/core/vocabulary';
import { StepTicks, type TickState } from '@/features/lesson-player/parts/StepTicks';
import { Title } from '@/features/motion/Title';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { drillShape } from './types';
import { useWords } from './useWords';

export type ReviewMode = 'review' | 'speed';

const DAY_MS = 86_400_000;
const DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
/** How long a speed-round verdict stays before the next word: long enough to read a miss. */
const SPEED_RIGHT_MS = 350;
const SPEED_WRONG_MS = 1200;
/** Below this many words in the deck, a speed round draws on the everyday words instead. */
const SPEED_MIN_DECK = 4;

const PROMPT: Record<DrillItem['kind'], string> = {
  meaning: 'What does it mean?',
  recall: 'Which word is this?',
  gap: 'Which word fills the gap?',
  snippet: 'Which word does this code show?',
};

interface Plan {
  items: SessionItem[];
  fresh: number;
  /** Speed round: the pool it draws from, for the result and the best score. */
  scope: string;
  seed: number;
  /** Speed round: when the clock runs out, in epoch milliseconds. */
  endsAt?: number;
}

interface Answer {
  picked: number;
  correct: boolean;
}

function Html({ html, className }: { html: string; className?: string }) {
  return (
    <span className={cn('rich-inline', className)} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/**
 * A review of the deck, or a sixty-second speed round. The queue is built once, when the log
 * and the words are both loaded, and missed words come back at the end as practice. A
 * graded answer is recorded the moment it is picked; a speed round records only its score.
 */
export function WordReview({ mode }: { mode: ReviewMode }) {
  const store = useStore();
  const { status, state } = useProgress();
  const { words, failed } = useWords();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(Answer | null)[]>([]);
  const [shownAt, setShownAt] = useState(0);
  const [clock, setClock] = useState(0);
  const planning = useRef(false);
  const recordedRound = useRef(false);
  const speed = mode === 'speed';

  const byId = useMemo(() => new Map((words ?? []).map((w) => [w.id, w])), [words]);
  const shapes = useMemo(() => (words ?? []).map(drillShape), [words]);

  // Build the queue once; the log keeps changing as answers are recorded, the queue must not.
  useEffect(() => {
    if (plan || planning.current || status !== 'ready' || !words) return;
    planning.current = true;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const now = new Date();
    let next: Plan;
    if (speed) {
      const deck = [...state.vocabulary.deck.keys()].filter((id) => byId.has(id));
      const scope = deck.length >= SPEED_MIN_DECK ? 'deck' : 'all';
      const pool = scope === 'deck' ? deck : words.filter((w) => w.level === 1).map((w) => w.id);
      const items = buildSpeedRound(pool, shapes, seed);
      next = { items, fresh: 0, scope, seed, endsAt: now.getTime() + SPEED_ROUND_SECONDS * 1000 };
    } else {
      const session = buildWordSession({ words: shapes, vocabulary: state.vocabulary, now, seed });
      next = { items: [...session.items], fresh: session.fresh, scope: 'deck', seed };
    }
    // Built once from the log and the words, like a practice session's queue (SessionRunner).
    setPlan(next);
    setShownAt(now.getTime());
  }, [plan, status, words, speed, state.vocabulary, byId, shapes]);

  const item = plan?.items[index];
  const answer = answers[index] ?? null;
  const endsAt = plan?.endsAt;
  const timeUp = speed && endsAt !== undefined && clock >= endsAt;
  const finished = plan !== null && (index >= plan.items.length || timeUp);

  // The speed round's clock ticks four times a second until it runs out.
  useEffect(() => {
    if (!speed || endsAt === undefined || finished) return;
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [speed, endsAt, finished]);

  const graded = (plan?.items ?? []).flatMap((it, i) =>
    it.kind !== 'intro' && (it.graded || speed) ? [answers[i]] : [],
  );
  const right = graded.filter((a) => a?.correct).length;
  const attempted = graded.filter((a) => a !== null && a !== undefined).length;

  useEffect(() => {
    if (!speed || !finished || recordedRound.current || attempted === 0 || !plan) return;
    recordedRound.current = true;
    void store.record('word_round_finished', {
      right,
      total: attempted,
      seconds: SPEED_ROUND_SECONDS,
      scope: plan.scope,
    });
  }, [speed, finished, attempted, right, plan, store]);

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
    setShownAt(Date.now());
  }, []);

  const pick = useCallback(
    (choice: number) => {
      if (!plan || !item || item.kind === 'intro' || answer || finished) return;
      const correct = choice === item.answer;
      setAnswers((all) => {
        const next = [...all];
        next[index] = { picked: choice, correct };
        return next;
      });
      if (item.graded && !speed) {
        const now = new Date();
        const prior = state.vocabulary.cards[item.termId];
        const ms = now.getTime() - shownAt;
        const rating = ratingForAnswer(correct, ms);
        const elapsed = prior?.lastReview
          ? (now.getTime() - new Date(prior.lastReview).getTime()) / DAY_MS
          : 0;
        void store.record('word_reviewed', {
          termId: item.termId,
          drill: item.kind,
          correct,
          rating,
          ...(prior && prior.reps > 0
            ? { retrievabilityBefore: retrievability(prior.stability, elapsed) }
            : {}),
          state: schedule(prior ?? null, rating, now),
          durationMs: Math.max(0, Math.round(ms)),
        });
      }
      if (!correct && !speed) {
        const retry = retryOf(item, shapes, mulberry32(plan.seed + index));
        if (retry) setPlan({ ...plan, items: [...plan.items, retry] });
      }
      if (speed) window.setTimeout(advance, correct ? SPEED_RIGHT_MS : SPEED_WRONG_MS);
    },
    [
      plan,
      item,
      answer,
      finished,
      index,
      speed,
      state.vocabulary.cards,
      shownAt,
      store,
      shapes,
      advance,
    ],
  );

  // 1 to 4 pick, Enter moves on: the review never needs the pointer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= 4) pick(n - 1);
      else if (event.key === 'Enter' && !speed && item && (item.kind === 'intro' || answer)) {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, advance, item, answer, speed]);

  const ticks: TickState[] = (plan?.items ?? []).map((it, i) =>
    i === index
      ? 'current'
      : i > index
        ? 'todo'
        : answers[i]
          ? answers[i]!.correct
            ? 'right'
            : 'wrong'
          : 'done',
  );
  const secondsLeft =
    endsAt === undefined || clock === 0
      ? SPEED_ROUND_SECONDS
      : Math.max(0, Math.ceil((endsAt - clock) / 1000));

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <header className="rule-b bg-bg sticky top-0 z-20">
        <div className="frame flex h-8 items-center gap-2">
          <Link
            href="/vocabulary"
            aria-label={speed ? 'Leave speed round' : 'Leave review'}
            title={speed ? 'Leave speed round' : 'Leave review'}
            className="text-muted hover:text-fg hover:bg-raised rounded-control -ml-1 inline-flex size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out"
          >
            <X aria-hidden size={20} strokeWidth={2} />
          </Link>
          {speed ? (
            <>
              <ProgressLine
                className="flex-1"
                value={secondsLeft / SPEED_ROUND_SECONDS}
                label={`${secondsLeft} seconds left`}
              />
              <p className="t-label t-figure shrink-0 text-right" aria-live="off">
                {right} right · {secondsLeft}s
              </p>
            </>
          ) : (
            <>
              <StepTicks
                ticks={ticks}
                label={
                  plan
                    ? `Word ${Math.min(index + 1, plan.items.length)} of ${plan.items.length}`
                    : 'Review'
                }
              />
              <p className="t-label t-figure w-6 shrink-0 text-right">
                {plan && !finished ? `${index + 1}/${plan.items.length}` : ''}
              </p>
            </>
          )}
        </div>
      </header>

      <main id="content" className="frame flex flex-1 flex-col pt-4 pb-6">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
          {failed ? (
            <p className="text-muted">
              The words could not be loaded. Check the connection and reload.
            </p>
          ) : !plan ? (
            <p className="t-label">{speed ? 'Shuffling words…' : 'Building your review…'}</p>
          ) : finished || !item ? (
            <Closing
              speed={speed}
              plan={plan}
              right={right}
              attempted={attempted}
              best={Math.max(
                0,
                ...state.vocabulary.rounds
                  .filter((r) => r.scope === plan.scope)
                  .map((r) => r.right),
              )}
              nextDue={nextDueOf(state.vocabulary)}
            />
          ) : item.kind === 'intro' ? (
            <Intro key={index} word={byId.get(item.termId)} onNext={advance} />
          ) : (
            <Drill
              key={index}
              item={item}
              byId={byId}
              answer={answer}
              onPick={pick}
              onNext={advance}
              speed={speed}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function nextDueOf(vocabulary: {
  deck: ReadonlyMap<string, string>;
  cards: Readonly<Record<string, { due: string }>>;
}) {
  return Object.entries(vocabulary.cards)
    .filter(([id]) => vocabulary.deck.has(id))
    .map(([, card]) => card.due)
    .sort()[0];
}

function Intro({ word, onNext }: { word: CompiledDrillWord | undefined; onNext: () => void }) {
  if (!word) return null;
  return (
    <section aria-labelledby="intro-title" className="step-in flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="t-label">New word</p>
        <h1 id="intro-title" className="t-title break-words">
          {word.term}
        </h1>
        <p className="text-lg">
          <Html html={word.shortHtml} />
        </p>
      </div>
      <p className="text-muted prose-measure">
        <Html html={word.analogyHtml} />
      </p>
      {word.exampleHtml ? (
        <div
          className="code-view rich min-w-0"
          tabIndex={0}
          role="region"
          aria-label={`Example of ${word.term}`}
          dangerouslySetInnerHTML={{ __html: word.exampleHtml }}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button variant="primary" onClick={onNext} autoFocus>
          Got it
          <ArrowRight aria-hidden size={16} strokeWidth={2} />
        </Button>
        <Link
          href={`/vocabulary/${word.id}`}
          target="_blank"
          className="text-muted hover:text-fg text-sm underline underline-offset-4"
        >
          Read the whole entry
        </Link>
      </div>
    </section>
  );
}

function Drill({
  item,
  byId,
  answer,
  onPick,
  onNext,
  speed,
}: {
  item: DrillItem;
  byId: ReadonlyMap<string, CompiledDrillWord>;
  answer: Answer | null;
  onPick: (choice: number) => void;
  onNext: () => void;
  speed: boolean;
}) {
  const word = byId.get(item.termId);
  if (!word) return null;
  const pickedWord = answer ? byId.get(item.choices[answer.picked] ?? '') : undefined;
  const showsMeaning = item.kind === 'meaning';

  return (
    <section aria-labelledby="drill-prompt" className="step-in flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 id="drill-prompt" className="t-label">
          {PROMPT[item.kind]}
          {!item.graded && !speed ? ' · Practice' : ''}
        </h1>
        {item.kind === 'meaning' ? (
          <p className="t-section break-words" translate="no">
            {word.term}
          </p>
        ) : item.kind === 'recall' ? (
          <p className="text-lg">
            <Html html={word.shortHtml} />
          </p>
        ) : item.kind === 'gap' ? (
          <p className="text-lg">
            “<Html html={word.gapHtml} />”
          </p>
        ) : word.exampleHtml ? (
          <div
            className="code-view rich min-w-0"
            tabIndex={0}
            role="region"
            aria-label="The code"
            dangerouslySetInnerHTML={{ __html: word.exampleHtml }}
          />
        ) : null}
      </div>

      <ol className="flex flex-col gap-1" aria-label="Choices">
        {item.choices.map((id, i) => {
          const choice = byId.get(id);
          if (!choice) return null;
          const isAnswer = i === item.answer;
          const isPick = answer?.picked === i;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-disabled={answer !== null}
                className={cn(
                  'rounded-control transition-press flex min-h-6 w-full items-center gap-2 border px-2 py-1 text-left',
                  'transition-colors duration-150 ease-out',
                  answer === null && 'border-border hover:bg-raised active:scale-98',
                  answer !== null && isAnswer && 'border-success',
                  answer !== null && isPick && !isAnswer && 'border-accent',
                  answer !== null && !isAnswer && !isPick && 'border-border opacity-60',
                )}
              >
                <span aria-hidden className="t-figure text-faint w-2 shrink-0 text-sm">
                  {i + 1}
                </span>
                <span className={cn('min-w-0 flex-1', !showsMeaning && 'font-medium')}>
                  {showsMeaning ? <Html html={choice.shortHtml} /> : choice.term}
                </span>
                {answer !== null && isAnswer ? (
                  <span className="text-success verdict-pop shrink-0 text-sm font-medium">
                    Right
                  </span>
                ) : null}
                {answer !== null && isPick && !isAnswer ? (
                  <span className="text-accent shrink-0 text-sm font-medium">Your pick</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      {answer && !speed ? (
        <div className="step-in flex flex-col gap-3" aria-live="polite">
          {answer.correct ? (
            <p>
              <span className="font-medium">Right.</span>{' '}
              {showsMeaning ? (
                <span className="text-muted">
                  <Html html={word.analogyHtml} />
                </span>
              ) : (
                <span className="text-muted">
                  {word.term}: <Html html={word.shortHtml} />
                </span>
              )}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <p>
                <span className="font-medium">Not quite.</span> {word.term}:{' '}
                <Html html={word.shortHtml} />
              </p>
              {pickedWord ? (
                <p className="text-muted">
                  You picked {pickedWord.term}: <Html html={pickedWord.shortHtml} /> It comes back
                  at the end.
                </p>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={onNext} autoFocus>
              Continue
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Button>
            <Link
              href={`/vocabulary/${word.id}`}
              target="_blank"
              className="text-muted hover:text-fg text-sm underline underline-offset-4"
            >
              Read about {word.term}
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Closing({
  speed,
  plan,
  right,
  attempted,
  best,
  nextDue,
}: {
  speed: boolean;
  plan: Plan;
  right: number;
  attempted: number;
  best: number;
  nextDue: string | undefined;
}) {
  if (plan.items.length === 0) {
    return (
      <section aria-labelledby="closing-title" className="step-in flex flex-col gap-4 py-4">
        <Title id="closing-title">
          {speed ? 'No words yet.' : 'Nothing due.'}{' '}
          <span className="text-muted">
            {nextDue ? `Next: ${DATE.format(new Date(nextDue))}.` : 'Add a few words first.'}
          </span>
        </Title>
        <div className="flex flex-wrap gap-1">
          <Link href="/vocabulary" className={buttonClass('primary')}>
            Find words
          </Link>
          {!speed ? (
            <Link href="/vocabulary/review?mode=speed" className={buttonClass('secondary')}>
              Speed round
            </Link>
          ) : null}
        </div>
      </section>
    );
  }
  const newBest = speed && right > 0 && right >= best;
  return (
    <section aria-labelledby="closing-title" className="step-in flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-2">
        <p className="t-label">
          {speed
            ? `Speed round · ${plan.scope === 'deck' ? 'your deck' : 'everyday words'}`
            : 'Review'}
        </p>
        <Title id="closing-title">{speed ? (newBest ? 'A new best.' : 'Time.') : 'Done.'}</Title>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
        <Figure label="Right" value={String(right)} unit={`/ ${attempted}`} />
        {speed ? (
          <Figure label="Best" value={String(Math.max(best, right))} unit="right in 60 s" />
        ) : (
          <Figure label="New words" value={String(plan.fresh)} />
        )}
        {!speed ? (
          <Figure
            label="Next review"
            value={nextDue ? DATE.format(new Date(nextDue)) : '··'}
            className="col-span-2 md:col-span-1"
          />
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-1">
        <Link href="/vocabulary" className={buttonClass('primary')}>
          Back to vocabulary
        </Link>
        <Link
          href={`/vocabulary/review?mode=speed&round=${plan.seed}`}
          className={buttonClass('secondary')}
        >
          {speed ? 'Play again' : 'Speed round'}
        </Link>
      </div>
    </section>
  );
}
