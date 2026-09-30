import { describe, expect, it } from 'vitest';
import { run, type Callback, type Op, type Scenario } from '@/core/labs/event-loop-stepper';
import { intBelow, mulberry32, type Rng } from '@/core/util';

/*
 * Random programs. Callback i only refers to callbacks after it, so every program ends,
 * and every callback is scheduled at most once per reference.
 */
function randomScenario(rng: Rng): Scenario {
  const count = 3 + intBelow(rng, 6);
  const callbacks: Callback[] = [];
  for (let i = 0; i < count; i += 1) {
    const ops: Op[] = [];
    const length = 1 + intBelow(rng, 5);
    for (let j = 0; j < length; j += 1) {
      const later = i + 1 + intBelow(rng, count - i - 1);
      const target = `c${later}`;
      const canRefer = later < count;
      const pick = intBelow(rng, 9);
      if (pick === 0 || !canRefer) ops.push({ kind: 'log', text: `c${i}.${j}`, line: 1 });
      else if (pick === 1)
        ops.push({ kind: 'setTimeout', callback: target, delayMs: intBelow(rng, 4) * 10, line: 1 });
      else if (pick === 2) ops.push({ kind: 'promiseThen', callback: target, line: 1 });
      else if (pick === 3) ops.push({ kind: 'queueMicrotask', callback: target, line: 1 });
      else if (pick === 4) ops.push({ kind: 'requestAnimationFrame', callback: target, line: 1 });
      else if (pick === 5) ops.push({ kind: 'blockFor', ms: intBelow(rng, 50), line: 1 });
      else if (pick === 6)
        ops.push({ kind: 'fetchResolve', callback: target, afterMs: intBelow(rng, 60), line: 1 });
      else if (pick === 7) ops.push({ kind: 'call', callback: target, line: 1 });
      else ops.push({ kind: 'domWrite', text: `write ${i}.${j}`, line: 1 });
    }
    if (i + 1 < count && intBelow(rng, 4) === 0)
      ops.push({ kind: 'awaitResolved', continuation: `c${i + 1}`, line: 1 });
    callbacks.push({ id: `c${i}`, label: `c${i}`, line: 1, ops });
  }
  return {
    id: 'random',
    title: 'Random',
    prompt: 'Predict.',
    source: 'x',
    entry: { callback: 'c0', label: 'script', source: 'script' },
    callbacks,
  };
}

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
const runs = SEEDS.map((seed) => run(randomScenario(mulberry32(seed)), { maxFrames: 5000 }));

describe('invariants over 300 seeded random programs', () => {
  it('every program ends with everything empty', () => {
    for (const frames of runs) {
      const last = frames.at(-1)!;
      expect(last.kind).toBe('done');
      expect([last.stack, last.microtasks, last.tasks, last.timers, last.rafQueue]).toEqual([
        [],
        [],
        [],
        [],
        [],
      ]);
      expect(last.pendingPaint).toEqual([]);
    }
  });

  it('a task or a rendering step only starts with an empty stack and an empty microtask queue', () => {
    for (const frames of runs)
      frames.forEach((frame, i) => {
        const before = frames[i - 1]!;
        // The frame before a paint may still show the last line of a frame callback.
        if (['task-start', 'render-start'].includes(frame.kind)) expect(before.stack).toEqual([]);
        if (['task-start', 'render-start', 'raf-start', 'paint'].includes(frame.kind))
          expect(before.microtasks).toEqual([]);
      });
  });

  it('the loop never waits while a task or a microtask is ready', () => {
    for (const frames of runs)
      frames.forEach((frame, i) => {
        if (frame.kind !== 'wait') return;
        const before = frames[i - 1]!;
        expect(before.tasks).toEqual([]);
        expect(before.microtasks).toEqual([]);
      });
  });

  it('the clock and the next rendering opportunity never go back, and output only grows', () => {
    for (const frames of runs)
      for (let i = 1; i < frames.length; i += 1) {
        const [a, b] = [frames[i - 1]!, frames[i]!];
        expect(b.clockMs).toBeGreaterThanOrEqual(a.clockMs);
        expect(b.nextRenderMs).toBeGreaterThanOrEqual(a.nextRenderMs);
        expect(b.output.slice(0, a.output.length)).toEqual(a.output);
        expect(b.painted.slice(0, a.painted.length)).toEqual(a.painted);
      }
  });

  it('no timer stays pending past its due time, and pending timers are sorted', () => {
    for (const frames of runs)
      for (const frame of frames) {
        expect(frame.timers.every((t) => t.dueMs > frame.clockMs)).toBe(true);
        const due = frame.timers.map((t) => t.dueMs);
        expect(due).toEqual([...due].sort((x, y) => x - y));
      }
  });

  it('tasks leave the task queue first in, first out', () => {
    for (const frames of runs) {
      const entered: string[] = [];
      const left: string[] = [];
      for (let i = 1; i < frames.length; i += 1) {
        const before = new Set(frames[i - 1]!.tasks.map((t) => t.key));
        const now = new Set(frames[i]!.tasks.map((t) => t.key));
        for (const t of frames[i]!.tasks) if (!before.has(t.key)) entered.push(t.key);
        for (const t of frames[i - 1]!.tasks) if (!now.has(t.key)) left.push(t.key);
      }
      // The first task is already queued in frame 0.
      expect(left).toEqual([frames[0]!.tasks[0]!.key, ...entered]);
    }
  });

  it('painting happens only in a rendering step, never before the clock reaches it', () => {
    for (const frames of runs)
      for (let i = 1; i < frames.length; i += 1) {
        if (frames[i]!.painted.length === frames[i - 1]!.painted.length) continue;
        expect(frames[i]!.kind).toBe('paint');
        expect(frames[i]!.clockMs).toBeGreaterThanOrEqual(frames[i - 1]!.nextRenderMs);
      }
  });

  it('is deterministic', () => {
    for (const seed of SEEDS.slice(0, 20))
      expect(run(randomScenario(mulberry32(seed)), { maxFrames: 5000 })).toEqual(runs[seed - 1]);
  });
});
