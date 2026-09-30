import type {
  Callback,
  Frame,
  FrameKind,
  Op,
  Painted,
  PendingItem,
  Phase,
  QueueItem,
  RunOptions,
  Scenario,
} from './types';

/*
 * The event loop, as the HTML Standard defines it (8.1.7.3 "Processing model",
 * https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model):
 *
 *   1. Take the oldest task from a task queue and run it to completion.
 *   2. Perform a microtask checkpoint: run microtasks until the queue is empty. A microtask
 *      queued by a microtask runs in the same checkpoint.
 *   3. If there is a rendering opportunity, update the rendering: run the animation frame
 *      callbacks, then style, layout and paint.
 *   4. Go to 1.
 *
 * What this model leaves out (the view repeats it for the learner):
 *   - Node.js. Its loop has phases (timers, poll, check), `process.nextTick` runs before
 *     promise microtasks and `setImmediate` runs in the check phase. None of that is here.
 *   - Several task queues. A browser may pick between task sources (input before timers,
 *     for example). Here there is one queue, first in, first out.
 *   - Timer clamping: nested timers are clamped to 4 ms after five levels, and background
 *     tabs are throttled. Here a timer is due exactly `delayMs` after it was set.
 *   - The cost of code. Every operation takes 0 ms except `blockFor`, so the clock moves
 *     only when the program blocks or the loop waits.
 *   - Frame timing. A rendering opportunity comes every `frameMs` (16, for a 60 Hz display)
 *     and only when something needs painting. Real browsers decide this themselves, which
 *     is why `setTimeout(0)` against `requestAnimationFrame` is not guaranteed in practice.
 *   - Rejections, `await` of a pending promise or a thenable, workers, `requestIdleCallback`.
 */

const DEFAULT_FRAME_MS = 16;
const DEFAULT_MAX_FRAMES = 400;

interface Entry extends QueueItem {
  callback: string;
  /** A network task does not call the callback: it resolves the promise it belongs to. */
  resolves?: boolean;
}

interface Pending extends Entry {
  dueMs: number;
  seq: number;
}

/** Thrown to unwind the simulated stack when a program never ends. Never escapes `run`. */
const TRUNCATED = { truncated: true } as const;

const ORIGIN_OF_MICROTASK: Partial<Record<Op['kind'], string>> = {
  promiseThen: 'then',
  queueMicrotask: 'queueMicrotask',
  awaitResolved: 'await',
};

