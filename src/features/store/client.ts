import { IdbEventStore } from '@/adapters/idb/event-store';
import { MemoryEventStore } from '@/adapters/memory/event-store';
import { systemClock } from '@/core/ports/clock';
import type { EventStore } from '@/core/ports/event-store';
import { uuidv7 } from '@/core/util/uuid';
import { localDateOf, ProgressStore } from './progress-store';

const CHANNEL = 'understory:log';

/** Randomness for ids comes from the platform's CSPRNG, behind core's Rng shape. */
const cryptoRng = {
  next(): number {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return (buffer[0] ?? 0) / 4294967296;
  },
};

function openEventStore(): { store: EventStore; durable: boolean } {
  // Private windows and locked-down browsers can refuse IndexedDB. Learning still works;
  // the shell tells the learner that this visit will not be kept.
  if (typeof indexedDB === 'undefined') return { store: new MemoryEventStore(), durable: false };
  return { store: new IdbEventStore(), durable: true };
}

let instance: ProgressStore | null = null;

/** One store per tab. Tabs tell each other about new events over a BroadcastChannel. */
export function getProgressStore(contentRev: string): ProgressStore {
  if (instance) return instance;

  const { store, durable } = openEventStore();
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);

  instance = new ProgressStore({
    store,
    durable,
    clock: systemClock,
    ids: { next: () => uuidv7(Date.now(), cryptoRng) },
    contentRev,
    localDate: localDateOf,
    newDeviceId: () => uuidv7(Date.now(), cryptoRng),
    onAppended: () => channel?.postMessage('appended'),
  });

  const created = instance;
  channel?.addEventListener('message', () => void created.reload());
  return created;
}

/**
 * Asks the browser not to evict the log. Safari deletes script-written storage after
 * seven days without a visit unless the site is installed or storage is persisted.
 * Asked once, after the first answer, when the learner has something to lose.
 */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
