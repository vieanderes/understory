import { describe, expect, it } from 'vitest';
import { run, validate, type Frame } from '@/core/labs/event-loop-stepper';
import { log, program } from './helpers';

const output = (frames: readonly Frame[]) => frames.at(-1)!.output;
const kinds = (frames: readonly Frame[]) => frames.map((f) => f.kind);
const labels = (items: readonly { label: string }[]) => items.map((i) => i.label);

describe('run: a task runs to completion', () => {
  it('starts with the script waiting as the first task and nothing on the stack', () => {
    const [first] = run(program({ main: [log('a')] }));
    expect(first).toMatchObject({
      kind: 'start',
      phase: 'idle',
      line: null,
      stack: [],
      clockMs: 0,
    });
    expect(labels(first!.tasks)).toEqual(['script']);
    expect(first!.note).toMatch(/script is the first task/);
  });

  it('names the event when the first task is an event handler', () => {
    const frames = run(
      program(
        { main: [log('a')] },
        { entry: { callback: 'main', label: 'click: onBuy', source: 'event' } },
      ),
    );
    expect(frames[0]!.note).toMatch(/click: onBuy/);
    expect(frames[1]!.note).toMatch(/oldest task, click: onBuy \(event\)/);
  });

  it('emits one frame per operation, with the line and the output so far', () => {
    const frames = run(
      program({
        main: [
          { ...log('a'), line: 2 },
          { ...log('b'), line: 3 },
        ],
      }),
    );
    expect(kinds(frames)).toEqual(['start', 'task-start', 'op', 'op', 'task-end', 'done']);
    expect(frames.map((f) => f.line)).toEqual([null, 1, 2, 3, null, null]);
    expect(frames.map((f) => f.output.length)).toEqual([0, 0, 1, 2, 2, 2]);
    expect(frames[2]!.stack).toEqual(['script']);
    expect(frames[4]!.stack).toEqual([]);
    expect(frames[4]!.note).toMatch(/microtask queue is empty too/);
    expect(frames.at(-1)!.note).toMatch(/2 lines were logged/);
  });

  it('says "1 line was logged" for a single line', () => {
    expect(run(program({ main: [log('a')] })).at(-1)!.note).toMatch(/1 line was logged/);
  });

  it('runs a synchronous call on top of the caller and returns to it', () => {
    const frames = run(
      program({ main: [{ kind: 'call', callback: 'f' }, log('after')], f: [log('inside')] }),
    );
    expect(output(frames)).toEqual(['inside', 'after']);
    const inside = frames.find((f) => f.output.at(-1) === 'inside')!;
    expect(inside.stack).toEqual(['script', 'f']);
    const after = frames.find((f) => f.output.at(-1) === 'after')!;
    expect(after.stack).toEqual(['script']);
  });
});

