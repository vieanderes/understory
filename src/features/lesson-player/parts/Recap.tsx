import { Check } from 'lucide-react';
import type { Rich } from '@/core/content/compiled';
import { RichText } from './RichText';

/** What the learner can now do, in the lesson's own three lines (writing guide rule 25). */
export function Recap({ lines }: { lines: readonly Rich[] }) {
  return (
    <section aria-labelledby="recap-title" className="flex flex-col gap-1">
      <h2 id="recap-title" className="t-label">
        You can now
      </h2>
      <ul className="prose-measure flex flex-col gap-1">
        {lines.map((line, index) => (
          <li key={index} className="flex items-baseline gap-1">
            <Check
              aria-hidden
              size={16}
              strokeWidth={2}
              className="text-success shrink-0 translate-y-0.5 self-start"
            />
            <RichText value={line} inline />
          </li>
        ))}
      </ul>
    </section>
  );
}
