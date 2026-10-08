'use client';

import { ArrowRight, Plus, Search, Timer } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Ledger, PageHead } from '@/components/layout/PageHead';
import { Button, buttonClass } from '@/components/ui/Button';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { rowAction, rowArrow, rowItem, rowList } from '@/components/ui/rows';
import {
  areaFluency,
  deckSummary,
  dueWords,
  FLUENCY_LABEL,
  searchWords,
  starterWords,
  wordOfTheDay,
  wordTier,
  type WordTier,
} from '@/core/vocabulary';
import { Title } from '@/features/motion/Title';
import { localDateOf } from '@/features/store/progress-store';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { LEVEL_LABEL, type AreaInfo, type IndexWord } from './types';
import { setUrlParam, useUrlParam } from './useUrlParam';

const STARTER_COUNT = 10;
/** Words shown per area before "All": everyday words first. */
const PREVIEW = 4;
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

const TIER_MARK: Record<WordTier, string> = {
  new: 'In deck',
  learning: 'Learning',
  familiar: 'Familiar',
  fluent: 'Fluent',
};

/**
 * The dictionary and the deck on one page. The first screen answers "what now": review the
 * words that are due, or start with a handful. Below, every word, searchable by name,
 * nickname or a misspelling, filtered by area, and how fluent you are in each area.
 */
