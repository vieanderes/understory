import { Check, Minus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { buttonClass } from '@/components/ui/Button';
import { Title } from '@/features/motion/Title';

/**
 * The page the service worker gives back when the network is gone and the page asked for
 * has never been on this device. It is static and carries no data of its own, so it keeps
 * working from the cache for as long as the worker does.
 */
export const metadata: Metadata = {
  title: 'Offline',
  description: 'What Understory does with no connection.',
  robots: { index: false, follow: false },
};

const WORKS: readonly { href: string | null; what: string; how: string }[] = [
  {
    href: '/learn',
    what: 'Lessons on this device',
    how: 'Any lesson you have opened, and every lesson once you download the course.',
  },
  {
    href: '/practise',
    what: 'The practice queue',
    how: 'What is due is worked out here, from your own log. Sessions are recorded.',
  },
  {
    href: '/map',
    what: 'The map',
    how: 'Mastery, XP and the weekly run are derived on this device.',
  },
  {
    href: '/settings',
    what: 'Settings',
    how: 'Download the course, export your progress, ask the browser to keep it.',
  },
  {
    href: null,
    what: 'The code runner',
    how: 'Code challenges run in the browser. They never needed a server.',
  },
];

const WAITS: readonly { what: string; how: string }[] = [
  {
    what: 'News',
    how: 'A new edition is fetched from the network. The last one you read is still here.',
  },
  {
    what: 'Lessons you have not opened',
    how: 'Download the course in Settings and they come with you.',
  },
];

export default function OfflinePage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6 py-4">
        <header className="flex flex-col gap-2">
          <p className="t-label">Offline</p>
          <Title>This page is not on this device.</Title>
          <p className="text-muted prose-measure">
            Understory keeps what you have used, so most of it carries on with no connection. Your
            progress is written here and syncs nowhere. Nothing is lost while you wait.
          </p>
        </header>

        <section aria-labelledby="works" className="flex flex-col gap-2">
          <h2 id="works" className="t-section">
            Works now
          </h2>
          <ul className="flex flex-col">
            {WORKS.map((item) => (
              <li key={item.what} className="rule-t flex items-start gap-1 py-2">
                <Check
                  aria-hidden
                  size={16}
                  strokeWidth={2}
                  className="text-muted mt-0.5 shrink-0"
                />
                <p className="prose-measure text-sm">
                  {item.href ? (
                    <Link href={item.href} className="rounded-control font-medium underline">
                      {item.what}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.what}</span>
                  )}{' '}
                  <span className="text-muted">{item.how}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="waits" className="flex flex-col gap-2">
          <h2 id="waits" className="t-section">
            Waits for a connection
          </h2>
          <ul className="flex flex-col">
            {WAITS.map((item) => (
              <li key={item.what} className="rule-t flex items-start gap-1 py-2">
                <Minus
                  aria-hidden
                  size={16}
                  strokeWidth={2}
                  className="text-muted mt-0.5 shrink-0"
                />
                <p className="prose-measure text-sm">
                  <span className="font-medium">{item.what}</span>{' '}
                  <span className="text-muted">{item.how}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap items-center gap-1">
          <Link href="/" className={buttonClass('primary')}>
            Go home
          </Link>
          <Link href="/settings" className={buttonClass('secondary')}>
            Download the course
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
