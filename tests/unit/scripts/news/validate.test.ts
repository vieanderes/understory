import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateNewsData } from '../../../../scripts/news/validate';
import { REPO_ROOT } from './helpers';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'signal-validate-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('validateNewsData', () => {
  it('accepts an empty folder', async () => {
    expect(await validateNewsData(root)).toEqual([]);
  });

  it('names a day file that fails the schema', async () => {
    await mkdir(path.join(root, '2026', '09'), { recursive: true });
    await writeFile(
      path.join(root, '2026', '09', '17.json'),
      '{"date":"2026-09-17","items":"none"}',
    );
    const problems = await validateNewsData(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('17.json');
  });

  it('names a file that is not JSON, and a roll-up that fails the schema', async () => {
    await mkdir(path.join(root, '2026', '09'), { recursive: true });
    await mkdir(path.join(root, 'digests', 'week'), { recursive: true });
    await writeFile(path.join(root, '2026', '09', '16.json'), 'not json');
    await writeFile(path.join(root, 'digests', 'week', '2026-W38.json'), '{"period":"week"}');
    const problems = await validateNewsData(root);
    expect(problems.some((problem) => problem.includes('16.json'))).toBe(true);
    expect(problems.some((problem) => problem.includes('2026-W38.json'))).toBe(true);
  });

  it('notices a file that claims another date', async () => {
    await mkdir(path.join(root, '2026', '09'), { recursive: true });
    const day = {
      date: '2026-09-01',
      generatedAt: '2026-09-01T05:30:00.000Z',
      items: [],
      stats: {
        fetched: 0,
        afterDedupe: 0,
        excluded: 0,
        selected: 0,
        llmBriefs: 0,
        extractiveBriefs: 0,
        sources: [],
      },
    };
    await writeFile(path.join(root, '2026', '09', '17.json'), JSON.stringify(day));
    expect(await validateNewsData(root)).toEqual(['2026-09-17: the file says it is 2026-09-01.']);
  });

  it('passes for the data committed in this repository', async () => {
    expect(await validateNewsData(path.join(REPO_ROOT, 'data', 'news'))).toEqual([]);
  });
});