describe('run: the microtask checkpoint', () => {
  it('runs a promise reaction after the script and before a 0 ms timer', () => {
    const frames = run(
      program({
        main: [
          log('sync 1'),
          { kind: 'setTimeout', callback: 'timer', delayMs: 0 },
          { kind: 'promiseThen', callback: 'reaction' },
          log('sync 2'),
        ],
        timer: [log('timer')],
        reaction: [log('reaction')],
      }),
    );
    expect(output(frames)).toEqual(['sync 1', 'sync 2', 'reaction', 'timer']);
  });

  it('queues setTimeout(0) as a task, never as a microtask', () => {
    const frames = run(
      program({ main: [{ kind: 'setTimeout', callback: 'timer', delayMs: 0 }], timer: [] }),
    );
    const queued = frames[2]!;
    expect(labels(queued.tasks)).toEqual(['timer']);
    expect(queued.tasks[0]!.origin).toBe('timer');
    expect(queued.microtasks).toEqual([]);
    expect(queued.note).toMatch(/never a microtask/);
  });

  it('runs microtasks queued by microtasks in the same checkpoint, before the next task', () => {
    const frames = run(
      program({
        main: [
          { kind: 'setTimeout', callback: 'timer', delayMs: 0 },
          { kind: 'queueMicrotask', callback: 'm1' },
        ],
        m1: [log('m1'), { kind: 'queueMicrotask', callback: 'm2' }],
        m2: [log('m2'), { kind: 'promiseThen', callback: 'm3' }],
        m3: [log('m3')],
        timer: [log('timer')],
      }),
    );
    expect(output(frames)).toEqual(['m1', 'm2', 'm3', 'timer']);
    expect(kinds(frames).filter((k) => k === 'checkpoint-end')).toHaveLength(1);
    const end = frames.find((f) => f.kind === 'checkpoint-end')!;
    expect(end.note).toMatch(/after 3 microtasks.*timer is next/);
    const start = frames.find((f) => f.kind === 'microtask-start')!;
    expect(start.phase).toBe('microtasks');
    expect(start.note).toMatch(/queued by queueMicrotask.*timer is still first/);
  });

  it('runs microtasks first in, first out', () => {
    const frames = run(
      program({
        main: [
          { kind: 'promiseThen', callback: 'a' },
          { kind: 'queueMicrotask', callback: 'b' },
          { kind: 'promiseThen', callback: 'c' },
        ],
        a: [log('a')],
        b: [log('b')],
        c: [log('c')],
      }),
    );
    expect(output(frames)).toEqual(['a', 'b', 'c']);
    expect(frames.find((f) => f.kind === 'task-end')!.note).toMatch(/3 microtasks wait/);
  });

  it('performs a checkpoint after every task, not only after the script', () => {
    const frames = run(
      program({
        main: [
          { kind: 'setTimeout', callback: 't1', delayMs: 0 },
          { kind: 'setTimeout', callback: 't2', delayMs: 0 },
        ],
        t1: [log('t1'), { kind: 'promiseThen', callback: 'm' }],
        m: [log('m')],
        t2: [log('t2')],
      }),
    );
    expect(output(frames)).toEqual(['t1', 'm', 't2']);
    expect(frames.find((f) => f.kind === 'task-end' && f.microtasks.length === 1)!.note).toMatch(
      /1 microtask waits/,
    );
  });
});

describe('run: await', () => {
  it('pauses the function, returns to the caller and resumes in one microtask hop', () => {
    const frames = run(
      program({
        main: [{ kind: 'call', callback: 'f' }, log('caller continues')],
        f: [log('before await'), { kind: 'awaitResolved', continuation: 'f2' }],
        f2: [log('after await')],
      }),
    );
    expect(output(frames)).toEqual(['before await', 'caller continues', 'after await']);
    const paused = frames.find((f) => f.note.startsWith('await pauses f'))!;
    expect(paused.stack).toEqual(['script']);
    expect(paused.microtasks).toMatchObject([{ label: 'f2', origin: 'await' }]);
  });

  it('interleaves two async functions hop by hop', () => {
    const frames = run(
      program({
        main: [
          { kind: 'call', callback: 'a' },
          { kind: 'call', callback: 'b' },
        ],
        a: [log('a0'), { kind: 'awaitResolved', continuation: 'a1' }],
        a1: [log('a1'), { kind: 'awaitResolved', continuation: 'a2' }],
        a2: [log('a2')],
        b: [log('b0'), { kind: 'awaitResolved', continuation: 'b1' }],
        b1: [log('b1')],
      }),
    );
    expect(output(frames)).toEqual(['a0', 'b0', 'a1', 'b1', 'a2']);
  });
});