export function VocabularyHome({ words, areas }: { words: IndexWord[]; areas: AreaInfo[] }) {
  const store = useStore();
  const { status, state } = useProgress();
  const ready = status === 'ready';
  const query = useUrlParam('q') ?? '';
  const areaParam = useUrlParam('area');
  const area = areas.some((a) => a.id === areaParam) ? areaParam : null;
  const setParam = setUrlParam;

  const { vocabulary } = state;
  const now = new Date();
  const summary = deckSummary(vocabulary, now);
  const known = summary.familiar + summary.fluent;
  const titleOf = new Map(areas.map((a) => [a.id, a.title]));
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);

  const shown = useMemo(
    () => searchWords(area ? words.filter((w) => w.area === area) : words, query),
    [words, area, query],
  );
  const browsing = area === null && query.trim() === '';
  const notInDeck = shown.filter((w) => !vocabulary.deck.has(w.id));
  const fluency = areaFluency(words, vocabulary);

  // The date is the visitor's, so it waits for the client: a static page has no today.
  const todayId = ready
    ? wordOfTheDay(words, localDateOf(now), new Set(vocabulary.deck.keys()))
    : undefined;
  const today = todayId ? byId.get(todayId) : undefined;

  const add = (ids: readonly string[]) => {
    if (ids.length > 0) void store.record('words_added', { termIds: [...ids] });
  };

  const wordRows = (list: readonly IndexWord[]) => (
    <ul className={rowList()}>
      {list.map((word) => (
        <li key={word.id} className={rowItem}>
          <Link href={`/vocabulary/${word.id}`} className={rowAction('items-start')}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium" translate="no">
                {word.term}
              </span>
              <span className="text-muted line-clamp-1 text-sm">{word.short}</span>
            </span>
            {ready && vocabulary.deck.has(word.id) ? (
              <span className="t-figure text-muted shrink-0 pt-0.5 text-sm">
                {TIER_MARK[wordTier(vocabulary.cards[word.id])]}
              </span>
            ) : null}
            <ArrowRight aria-hidden size={16} strokeWidth={2} className={cn(rowArrow, 'mt-0.5')} />
          </Link>
        </li>
      ))}
    </ul>
  );

  const nextDue = Object.entries(vocabulary.cards)
    .filter(([id]) => vocabulary.deck.has(id))
    .map(([, card]) => card.due)
    .sort()[0];
  const reviewable = dueWords(vocabulary, now).length + summary.fresh;

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        label="Vocabulary"
        title={<Title>The language of software.</Title>}
        lede="Every word the course teaches, in plain English, with the lessons that teach it. Add the ones you want to own and learn them a few at a time."
        aside={
          <Ledger
            rows={[
              { label: 'In your deck', short: 'Deck', value: ready ? summary.words : '··' },
              { label: 'Due today', short: 'Due', value: ready ? summary.due : '··' },
              { label: 'Known', short: 'Known', value: ready ? known : '··' },
              { label: 'Words', short: 'Words', value: words.length },
            ]}
          />
        }
      />

      <section
        aria-labelledby="deck-title"
        className="border-border rounded-panel flex flex-col gap-3 border p-3 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex flex-col gap-1">
          <h2 id="deck-title" className="text-lg font-medium">
            {!ready
              ? 'Your deck'
              : summary.words === 0
                ? 'Start with 10 everyday words'
                : reviewable > 0
                  ? `${summary.due} due, ${summary.fresh} new`
                  : 'Nothing due'}
          </h2>
          <p className="text-muted prose-measure">
            {!ready
              ? 'Loading your words…'
              : summary.words === 0
                ? 'One from each area, the words every engineer uses. Five new words come per review, so it never floods.'
                : reviewable > 0
                  ? 'About five minutes. New words come five at a time, after the ones that are due.'
                  : nextDue
                    ? `Next review ${DAY.format(new Date(nextDue))}. Add more words below, or play a speed round.`
                    : 'Add more words below, or play a speed round.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {ready && summary.words === 0 ? (
            <Button variant="primary" onClick={() => add(starterWords(words, STARTER_COUNT))}>
              <Plus aria-hidden size={16} strokeWidth={2} />
              Add 10 words
            </Button>
          ) : (
            <Link
              href="/vocabulary/review"
              aria-disabled={!ready || reviewable === 0}
              className={buttonClass(
                ready && reviewable > 0 ? 'primary' : 'secondary',
                'lg',
                cn(!ready || reviewable === 0 ? 'text-faint pointer-events-none' : undefined),
              )}
            >
              Review words
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          )}
          <Link href="/vocabulary/review?mode=speed" className={buttonClass('secondary')}>
            <Timer aria-hidden size={16} strokeWidth={2} />
            Speed round
          </Link>
        </div>
      </section>

      {today ? (
        <section aria-labelledby="today-title" className="flex flex-col gap-1">
          <p className="t-label">Word of the day</p>
          <h2 id="today-title" className="t-section">
            <Link
              href={`/vocabulary/${today.id}`}
              className="underline-offset-4 transition-colors duration-150 ease-out hover:underline"
            >
              {today.term}
            </Link>
          </h2>
          <p className="prose-measure text-lg">{today.short}</p>
          <p className="t-label">
            {titleOf.get(today.area)} · {LEVEL_LABEL[today.level]}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="words-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <h2 id="words-title" className="t-section">
            Every word
          </h2>
          <label className="border-border rounded-control focus-within:outline-accent bg-surface flex h-6 items-center gap-1 border px-2 focus-within:outline-2 focus-within:outline-offset-2 md:max-w-xl">
            <Search aria-hidden size={16} strokeWidth={2} className="text-muted shrink-0" />
            <span className="sr-only">Search words</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setParam('q', event.target.value || null)}
              placeholder="A word, a nickname or a meaning…"
              autoComplete="off"
              spellCheck={false}
              className="placeholder:text-muted min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
          <div role="group" aria-label="Area" className="flex flex-wrap gap-0.5">
            <AreaChip pressed={area === null} onClick={() => setParam('area', null)}>
              All
            </AreaChip>
            {areas
              .filter((a) => a.words > 0)
              .map((a) => (
                <AreaChip
                  key={a.id}
                  pressed={area === a.id}
                  onClick={() => setParam('area', area === a.id ? null : a.id)}
                >
                  {a.title}
                </AreaChip>
              ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="t-label t-figure" aria-live="polite">
            {shown.length} {shown.length === 1 ? 'word' : 'words'}
          </p>
          {ready && notInDeck.length > 1 && (area !== null || query !== '') ? (
            <Button size="md" onClick={() => add(notInDeck.map((w) => w.id))}>
              <Plus aria-hidden size={16} strokeWidth={2} />
              Add these {notInDeck.length}
            </Button>
          ) : null}
        </div>

        {shown.length === 0 ? (
          <p className="text-muted">
            No word matches “{query}”. Try a shorter spelling, or clear the area.
          </p>
        ) : browsing ? (
          // Without a search or an area, a taste of each area instead of a wall of words.
          <div className="flex flex-col gap-6">
            {areas
              .filter((a) => a.words > 0)
              .map((a) => {
                const inArea = shown.filter((w) => w.area === a.id);
                const preview = [...inArea].sort((x, y) => x.level - y.level).slice(0, PREVIEW);
                return (
                  <section
                    key={a.id}
                    aria-labelledby={`area-${a.id}`}
                    className="flex flex-col gap-1"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 id={`area-${a.id}`} className="font-semibold">
                        {a.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setParam('area', a.id)}
                        className="text-muted hover:text-fg t-figure text-sm underline-offset-4 transition-colors duration-150 ease-out hover:underline"
                      >
                        All {inArea.length}
                      </button>
                    </div>
                    {wordRows(preview)}
                  </section>
                );
              })}
          </div>
        ) : (
          wordRows(shown)
        )}
      </section>

      <section aria-labelledby="fluency-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="fluency-title" className="t-section">
            Your fluency
          </h2>
          <p className="text-muted prose-measure">
            A word is known once you&apos;d still recall it after a week. A quarter of an area makes
            you conversational, nine in ten makes you a native.
          </p>
        </div>
        <ul className={rowList()}>
          {fluency
            .filter((row) => row.total > 0)
            .map((row) => (
              <li key={row.area} className={cn(rowItem, 'flex flex-col gap-1 py-1.5')}>
                <div className="flex items-baseline justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setParam('area', row.area)}
                    className="hover:text-fg text-left font-medium underline-offset-4 hover:underline"
                  >
                    {titleOf.get(row.area) ?? row.area}
                  </button>
                  <span className="t-figure text-sm">
                    <span className={cn(row.level === 'tourist' ? 'text-muted' : 'font-semibold')}>
                      {FLUENCY_LABEL[row.level]}
                    </span>
                    <span className="text-muted">
                      {' '}
                      · {ready ? row.known : 0} of {row.total}
                    </span>
                  </span>
                </div>
                <ProgressLine
                  value={ready ? row.known / row.total : 0}
                  label={`${titleOf.get(row.area) ?? row.area}: ${row.known} of ${row.total} words known`}
                />
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function AreaChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'transition-press inline-flex h-5 items-center rounded-full border px-1.5 text-sm font-medium active:scale-98',
        'transition-colors duration-150 ease-out',
        pressed
          ? 'bg-fg border-fg text-bg'
          : 'border-border text-muted hover:text-fg hover:border-border-strong',
      )}
    >
      {children}
    </button>
  );
}
