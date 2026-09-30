import { describe, expect, it } from 'vitest';
import {
  clockLabel,
  codeOf,
  createAttempt,
  endsAt,
  integritySummary,
  isTimeUp,
  MAX_SNAPSHOTS,
  reduceAttempt,
  secondsRemaining,
  SNAPSHOT_GAP_MS,
  type AttemptAction,
  type AttemptState,
  type TestSpec,
} from '@/core/online-test';

const spec: TestSpec = {
  key: 'demo',
  title: 'Demo test',
  mode: 'demo',
  minutes: 30,
  taskIds: ['a', 'b'],
  languages: ['ts', 'python'],
  assistant: false,
  proctoring: true,
};

const T0 = 1_000_000;

function running(minutes = spec.minutes): AttemptState {
  const actions: AttemptAction[] = [
    { type: 'tour-started' },
    { type: 'tour-finished' },
    { type: 'started', at: T0 },
  ];
  return actions.reduce(
    reduceAttempt,
    createAttempt('x', { ...spec, minutes }, { a: 'A0', b: 'B0' }, T0 - 5000),
  );
}

describe('the flow', () => {
  it('starts the clock only after the tour and the ready dialog', () => {
    let state = createAttempt('x', spec, { a: 'A0' }, T0);
    expect(state.phase).toBe('intro');
    expect(secondsRemaining(state, T0)).toBe(1800);
    expect(endsAt(state)).toBeUndefined();
    state = reduceAttempt(state, { type: 'started', at: T0 });
    expect(state.phase).toBe('intro');
    state = reduceAttempt(state, { type: 'tour-finished' });
    expect(state.phase).toBe('intro');
    state = reduceAttempt(state, { type: 'tour-started' });
    state = reduceAttempt(state, { type: 'tour-started' });
    state = reduceAttempt(state, { type: 'tour-finished' });
    expect(state.phase).toBe('ready');
    state = reduceAttempt(state, { type: 'started', at: T0 });
    expect(state).toMatchObject({ phase: 'running', startedAt: T0 });
    expect(codeOf(state, 'b')).toEqual({ language: 'ts', code: '' });
  });

  it('runs one clock that shows hours and whole minutes', () => {
    const state = running();
    expect(clockLabel(secondsRemaining(state, T0 + 1000))).toBe('0h 29min');
    expect(clockLabel(5400)).toBe('1h 30min');
    expect(isTimeUp(state, T0 + 30 * 60_000)).toBe(true);
    expect(secondsRemaining(state, T0 + 31 * 60_000)).toBe(0);
  });

  it('submits once, and ignores everything after', () => {
    let state = running();
    state = reduceAttempt(state, { type: 'submitted', at: T0 + 10, reason: 'candidate' });
    expect(state).toMatchObject({ phase: 'submitted', submitReason: 'candidate' });
    const again = reduceAttempt(state, { type: 'submitted', at: T0 + 20, reason: 'time-up' });
    expect(again).toBe(state);
    expect(reduceAttempt(state, { type: 'code-edited', taskId: 'a', code: 'x', at: T0 })).toBe(
      state,
    );
    expect(reduceAttempt(state, { type: 'quit', at: T0 })).toBe(state);
    expect(reduceAttempt(state, { type: 'integrity', event: { at: T0, kind: 'blur' } })).toBe(
      state,
    );
    expect(
      reduceAttempt(state, {
        type: 'assistant-message',
        message: { at: T0, role: 'user', text: 'hi', taskId: 'a' },
      }),
    ).toBe(state);
  });
});