export function run(scenario: Scenario, options: RunOptions = {}): Frame[] {
  const callbacks = validate(scenario);
  const frameMs = scenario.frameMs ?? DEFAULT_FRAME_MS;
  const maxFrames = Math.max(1, options.maxFrames ?? DEFAULT_MAX_FRAMES);

  const frames: Frame[] = [];
  const stack: string[] = [];
  const microtasks: Entry[] = [];
  const tasks: Entry[] = [];
  const rafQueue: Entry[] = [];
  let pending: Pending[] = [];
  const output: string[] = [];
  const pendingPaint: string[] = [];
  const painted: Painted[] = [];
  let clockMs = 0;
  let nextRenderMs = frameMs;
  let phase: Phase = 'idle';
  let rendering = false;
  let seq = 0;

  const item = ({ key, label, origin }: QueueItem): QueueItem => ({ key, label, origin });

  function emit(kind: FrameKind, line: number | null, note: string): void {
    if (frames.length >= maxFrames) throw TRUNCATED;
    frames.push({
      kind,
      phase,
      line,
      stack: [...stack],
      microtasks: microtasks.map(item),
      tasks: tasks.map(item),
      timers: pending.map((p): PendingItem => ({ ...item(p), dueMs: p.dueMs })),
      rafQueue: rafQueue.map(item),
      output: [...output],
      clockMs,
      nextRenderMs,
      pendingPaint: [...pendingPaint],
      painted: [...painted],
      note,
    });
  }

  const entry = (callback: Callback, origin: string): Entry => {
    seq += 1;
    return { key: `e${seq}`, label: callback.label, origin, callback: callback.id };
  };

  const renderNeeded = () => rafQueue.length > 0 || pendingPaint.length > 0;
  const frameAfter = (ms: number) => (Math.floor(ms / frameMs) + 1) * frameMs;

  /*
   * A browser skips rendering opportunities when nothing changed. When something does
   * change after a skipped one, the next opportunity is the next frame, not the missed one.
   */
  function requestRender(): void {
    if (!rendering && !renderNeeded() && clockMs >= nextRenderMs)
      nextRenderMs = frameAfter(clockMs);
  }

  /*
   * HTML Standard, timers ("run steps after a timeout"): a timer waits in parallel and
   * then queues a task. Timers come due in order of due time, then of registration.
   * A timer can therefore be due long before the loop is free to run its task.
   */
  function releaseDue(): Pending[] {
    const due = pending.filter((p) => p.dueMs <= clockMs);
    pending = pending.filter((p) => p.dueMs > clockMs);
    tasks.push(...due);
    return due;
  }

  function addPending(next: Pending): Pending[] {
    pending = [...pending, next].sort((a, b) => a.dueMs - b.dueMs || a.seq - b.seq);
    return releaseDue();
  }

  function released(due: readonly Pending[]): string {
    return due
      .map((p) =>
        p.resolves
          ? ` The response for ${callbacks.get(p.callback)!.label} arrived at ${p.dueMs} ms: its task joins the task queue.`
          : ` Timer ${p.label} came due at ${p.dueMs} ms: its task joins the task queue.`,
      )
      .join('');
  }

  function applyOp(op: Exclude<Op, { kind: 'call' }>, owner: Callback): string {
    switch (op.kind) {
      case 'log':
        output.push(op.text);
        return `console.log prints "${op.text}".`;
      case 'setTimeout': {
        const target = callbacks.get(op.callback)!;
        const dueMs = clockMs + op.delayMs;
        const due = addPending({ ...entry(target, 'timer'), dueMs, seq });
        return due.length > 0
          ? `setTimeout with ${op.delayMs} ms: ${target.label} joins the task queue at once. It is a task, never a microtask, so it waits for the stack and every microtask.`
          : `setTimeout hands ${target.label} to the timer, due at ${dueMs} ms. Nothing is queued yet.`;
      }
      case 'fetchResolve': {
        const target = callbacks.get(op.callback)!;
        const dueMs = clockMs + op.afterMs;
        addPending({
          ...entry(target, 'network'),
          label: 'fetch response',
          dueMs,
          seq,
          resolves: true,
        });
        return `fetch starts outside the loop. The response is due at ${dueMs} ms. A network task will then resolve the promise, and ${target.label} will run as a microtask.`;
      }
      case 'promiseThen':
      case 'queueMicrotask': {
        const target = callbacks.get(op.callback)!;
        microtasks.push(entry(target, ORIGIN_OF_MICROTASK[op.kind]!));
        return op.kind === 'promiseThen'
          ? `The promise is already resolved, so then() queues ${target.label} as a microtask. It still waits for the stack to empty.`
          : `queueMicrotask puts ${target.label} on the microtask queue.`;
      }
      case 'awaitResolved': {
        // ECMAScript Await: the continuation is a promise reaction job, one microtask hop,
        // even when the awaited value is already there.
        const target = callbacks.get(op.continuation)!;
        microtasks.push(entry(target, ORIGIN_OF_MICROTASK[op.kind]!));
        stack.pop();
        return `await pauses ${owner.label}, even for a resolved value. The rest of the function becomes one microtask, and control returns to the caller.`;
      }
      case 'requestAnimationFrame': {
        const target = callbacks.get(op.callback)!;
        requestRender();
        rafQueue.push(entry(target, 'rAF'));
        return `requestAnimationFrame keeps ${target.label} for the next rendering opportunity, at ${nextRenderMs} ms or later. It is neither a task nor a microtask.`;
      }
      case 'domWrite':
        requestRender();
        pendingPaint.push(op.text);
        return `The DOM changes (${op.text}), but the screen does not. Painting waits for a rendering opportunity.`;
      case 'blockFor': {
        const missedFrom = nextRenderMs;
        clockMs += op.ms;
        const due = releaseDue();
        const missed =
          renderNeeded() && clockMs >= missedFrom
            ? ` The rendering opportunity at ${missedFrom} ms passed: the loop was busy.`
            : '';
        return `Synchronous work holds the stack for ${op.ms} ms. The clock reads ${clockMs} ms.${released(due)}${missed}`;
      }
    }
  }

  /** Runs a callback body on the simulated stack. `started` emits the frame after the push. */
  function invoke(callback: Callback, started: () => void): void {
    const depth = stack.length;
    stack.push(callback.label);
    started();
    for (const op of callback.ops) {
      if (op.kind === 'call') {
        const callee = callbacks.get(op.callback)!;
        invoke(callee, () =>
          emit('op', op.line, `${callee.label}() is called and runs synchronously, now.`),
        );
      } else {
        emit('op', op.line, applyOp(op, callback));
      }
    }
    // An await has already popped the function; a plain return pops it here.
    stack.length = depth;
  }

  /* HTML Standard, "perform a microtask checkpoint": loop until the queue is empty. */
  function checkpoint(): void {
    let ran = 0;
    const inRender = phase === 'render';
    if (microtasks.length > 0) phase = 'microtasks';
    while (microtasks.length > 0) {
      const next = microtasks.shift()!;
      const callback = callbacks.get(next.callback)!;
      ran += 1;
      invoke(callback, () =>
        emit(
          'microtask-start',
          callback.line,
          `Microtask ${callback.label} runs (queued by ${next.origin}).${
            tasks.length > 0 ? ` The task queue waits: ${tasks[0]!.label} is still first.` : ''
          }`,
        ),
      );
    }
    if (ran === 0) return;
    const waiting =
      tasks.length > 0
        ? ` Only now can the loop look at the task queue: ${tasks[0]!.label} is next.`
        : '';
    const beforePaint = inRender ? ' All of it ran before the paint.' : waiting;
    emit(
      'checkpoint-end',
      null,
      `The microtask queue is empty after ${ran} ${ran === 1 ? 'microtask' : 'microtasks'}. The checkpoint ends.${beforePaint}`,
    );
    if (inRender) phase = 'render';
  }

  function runTask(task: Entry): void {
    phase = 'task';
    const callback = callbacks.get(task.callback)!;
    if (task.resolves) {
      // Fetch Standard: the response is delivered by a task on the networking task source.
      // Resolving the promise queues its reaction as a microtask of that task.
      stack.push('fetch response');
      microtasks.push(entry(callback, 'then'));
      emit(
        'task-start',
        null,
        `The loop takes the network task. It resolves the fetch promise, which queues ${callback.label} as a microtask.`,
      );
      stack.pop();
    } else {
      invoke(callback, () =>
        emit(
          'task-start',
          callback.line,
          task.origin === 'script'
            ? 'The loop takes the first task, the script, and runs it to completion.'
            : `The loop takes the oldest task, ${task.label} (${task.origin}), and runs it to completion.`,
        ),
      );
    }
    const count = microtasks.length;
    emit(
      'task-end',
      null,
      count > 0
        ? `Task ${task.label} is done and the stack is empty. A microtask checkpoint starts: ${count} ${count === 1 ? 'microtask waits' : 'microtasks wait'}.`
        : `Task ${task.label} is done and the stack is empty. The microtask queue is empty too.`,
    );
    checkpoint();
    phase = 'idle';
  }

  /* HTML Standard, "update the rendering". */
  function render(): void {
    phase = 'render';
    rendering = true;
    const late = clockMs - nextRenderMs;
    emit(
      'render-start',
      null,
      `Rendering opportunity at ${clockMs} ms${late > 0 ? `, ${late} ms late: it was due at ${nextRenderMs} ms` : ''}. ${
        rafQueue.length > 0
          ? 'Animation frame callbacks run first.'
          : 'No animation frame callbacks wait.'
      }`,
    );
    // "Run the animation frame callbacks" takes the list as it is now: a callback
    // registered during this frame runs in the next one.
    const batch = rafQueue.splice(0);
    for (const next of batch) {
      const callback = callbacks.get(next.callback)!;
      invoke(callback, () =>
        emit(
          'raf-start',
          callback.line,
          `Animation frame callback ${callback.label} runs, just before the paint.`,
        ),
      );
      // "Clean up after running script": the stack is empty, so microtasks run now.
      checkpoint();
    }
    const shown = pendingPaint.splice(0);
    for (const text of shown) painted.push({ text, atMs: clockMs });
    nextRenderMs = frameAfter(clockMs);
    emit(
      'paint',
      null,
      shown.length > 0
        ? `Style, layout and paint. The screen now shows: ${shown.join('; ')}.`
        : 'Style, layout and paint. Nothing changed on screen.',
    );
    rendering = false;
    phase = 'idle';
  }

  function renderIfDue(): void {
    if (clockMs < nextRenderMs) return;
    if (renderNeeded()) render();
    else nextRenderMs = frameAfter(clockMs);
  }

  /** Nothing can run: move the clock to the next thing that can wake the loop. */
  function wait(): boolean {
    const wakeups = [
      ...(pending.length > 0 ? [pending[0]!.dueMs] : []),
      ...(renderNeeded() ? [nextRenderMs] : []),
    ];
    if (wakeups.length === 0) return false;
    clockMs = Math.min(...wakeups);
    const due = releaseDue();
    const frameDue =
      renderNeeded() && clockMs >= nextRenderMs ? ' That is the next rendering opportunity.' : '';
    emit(
      'wait',
      null,
      `The stack and both queues are empty, so the loop waits. The clock reaches ${clockMs} ms.${released(due)}${frameDue}`,
    );
    return true;
  }

  try {
    const first = callbacks.get(scenario.entry.callback)!;
    tasks.push({ ...entry(first, scenario.entry.source), label: scenario.entry.label });
    emit(
      'start',
      null,
      scenario.entry.source === 'script'
        ? 'Nothing has run yet. The script is the first task in the task queue.'
        : `Nothing has run yet. The event put a task in the task queue: ${scenario.entry.label}.`,
    );
    for (;;) {
      if (tasks.length > 0) {
        runTask(tasks.shift()!);
        renderIfDue();
      } else if (clockMs >= nextRenderMs && renderNeeded()) {
        render();
      } else if (!wait()) {
        break;
      }
    }
    emit(
      'done',
      null,
      `Nothing is left to run. The loop idles until the next event. ${output.length} ${output.length === 1 ? 'line was' : 'lines were'} logged.`,
    );
  } catch (error) {
    if (error !== TRUNCATED) throw error;
    const last = frames[frames.length - 1]!;
    frames[frames.length - 1] = {
      ...last,
      kind: 'truncated',
      note: `Stopped after ${maxFrames} steps. This program never lets the loop rest, so on a real page later tasks and paints would starve.`,
    };
  }
  return frames;
}

