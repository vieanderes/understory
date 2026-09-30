import { describe, expect, it } from 'vitest';
import { outlineSchema, type Outline } from '@/core/content/outline';
import { hostModuleOf, partJourney, partOfLessons, wovenModuleIds } from '@/core/content/parts';
import type { Part } from '@/core/content/schema';

const lesson = (id: string, n: number, wovenAfter?: string) => ({
  id,
  dir: `${String(n).padStart(2, '0')}-${id.split('.')[1] ?? 'x'}`,
  title: id,
  objective: 'Do the thing.',
  level: 'essential' as const,
  concepts: [`${id}-a`, `${id}-b`],
  ...(wovenAfter ? { wovenAfter } : {}),
});

/** js and ts carry parts; cs is woven after js and ts lessons, and pro after a cs lesson. */
function outline(): Outline {
  return outlineSchema.parse({
    modules: [
      { id: 'js', dir: '01-js', lessons: [lesson('js.one', 1), lesson('js.two', 2)] },
      { id: 'ts', dir: '02-ts', lessons: [lesson('ts.one', 1)] },
      {
        id: 'cs',
        dir: '03-cs',
        lessons: [lesson('cs.one', 1, 'js.one'), lesson('cs.two', 2, 'ts.one')],
      },
      { id: 'pro', dir: '04-pro', lessons: [lesson('pro.one', 1, 'cs.one')] },
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

const parts = [part('first', ['js']), part('second', ['ts'])];

describe('wovenModuleIds', () => {
  it('names the modules whose every lesson is woven after another', () => {
    expect([...wovenModuleIds(outline())]).toEqual(['cs', 'pro']);
  });

  it('does not count a module with only some woven lessons', () => {
    const data = outline();
    data.modules[2]?.lessons.push(lesson('cs.three', 3));
    expect([...wovenModuleIds(data)]).toEqual(['pro']);
  });
});

describe('partOfLessons', () => {
  it('places a lesson in the part of its module', () => {
    const of = partOfLessons(outline(), parts);
    expect(of.get('js.one')).toBe('first');
    expect(of.get('js.two')).toBe('first');
    expect(of.get('ts.one')).toBe('second');
  });

  it('places a woven lesson in the part of the lesson it follows, through chains', () => {
    const of = partOfLessons(outline(), parts);
    expect(of.get('cs.one')).toBe('first');
    expect(of.get('cs.two')).toBe('second');
    expect(of.get('pro.one')).toBe('first');
  });

  it('leaves out a lesson that reaches no part, and survives a cycle of wovenAfter links', () => {
    const data = outline();
    const cs = data.modules[2];
    if (!cs) throw new Error('fixture');
    cs.lessons = [lesson('cs.one', 1, 'cs.two'), lesson('cs.two', 2, 'cs.one')];
    const of = partOfLessons(data, [part('first', ['js'])]);
    expect(of.has('cs.one')).toBe(false);
    expect(of.has('ts.one')).toBe(false);
    expect(of.get('js.one')).toBe('first');
  });
});

describe('partJourney', () => {
  it('lists each part with its lessons and concepts in journey order', () => {
    const [first, second] = partJourney(outline(), parts);
    expect(first?.part.id).toBe('first');
    expect(first?.lessons.map((entry) => entry.lesson.id)).toEqual([
      'js.one',
      'cs.one',
      'pro.one',
      'js.two',
    ]);
    expect(first?.concepts.slice(0, 3)).toEqual(['js.one-a', 'js.one-b', 'cs.one-a']);
    expect(second?.lessons.map((entry) => entry.lesson.id)).toEqual(['ts.one', 'cs.two']);
  });

  it('lists a concept once, where it is first taught', () => {
    const data = outline();
    const two = data.modules[0]?.lessons[1];
    if (!two) throw new Error('fixture');
    two.concepts = ['js.one-a', 'js.new'];
    const [first] = partJourney(data, [part('first', ['js'])]);
    expect(first?.concepts.filter((c) => c === 'js.one-a')).toHaveLength(1);
    expect(first?.concepts).toContain('js.new');
  });
});

describe('hostModuleOf', () => {
  it('gives a lesson its own module, and a woven lesson the module it is taught in', () => {
    const host = hostModuleOf(outline());
    expect(host.get('js.two')).toBe('js');
    expect(host.get('cs.one')).toBe('js');
    expect(host.get('cs.two')).toBe('ts');
    expect(host.get('pro.one')).toBe('js');
  });

  it('keeps a woven lesson in its own module when its chain leads nowhere', () => {
    const data = outline();
    const cs = data.modules[2];
    if (!cs) throw new Error('fixture');
    cs.lessons = [lesson('cs.one', 1, 'cs.two'), lesson('cs.two', 2, 'cs.one')];
    expect(hostModuleOf(data).get('cs.one')).toBe('cs');
  });
});
