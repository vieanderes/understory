import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CompiledGlossaryWord } from '@/core/content/glossary-schema';
import { Crumbs } from '@/features/lecture/Crumbs';
import { Title } from '@/features/motion/Title';
import { rowAction, rowArrow, rowItem } from '@/components/ui/rows';
import { cn } from '@/lib/cn';
import { DeckButton } from './DeckButton';
import { LEVEL_LABEL } from './types';

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rule-t flex flex-col gap-2 pt-3">
      <h2 id={id} className="t-label">
        {title}
      </h2>
      {children}
    </section>
  );
}

const wordLink =
  'underline decoration-border-strong underline-offset-4 transition-colors duration-150 ease-out hover:decoration-fg';

/**
 * One word, read top to bottom: what it is in a sentence, the real explanation, a picture
 * from everyday life, code, how a colleague says it, the word it gets confused with, and
 * the lessons where the course teaches it.
 */
export function WordPage({
  word,
  areaTitle,
  names,
  previous,
  next,
}: {
  word: CompiledGlossaryWord;
  areaTitle: string;
  /** Terms by id, for the twin and related words. */
  names: ReadonlyMap<string, string>;
  previous?: { id: string; term: string };
  next?: { id: string; term: string };
}) {
  const twinName = word.twin ? names.get(word.twin) : undefined;
  return (
    <article className="flex flex-col gap-6" aria-labelledby="word-title">
      <Crumbs
        trail={[
          { href: '/vocabulary', label: 'Vocabulary' },
          { href: `/vocabulary?area=${word.area}`, label: areaTitle },
        ]}
      />
      <div className="grid grid-cols-4 gap-x-4 gap-y-4 md:grid-cols-12">
        <header className="col-span-4 flex min-w-0 flex-col gap-2 md:col-span-8">
          <p className="t-label">
            {areaTitle} · {LEVEL_LABEL[word.level]}
          </p>
          <Title id="word-title" className="break-words" translate="no">
            {word.term}
          </Title>
          {word.aka.length > 0 ? (
            <p className="text-muted text-sm">Also said: {word.aka.join(', ')}</p>
          ) : null}
          <p
            className="prose-measure rich-inline text-lg"
            dangerouslySetInnerHTML={{ __html: word.shortHtml }}
          />
        </header>
        <div className="col-span-4 md:col-span-4 md:justify-self-end md:pt-4">
          <DeckButton id={word.id} term={word.term} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-x-4 md:grid-cols-12">
        <div className="col-span-4 flex min-w-0 flex-col gap-6 md:col-span-8">
          <Part id="plain" title="In plain words">
            <div
              className="rich lecture-prose prose-measure"
              dangerouslySetInnerHTML={{ __html: word.explainHtml }}
            />
          </Part>

          <Part id="picture" title="Picture it">
            <p
              className="prose-measure rich-inline text-lg"
              dangerouslySetInnerHTML={{ __html: word.analogyHtml }}
            />
          </Part>

          {word.exampleHtml ? (
            <Part id="code" title="In code">
              <div
                className="code-view rich min-w-0"
                tabIndex={0}
                role="region"
                aria-label={`Example of ${word.term}`}
                dangerouslySetInnerHTML={{ __html: word.exampleHtml }}
              />
            </Part>
          ) : null}

          <Part id="wild" title="Heard in the wild">
            <blockquote className="border-border-strong prose-measure border-l pl-2">
              <p
                className="rich-inline text-lg"
                dangerouslySetInnerHTML={{ __html: `“${word.usageHtml}”` }}
              />
            </blockquote>
          </Part>

          {word.twin && twinName ? (
            <Part id="twin" title="Don’t confuse it with">
              <p className="text-lg font-medium">
                <Link href={`/vocabulary/${word.twin}`} className={wordLink}>
                  {twinName}
                </Link>
              </p>
              {word.twinDifferenceHtml ? (
                <p
                  className="prose-measure rich-inline"
                  dangerouslySetInnerHTML={{ __html: word.twinDifferenceHtml }}
                />
              ) : null}
            </Part>
          ) : null}

          <Part id="learnt" title="Where you learn it">
            {word.seenIn.length === 0 ? (
              <p className="text-muted">No lesson names it yet.</p>
            ) : (
              <ul className="flex flex-col">
                {word.seenIn.map((seen) => (
                  <li key={seen.lessonId} className={cn(rowItem, 'first:border-t-0')}>
                    <Link href={seen.href} className={rowAction('items-start')}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{seen.title}</span>
                        <span className="text-muted text-sm">
                          {seen.chapter}
                          {seen.spot ? ` · ${seen.spot}` : ''}
                        </span>
                      </span>
                      <ArrowRight
                        aria-hidden
                        size={16}
                        strokeWidth={2}
                        className={cn(rowArrow, 'mt-0.5')}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Part>
        </div>

        {word.related.length > 0 ? (
          <aside
            aria-labelledby="related"
            className="col-span-4 flex flex-col gap-2 pt-6 md:col-span-3 md:col-start-10 md:pt-0"
          >
            <h2 id="related" className="t-label">
              Related words
            </h2>
            <ul className="flex flex-wrap gap-0.5">
              {word.related.map((id) => (
                <li key={id}>
                  <Link
                    href={`/vocabulary/${id}`}
                    className="border-border hover:border-border-strong transition-press inline-flex h-5 items-center rounded-full border px-1.5 text-sm font-medium transition-colors duration-150 ease-out active:scale-98"
                  >
                    {names.get(id) ?? id}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>

      <nav aria-label="More words" className="rule-t flex justify-between gap-2 pt-3 text-sm">
        {previous ? (
          <Link
            href={`/vocabulary/${previous.id}`}
            className="hairline-row group flex items-center gap-1"
          >
            <ArrowLeft
              aria-hidden
              size={16}
              strokeWidth={2}
              className="text-faint group-hover:text-fg"
            />
            <span className="font-medium">{previous.term}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/vocabulary/${next.id}`}
            className="hairline-row group flex items-center gap-1"
          >
            <span className="font-medium">{next.term}</span>
            <ArrowRight
              aria-hidden
              size={16}
              strokeWidth={2}
              className="text-faint group-hover:text-fg"
            />
          </Link>
        ) : null}
      </nav>
    </article>
  );
}
