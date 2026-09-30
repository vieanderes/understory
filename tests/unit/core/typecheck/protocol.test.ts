import { describe, expect, it } from 'vitest';
import { LIMITS } from '@/core/running/limits';
import { checkReplySchema, checkRequestSchema } from '@/core/typecheck/protocol';

describe('checkRequestSchema', () => {
  it('accepts a request with code and tests', () => {
    const request = { v: 1, id: 3, code: 'const a = 1;', tests: '' };
    expect(checkRequestSchema.parse(request)).toEqual(request);
  });

  it('refuses unknown keys, another version and oversized code', () => {
    expect(checkRequestSchema.safeParse({ v: 1, id: 1, code: '', tests: '', x: 1 }).success).toBe(
      false,
    );
    expect(checkRequestSchema.safeParse({ v: 2, id: 1, code: '', tests: '' }).success).toBe(false);
    const big = 'x'.repeat(LIMITS.maxSourceBytes + 1);
    expect(checkRequestSchema.safeParse({ v: 1, id: 1, code: big, tests: '' }).success).toBe(false);
  });
});

describe('checkReplySchema', () => {
  it('accepts diagnostics', () => {
    const reply = {
      v: 1,
      id: 3,
      diagnostics: [
        { file: 'code', start: 1, length: 2, code: 2322, category: 'error', message: 'm' },
      ],
    };
    expect(checkReplySchema.parse(reply)).toEqual(reply);
  });

  it('accepts a diagnostic without a position', () => {
    const reply = {
      v: 1,
      id: 3,
      diagnostics: [{ file: 'other', code: 5, category: 'error', message: 'm' }],
    };
    expect(checkReplySchema.safeParse(reply).success).toBe(true);
  });

  it('accepts a failure with a reason', () => {
    expect(checkReplySchema.parse({ v: 1, id: 3, failure: 'broken' })).toEqual({
      v: 1,
      id: 3,
      failure: 'broken',
    });
  });

  it('refuses a reply that is neither', () => {
    expect(checkReplySchema.safeParse({ v: 1, id: 3 }).success).toBe(false);
    expect(
      checkReplySchema.safeParse({
        v: 1,
        id: 3,
        diagnostics: [{ file: 'code', code: 1, category: 'fatal', message: 'm' }],
      }).success,
    ).toBe(false);
  });
});
