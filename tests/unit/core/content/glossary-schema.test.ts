import { describe, expect, it } from 'vitest';
import {
  checkGlossary,
  glossaryEntrySchema,
  type GlossaryEntry,
  type RawGlossaryEntry,
} from '@/core/content/glossary-schema';

const entry = (over: Partial<GlossaryEntry> = {}): GlossaryEntry => ({
  term: 'closure',
  short: 'A function that keeps the variables from where it was made.',
  explain: 'When a function is made inside another, it keeps access to its variables.',
  analogy: 'A backpack the function carries everywhere.',
  usage: 'The handler holds a closure over the old count.',
  level: 1,
  ...over,
});

const raw = (id: string, area: string, data: Partial<GlossaryEntry> = {}): RawGlossaryEntry => ({
  id,
  area,
  path: `content/glossary/${area}/${id}.yaml`,
  data: entry(data),
});

const world = { lessonIds: new Set(['js.closures', 'js.scope']) };
/** Only the rule under test: a lesson nobody pins is a separate rule. */
const rules = (entries: RawGlossaryEntry[]) =>
  checkGlossary(entries, world)
    .map((i) => i.rule)
    .filter((rule) => rule !== 'glossary-lesson-unpinned');

describe('glossaryEntrySchema', () => {
  it('accepts a minimal entry and rejects unknown keys', () => {
    expect(glossaryEntrySchema.safeParse(entry()).success).toBe(true);
    expect(glossaryEntrySchema.safeParse({ ...entry(), colour: 'blue' }).success).toBe(false);
  });

  it('takes an example, a twin, related words and pinned lessons', () => {
    const full = entry({
      aka: ['closures'],
      example: { language: 'js', code: 'const add = (a) => (b) => a + b;' },
      twin: { term: 'scope', difference: 'Scope is where a name is visible.' },
      related: ['scope'],
      lessons: ['js.closures'],
    });
    expect(glossaryEntrySchema.safeParse(full).success).toBe(true);
  });

  it('keeps the level to 1, 2 or 3', () => {
    expect(glossaryEntrySchema.safeParse({ ...entry(), level: 4 }).success).toBe(false);
  });
});

describe('checkGlossary', () => {
  it('passes a clean pair of entries', () => {
    const issues = checkGlossary(
      [
        raw('closure', 'javascript', {
          twin: { term: 'scope', difference: 'Scope is where a name is visible.' },
          related: ['scope'],
          lessons: ['js.closures'],
        }),
        raw('scope', 'javascript', {
          term: 'scope',
          usage: 'That name is out of scope here.',
          lessons: ['js.scope'],
        }),
      ],
      world,
    );
    expect(issues).toEqual([]);
  });

  it('rejects an id that is not a slug and an unknown area', () => {
    expect(rules([raw('Closure', 'javascript')])).toContain('glossary-id');
    expect(rules([raw('closure', 'astrology')])).toContain('glossary-area-unknown');
  });

  it('finds the same word twice, through a term or an alias, whatever the case', () => {
    const issues = checkGlossary(
      [
        raw('closure', 'javascript'),
        raw('closures', 'javascript', { term: 'Closure', usage: 'A closure again.' }),
        raw('lexical', 'javascript', {
          term: 'lexical closure',
          aka: ['CLOSURE'],
          usage: 'A lexical closure, again.',
        }),
      ],
      world,
    );
    expect(issues.filter((i) => i.rule === 'glossary-duplicate')).toHaveLength(2);
  });

  it('needs every lesson to be pinned by at least one word, so a new lesson brings its words', () => {
    const issues = checkGlossary([raw('closure', 'javascript', { lessons: ['js.closures'] })], world);
    expect(issues.filter((i) => i.rule === 'glossary-lesson-unpinned')).toEqual([
      expect.objectContaining({ path: 'content/glossary', where: 'js.scope' }),
    ]);
  });

  it('asks nothing of a tree with no vocabulary yet', () => {
    expect(checkGlossary([], world)).toEqual([]);
  });

  it('finds one id in two areas', () => {
    const found = rules([raw('cdn', 'web'), raw('cdn', 'system-design', { term: 'edge network', usage: 'An edge network.' })]);
    expect(found).toContain('glossary-id-duplicate');
  });

  it('names related words, twins and lessons that do not exist', () => {
    const found = rules([
      raw('closure', 'javascript', {
        related: ['hoisting', 'closure'],
        twin: { term: 'closure', difference: 'Itself.' },
        lessons: ['js.nowhere'],
      }),
    ]);
    expect(found).toEqual(
      expect.arrayContaining([
        'glossary-related-unknown',
        'glossary-related-self',
        'glossary-twin-self',
        'glossary-lesson-unknown',
      ]),
    );
    expect(rules([raw('closure', 'javascript', { twin: { term: 'x', difference: 'y' } })])).toContain(
      'glossary-twin-unknown',
    );
  });

  it('needs the usage sentence to say the word, so the gap drill has a gap', () => {
    expect(rules([raw('closure', 'javascript', { usage: 'Nothing to see here.' })])).toContain(
      'glossary-usage-term',
    );
    // An alias, a plural or another case counts.
    expect(
      rules([raw('closure', 'javascript', { aka: ['lexical closure'], usage: 'Two Closures.' })]),
    ).not.toContain('glossary-usage-term');
  });

  it('keeps the short meaning to one plain sentence that does not give the word away', () => {
    expect(
      rules([raw('closure', 'javascript', { short: 'One sentence. And another one.' })]),
    ).toContain('glossary-short-sentence');
    expect(
      rules([
        raw('closure', 'javascript', {
          short:
            'A function that keeps the variables from the place where it was made, even after that outer function has long finished running and returned.',
        }),
      ]),
    ).toContain('glossary-short-long');
    expect(
      rules([raw('closure', 'javascript', { short: 'A closure keeps its variables.' })]),
    ).toContain('glossary-short-names-term');
  });

  it('holds the voice: no banned words, no em-dash, generic examples, short code', () => {
    expect(
      rules([raw('closure', 'javascript', { explain: 'It is simply a function.' })]),
    ).toContain('glossary-banned-word');
    expect(
      rules([
        raw('closure', 'javascript', { analogy: `A backpack ${String.fromCharCode(0x2014)} yes.` }),
      ]),
    ).toContain('glossary-em-dash');
    const long = Array.from({ length: 16 }, (_, i) => `line${i}();`).join('\n');
    expect(
      rules([raw('closure', 'javascript', { example: { language: 'js', code: long } })]),
    ).toContain('glossary-example-long');
  });
});