describe('editing', () => {
  it('keeps a solution per language', () => {
    let state = running();
    state = reduceAttempt(state, { type: 'code-edited', taskId: 'a', code: 'ts code', at: T0 + 1 });
    state = reduceAttempt(state, {
      type: 'language-set',
      taskId: 'a',
      language: 'python',
      starter: 'PY0',
    });
    expect(codeOf(state, 'a')).toEqual({ language: 'python', code: 'PY0' });
    state = reduceAttempt(state, {
      type: 'language-set',
      taskId: 'a',
      language: 'ts',
      starter: 'TS0',
    });
    expect(codeOf(state, 'a')).toEqual({ language: 'ts', code: 'ts code' });
    expect(
      reduceAttempt(state, { type: 'language-set', taskId: 'a', language: 'js', starter: '' }),
    ).toBe(state);
    expect(
      reduceAttempt(state, {
        type: 'language-set',
        taskId: 'zzz',
        language: 'python',
        starter: '',
      }),
    ).toBe(state);
  });

  it('stops taking edits when the time is up', () => {
    const state = running();
    expect(
      reduceAttempt(state, {
        type: 'code-edited',
        taskId: 'a',
        code: 'late',
        at: T0 + 30 * 60_000,
      }),
    ).toBe(state);
    expect(reduceAttempt(state, { type: 'code-edited', taskId: 'a', code: 'A0', at: T0 + 1 })).toBe(
      state,
    );
    expect(
      reduceAttempt(state, { type: 'code-edited', taskId: 'nope', code: 'x', at: T0 + 1 }),
    ).toBe(state);
  });

  it('selects tasks in range, and keeps the test input and run count', () => {
    let state = running();
    state = reduceAttempt(state, { type: 'task-selected', index: 1 });
    expect(state.activeTask).toBe(1);
    expect(reduceAttempt(state, { type: 'task-selected', index: 5 })).toBe(state);
    state = reduceAttempt(state, { type: 'input-edited', taskId: 'b', text: '[1]' });
    state = reduceAttempt(state, { type: 'code-run', taskId: 'b', at: T0 + 2 });
    expect(state.drafts.b).toMatchObject({ input: '[1]', runs: 1 });
    expect(state.snapshots).toHaveLength(1);
  });

  it('snapshots at most every ten seconds while typing, and always on a run', () => {
    let state = running();
    state = reduceAttempt(state, { type: 'code-edited', taskId: 'a', code: 'v1', at: T0 + 1 });
    state = reduceAttempt(state, { type: 'code-edited', taskId: 'a', code: 'v2', at: T0 + 2 });
    expect(state.snapshots.map((s) => s.code)).toEqual(['v1']);
    state = reduceAttempt(state, {
      type: 'code-edited',
      taskId: 'a',
      code: 'v3',
      at: T0 + 1 + SNAPSHOT_GAP_MS,
    });
    state = reduceAttempt(state, { type: 'code-run', taskId: 'a', at: T0 + 1 + SNAPSHOT_GAP_MS });
    expect(state.snapshots.map((s) => s.code)).toEqual(['v1', 'v3']);
    state = reduceAttempt(state, {
      type: 'code-edited',
      taskId: 'a',
      code: 'v4',
      at: T0 + 3 + SNAPSHOT_GAP_MS,
    });
    state = reduceAttempt(state, { type: 'code-run', taskId: 'a', at: T0 + 4 + SNAPSHOT_GAP_MS });
    expect(state.snapshots.map((s) => s.code)).toEqual(['v1', 'v3', 'v4']);
  });

  it('keeps the newest snapshots when there are too many', () => {
    let state = running(180);
    for (let i = 0; i <= MAX_SNAPSHOTS; i++) {
      state = reduceAttempt(state, {
        type: 'code-edited',
        taskId: 'a',
        code: `v${i}`,
        at: T0 + i * SNAPSHOT_GAP_MS,
      });
    }
    expect(state.snapshots).toHaveLength(MAX_SNAPSHOTS);
    expect(state.snapshots.at(-1)?.code).toBe(`v${MAX_SNAPSHOTS}`);
  });
});

describe('integrity', () => {
  it('sums pastes, copy attempts, tab switches and time away', () => {
    let state = running();
    const events: AttemptAction[] = [
      { type: 'integrity', event: { at: T0 + 1000, kind: 'paste', chars: 400 } },
      { type: 'integrity', event: { at: T0 + 1500, kind: 'paste', chars: 10 } },
      { type: 'integrity', event: { at: T0 + 2000, kind: 'copy-blocked' } },
      { type: 'integrity', event: { at: T0 + 3000, kind: 'hidden' } },
      { type: 'integrity', event: { at: T0 + 13_000, kind: 'visible' } },
      { type: 'integrity', event: { at: T0 + 20_000, kind: 'blur' } },
      { type: 'quit', at: T0 + 21_000 },
      { type: 'submitted', at: T0 + 60_000, reason: 'candidate' },
    ];
    state = events.reduce(reduceAttempt, state);
    const summary = integritySummary(state, 20);
    expect(summary).toMatchObject({
      pastes: 2,
      pastedChars: 410,
      largestPaste: 400,
      copyAttempts: 1,
      tabSwitches: 1,
      focusLosses: 1,
      awayMs: 40_000,
      durationMs: 60_000,
      risk: 'High',
    });
    expect(summary.issues).toEqual([
      'pasted-code',
      'copy-description',
      'losing-focus',
      'switching-tabs',
      'time-spent',
    ]);
    expect(state.quits).toEqual([T0 + 21_000]);
  });

  it('is low risk for a quiet sitting', () => {
    const state = reduceAttempt(running(), {
      type: 'submitted',
      at: T0 + 25 * 60_000,
      reason: 'time-up',
    });
    expect(integritySummary(state, 20)).toMatchObject({ issues: [], risk: 'Low' });
    const noClock = createAttempt('y', spec, {}, T0);
    expect(integritySummary(noClock, 0).durationMs).toBe(0);
  });

  it('is medium risk for one or two issues', () => {
    const state = [
      { type: 'integrity', event: { at: T0 + 1, kind: 'hidden' } },
      { type: 'integrity', event: { at: T0 + 2, kind: 'visible' } },
      { type: 'submitted', at: T0 + 25 * 60_000, reason: 'candidate' },
    ].reduce((s, a) => reduceAttempt(s, a as AttemptAction), running());
    expect(integritySummary(state, 20).risk).toBe('Medium');
  });
});

describe('guided mode', () => {
  it('remembers the step per task and marks the attempt as guided', () => {
    let state = running();
    expect(state.guideUsed).toBeUndefined();
    state = reduceAttempt(state, { type: 'guide-opened' });
    expect(state.guideUsed).toBe(true);
    expect(reduceAttempt(state, { type: 'guide-opened' })).toBe(state);
    state = reduceAttempt(state, { type: 'guide-step', taskId: 'a', index: 3 });
    state = reduceAttempt(state, { type: 'guide-step', taskId: 'b', index: 1 });
    expect(state.guideSteps).toEqual({ a: 3, b: 1 });
    expect(reduceAttempt(state, { type: 'guide-step', taskId: 'a', index: -1 })).toBe(state);
    const done = reduceAttempt(state, { type: 'submitted', at: T0 + 1, reason: 'candidate' });
    expect(reduceAttempt(done, { type: 'guide-step', taskId: 'a', index: 5 })).toBe(done);
  });
});
