import type { Clock } from '@/core/ports/clock';
import type { EventStore, StoredEvent } from '@/core/ports/event-store';
import type { IdGen } from '@/core/ports/id-gen';
import {
  applyEvent,
  initialProgressState,
  isUnknownEvent,
  makeEvent,
  reduce,
  upcast,
  type EventType,
  type PayloadOf,
  type ProgressState,
  type StoryEvent,
} from '@/core/progress';
export type StoreStatus = 'loading' | 'ready';

export interface StoreSnapshot {
  readonly status: StoreStatus;
  readonly state: ProgressState;
  readonly eventCount: number;
  /** False when IndexedDB was refused and progress lives in memory for this visit only. */
  readonly durable: boolean;
}

export interface ProgressStoreDeps {
  store: EventStore;
  clock: Clock;
  ids: IdGen;
  contentRev: string;
  /** The learner's calendar date, `YYYY-MM-DD`. Weekly goals follow their clock, not UTC. */
  localDate: (now: Date) => string;
  newDeviceId: () => string;
  durable?: boolean;
  /** Called after a successful append, so other tabs can reload. */
  onAppended?: () => void;
}

export const EXPORT_FORMAT = 'understory-export';
export const EXPORT_VERSION = 1;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  events: StoredEvent[];
}

const LOADING: StoreSnapshot = {
  status: 'loading',
  state: initialProgressState(),
  eventCount: 0,
  durable: true,
};

/**
 * The client's read model. It folds the event log into a ProgressState once at start,
 * then applies each new event incrementally, so recording an answer costs one reducer
 * step and one IndexedDB write. React reads it through useSyncExternalStore.
 *
 * The UI is updated before the write settles. If the write fails the event is kept in
 * memory and the snapshot says the visit is no longer durable, which the shell shows.
 */
export class ProgressStore {
  private snapshot: StoreSnapshot = LOADING;
  private readonly listeners = new Set<() => void>();
  private deviceId = '';
  private seq = 0;
  private ready: Promise<void> | null = null;

  constructor(private readonly deps: ProgressStoreDeps) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StoreSnapshot => this.snapshot;

  /** Safe to call many times. The log is read once. */
  init(): Promise<void> {
    this.ready ??= this.load();
    return this.ready;
  }

  /** Re-reads the log, for when another tab has written to it. */
  async reload(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    const { store } = this.deps;
    let deviceId = await store.getMeta('deviceId');
    if (!deviceId) {
      deviceId = this.deps.newDeviceId();
      await store.setMeta('deviceId', deviceId);
    }
    this.deviceId = deviceId;

    const raw = await store.readAll();
    const events = raw.map(upcast);
    // Continue this device's own sequence, whatever other devices have written.
    this.seq = events.reduce(
      (max, e) => (!isUnknownEvent(e) && e.deviceId === deviceId ? Math.max(max, e.seq) : max),
      0,
    );
    this.set({
      status: 'ready',
      state: reduce(events),
      eventCount: raw.length,
      durable: this.deps.durable ?? true,
    });
  }

  async record<T extends EventType>(type: T, payload: PayloadOf<T>): Promise<StoryEvent> {
    await this.init();
    const now = this.deps.clock.now();
    const event = makeEvent(
      {
        clock: { now: () => now },
        ids: this.deps.ids,
        deviceId: this.deviceId,
        nextSeq: () => ++this.seq,
        contentRev: this.deps.contentRev,
        localDate: this.deps.localDate(now),
      },
      type,
      payload,
    );

    this.set({
      ...this.snapshot,
      state: applyEvent(this.snapshot.state, event),
      eventCount: this.snapshot.eventCount + 1,
    });

    try {
      await this.deps.store.append([event as unknown as StoredEvent]);
      this.deps.onAppended?.();
    } catch {
      this.set({ ...this.snapshot, durable: false });
    }
    return event;
  }

  async exportFile(): Promise<ExportFile> {
    await this.init();
    return {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: this.deps.clock.now().toISOString(),
      events: await this.deps.store.readAll(),
    };
  }

  /**
   * Merges a file into the log. Import is a union, exactly like sync will be: events
   * already present are skipped, nothing is overwritten, and the result does not depend
   * on the order of imports. Returns how many events were new.
   */
  async importFile(file: unknown): Promise<number> {
    await this.init();
    if (!isExportFile(file)) throw new Error('This is not an Understory export file.');
    const before = await this.deps.store.count();
    await this.deps.store.append(file.events);
    await this.load();
    this.deps.onAppended?.();
    return this.snapshot.eventCount - before;
  }

  async reset(): Promise<void> {
    await this.init();
    await this.deps.store.clear();
    await this.load();
    this.deps.onAppended?.();
  }

  private set(next: StoreSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}

function isExportFile(value: unknown): value is ExportFile {
  if (typeof value !== 'object' || value === null) return false;
  const file = value as Partial<ExportFile>;
  return (
    file.format === EXPORT_FORMAT &&
    file.version === EXPORT_VERSION &&
    Array.isArray(file.events) &&
    file.events.every(
      (e) => typeof e === 'object' && e !== null && typeof (e as StoredEvent).id === 'string',
    )
  );
}

/** `YYYY-MM-DD` on the learner's own calendar. */
export function localDateOf(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
