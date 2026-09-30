/**
 * Installs the DOM before anything else in the React runtime is evaluated. It must be
 * the first import of runtime.ts: react-dom decides whether a DOM exists when its module
 * is first evaluated, and esbuild evaluates modules in import order.
 */
import { installDom } from './dom';

const host = globalThis as unknown as Record<string, unknown>;

/** Errors thrown by event listeners and React's reported errors, until a step rethrows them. */
export const pendingErrors: unknown[] = [];

function report(error: unknown): void {
  pendingErrors.push(error);
}

export const dom = installDom(host, report);

// React 19 hands errors from event handlers and effects to reportError. A worker would
// turn that into an uncaught error event, and a vm context has no reportError at all,
// so both runtimes collect them here and the step that caused them rethrows the first.
Object.defineProperty(host, 'reportError', { value: report, writable: true, configurable: true });
// Tells React that a test is driving it, so updates are expected inside act().
host.IS_REACT_ACT_ENVIRONMENT = true;
// The same answers in the browser worker and in the Node gate.
Object.defineProperty(host, 'navigator', {
  value: {
    userAgent: 'Understory sandbox',
    language: 'en-GB',
    languages: ['en-GB'],
    onLine: false,
  },
  writable: true,
  configurable: true,
});
Object.defineProperty(host, 'location', {
  value: {
    href: 'about:blank',
    origin: 'null',
    protocol: 'about:',
    host: '',
    hostname: '',
    pathname: 'blank',
    search: '',
    hash: '',
  },
  writable: true,
  configurable: true,
});

// ---- MessageChannel ------------------------------------------------------------------
// React's act() queues its async work through MessageChannel. A vm context has none, and
// a worker's native one would make the two runtimes schedule differently. A macrotask per
// message is what both need.

type Listener = (event: { data: unknown }) => void;

class ShimPort {
  onmessage: Listener | null = null;
  other: ShimPort | null = null;
  private listeners: Listener[] = [];

  postMessage(data: unknown): void {
    const target = this.other;
    if (!target) return;
    setTimeout(() => {
      const event = { data };
      target.onmessage?.(event);
      for (const listener of target.listeners) listener(event);
    }, 0);
  }

  addEventListener(type: string, listener: Listener): void {
    if (type === 'message') this.listeners.push(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    if (type === 'message') this.listeners = this.listeners.filter((l) => l !== listener);
  }

  start(): void {}
  close(): void {
    this.other = null;
  }
}

class ShimMessageChannel {
  readonly port1 = new ShimPort();
  readonly port2 = new ShimPort();
  constructor() {
    this.port1.other = this.port2;
    this.port2.other = this.port1;
  }
}

// ---- FormData ------------------------------------------------------------------------
// React 19 form actions call `new FormData(form)`. A worker's native FormData refuses the
// worker DOM's forms, and a vm context has none, so the runtime reads the fields itself,
// following the HTML "constructing the entry list" rules for the controls it models.

interface FieldLike {
  name?: string;
  type?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  tagName?: string;
  multiple?: boolean;
  options?: ArrayLike<{ selected?: boolean; value?: string }>;
  closest?: (selector: string) => unknown;
  querySelectorAll?: (selector: string) => ArrayLike<FieldLike>;
}

const SKIPPED_TYPES = new Set(['submit', 'button', 'reset', 'image', 'file']);

class ShimFormData {
  private entries_: [string, string][] = [];

  constructor(form?: FieldLike, submitter?: FieldLike | null) {
    if (!form?.querySelectorAll) return;
    for (const field of Array.from(form.querySelectorAll('input, select, textarea, button'))) {
      const name = field.name;
      if (!name || field.disabled === true) continue;
      if (field.closest?.('fieldset[disabled]')) continue;
      const tag = String(field.tagName ?? '').toLowerCase();
      const type = String(field.type ?? '').toLowerCase();
      if (tag === 'button' || SKIPPED_TYPES.has(type)) {
        if (field === submitter) this.append(name, String(field.value ?? ''));
        continue;
      }
      if ((type === 'checkbox' || type === 'radio') && field.checked !== true) continue;
      if (tag === 'select') {
        for (const option of Array.from(field.options ?? [])) {
          if (option.selected === true) this.append(name, String(option.value ?? ''));
        }
        continue;
      }
      const fallback = type === 'checkbox' || type === 'radio' ? 'on' : '';
      this.append(name, String(field.value ?? fallback) || fallback);
    }
  }

  append(name: string, value: unknown): void {
    this.entries_.push([String(name), String(value)]);
  }

  /** Replaces the first entry of that name and drops the rest, keeping its position. */
  set(name: string, value: unknown): void {
    const key = String(name);
    const at = this.entries_.findIndex(([k]) => k === key);
    if (at === -1) {
      this.entries_.push([key, String(value)]);
      return;
    }
    this.entries_ = this.entries_.flatMap((entry, index): [string, string][] => {
      if (index === at) return [[key, String(value)]];
      return entry[0] === key ? [] : [entry];
    });
  }

  get(name: string): string | null {
    return this.entries_.find(([k]) => k === String(name))?.[1] ?? null;
  }

  getAll(name: string): string[] {
    return this.entries_.filter(([k]) => k === String(name)).map(([, v]) => v);
  }

  has(name: string): boolean {
    return this.entries_.some(([k]) => k === String(name));
  }

  delete(name: string): void {
    this.entries_ = this.entries_.filter(([k]) => k !== String(name));
  }

  forEach(callback: (value: string, key: string, parent: ShimFormData) => void): void {
    for (const [k, v] of this.entries_) callback(v, k, this);
  }

  *entries(): IterableIterator<[string, string]> {
    yield* this.entries_.map(([k, v]): [string, string] => [k, v]);
  }

  *keys(): IterableIterator<string> {
    for (const [k] of this.entries_) yield k;
  }

  *values(): IterableIterator<string> {
    for (const [, v] of this.entries_) yield v;
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }
}

Object.defineProperty(host, 'MessageChannel', {
  value: ShimMessageChannel,
  writable: true,
  configurable: true,
});
Object.defineProperty(host, 'FormData', {
  value: ShimFormData,
  writable: true,
  configurable: true,
});

// React reads the clock for transitions and profiling. A worker has one; a vm context has
// none, and there Date.now is precise enough for tests.
if (typeof host.performance !== 'object' || host.performance === null) {
  Object.defineProperty(host, 'performance', {
    value: {
      now: () => Date.now(),
      timeOrigin: Date.now(),
      // React's development build writes User Timing marks when it sees a clock. None of
      // them matter to a test, so they record nothing.
      mark: () => undefined,
      measure: () => undefined,
      clearMarks: () => undefined,
      clearMeasures: () => undefined,
      getEntries: () => [],
      getEntriesByName: () => [],
      getEntriesByType: () => [],
    },
    writable: true,
    configurable: true,
  });
}
