import { describe, expect, it } from 'vitest';
import {
  cutText,
  libraryEntries,
  librarySlice,
  libraryText,
  parseReadingBlock,
  type LibraryEntry,
} from '@/core/scout';

/* The Librarian: the course's own references only (docs/SCOUT-ROLES.md, section 5). */

const ref = (title: string, extra: Partial<LibraryEntry> = {}) => ({
  kind: 'docs' as const,
  title,
  verified: true,
  ...extra,
});

const ENTRIES = libraryEntries([
  {
    id: 'web.http',
    moduleId: 'web',
    references: [
      ref('MDN: HTTP overview', { url: 'https://developer.mozilla.org/x', note: 'Start here.' }),
      ref('RFC 9110', { kind: 'rfc', primary: true, year: 2022, authors: 'Fielding et al.' }),
    ],
  },
  {
    id: 'web.rest',
    moduleId: 'web',
    references: [ref('A blog on REST', { kind: 'essay', verified: false })],
  },
  { id: 'db.select', moduleId: 'db', references: [ref('SQLite docs', { primary: true })] },
]);

describe('the library', () => {
  it('gives every reference a stable id from its lesson and place', () => {
    expect(ENTRIES.map((e) => e.id)).toEqual([
      'web.http#r1',
      'web.http#r2',
      'web.rest#r1',
      'db.select#r1',
    ]);
    expect(ENTRIES[1]).toMatchObject({ lessonId: 'web.http', moduleId: 'web', primary: true });
    expect(ENTRIES[0]?.primary).toBe(false);
  });

  it('slices the lesson’s references first, then its chapter’s, primary and checked first', () => {
    const slice = librarySlice(ENTRIES, { lessonId: 'web.rest', moduleIds: ['web'] });
    expect(slice.map((e) => e.id)).toEqual(['web.rest#r1', 'web.http#r2', 'web.http#r1']);
  });

  it('takes the chapters given, and keeps to the limit', () => {
    expect(librarySlice(ENTRIES, { moduleIds: ['db', 'web'] }, 2).map((e) => e.id)).toEqual([
      'db.select#r1',
      'web.http#r2',
    ]);
  });

  it('writes each reference on a line with its id, and marks the unchecked', () => {
    const text = libraryText(librarySlice(ENTRIES, { lessonId: 'web.rest', moduleIds: ['web'] }));
    expect(text).toContain('[web.http#r2] rfc · RFC 9110 · Fielding et al., 2022 · primary');
    expect(text).toContain('[web.http#r1] docs · MDN: HTTP overview · Start here.');
    expect(text).toContain('[web.rest#r1] essay · A blog on REST · not yet checked by a person');
  });
});

describe('a reading list', () => {
  const json = (value: unknown) => JSON.stringify(value);

  it('reads one to three items, each an id and why', () => {
    const block = parseReadingBlock(json({ items: [{ id: 'web.http#r2', why: 'The source.' }] }));
    expect(block?.items[0]?.id).toBe('web.http#r2');
  });

  it('refuses none, more than three, and broken JSON', () => {
    const item = { id: 'web.http#r1', why: 'Why.' };
    expect(parseReadingBlock(json({ items: [] }))).toBeNull();
    expect(parseReadingBlock(json({ items: [item, item, item, item] }))).toBeNull();
    expect(parseReadingBlock('{')).toBeNull();
  });
});

describe('the path’s cutlist for the Librarian', () => {
  it('lists each cut with whether it is for later', () => {
    expect(
      cutText([
        { what: 'GraphQL', why: 'REST first.', later: true },
        { what: 'Kubernetes', why: 'One service.', later: false },
      ]),
    ).toBe(
      'Their path leaves out on purpose:\n- GraphQL (for now): REST first.\n- Kubernetes (not needed): One service.',
    );
    expect(cutText([])).toBe('');
  });
});
