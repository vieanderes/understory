import type { ReactNode } from 'react';
import type { CompiledCode, Rich } from '@/core/content/compiled';
import type { ShownCode } from '@/core/lecture';
import { cn } from '@/lib/cn';

/*
 * The small pieces every lecture is made of. Server components: a lecture is static
 * reading, so it ships no JavaScript beyond the download button.
 */

export type Level = 1 | 2 | 3 | 4 | 5;

/** A heading whose level follows the nesting: a lesson is h1 alone and h2 inside a chapter. */
export function Heading({
  level,
  id,
  className,
  children,
}: {
  level: Level;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const Tag = `h${level}` as const;
  return (
    <Tag id={id} className={className}>
      {children}
    </Tag>
  );
}

export const deeper = (level: Level): Level => Math.min(level + 1, 5) as Level;

/** Trusted HTML from the content compiler (raw HTML is disabled there). */
export function RichHtml({
  value,
  inline,
  className,
}: {
  value: Rich;
  inline?: boolean;
  className?: string;
}) {
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag
      className={cn(inline ? 'rich-inline' : 'rich', className)}
      dangerouslySetInnerHTML={{ __html: value.html }}
    />
  );
}

/** Marks lines by their number, the way the player marks a judged line. */
function markLines(html: string, lines: readonly number[]): string {
  return lines.reduce(
    (marked, line) =>
      marked.replace(`data-line="${line}"`, `data-line="${line}" data-verdict="wrong"`),
    html,
  );
}

export function Code({
  code,
  label,
  marked = [],
  className,
}: {
  code: ShownCode | CompiledCode;
  label: string;
  marked?: readonly number[];
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('code-view wrap lecture-code min-w-0', className)}
      dangerouslySetInnerHTML={{ __html: markLines(code.html, marked) }}
    />
  );
}

/** A solution: one file, or several with their names (a playground's HTML, CSS and JS). */
export function Solution({ files, label }: { files: readonly CompiledCode[]; label: string }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {files.map((file, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-1">
          {file.label ? <p className="t-label">{file.label}</p> : null}
          <Code code={file} label={file.label ? `${label}, ${file.label}` : label} />
        </div>
      ))}
    </div>
  );
}

/** A micro label over a block: what kind of reading this is. */
export function Kicker({ children }: { children: ReactNode }) {
  return <p className="t-label">{children}</p>;
}

/**
 * The sentences to know by heart. The one bordered surface in a lecture: everything else is
 * hairlines, so this is what the eye lands on when skimming, on screen and on paper.
 */
export function RememberBox({
  items,
  title = 'Remember',
  level,
  id,
}: {
  items: readonly Rich[];
  title?: string;
  level: Level;
  id?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section
      id={id}
      aria-label={title}
      className="lecture-remember bg-raised border-border rounded-panel shadow-edge flex flex-col gap-2 border p-3"
    >
      <Heading level={level} className="t-label text-fg">
        {title}
      </Heading>
      <ol className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="t-figure text-muted w-3 shrink-0 pt-0.5 text-sm">
              {String(i + 1).padStart(2, '0')}
            </span>
            <RichHtml value={item} className="min-w-0 font-medium" />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Minutes, spelt the way the rest of the app spells time. */
export function readingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min read`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h read` : `${hours} h ${rest} min read`;
}

/**
 * What people say a term is, and what it actually means. Interviews probe the difference,
 * so the loose version sits beside the precise one. Three columns from `md`; stacked, with
 * the column names inline, on a phone.
 */
export function TermsTable({
  terms,
  level,
  id,
  title = 'Terms, said precisely',
}: {
  terms: readonly { term: string; say: string; means: Rich }[];
  level: Level;
  id?: string;
  title?: string;
}) {
  if (terms.length === 0) return null;
  return (
    <section id={id} aria-label={title} className="flex flex-col gap-2">
      <Heading level={level} className="t-label text-fg">
        {title}
      </Heading>
      <div aria-hidden className="t-label hidden grid-cols-12 gap-x-4 md:grid">
        <span className="col-span-3">Term</span>
        <span className="col-span-4">What people say</span>
        <span className="col-span-5">What it actually means</span>
      </div>
      <dl className="border-border rounded-panel divide-border divide-y border">
        {terms.map((t) => (
          <div key={t.term} className="grid grid-cols-1 gap-x-4 gap-y-0.5 p-2 md:grid-cols-12">
            <dt className="font-semibold md:col-span-3">{t.term}</dt>
            <dd className="text-muted text-sm md:col-span-4">
              <span className="t-label md:hidden">People say: </span>
              {t.say}
            </dd>
            <dd className="text-sm md:col-span-5">
              <span className="t-label md:hidden">It means: </span>
              <RichHtml value={t.means} inline />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