describe('run: timers', () => {
  it('fires timers in order of due time, then of registration', () => {
    const frames = run(
      program({
        main: [
          { kind: 'setTimeout', callback: 'late', delayMs: 30 },
          { kind: 'setTimeout', callback: 'firstAtTen', delayMs: 10 },
          { kind: 'setTimeout', callback: 'secondAtTen', delayMs: 10 },
          { kind: 'setTimeout', callback: 'zero', delayMs: 0 },
        ],
        late: [log('late')],
        firstAtTen: [log('first at 10')],
        secondAtTen: [log('second at 10')],
        zero: [log('zero')],
      }),
    );
    expect(output(frames)).toEqual(['zero', 'first at 10', 'second at 10', 'late']);
    const registered = frames[4]!;
    expect(registered.timers.map((t) => [t.label, t.dueMs])).toEqual([
      ['firstAtTen', 10],
      ['secondAtTen', 10],
      ['late', 30],
    ]);
    expect(frames[2]!.note).toMatch(/due at 30 ms\. Nothing is queued yet/);
  });

  it('waits with an idle clock jump when only a timer is left', () => {
    const frames = run(
      program({ main: [{ kind: 'setTimeout', callback: 't', delayMs: 25 }], t: [log('t')] }),
    );
    const wait = frames.find((f) => f.kind === 'wait')!;
    expect(wait).toMatchObject({ clockMs: 25, phase: 'idle', timers: [] });
    expect(labels(wait.tasks)).toEqual(['t']);
    expect(wait.note).toMatch(/clock reaches 25 ms\. Timer t came due at 25 ms/);
    expect(frames.at(-1)!.clockMs).toBe(25);
  });

  it('keeps the key of a timer when it becomes a task', () => {
    const frames = run(
      program({ main: [{ kind: 'setTimeout', callback: 't', delayMs: 5 }], t: [] }),
    );
    const key = frames[2]!.timers[0]!.key;
    expect(frames.find((f) => f.kind === 'wait')!.tasks[0]!.key).toBe(key);
  });

  it('a timer that came due during blocking work still runs after an older task', () => {
    const frames = run(
      program({
        main: [
          { kind: 'setTimeout', callback: 'ten', delayMs: 10 },
          { kind: 'blockFor', ms: 50 },
          { kind: 'setTimeout', callback: 'zero', delayMs: 0 },
        ],
        ten: [log('ten')],
        zero: [log('zero')],
      }),
    );
    expect(output(frames)).toEqual(['ten', 'zero']);
    const blocked = frames.find((f) => f.note.startsWith('Synchronous work'))!;
    expect(blocked.clockMs).toBe(50);
    expect(blocked.note).toMatch(/Timer ten came due at 10 ms/);
    expect(blocked.note).not.toMatch(/rendering opportunity/);
  });
});

describe('run: fetch', () => {
  it('resolves in a network task, and the reaction runs as a microtask of that task', () => {
    const frames = run(
      program({
        main: [
          { kind: 'fetchResolve', callback: 'onResponse', afterMs: 40 },
          { kind: 'setTimeout', callback: 'timer', delayMs: 40 },
        ],
        onResponse: [log('response')],
        timer: [log('timer')],
      }),
    );
    expect(output(frames)).toEqual(['response', 'timer']);
    expect(frames[2]!.timers).toMatchObject([{ label: 'fetch response', origin: 'network' }]);
    const network = frames.find((f) => f.note.startsWith('The loop takes the network task'))!;
    expect(network).toMatchObject({ kind: 'task-start', line: null, stack: ['fetch response'] });
    expect(network.microtasks).toMatchObject([{ label: 'onResponse', origin: 'then' }]);
    expect(frames.find((f) => f.kind === 'wait')!.note).toMatch(
      /response for onResponse arrived at 40 ms/,
    );
  });
});

