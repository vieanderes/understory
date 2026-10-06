import { describe, expect, it } from 'vitest';
import {
  EXPLAIN_BACK_AUDIENCES,
  EXPLAIN_BACK_KINDS,
  explainBackCue,
  explainBackFrame,
} from '@/core/content/explain-back';

describe('explainBackFrame', () => {
  it('reads an absent audience as a teammate and an absent kind as explain', () => {
    expect(explainBackFrame({})).toEqual({ audience: 'teammate', kind: 'explain' });
    expect(explainBackFrame({ audience: 'reviewer' })).toEqual({
      audience: 'reviewer',
      kind: 'explain',
    });
    expect(explainBackFrame({ kind: 'risk' })).toEqual({ audience: 'teammate', kind: 'risk' });
  });
});

describe('explainBackCue', () => {
  it('names the default frame', () => {
    expect(explainBackCue({})).toBe('Explain it to a teammate');
  });

  it('names the audience for an explanation', () => {
    expect(explainBackCue({ audience: 'newcomer' })).toBe('Explain it to a newcomer');
    expect(explainBackCue({ audience: 'non-technical' })).toBe(
      'Explain it to someone non-technical',
    );
    expect(explainBackCue({ audience: 'interviewer' })).toBe('Explain it to an interviewer');
    expect(explainBackCue({ audience: 'incident' })).toBe('Explain it to the incident channel');
  });

  it('asks for a defence of a choice', () => {
    expect(explainBackCue({ audience: 'reviewer', kind: 'decide' })).toBe(
      'Defend the choice to a reviewer',
    );
    expect(explainBackCue({ kind: 'decide' })).toBe('Defend the choice to a teammate');
  });

  it('asks for a warning about a risk', () => {
    expect(explainBackCue({ kind: 'risk' })).toBe('Warn a teammate: what could go wrong');
    expect(explainBackCue({ audience: 'incident', kind: 'risk' })).toBe(
      'Warn the incident channel: what could go wrong',
    );
  });

  it('has a short cue for every audience and kind, without a dash or an exclamation mark', () => {
    for (const audience of EXPLAIN_BACK_AUDIENCES) {
      for (const kind of EXPLAIN_BACK_KINDS) {
        const cue = explainBackCue({ audience, kind });
        expect(cue.split(' ').length).toBeLessThanOrEqual(8);
        expect(cue).not.toMatch(/[!—]/);
      }
    }
  });
});
