import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Ledger, PageHead } from '@/components/layout/PageHead';
import { buttonClass } from '@/components/ui/Button';
import type { NewsDay } from '@/lib/news';
import { getSignalContext } from './data';
import { formatDay, formatShort, isoWeekOf } from './format';
import { SignalItem } from './SignalItem';
import { SignalNav } from './SignalNav';
import { Title } from '@/features/motion/Title';

interface SignalDayViewProps {
  day: NewsDay;
  dates: string[];
}

export async function SignalDayView({ day, dates }: SignalDayViewProps) {
  const { topicLabels, lessons } = await getSignalContext();
  const position = dates.indexOf(day.date);
  // `dates` is newest first, so the previous day sits one step further along.
  const older = position >= 0 ? dates[position + 1] : undefined;
  const newer = position > 0 ? dates[position - 1] : undefined;
  const sourcesOk = day.stats.sources.filter((s) => s.ok).length;

  const [lead, ...rest] = day.items;
  const topicCounts = [
    ...Map.groupBy(
      day.items.flatMap((item) => item.topics),
      (t) => t,
    ),
  ]
    .map(([topic, list]) => ({
      topic,
      count: list.length,
      first: day.items.find((item) => item.topics.includes(topic))?.id,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHead
        label="News · Daily edition"
        title={<Title>{formatDay(day.date)}</Title>}
        lede={
          <>
            The top <span className="t-figure">{day.items.length}</span> of{' '}
            <span className="t-figure">{day.stats.fetched}</span> stories, each with why it matters
            and where Understory teaches it.
          </>
        }
        actions={
          <SignalNav
            current="day"
            dayHref={`/signal/${day.date}`}
            weekHref={`/signal/week/${isoWeekOf(day.date)}`}
            monthHref={`/signal/month/${day.date.slice(0, 7)}`}
          />
        }
        asideClassName="hidden md:flex"
        aside={
          <Ledger
            rows={[
              { label: 'Stories', value: day.items.length },
              { label: 'Read', value: day.stats.fetched },
              { label: 'Sources', value: sourcesOk },
            ]}
          />
        }
      />

      {lead ? (
        <div className="rule-t grid grid-cols-4 gap-x-4 gap-y-4 pt-2 md:grid-cols-12 md:gap-y-6 md:pt-4">
          <div className="col-span-4 min-w-0 md:col-span-8">
            <SignalItem
              item={lead}
              index={1}
              topicLabels={topicLabels}
              lessons={lessons}
              variant="lead"
            />
          </div>
          <aside
            aria-labelledby="edition-topics"
            data-arrive="rise"
            className="md:border-border col-span-4 flex min-w-0 flex-col gap-1 md:col-span-4 md:border-l md:pl-4"
          >
            <h2 id="edition-topics" className="t-label">
              In this edition
            </h2>
            <ul className="flex flex-wrap gap-x-3 md:flex-col md:gap-0">
              {topicCounts.map((t) => (
                <li key={t.topic} className="md:border-border md:border-t">
                  <a
                    href={`#story-${t.first}`}
                    className="hover:text-accent flex min-h-5 items-baseline justify-between gap-1 py-0.5 text-sm transition-colors duration-150 ease-out md:gap-2"
                  >
                    <span className="min-w-0">{topicLabels.get(t.topic) ?? t.topic}</span>
                    <span className="t-figure text-muted">{t.count}</span>
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      ) : null}

      {rest.length > 0 ? (
        <section aria-labelledby="more-stories" className="flex flex-col gap-3">
          <h2 id="more-stories" className="t-label">
            Also today
          </h2>
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((item, i) => (
              <SignalItem
                key={item.id}
                item={item}
                index={i + 2}
                topicLabels={topicLabels}
                lessons={lessons}
              />
            ))}
          </div>
        </section>
      ) : null}

      <nav
        aria-label="Other days"
        className="rule-t flex justify-between gap-2 pt-2 text-sm font-medium"
      >
        {older ? (
          <Link href={`/signal/${older}`} className={buttonClass('secondary', 'md')}>
            <ArrowLeft aria-hidden size={16} strokeWidth={2} />
            Earlier · {formatShort(older)}
          </Link>
        ) : (
          <span />
        )}
        {newer ? (
          <Link href={`/signal/${newer}`} className={buttonClass('secondary', 'md')}>
            Later · {formatShort(newer)}
            <ArrowRight aria-hidden size={16} strokeWidth={2} />
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
