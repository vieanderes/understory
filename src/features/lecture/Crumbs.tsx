import Link from 'next/link';

/** Where this lecture sits: Lectures, then its part, then its chapter. */
export function Crumbs({ trail }: { trail: readonly { href: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="lecture-screen-only">
      <ol className="t-label flex flex-wrap gap-x-1 gap-y-0.5">
        {trail.map((crumb, i) => (
          <li key={crumb.href} className="flex gap-1">
            {i > 0 ? <span aria-hidden>/</span> : null}
            <Link
              href={crumb.href}
              className="hover:text-fg underline-offset-4 transition-colors duration-150 ease-out hover:underline"
            >
              {crumb.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
