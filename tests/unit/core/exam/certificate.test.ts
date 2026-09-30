import { describe, expect, it } from 'vitest';
import { certificateCode, certificateFacts, fnv1a32 } from '@/core/exam';
import type { PathExamAttempt } from '@/core/progress';

const FACTS = {
  pathId: 'coding-rounds',
  passedOn: '2026-09-29',
  right: 24,
  total: 28,
  lessonIds: ['js.closures', 'js.arrays', 'algo.two-pointers'],
};

describe('fnv1a32', () => {
  it('matches the published FNV-1a test vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('hashes UTF-8 bytes, so text outside ASCII is stable too', () => {
    expect(fnv1a32('é')).toBe(fnv1a32('é'));
    expect(fnv1a32('é')).not.toBe(fnv1a32('e'));
    // Two, three and four UTF-8 bytes each hash as their bytes, not their UTF-16 units.
    // Reference values from Node's own UTF-8 encoder.
    expect(fnv1a32('\u00e9')).toBe(0x1e9de8c1);
    expect(fnv1a32('\u20ac')).toBe(0x298f832b);
    expect(fnv1a32('\u{1f600}')).toBe(0x33a29608);
  });
});

describe('certificateCode', () => {
  it('is three groups of four unambiguous characters', () => {
    expect(certificateCode(FACTS)).toMatch(
      /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
    );
  });

  it('is stable for the same facts, and ignores the order of the lesson ids', () => {
    const code = certificateCode(FACTS);
    expect(certificateCode({ ...FACTS })).toBe(code);
    expect(certificateCode({ ...FACTS, lessonIds: [...FACTS.lessonIds].reverse() })).toBe(code);
  });

  it('changes when any fact changes', () => {
    const code = certificateCode(FACTS);
    const variants = [
      { ...FACTS, pathId: 'ai-coding-tests' },
      { ...FACTS, passedOn: '2026-09-30' },
      { ...FACTS, right: 25 },
      { ...FACTS, total: 29 },
      { ...FACTS, lessonIds: FACTS.lessonIds.slice(1) },
    ];
    for (const variant of variants) expect(certificateCode(variant)).not.toBe(code);
  });

  it('is pinned, so a change to the recipe is a deliberate one', () => {
    expect(certificateCode(FACTS)).toMatchInlineSnapshot(`"5RPE-JAXB-AGTD"`);
  });
});

describe('certificateFacts', () => {
  it('reads the facts from the attempt that first passed', () => {
    const attempt: PathExamAttempt = {
      seed: 1,
      right: 24,
      total: 28,
      startedAt: '2026-09-29T09:40:00.000Z',
      finishedAt: '2026-09-29T10:00:00.000Z',
      lessonIds: FACTS.lessonIds,
      localDate: '2026-09-29',
    };
    expect(certificateFacts('coding-rounds', attempt)).toEqual(FACTS);
  });
});
