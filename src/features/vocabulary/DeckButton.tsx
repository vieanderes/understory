'use client';

import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { wordTier, type WordTier } from '@/core/vocabulary';
import { useProgress, useStore } from '@/features/store/StoreProvider';

const TIER_LABEL: Record<WordTier, string> = {
  new: 'New in your deck',
  learning: 'Learning',
  familiar: 'Familiar',
  fluent: 'Fluent',
};

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/**
 * Adds one word to the deck, or takes it out again. Out of the deck, a word keeps its card,
 * so putting it back picks the schedule up where it stopped.
 */
export function DeckButton({ id, term }: { id: string; term: string }) {
  const store = useStore();
  const { status, state } = useProgress();
  const inDeck = state.vocabulary.deck.has(id);
  const card = state.vocabulary.cards[id];
  const tier = wordTier(card);

  return (
    <div className="flex flex-col gap-1">
      {inDeck ? (
        <>
          <p className="flex items-center gap-1 font-medium">
            <Check aria-hidden size={16} strokeWidth={2} />
            {TIER_LABEL[tier]}
          </p>
          {card && tier !== 'new' ? (
            <p className="t-figure text-muted text-sm">
              Next review {DAY.format(new Date(card.due))}
            </p>
          ) : null}
          <Button
            variant="quiet"
            size="md"
            className="-ml-2 self-start"
            onClick={() => void store.record('words_removed', { termIds: [id] })}
          >
            Remove from deck
          </Button>
        </>
      ) : (
        <Button
          variant="primary"
          disabled={status !== 'ready'}
          aria-label={`Add ${term} to your deck`}
          onClick={() => void store.record('words_added', { termIds: [id] })}
        >
          <Plus aria-hidden size={16} strokeWidth={2} />
          Add to deck
        </Button>
      )}
    </div>
  );
}
