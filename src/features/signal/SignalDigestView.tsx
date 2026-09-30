import Link from 'next/link';
import type { NewsDigest } from '@/lib/news';
import { getSignalContext } from './data';
import { formatMonth, formatShort, isoWeekOf } from './format';
import { SignalItem } from './SignalItem';
import { SignalNav } from './SignalNav';
import { Title } from '@/features/motion/Title';

export async function SignalDigestView({ digest }: { digest: NewsDigest }) {
  const { topicLabels, lessons } = await getSignalContext();
  const isWeek = digest.period === 'week';
  const title = isWeek
    ? `${formatShort(digest.from)} to ${formatShort(digest.to)}`
    : formatMonth(digest.key);
  const lastDay = digest.days.at(-1) ?? digest.to;
  const max = Math.max(1, ...digest.topicCounts.map((t) => t.count));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <p className="t-label">News · {isWeek ? `Week ${digest.key.slice(-2)}` : 'Month'}</p>
        <Title>{title}</Title>
        <p className="text-muted prose-measure">
          <span className="t-figure">{digest.itemCount}</span> stories over{' '}
          <span className="t-figure">{digest.days.length}</span>{' '}
          {digest.days.length === 1 ? 'day' : 'days'}. The top stories are below.
        </p>
        <SignalNav
          current={isWeek ? 'week' : 'month'}
          dayHref={`/signal/${lastDay}`}
          weekHref={`/signal/week/${isoWeekOf(lastDay)}`}
          monthHref={`/signal/month/${lastDay.slice(0, 7)}`}
        />
      </header>

      <section
        data-arrive="rise"
        aria-labelledby="topics-title"
        className="grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12"
      >
        <div className="col-span-4 md:col-span-7">
          <h2 id="topics-title" className="t-label rule-t pt-2">
            {isWeek ? 'Topics this week' : 'Topics this month'}
          </h2>
          <ul className="flex flex-col gap-1 pt-2">
            {digest.topicCounts.map((t) => (
              <li key={t.topic} className="grid grid-cols-12 items-center gap-2 text-sm">
                <span className="col-span-6 truncate md:col-span-5">
                  {topicLabels.get(t.topic) ?? t.topic}
                </span>
                {/* A bar is one mark per value, flat, in ink. Its length is the count. */}
                <span className="col-span-5 md:col-span-6" aria-hidden>
                  <span
                    className="bg-fg block h-0.5 rounded-full"
                    style={{ width: `${Math.round((t.count / max) * 100)}%` }}
                  />
                </span>
                <span className="t-figure col-span-1 text-right">{t.count}</span>
              </li>
            ))}
          </ul>
        </div>
        {digest.threads.length > 0 ? (
          <div className="col-span-4 md:col-span-5">
            <h2 className="t-label rule-t pt-2">Topics that kept coming up</h2>
            <ul className="flex flex-col gap-1 pt-2 text-sm">
              {digest.threads.map((thread) => (
                <li key={thread.topic} className="flex justify-between gap-2">
                  <span>{topicLabels.get(thread.topic) ?? thread.topic}</span>
                  <span className="t-figure text-muted">{thread.days} days</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-6">
        {digest.topItems.map((item, i) => (
          <SignalItem
            key={item.id}
            item={item}
            index={i + 1}
            topicLabels={topicLabels}
            lessons={lessons}
          />
        ))}
      </div>

      <nav
        aria-label="Days in this period"
        className="rule-t flex flex-wrap gap-x-3 pt-2 text-sm font-medium"
      >
        {digest.days.map((date) => (
          <Link
            key={date}
            href={`/signal/${date}`}
            className="flex h-5 items-center underline underline-offset-4"
          >
            {formatShort(date)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
