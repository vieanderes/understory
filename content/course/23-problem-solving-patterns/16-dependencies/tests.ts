import { buildStages } from './solution';

test('example: install, then build and lint, then test', () => {
  expect(
    buildStages(['test', 'build', 'lint', 'install'], [
      ['install', 'build'],
      ['build', 'test'],
      ['install', 'lint'],
    ]),
  ).toEqual([['install'], ['build', 'lint'], ['test']]);
});

test('a job waits for its slowest dependency', () => {
  expect(
    buildStages(['c', 'b', 'a'], [
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c'],
    ]),
  ).toEqual([['a'], ['b'], ['c']]);
});

test('independent jobs share one sorted stage', () => {
  expect(buildStages(['pack', 'fetch', 'clean'], [])).toEqual([['clean', 'fetch', 'pack']]);
});

test('no jobs give no stages', () => {
  expect(buildStages([], [])).toEqual([]);
});

test('a cycle returns null', () => {
  expect(
    buildStages(['a', 'b', 'c', 'd'], [
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'b'],
    ]),
  ).toBe(null);
  expect(buildStages(['a'], [['a', 'a']])).toBe(null);
});

test('performance: a chain of 200,000 jobs', () => {
  const jobs: string[] = [];
  const deps: [string, string][] = [];
  for (let i = 0; i < 200000; i++) {
    jobs.push(`job${i}`);
    if (i > 0) deps.push([`job${i - 1}`, `job${i}`]);
  }
  const stages = buildStages(jobs, deps);
  expect(stages).toHaveLength(200000);
  expect(stages![199999]).toEqual(['job199999']);
  deps.push(['job199999', 'job0']);
  expect(buildStages(jobs, deps)).toBe(null);
});

test('performance: 100,000 independent jobs, then one that needs them all', () => {
  const jobs: string[] = ['report'];
  const deps: [string, string][] = [];
  for (let i = 99999; i >= 0; i--) {
    jobs.push(`part${i}`);
    deps.push([`part${i}`, 'report']);
  }
  const stages = buildStages(jobs, deps)!;
  expect(stages).toHaveLength(2);
  const first = stages[0]!;
  expect(first).toHaveLength(100000);
  expect(first[0]).toBe('part0');
  expect(first[1]).toBe('part1');
  expect(stages[1]).toEqual(['report']);
});
