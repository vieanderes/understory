import Link from 'next/link';
import { cn } from '@/lib/cn';

interface SignalNavProps {
  current: 'day' | 'week' | 'month';
  dayHref: string;
  weekHref: string;
  monthHref: string;
}

/** Three lenses on the same feed. Underline tabs, because these are places, not settings. */
export function SignalNav({ current, dayHref, weekHref, monthHref }: SignalNavProps) {
  const tabs = [
    { key: 'day', label: 'Day', href: dayHref },
    { key: 'week', label: 'Week', href: weekHref },
    { key: 'month', label: 'Month', href: monthHref },
  ] as const;
  return (
    <nav aria-label="News period" className="flex gap-3">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? 'page' : undefined}
          className={cn(
            'flex h-5 items-center border-b-2 text-sm font-medium transition-colors duration-150 ease-out',
            tab.key === current
              ? 'border-fg text-fg'
              : 'text-muted hover:text-fg border-transparent',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
