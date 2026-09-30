'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CompiledRecallCard } from '@/core/content/compiled';
import { schedule, type FsrsRating } from '@/core/scheduling';
import { useStore } from '@/features/store/StoreProvider';
import { retrievabilityNow } from './outcome';
import { RichText } from './parts/RichText';

const RATINGS: { rating: FsrsRating; label: string; hint: string }[] = [
  { rating: 1, label: 'Forgot', hint: 'Could not recall it' },
  { rating: 2, label: 'Hard', hint: 'Recalled with effort' },
  { rating: 3, label: 'Good', hint: 'Recalled it' },
  { rating: 4, label: 'Instant', hint: 'No effort at all' },
];

interface RecallCardViewProps {
  lessonId: string;
  card: CompiledRecallCard;
  label: React.ReactNode;
  onRated: (rating: FsrsRating) => void;
}

/**
 * One recall card: answer in your head, turn it, say how it went. The rating and the
 * card's new schedule are written as one fact. Space or Enter turns the card; 1 to 4 rate.
 * Mount with `key={card id}`.
 */
export function RecallCardView({ lessonId, card, label, onRated }: RecallCardViewProps) {
  const store = useStore();
  const [turned, setTurned] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function rate(rating: FsrsRating) {
    const now = new Date();
    const cardKey = `lesson:${lessonId}#${card.id}`;
    const before = store.getSnapshot().state.cards[cardKey];
    const r = retrievabilityNow(before, now);
    await store.record('review_graded', {
      cardKey,
      concept: card.concept,
      rating,
      ...(r === undefined ? {} : { retrievabilityBefore: r }),
      state: schedule(before ?? null, rating, now),
    });
    onRated(rating);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (!turned && (e.key === ' ' || e.key === 'Enter')) {
        if (tag === 'BUTTON' || tag === 'A') return;
        e.preventDefault();
        setTurned(true);
      } else if (turned && ['1', '2', '3', '4'].includes(e.key)) {
        void rate(Number(e.key) as FsrsRating);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <section aria-labelledby="recall-title" className="step-in flex max-w-3xl flex-col gap-3">
      <h2 id="recall-title" ref={headingRef} tabIndex={-1} className="t-label outline-none">
        {label}
      </h2>
      <RichText value={card.front} className="t-section" />

      {turned ? (
        <>
          <div className="rule-t step-in pt-2">
            <p className="t-label">Answer</p>
            <RichText value={card.back} className="pt-1" />
          </div>
          <div
            role="group"
            aria-label="How did recall go"
            className="grid grid-cols-2 gap-1 sm:grid-cols-4"
          >
            {RATINGS.map(({ rating, label: name, hint }) => (
              <Button
                key={rating}
                variant="secondary"
                onClick={() => void rate(rating)}
                className="h-auto min-h-7 flex-col gap-0 py-1"
              >
                <span>
                  <span aria-hidden className="t-figure text-faint pr-1 text-sm">
                    {rating}
                  </span>
                  {name}
                </span>
                <span className="text-muted text-sm font-normal whitespace-normal">{hint}</span>
              </Button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="text-muted text-sm">
            Say the answer to yourself first. Then turn the card.
          </p>
          <Button variant="primary" onClick={() => setTurned(true)}>
            Show answer
          </Button>
        </div>
      )}
    </section>
  );
}
