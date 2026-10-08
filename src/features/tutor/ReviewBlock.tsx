'use client';

import { Check, Plus, Wrench } from 'lucide-react';
import type { CSSProperties } from 'react';
import { parseReviewBlock, type ReviewBlock as Review } from '@/core/scout';
import { cn } from '@/lib/cn';

/*
 * The Editor's notes on the learner's own work (docs/SCOUT-ROLES.md, section 7): what to
 * keep, what to fix and what is missing, each on their own words, then one next step.
 */

const TAG: Record<Review['notes'][number]['tag'], { label: string; Icon: typeof Check }> = {
  keep: { label: 'Keep', Icon: Check },
  fix: { label: 'Fix', Icon: Wrench },
  missing: { label: 'Missing', Icon: Plus },
};

export function ReviewBlock({ body }: { body: string }) {
  const review = parseReviewBlock(body);
  if (!review) return null;
  return (
    <div className="flex flex-col gap-1 py-0.5">
      <ul aria-label="Notes on your work" className="rule-t flex flex-col">
        {review.notes.map(({ tag, quote, note }, index) => {
          const { label, Icon } = TAG[tag];
          return (
            <li
              key={`${tag}-${index}`}
              className="stream-in rule-b flex items-start gap-1 py-1"
              style={{ '--i': index } as CSSProperties}
            >
              <Icon
                aria-hidden
                size={16}
                strokeWidth={2}
                className={cn('mt-0.5 shrink-0', tag === 'keep' ? 'text-success' : 'text-accent')}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="t-label">{label}</p>
                {quote ? (
                  <p className="text-muted text-sm text-pretty break-words">“{quote}”</p>
                ) : null}
                <p className="text-sm text-pretty">{note}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm font-medium text-pretty">Next: {review.next}</p>
    </div>
  );
}
