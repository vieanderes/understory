import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LibraryEntry } from '@/core/scout';
import { ReadingBlock } from '@/features/tutor/ReadingBlock';

const entry = (id: string, extra: Partial<LibraryEntry> = {}): LibraryEntry => ({
  id,
  kind: 'docs',
  title: `Title ${id}`,
  verified: true,
  primary: false,
  lessonId: 'web.http',
  moduleId: 'web',
  ...extra,
});

const LIBRARY = new Map([
  ['web.http#r1', entry('web.http#r1', { url: 'https://example.org/http', year: 2022 })],
  ['web.http#r2', entry('web.http#r2', { verified: false })],
]);

describe('ReadingBlock', () => {
  it('shows only references the course carries, linked, with why and their check', () => {
    render(
      <ReadingBlock
        library={LIBRARY}
        body={JSON.stringify({
          items: [
            { id: 'web.http#r1', why: 'The overview.' },
            { id: 'made.up#r9', why: 'Invented.' },
            { id: 'web.http#r2', why: 'Deeper.' },
          ],
        })}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'Worth reading' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole('link', { name: /Title web.http#r1/ })).toHaveAttribute(
      'href',
      'https://example.org/http',
    );
    expect(items[0]).toHaveTextContent('docs · 2022');
    expect(items[1]).toHaveTextContent('Not yet checked by a person.');
    expect(screen.queryByText('Invented.')).not.toBeInTheDocument();
  });

  it('draws nothing when no id is in the library', () => {
    const { container } = render(
      <ReadingBlock
        library={LIBRARY}
        body={JSON.stringify({ items: [{ id: 'x#r1', why: 'No.' }] })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
