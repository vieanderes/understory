import Link from 'next/link';
import { editionWeeks } from '@/core/news';
import { PageHead } from '@/components/layout/PageHead';
import type { EditionSummary } from '@/lib/news';
import { Title } from '@/features/motion/Title';
import { EditionList } from './EditionList';
import { formatShort } from './format';
import { PeriodLinks } from './PeriodLinks';

/** Every edition, a week to a group, so a skipped day is easy to find and to catch up on. */
export function SignalArchiveView({ editions }: { editions: EditionSummary[] }) {
  const weeks = editionWeeks(editions);
  const latest = editions[0];

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHead
        label="News"
        title={<Title>All editions</Title>}
        lede="Newest first. Editions you have not opened carry a dot."
        actions={
          latest ? (
            <PeriodLinks
              label="Latest"
              links={[{ href: '/signal', label: 'Latest edition', arrow: 'right' }]}
            />
          ) : null
        }
      />

      {weeks.length === 0 ? (
        <p className="rule-t text-muted pt-3">No editions yet.</p>
      ) : (
        <div className="grid grid-cols-4 gap-x-4 md:grid-cols-12">
          <div className="col-span-4 flex min-w-0 flex-col gap-6 md:col-span-8">
            {weeks.map((week) => (
              <section
                key={week.key}
                aria-labelledby={`week-${week.key}`}
                className="flex flex-col gap-1"
              >
                <h2 id={`week-${week.key}`} className="rule-t flex items-baseline pt-3">
                  <Link
                    href={`/signal/week/${week.key}`}
                    className="t-label hover:text-fg decoration-border-strong inline-flex min-h-5 items-center underline underline-offset-4 transition-colors duration-150 ease-out"
                  >
                    Week of {formatShort(week.monday)}
                  </Link>
                </h2>
                <EditionList editions={week.editions} />
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