/** Rejects a scenario the engine cannot run truthfully. Returns the callbacks by id. */
export function validate(scenario: Scenario): ReadonlyMap<string, Callback> {
  const fail = (message: string): never => {
    throw new Error(`Scenario "${scenario.id}": ${message}`);
  };
  const lineCount = scenario.source.split('\n').length;
  const checkLine = (line: number, where: string) => {
    if (!Number.isInteger(line) || line < 1 || line > lineCount)
      fail(`${where} points at line ${line}, outside the source`);
  };
  const checkMs = (ms: number, where: string) => {
    if (!Number.isFinite(ms) || ms < 0) fail(`${where} needs a duration of 0 ms or more`);
  };
  if (scenario.frameMs !== undefined && !(scenario.frameMs > 0))
    fail('frameMs must be greater than 0');

  const callbacks = new Map<string, Callback>();
  for (const callback of scenario.callbacks) {
    if (callbacks.has(callback.id)) fail(`callback "${callback.id}" is defined twice`);
    callbacks.set(callback.id, callback);
  }
  const mustExist = (id: string, where: string) => {
    if (!callbacks.has(id)) fail(`${where} refers to unknown callback "${id}"`);
  };
  mustExist(scenario.entry.callback, 'entry');

  for (const callback of scenario.callbacks) {
    checkLine(callback.line, `callback "${callback.id}"`);
    callback.ops.forEach((op, index) => {
      const where = `${callback.id}[${index}] ${op.kind}`;
      checkLine(op.line, where);
      if (op.kind === 'awaitResolved') {
        mustExist(op.continuation, where);
        if (index !== callback.ops.length - 1)
          fail(`${where} must be last: what follows an await belongs in its continuation`);
      } else if ('callback' in op) {
        mustExist(op.callback, where);
      }
      if (op.kind === 'setTimeout') checkMs(op.delayMs, where);
      if (op.kind === 'fetchResolve') checkMs(op.afterMs, where);
      if (op.kind === 'blockFor') checkMs(op.ms, where);
    });
  }
  return callbacks;
}
