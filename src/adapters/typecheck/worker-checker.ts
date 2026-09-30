import type { TypeCheckOutcome, TypeCheckRequest, TypeChecker } from '@/core/ports/type-checker';
import { LIMITS } from '@/core/running/limits';
import { normaliseDiagnostics } from '@/core/typecheck/diagnostics';
import { checkReplySchema, type CheckRequest } from '@/core/typecheck/protocol';
import { checkerWorkerUrl } from './assets';

/** The part of a DOM `Worker` the checker uses, so tests can hand it a fake. */
export interface CheckerWorker {
  postMessage(message: CheckRequest): void;
  addEventListener(type: 'message' | 'error', listener: (event: { data?: unknown }) => void): void;
  terminate(): void;
}

export interface WorkerCheckerOptions {
  createWorker?: () => Promise<CheckerWorker>;
  /** A check on a warm worker takes milliseconds. This only catches a wedged one. */
  timeoutMs?: number;
  /** The first check includes downloading the compiler, about 1 MB, on a slow phone. */
  firstTimeoutMs?: number;
}

interface Pending {
  code: string;
  resolve: (outcome: TypeCheckOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

const unavailable = (reason: string): TypeCheckOutcome => ({ status: 'unavailable', reason });

/** A same-origin classic worker: the app's CSP allows `worker-src 'self'`. */
async function createBrowserWorker(): Promise<CheckerWorker> {
  const url = await checkerWorkerUrl();
  return new Worker(url, { name: 'typecheck' }) as unknown as CheckerWorker;
}

/**
 * The page's side of the type-checker worker. One worker answers every check in order;
 * a check never rejects. When the worker cannot be loaded (offline before it was ever
 * fetched) or stops answering, checks resolve `unavailable` and the next one starts a
 * fresh worker, so a learner is never stuck behind the checker.
 */
export class WorkerTypeChecker implements TypeChecker {
  private readonly createWorker: () => Promise<CheckerWorker>;
  private readonly timeoutMs: number;
  private readonly firstTimeoutMs: number;
  private worker: Promise<CheckerWorker> | null = null;
  private answered = false;
  private readonly pending = new Map<number, Pending>();
  private nextId = 0;

  constructor(options: WorkerCheckerOptions = {}) {
    this.createWorker = options.createWorker ?? createBrowserWorker;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.firstTimeoutMs = options.firstTimeoutMs ?? 60_000;
  }

  async check(request: TypeCheckRequest): Promise<TypeCheckOutcome> {
    if (
      request.code.length > LIMITS.maxSourceBytes ||
      request.tests.length > LIMITS.maxSourceBytes
    ) {
      return unavailable('The code is too long to check.');
    }
    let worker: CheckerWorker;
    try {
      worker = await this.start();
    } catch {
      this.worker = null;
      return unavailable('The type checker did not load.');
    }
    const id = this.nextId;
    this.nextId += 1;
    return new Promise<TypeCheckOutcome>((resolve) => {
      const timer = setTimeout(
        () => this.reset('The type checker did not answer.'),
        this.answered ? this.timeoutMs : this.firstTimeoutMs,
      );
      this.pending.set(id, { code: request.code, resolve, timer });
      worker.postMessage({ v: 1, id, code: request.code, tests: request.tests });
    });
  }

  dispose(): void {
    this.reset('The type checker was closed.');
  }

  private start(): Promise<CheckerWorker> {
    this.worker ??= this.createWorker().then((worker) => {
      worker.addEventListener('message', (event) => this.receive(event.data));
      // A worker whose script failed to load or threw at the top level is of no more use.
      worker.addEventListener('error', () => this.reset('The type checker did not load.'));
      return worker;
    });
    return this.worker;
  }

  private receive(data: unknown): void {
    const reply = checkReplySchema.safeParse(data);
    // A reply that does not parse cannot be matched to a check; its timer ends it.
    if (!reply.success) return;
    const pending = this.pending.get(reply.data.id);
    if (!pending) return;
    this.pending.delete(reply.data.id);
    clearTimeout(pending.timer);
    this.answered = true;
    pending.resolve(
      'failure' in reply.data
        ? unavailable('The type checker failed on this code.')
        : {
            status: 'checked',
            diagnostics: normaliseDiagnostics(reply.data.diagnostics, pending.code),
          },
    );
  }

  /** Ends every pending check and drops the worker; the next check starts a new one. */
  private reset(reason: string): void {
    const worker = this.worker;
    this.worker = null;
    this.answered = false;
    void worker?.then((w) => w.terminate()).catch(() => undefined);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.resolve(unavailable(reason));
    }
    this.pending.clear();
  }
}
