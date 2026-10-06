import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { neighbours, weekRange } from '@/core/news';
import { PageHead } from '@/components/layout/PageHead';
import { buttonClass } from '@/components/ui/Button';
import type { EditionSummary, NewsDay } from '@/lib/news';
import { getSourceGroups } from '@/lib/news/sources';
import { Title } from '@/features/motion/Title';
import { getStoryContext } from './data';
import { EditionList } from './EditionList';
import { EditionNav } from './EditionNav';
import { formatDay, formatMonth, formatShort, isoWeekOf } from './format';
import { HowNewsWorks } from './HowNewsWorks';
import { MarkEditionRead } from './MarkEditionRead';
import { PeriodLinks } from './PeriodLinks';
import { StoryList } from './StoryList';

interface SignalDayViewProps {
  day: NewsDay;
  /** Every edition, newest first. */
  editions: EditionSummary[];
}

/** How many earlier editions the side column offers before "All editions". */
const EARLIER_SHOWN = 7;

export async function SignalDayView({ day, editions }: SignalDayViewProps) {
  const [{ topicLabels, lessons }, groups] = await Promise.all([
    getStoryContext(day.items),
    getSourceGroups(),
  ]);
  const dates = editions.map((edition) => edition.date);
  const { earlier, later } = neighbours(dates, day.date);
  const at = dates.indexOf(day.date);
  const before = editions.slice(at + 1, at + 1 + EARLIER_SHOWN);
  const week = isoWeekOf(day.date);
  const month = day.date.slice(0, 7);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <MarkEditionRead date={day.date} />
      <PageHead
        label="News"
        title={
          <HowNewsWorks groups={groups}>
            <Title>{formatDay(day.date)}</Title>
          </HowNewsWorks>
        }
        actions={
          <EditionNav dates={dates} current={day.date}>
            <PeriodLinks
              links={[
                {
                  href: `/signal/week/${week}`,
                  label: `Week of ${formatShort(weekRange(week)?.from ?? day.date)}`,
                },
                { href: `/signal/month/${month}`, label: formatMonth(month) },
                { href: '/signal/archive', label: 'All editions' },
              ]}
            />
          </EditionNav>
        }
      />

      <div className="grid grid-cols-4 gap-x-4 gap-y-6 md:grid-cols-12">
        <div className="col-span-4 min-w-0 md:col-span-12 lg:col-span-8">
          {day.items.length > 0 ? (
            <StoryList items={day.items} topicLabels={topicLabels} lessons={lessons} />
          ) : (
            <p className="rule-t text-muted pt-3">No stories made this edition.</p>
          )}
        </div>

        {before.length > 0 ? (
          <aside
            aria-labelledby="earlier-editions"
            className="col-span-4 flex min-w-0 flex-col gap-1 md:col-span-8 lg:col-span-4 xl:col-span-3 xl:col-start-10"
          >
            <h2 id="earlier-editions" className="t-label rule-t pt-3">
              Earlier editions
            </h2>
            <EditionList editions={before} />
            <Link
              href="/signal/archive"
              className="text-muted hover:text-fg inline-flex h-5 items-center gap-0.5 self-start text-sm font-medium underline underline-offset-4 transition-colors duration-150 ease-out"
            >
              All editions
            </Link>
          </aside>
        ) : null}
      </div>

      <nav aria-label="Other days" className="rule-t flex justify-between gap-2 pt-3">
        {earlier ? (
          <Link href={`/signal/${earlier}`} className={buttonClass('secondary', 'md')}>
            <ArrowLeft aria-hidden size={16} strokeWidth={2} />
            Earlier · {formatShort(earlier)}
          </Link>
        ) : (
          <span />
        )}
        {later ? (
          <Link href={`/signal/${later}`} className={buttonClass('secondary', 'md')}>
            Later · {formatShort(later)}
            <ArrowRight aria-hidden size={16} strokeWidth={2} />
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
