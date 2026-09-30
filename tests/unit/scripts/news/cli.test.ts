import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../../../scripts/news/cli';
import { NOW } from './helpers';

describe('pnpm news flags', () => {
  it('defaults to today, twelve items, with writes and the model allowed', () => {
    expect(parseArgs([], NOW)).toEqual({
      date: '2026-09-17',
      dryRun: false,
      noLlm: false,
      max: 12,
      help: false,
    });
  });

  it('reads every flag, in both spellings', () => {
    expect(parseArgs(['--date', '2026-09-01', '--dry-run', '--no-llm', '--max', '5'], NOW)).toEqual(
      {
        date: '2026-09-01',
        dryRun: true,
        noLlm: true,
        max: 5,
        help: false,
      },
    );
    expect(parseArgs(['--date=2026-09-01', '--max=5'], NOW)).toMatchObject({
      date: '2026-09-01',
      max: 5,
    });
    expect(parseArgs(['-h'], NOW).help).toBe(true);
  });

  it.each([
    [['--date', '17.09.2026'], /YYYY-MM-DD/],
    [['--date'], /needs a value/],
    [['--max', '0'], /1 to 20/],
    [['--max', '99'], /1 to 20/],
    [['--max', 'many'], /1 to 20/],
    [['--max', '--dry-run'], /needs a value/],
    [['--force'], /Unknown argument/],
  ])('rejects %j', (args, message) => {
    expect(() => parseArgs(args, NOW)).toThrow(message);
  });
});
