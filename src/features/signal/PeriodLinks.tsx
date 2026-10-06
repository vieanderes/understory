import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export interface PeriodLink {
  href: string;
  label: string;
  /** Earlier and later periods carry an arrow on the side they lead to. */
  arrow?: 'left' | 'right';
}

/**
 * Where else to read: the week, the month, the archive, or the period either side. Plain
 * links in one quiet row, because they are places to go, not a setting to switch.
 */
export function PeriodLinks({
  links,
  label = 'More news',
}: {
  links: PeriodLink[];
  label?: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap items-center gap-x-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-muted hover:text-fg decoration-border-strong inline-flex h-5 items-center gap-0.5 text-sm font-medium underline underline-offset-4 transition-colors duration-150 ease-out"
            >
              {link.arrow === 'left' ? <ArrowLeft aria-hidden size={16} strokeWidth={2} /> : null}
              {link.label}
              {link.arrow === 'right' ? <ArrowRight aria-hidden size={16} strokeWidth={2} /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