describe('run: rendering', () => {
  it('runs animation frame callbacks at the next rendering opportunity, after a 0 ms timer', () => {
    const frames = run(
      program({
        main: [
          { kind: 'requestAnimationFrame', callback: 'frame' },
          { kind: 'setTimeout', callback: 'timer', delayMs: 0 },
        ],
        frame: [log('frame')],
        timer: [log('timer')],
      }),
    );
    expect(output(frames)).toEqual(['timer', 'frame']);
    const wait = frames.find((f) => f.kind === 'wait')!;
    expect(wait.clockMs).toBe(16);
    expect(wait.note).toMatch(/next rendering opportunity/);
    const start = frames.find((f) => f.kind === 'render-start')!;
    expect(start).toMatchObject({ phase: 'render', clockMs: 16 });
    expect(start.note).toBe('Rendering opportunity at 16 ms. Animation frame callbacks run first.');
    expect(frames.find((f) => f.kind === 'raf-start')!.stack).toEqual(['frame']);
    const paint = frames.find((f) => f.kind === 'paint')!;
    expect(paint.nextRenderMs).toBe(32);
    expect(paint.note).toMatch(/Nothing changed on screen/);
  });

  it('runs an animation frame callback before a timer that is due after the frame', () => {
    const frames = run(
      program({
        main: [
          { kind: 'requestAnimationFrame', callback: 'frame' },
          { kind: 'setTimeout', callback: 'timer', delayMs: 20 },
        ],
        frame: [log('frame')],
        timer: [log('timer')],
      }),
    );
    expect(output(frames)).toEqual(['frame', 'timer']);
  });

  it('runs a task that is due at the same moment as the frame first, then renders', () => {
    const frames = run(
      program({
        main: [
          { kind: 'requestAnimationFrame', callback: 'frame' },
          { kind: 'setTimeout', callback: 'timer', delayMs: 16 },
        ],
        frame: [log('frame')],
        timer: [log('timer')],
      }),
    );
    expect(output(frames)).toEqual(['timer', 'frame']);
  });

  it('drains microtasks queued by a frame callback before the paint', () => {
    const frames = run(
      program({
        main: [{ kind: 'requestAnimationFrame', callback: 'frame' }],
        frame: [
          { kind: 'domWrite', text: 'banner' },
          { kind: 'promiseThen', callback: 'm' },
        ],
        m: [log('m')],
      }),
    );
    const order = kinds(frames);
    expect(order.indexOf('checkpoint-end')).toBeLessThan(order.indexOf('paint'));
    const end = frames.find((f) => f.kind === 'checkpoint-end')!;
    expect(end.note).toMatch(/before the paint/);
    // A DOM write inside the frame does not move the opportunity that is running.
    expect(end.nextRenderMs).toBe(16);
    const paint = frames.find((f) => f.kind === 'paint')!;
    expect(paint).toMatchObject({ phase: 'render', painted: [{ text: 'banner', atMs: 16 }] });
    expect(paint.pendingPaint).toEqual([]);
  });

  it('defers a callback registered during a frame to the next frame', () => {
    const frames = run(
      program({
        main: [{ kind: 'requestAnimationFrame', callback: 'f1' }],
        f1: [log('f1'), { kind: 'requestAnimationFrame', callback: 'f2' }],
        f2: [log('f2')],
      }),
    );
    expect(frames.filter((f) => f.kind === 'paint').map((f) => f.clockMs)).toEqual([16, 32]);
    expect(output(frames)).toEqual(['f1', 'f2']);
  });

  it('paints a DOM write only at the rendering step, late when the task blocked', () => {
    const frames = run(
      program({
        main: [
          { kind: 'domWrite', text: 'button reads "Buying"' },
          { kind: 'setTimeout', callback: 'timer', delayMs: 0 },
          { kind: 'blockFor', ms: 120 },
        ],
        timer: [log('timer')],
      }),
    );
    expect(frames[2]!.pendingPaint).toEqual(['button reads "Buying"']);
    expect(frames[2]!.painted).toEqual([]);
    expect(frames.find((f) => f.note.startsWith('Synchronous'))!.note).toMatch(
      /rendering opportunity at 16 ms passed/,
    );
    const start = frames.find((f) => f.kind === 'render-start')!;
    expect(start.note).toBe(
      'Rendering opportunity at 120 ms, 104 ms late: it was due at 16 ms. No animation frame callbacks wait.',
    );
    const order = kinds(frames);
    // The rendering opportunity follows the blocking task, ahead of the older timer task.
    expect(order.indexOf('paint')).toBeLessThan(order.lastIndexOf('task-start'));
    expect(frames.find((f) => f.kind === 'paint')!.nextRenderMs).toBe(128);
  });

  it('skips opportunities nobody needs, so a later request gets the next frame', () => {
    const frames = run(
      program({
        main: [
          { kind: 'blockFor', ms: 40 },
          { kind: 'requestAnimationFrame', callback: 'f' },
        ],
        f: [log('f')],
      }),
    );
    expect(frames.find((f) => f.rafQueue.length === 1)!.nextRenderMs).toBe(48);
    expect(frames.find((f) => f.kind === 'render-start')!.clockMs).toBe(48);
  });

  it('moves past an unneeded opportunity after a task', () => {
    const frames = run(
      program({
        main: [
          { kind: 'blockFor', ms: 40 },
          { kind: 'setTimeout', callback: 't', delayMs: 0 },
        ],
        t: [{ kind: 'domWrite', text: 'x' }],
      }),
    );
    expect(kinds(frames).filter((k) => k === 'paint')).toHaveLength(1);
    expect(frames.find((f) => f.kind === 'paint')!.clockMs).toBe(48);
  });

  it('honours frameMs', () => {
    const frames = run(
      program({ main: [{ kind: 'requestAnimationFrame', callback: 'f' }], f: [] }, { frameMs: 10 }),
    );
    expect(frames[0]!.nextRenderMs).toBe(10);
    expect(frames.find((f) => f.kind === 'paint')!).toMatchObject({
      clockMs: 10,
      nextRenderMs: 20,
    });
  });
});

