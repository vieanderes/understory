import type { CapstoneAdr } from '@/core/progress';
import { cn } from '@/lib/cn';

const SECTIONS = [
  ['context', 'Context'],
  ['decision', 'Decision'],
  ['alternatives', 'Alternatives considered'],
  ['consequences', 'Consequences'],
] as const;

const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dayOf = (localDate: string) => SHORT.format(new Date(`${localDate}T12:00:00Z`));

interface AdrRecordProps {
  adr: CapstoneAdr;
  /** `ADR 0003`, shown beside the title. */
  label: string;
  /** The title's heading level, so the record fits the outline of the page it sits in. */
  level: 2 | 3;
  className?: string;
}

/**
 * A saved decision record as the learner wrote it. Sections that were left blank are not
 * shown. Line breaks are kept; nothing else of Markdown is rendered, so the text reads the
 * same here and in the exported file.
 */
export function AdrRecord({ adr, label, level, className }: AdrRecordProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const edited = adr.revisions > 1 ? ` · edited ${dayOf(adr.updatedOn)}` : '';
  return (
    <article className={cn('prose-measure flex flex-col gap-2', className)} data-testid="adr">
      <header className="flex flex-col gap-0.5">
        <p className="t-label">
          <span className="t-figure">{label}</span> · Accepted
        </p>
        <Heading className="t-section break-words">{adr.title}</Heading>
        <p className="text-muted text-sm">
          Written {dayOf(adr.firstWrittenOn)}
          {edited}
        </p>
      </header>
      <dl className="flex flex-col gap-2">
        {SECTIONS.map(([key, name]) =>
          adr[key] === undefined ? null : (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className="t-label">{name}</dt>
              <dd className="break-words whitespace-pre-line">{adr[key]}</dd>
            </div>
          ),
        )}
      </dl>
    </article>
  );
}

export const adrLabel = (number: number) => `ADR ${String(number).padStart(4, '0')}`;
