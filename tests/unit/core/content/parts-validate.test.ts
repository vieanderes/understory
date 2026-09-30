import { describe, expect, it } from 'vitest';
import type { Issue, RawCatalog } from '@/core/content/catalog';
import { OUTLINE_PATH, outlineSchema, type Outline } from '@/core/content/outline';
import type { Part } from '@/core/content/schema';
import { validateOutline } from '@/core/content/validate';
import { validCatalog } from './fixtures';

const lesson = (id: string, n: number, wovenAfter?: string) => ({
  id,
  dir: `${String(n).padStart(2, '0')}-${id.split('.')[1] ?? 'x'}`,
  title: id,
  objective: 'Do the thing.',
  level: 'essential' as const,
  concepts: ['js.coercion', 'js.equality'],
  ...(wovenAfter ? { wovenAfter } : {}),
});

/** js and ts are taught; cs is woven after a js lesson. */
function outline(): Outline {
  return outlineSchema.parse({
    modules: [
      { id: 'js', dir: '03-javascript', lessons: [lesson('js.coercion', 1)] },
      { id: 'ts', dir: '04-typescript', lessons: [lesson('ts.types', 1)] },
      { id: 'cs', dir: '17-cs', lessons: [lesson('cs.memory', 1, 'js.coercion')] },
    ],
  });
}

const part = (id: string, modules: string[]): Part => ({
  id,
  title: id,
  summary: 'You can do it.',
  modules,
  capstone: { title: 'A thing', brief: 'Build a thing.' },
});

/** A catalog whose course carries the given parts. Only `js` has a module.yaml. */
function catalogWith(parts: Part[] | undefined): RawCatalog {
  const catalog = validCatalog();
  const course = catalog.course;
  if (!course) throw new Error('fixture');
  return { ...catalog, course: { ...course, data: { ...course.data, ...(parts ? { parts } : {}) } } };
}

/** Only the part rules: the fixture outline plans modules the fixture catalog lacks. */
function partIssues(parts: Part[] | undefined, withOutline = true): Issue[] {
  return validateOutline({
    catalog: catalogWith(parts),
    ...(withOutline ? { outline: { path: OUTLINE_PATH, data: outline() } } : {}),
  }).filter((issue) => issue.rule.startsWith('part-'));
}

const rules = (issues: Issue[]) => issues.map((issue) => issue.rule);

describe('part rules', () => {
  it('accept parts that cover every taught module once, in order', () => {
    expect(partIssues([part('first', ['js']), part('second', ['ts'])])).toEqual([]);
  });

  it('check nothing when the course has no parts', () => {
    expect(partIssues(undefined)).toEqual([]);
  });

  it('report a part id used twice', () => {
    const issues = partIssues([part('first', ['js']), part('first', ['ts'])]);
    expect(rules(issues)).toEqual(['part-duplicate-id']);
    expect(issues[0]).toMatchObject({ path: 'content/course/course.yaml', severity: 'error' });
  });

  it('report a part id that is also a module id', () => {
    const issues = partIssues([part('js', ['js']), part('second', ['ts'])]);
    expect(rules(issues)).toEqual(['part-id-clash']);
    expect(issues[0]?.where).toBe('js');
  });

  it('report a module that does not exist', () => {
    const issues = partIssues([part('first', ['js', 'go']), part('second', ['ts'])]);
    expect(rules(issues)).toEqual(['part-module-unknown']);
    expect(issues[0]?.message).toContain('"go"');
  });

  it('report a module listed in two parts', () => {
    const issues = partIssues([part('first', ['js', 'ts']), part('second', ['ts'])]);
    expect(rules(issues)).toEqual(['part-module-repeated']);
  });

  it('report a woven module listed in a part', () => {
    const issues = partIssues([part('first', ['js', 'cs']), part('second', ['ts'])]);
    expect(rules(issues)).toEqual(['part-module-woven']);
  });

  it('report a taught module that is in no part', () => {
    const issues = partIssues([part('first', ['js'])]);
    expect(rules(issues)).toEqual(['part-module-missing']);
    expect(issues[0]?.where).toBe('ts');
  });

  it('report modules out of course order', () => {
    const issues = partIssues([part('first', ['ts']), part('second', ['js'])]);
    expect(rules(issues)).toEqual(['part-module-order']);
  });

  it('check only what the catalog can show when there is no outline', () => {
    // Without a plan, neither woven modules nor a missing module can be known.
    expect(partIssues([part('first', ['js'])], false)).toEqual([]);
    expect(rules(partIssues([part('first', ['ts'])], false))).toEqual(['part-module-unknown']);
    expect(rules(partIssues([part('js', ['js'])], false))).toEqual(['part-id-clash']);
  });
});