describe('run: programs that never end', () => {
  const endless = program({
    main: [
      { kind: 'queueMicrotask', callback: 'again' },
      { kind: 'setTimeout', callback: 't', delayMs: 0 },
    ],
    again: [{ kind: 'queueMicrotask', callback: 'again' }],
    t: [log('never')],
  });

  it('stops at maxFrames and says that the task queue starved', () => {
    const frames = run(endless, { maxFrames: 30 });
    expect(frames).toHaveLength(30);
    expect(frames.at(-1)!.kind).toBe('truncated');
    expect(frames.at(-1)!.note).toMatch(/Stopped after 30 steps/);
    expect(frames.at(-1)!.output).toEqual([]);
    expect(labels(frames.at(-1)!.tasks)).toEqual(['t']);
  });

  it('has a default limit, and survives unbounded recursion', () => {
    expect(run(endless)).toHaveLength(400);
    const recursive = program({ main: [{ kind: 'call', callback: 'main' }] });
    expect(run(recursive, { maxFrames: 0 })).toHaveLength(1);
    expect(run(recursive, { maxFrames: 50 }).at(-1)!.kind).toBe('truncated');
  });
});

describe('run: purity', () => {
  it('returns equal frames for the same scenario and never shares arrays between frames', () => {
    const scenario = program({
      main: [log('a'), { kind: 'promiseThen', callback: 'm' }],
      m: [log('b')],
    });
    const a = run(scenario);
    expect(run(scenario)).toEqual(a);
    expect(a[2]!.output).not.toBe(a[3]!.output);
  });
});

describe('validate', () => {
  it.each([
    ['an unknown entry', program({ other: [] }), /entry refers to unknown callback "main"/],
    [
      'an unknown callback',
      program({ main: [{ kind: 'setTimeout', callback: 'nope', delayMs: 0 }] }),
      /unknown callback "nope"/,
    ],
    [
      'an unknown continuation',
      program({ main: [{ kind: 'awaitResolved', continuation: 'nope' }] }),
      /unknown callback "nope"/,
    ],
    [
      'code after an await',
      program({ main: [{ kind: 'awaitResolved', continuation: 'main' }, log('x')] }),
      /must be last/,
    ],
    [
      'a negative delay',
      program({ main: [{ kind: 'setTimeout', callback: 'main', delayMs: -1 }] }),
      /0 ms or more/,
    ],
    [
      'a fetch that never returns',
      program({ main: [{ kind: 'fetchResolve', callback: 'main', afterMs: Infinity }] }),
      /0 ms or more/,
    ],
    ['negative blocking work', program({ main: [{ kind: 'blockFor', ms: -5 }] }), /0 ms or more/],
    ['an op line outside the source', program({ main: [{ ...log('x'), line: 9 }] }), /line 9/],
    ['a fractional line', program({ main: [{ ...log('x'), line: 1.5 }] }), /line 1.5/],
    ['a frame interval of zero', program({ main: [] }, { frameMs: 0 }), /frameMs/],
  ])('rejects %s', (_name, scenario, message) => {
    expect(() => run(scenario)).toThrow(message);
  });

  it('rejects a callback line outside the source and duplicate ids', () => {
    const base = program({ main: [] });
    expect(() => validate({ ...base, callbacks: [{ ...base.callbacks[0]!, line: 0 }] })).toThrow(
      /line 0/,
    );
    expect(() => validate({ ...base, callbacks: [...base.callbacks, ...base.callbacks] })).toThrow(
      /defined twice/,
    );
  });

  it('returns the callbacks by id', () => {
    expect([...validate(program({ main: [], other: [] })).keys()]).toEqual(['main', 'other']);
  });

  it('lets errors other than truncation escape', () => {
    const broken = program({ main: [log('x')] });
    Object.defineProperty(broken.callbacks[0]!.ops[0]!, 'text', {
      get() {
        throw new Error('boom');
      },
    });
    expect(() => run(broken)).toThrow('boom');
  });
});
