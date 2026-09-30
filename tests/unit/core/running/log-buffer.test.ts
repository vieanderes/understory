import { describe, expect, it } from 'vitest';
import { LIMITS, LOG_TRUNCATION_NOTICE } from '@/core/running/limits';
import { capLogs, LogBuffer } from '@/core/running/log-buffer';

describe('LogBuffer', () => {
  it('keeps lines in order and returns a copy', () => {
    const buffer = new LogBuffer();
    expect(buffer.push('a')).toBe(true);
    expect(buffer.push('b')).toBe(true);
    const lines = buffer.lines();
    lines.push('mutated');
    expect(buffer.lines()).toEqual(['a', 'b']);
  });

  it('stops at the line cap with one notice and reports it to the caller', () => {
    const buffer = new LogBuffer();
    for (let i = 0; i < LIMITS.maxLogLines; i++) expect(buffer.push(`line ${i}`)).toBe(true);
    expect(buffer.push('one too many')).toBe(false);
    expect(buffer.push('and another')).toBe(false);
    expect(buffer.lines()).toHaveLength(LIMITS.maxLogLines + 1);
    expect(buffer.lines().at(-1)).toBe(LOG_TRUNCATION_NOTICE);
  });

  it('stops at the byte cap', () => {
    const buffer = new LogBuffer();
    let accepted = 0;
    while (buffer.push('x'.repeat(LIMITS.maxLogLineLength))) accepted += 1;
    expect(accepted).toBe(Math.floor(LIMITS.maxLogBytes / (LIMITS.maxLogLineLength + 1)));
    expect(buffer.lines().at(-1)).toBe(LOG_TRUNCATION_NOTICE);
  });

  it('clips a line that is longer than the wire allows', () => {
    const buffer = new LogBuffer();
    buffer.push('y'.repeat(LIMITS.maxLogLineLength * 2));
    expect(buffer.lines()[0]).toHaveLength(LIMITS.maxLogLineLength);
  });
});

describe('capLogs', () => {
  it('passes a short list through', () => {
    expect(capLogs(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('keeps the single notice of a list the harness already truncated', () => {
    const lines = [
      ...Array.from({ length: LIMITS.maxLogLines }, (_, i) => `line ${i}`),
      LOG_TRUNCATION_NOTICE,
    ];
    expect(capLogs(lines)).toEqual(lines);
  });

  it('keeps a notice that arrives early, as when the byte cap was hit', () => {
    expect(capLogs(['a', LOG_TRUNCATION_NOTICE])).toEqual(['a', LOG_TRUNCATION_NOTICE]);
  });

  it('truncates a list that was never capped', () => {
    const capped = capLogs(Array.from({ length: 500 }, (_, i) => `line ${i}`));
    expect(capped).toHaveLength(LIMITS.maxLogLines + 1);
    expect(capped.at(-1)).toBe(LOG_TRUNCATION_NOTICE);
    expect(capped.filter((line) => line === LOG_TRUNCATION_NOTICE)).toHaveLength(1);
  });
});
