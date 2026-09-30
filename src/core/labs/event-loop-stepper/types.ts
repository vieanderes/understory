/*
 * The script DSL of the event loop stepper. A program is never parsed or evaluated: each
 * callback body is an ordered list of typed operations, and the display source is a string
 * with a line number per operation. That keeps the engine honest (it can only do what the
 * processing model defines) and portable to Swift against the same fixtures.
 */

export type CallbackId = string;

interface OpBase {
  /** 1-based line of the display source that this operation comes from. */
  line: number;
}

export type Op =
  | (OpBase & { kind: 'log'; text: string })
  /** A synchronous call. An async function runs synchronously up to its first await. */
  | (OpBase & { kind: 'call'; callback: CallbackId })
  | (OpBase & { kind: 'setTimeout'; callback: CallbackId; delayMs: number })
  /** A reaction on an already-resolved promise: `Promise.resolve().then(cb)`. */
  | (OpBase & { kind: 'promiseThen'; callback: CallbackId })
  | (OpBase & { kind: 'queueMicrotask'; callback: CallbackId })
  /** The rest of an async function after `await` of a resolved value. Last in its body. */
  | (OpBase & { kind: 'awaitResolved'; continuation: CallbackId })
  | (OpBase & { kind: 'requestAnimationFrame'; callback: CallbackId })
  /** Synchronous work that holds the stack while the clock runs. */
  | (OpBase & { kind: 'blockFor'; ms: number })
  /** `fetch(url).then(cb)`: a network task resolves the promise after `afterMs`. */
  | (OpBase & { kind: 'fetchResolve'; callback: CallbackId; afterMs: number })
  /** A DOM write. Nothing reaches the screen until the next rendering step. */
  | (OpBase & { kind: 'domWrite'; text: string });

export interface Callback {
  id: CallbackId;
  /** The name shown on the call stack and in the queues. */
  label: string;
  /** 1-based line where the callback is declared. */
  line: number;
  ops: readonly Op[];
}

export interface Scenario {
  id: string;
  title: string;
  /** Asked before the first step, because predicting first is what makes the lab teach. */
  prompt: string;
  /** The program as the learner reads it. */
  source: string;
  /** The first task: the script itself, or an event such as a click. */
  entry: { callback: CallbackId; label: string; source: 'script' | 'event' };
  callbacks: readonly Callback[];
  /** Milliseconds between rendering opportunities. 16 stands in for a 60 Hz display. */
  frameMs?: number;
}

export type FrameKind =
  | 'start'
  | 'task-start'
  | 'op'
  | 'task-end'
  | 'microtask-start'
  | 'checkpoint-end'
  | 'wait'
  | 'render-start'
  | 'raf-start'
  | 'paint'
  | 'done'
  | 'truncated';

/** Which part of the loop is active. The view gives it the weight, not a colour. */
export type Phase = 'idle' | 'task' | 'microtasks' | 'render';

export interface QueueItem {
  /** Stable for the life of the entry, also when a timer becomes a task. */
  key: string;
  label: string;
  /** Where it came from: "timer", "then", "await", "network", "script", "event". */
  origin: string;
}

export interface PendingItem extends QueueItem {
  dueMs: number;
}

export interface Painted {
  text: string;
  atMs: number;
}

export interface Frame {
  kind: FrameKind;
  phase: Phase;
  /** The source line to mark, or null when no code is running. */
  line: number | null;
  /** Bottom of the stack first. */
  stack: readonly string[];
  /** Oldest first, in all queues. */
  microtasks: readonly QueueItem[];
  tasks: readonly QueueItem[];
  /** Timers and network requests that wait outside the loop, soonest first. */
  timers: readonly PendingItem[];
  rafQueue: readonly QueueItem[];
  output: readonly string[];
  clockMs: number;
  nextRenderMs: number;
  /** DOM writes that no rendering step has shown yet. */
  pendingPaint: readonly string[];
  painted: readonly Painted[];
  /** What this step did, in plain words. */
  note: string;
}

export interface RunOptions {
  /** A program that never lets the microtask queue empty would never end. */
  maxFrames?: number;
}
