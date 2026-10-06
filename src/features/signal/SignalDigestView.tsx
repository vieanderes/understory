import Link from 'next/link';
import { neighbours, weekRange } from '@/core/news';
import { PageHead } from '@/components/layout/PageHead';
import type { NewsDigest } from '@/lib/news';
import { Title } from '@/features/motion/Title';
import { getStoryContext } from './data';
import { formatMonth, formatShort, formatWeekday } from './format';
import { PeriodLinks, type PeriodLink } from './PeriodLinks';
import { StoryList } from './StoryList';

interface SignalDigestViewProps {
  digest: NewsDigest;
  /** Every week or month key that has news, newest first, for earlier and later. */
  periods: string[];
}

const periodLabel = (isWeek: boolean, key: string) =>
  isWeek ? `Week of ${formatShort(weekRange(key)?.from ?? key)}` : formatMonth(key);

export async function SignalDigestView({ digest, periods }: SignalDigestViewProps) {
  const { topicLabels, lessons } = await getStoryContext(digest.topItems);
  const isWeek = digest.period === 'week';
  const base = isWeek ? '/signal/week' : '/signal/month';
  const title = isWeek
    ? `${formatShort(digest.from)} to ${formatShort(digest.to)}`
    : formatMonth(digest.key);
  const { earlier, later } = neighbours(periods, digest.key);
  const max = Math.max(1, ...digest.topicCounts.map((t) => t.count));

  const links: PeriodLink[] = [
    ...(earlier
      ? [
          {
            href: `${base}/${earlier}`,
            label: periodLabel(isWeek, earlier),
            arrow: 'left' as const,
          },
        ]
      : []),
    ...(later
      ? [{ href: `${base}/${later}`, label: periodLabel(isWeek, later), arrow: 'right' as const }]
      : []),
    { href: '/signal/archive', label: 'All editions' },
  ];

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHead
        label={isWeek ? 'News · The week' : 'News · The month'}
        title={<Title>{title}</Title>}
        actions={<PeriodLinks label={isWeek ? 'Other weeks' : 'Other months'} links={links} />}
      />

      <div className="grid grid-cols-4 gap-x-4 gap-y-6 md:grid-cols-12">
        <section
          aria-labelledby="top-stories"
          className="col-span-4 flex min-w-0 flex-col gap-1 md:col-span-12 lg:col-span-8"
        >
          <h2 id="top-stories" className="t-label">
            {isWeek ? 'Top stories of the week' : 'Top stories of the month'}
          </h2>
          <StoryList items={digest.topItems} topicLabels={topicLabels} lessons={lessons} />
        </section>

        <aside className="col-span-4 flex min-w-0 flex-col gap-6 md:col-span-8 lg:col-span-4 xl:col-span-3 xl:col-start-10">
          <section aria-labelledby="topics-title" className="flex flex-col gap-1">
            <h2 id="topics-title" className="t-label rule-t pt-3">
              Topics
            </h2>
            <ul className="flex flex-col gap-1">
              {digest.topicCounts.map((t) => (
                <li key={t.topic} className="grid grid-cols-12 items-center gap-1 text-sm">
                  <span className="col-span-7 truncate">{topicLabels[t.topic] ?? t.topic}</span>
                  {/* A bar is one mark per value, flat, in ink. Its length is the count. */}
                  <span className="col-span-4" aria-hidden>
                    <span
                      className="bg-fg block h-0.5 rounded-full"
                      style={{ width: `${Math.round((t.count / max) * 100)}%` }}
                    />
                  </span>
                  <span className="t-figure col-span-1 text-right">{t.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <nav aria-labelledby="days-title" className="flex flex-col gap-1">
            <h2 id="days-title" className="t-label rule-t pt-3">
              Daily editions
            </h2>
            <ul className="flex flex-wrap gap-x-3">
              {digest.days.map((date) => (
                <li key={date}>
                  <Link
                    href={`/signal/${date}`}
                    className="hover:text-muted decoration-border-strong flex h-5 items-center text-sm font-medium underline underline-offset-4 transition-colors duration-150 ease-out"
                  >
                    {formatWeekday(date)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
