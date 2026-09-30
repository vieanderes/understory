import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENARIO_ID,
  SCENARIOS,
  SCENARIO_IDS,
  buildScenario,
  lineOf,
  run,
  validate,
} from '@/core/labs/event-loop-stepper';

const allVariants = SCENARIOS.flatMap((def) =>
  def.param.options.map((value) => [def.id, value] as const),
);

describe('scenarios', () => {
  it('ships five, in teaching order, with the classic one as the default', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual([...SCENARIO_IDS]);
    expect(SCENARIOS).toHaveLength(5);
    expect(DEFAULT_SCENARIO_ID).toBe('classic');
  });

  it.each(allVariants)('%s with %i is valid, ends, and has a prompt', (id, value) => {
    const scenario = buildScenario(id, value);
    expect(() => validate(scenario)).not.toThrow();
    expect(scenario.prompt).toMatch(/^Before you step: /);
    expect(scenario.title).toBe(SCENARIOS.find((s) => s.id === id)!.title);
    const frames = run(scenario);
    expect(frames.at(-1)!.kind).toBe('done');
    expect(frames.length).toBeLessThan(60);
  });

  it.each(allVariants)(
    '%s with %i: every log op sits on the line that logs its text',
    (id, value) => {
      const scenario = buildScenario(id, value);
      const lines = scenario.source.split('\n');
      for (const callback of scenario.callbacks)
        for (const op of callback.ops)
          if (op.kind === 'log')
            expect(lines[op.line - 1]).toContain(`console.log('${op.text.replace(/ \d+$/, '')}`);
    },
  );

  it('every default is one of the options, and a bad value falls back to it', () => {
    for (const def of SCENARIOS) {
      expect(def.param.options).toContain(def.param.default);
      expect(buildScenario(def.id, 999)).toEqual(buildScenario(def.id));
      expect(buildScenario(def.id)).toEqual(def.build(def.param.default));
    }
  });

  it('lineOf finds the first matching line, 1-based, and fails loudly', () => {
    expect(lineOf(['a', 'b', 'ab'], 'b')).toBe(2);
    expect(() => lineOf(['a'], 'z')).toThrow(/No source line contains "z"/);
  });
});

describe('scenario 2: microtask starvation', () => {
  it('holds the 0 ms timer back for the whole chain, however long', () => {
    for (const length of [1, 3, 6]) {
      const frames = run(buildScenario('microtask-chain', length));
      const timerRan = frames.findIndex((f) => f.stack[0] === 'releaseSeats');
      const waiting = frames.slice(2, timerRan);
      expect(waiting.every((f) => f.tasks.some((t) => t.label === 'releaseSeats'))).toBe(true);
      expect(frames[timerRan]!.output).toHaveLength(length + 1);
    }
  });
});

describe('scenario 4: a blocked Buy button', () => {
  const paintAt = (blockMs: number) =>
    run(buildScenario('blocked-click', blockMs)).find((f) => f.kind === 'paint')!.clockMs;

  it('paints "Buying" only after the blocking work', () => {
    expect(paintAt(120)).toBe(120);
    expect(paintAt(40)).toBe(40);
    expect(paintAt(0)).toBe(16);
  });

  it('logs the timer before the response, and both after the handler', () => {
    for (const blockMs of [0, 40, 120])
      expect(run(buildScenario('blocked-click', blockMs)).at(-1)!.output).toEqual([
        'handler finished',
        'timeout: spinner shown',
        'response: seat held',
      ]);
  });

  it('with 120 ms of work the response waits 80 ms in the task queue', () => {
    const frames = run(buildScenario('blocked-click', 120));
    const held = frames.find((f) => f.output.includes('response: seat held'))!;
    expect(held.clockMs).toBe(120);
  });
});

describe('scenario 5: frame, timer, microtask', () => {
  it('runs microtask, then the 0 ms timer, then the frame and its own microtask', () => {
    expect(run(buildScenario('frame-order', 0)).at(-1)!.output).toEqual([
      'script finished',
      'microtask',
      'timeout',
      'frame: move the queue banner',
      'microtask inside the frame',
    ]);
  });

  it('runs the frame first when the timer is due after it', () => {
    expect(run(buildScenario('frame-order', 20)).at(-1)!.output).toEqual([
      'script finished',
      'microtask',
      'frame: move the queue banner',
      'microtask inside the frame',
      'timeout',
    ]);
  });
});
