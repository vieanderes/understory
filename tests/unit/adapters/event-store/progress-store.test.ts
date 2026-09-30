import { describe, expect, it, vi } from 'vitest';
import { MemoryEventStore } from '@/adapters/memory/event-store';
import { fixedClock } from '@/core/ports/clock';
import type { EventStore } from '@/core/ports/event-store';
import { localDateOf, ProgressStore } from '@/features/store/progress-store';

function makeStore(store: EventStore = new MemoryEventStore(), device = 'device-a') {
  let n = 0;
  return new ProgressStore({
    store,
    clock: fixedClock('2026-09-17T10:00:00Z'),
    ids: {
      next: () => `0190a000-0000-7000-8000-${String(++n).padStart(12, '0')}-${device}`.slice(0, 36),
    },
    contentRev: 'rev1',
    localDate: () => '2026-09-17',
    newDeviceId: () => device,
  });
}

const tier = { tier: 'steady' } as const;

describe('ProgressStore', () => {
  it('is loading until init, then ready with an empty state', async () => {
    const store = makeStore();
    expect(store.getSnapshot().status).toBe('loading');
    await store.init();
    expect(store.getSnapshot().status).toBe('ready');
    expect(store.getSnapshot().eventCount).toBe(0);
  });

  it('applies a recorded event at once and notifies subscribers', async () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    await store.record('goal_tier_set', tier);
    expect(store.getSnapshot().state.goalTier).toBe('steady');
    expect(listener).toHaveBeenCalled();
  });

  it('survives a restart: a second store over the same log folds to the same state', async () => {
    const log = new MemoryEventStore();
    await makeStore(log).record('goal_tier_set', tier);
    const second = makeStore(log);
    await second.init();
    expect(second.getSnapshot().state.goalTier).toBe('steady');
    expect(second.getSnapshot().eventCount).toBe(1);
  });

  it('keeps one device id and continues its sequence after a restart', async () => {
    const log = new MemoryEventStore();
    const first = await makeStore(log).record('goal_tier_set', tier);
    const second = await makeStore(log, 'ignored-because-one-exists').record('goal_tier_set', {
      tier: 'deep',
    });
    expect(second.deviceId).toBe(first.deviceId);
    expect(second.seq).toBe(first.seq + 1);
  });

  it('stays usable when the write fails, and says the visit is not durable', async () => {
    const log = new MemoryEventStore();
    log.append = () => Promise.reject(new Error('quota'));
    const store = makeStore(log);
    await store.record('goal_tier_set', tier);
    expect(store.getSnapshot().state.goalTier).toBe('steady');
    expect(store.getSnapshot().durable).toBe(false);
  });

  it('exports the log and imports it elsewhere as a union', async () => {
    const a = makeStore(new MemoryEventStore(), 'device-a');
    await a.record('goal_tier_set', tier);
    const file = JSON.parse(JSON.stringify(await a.exportFile()));

    const b = makeStore(new MemoryEventStore(), 'device-b');
    expect(await b.importFile(file)).toBe(1);
    expect(await b.importFile(file)).toBe(0);
    expect(b.getSnapshot().state.goalTier).toBe('steady');
  });

  it('carries a decision record and its edit through export and import', async () => {
    const a = makeStore(new MemoryEventStore(), 'device-a');
    await a.record('capstone_completed', { moduleId: 'servers' });
    await a.record('capstone_adr_written', {
      partId: 'servers',
      title: 'Keep sessions in memory',
      decision: 'A map in memory.',
    });
    await a.record('capstone_adr_written', {
      partId: 'servers',
      title: 'Keep sessions in the database',
      decision: 'A sessions table.',
      consequences: 'One more query per request.',
    });
    const file = JSON.parse(JSON.stringify(await a.exportFile()));

    const b = makeStore(new MemoryEventStore(), 'device-b');
    expect(await b.importFile(file)).toBe(3);
    expect(b.getSnapshot().state.capstoneAdrs).toEqual(a.getSnapshot().state.capstoneAdrs);
    expect(b.getSnapshot().state.capstoneAdrs.servers).toMatchObject({
      title: 'Keep sessions in the database',
      consequences: 'One more query per request.',
      revisions: 2,
    });
  });

  it('refuses a file that is not an export', async () => {
    const store = makeStore();
    await expect(store.importFile({ events: [] })).rejects.toThrow(/not an Understory export/);
    await expect(store.importFile('nope')).rejects.toThrow();
  });

  it('keeps events from a newer app version through export and import', async () => {
    const log = new MemoryEventStore();
    await log.append([{ id: 'future-1', type: 'hologram_watched', v: 3, payload: {} }]);
    const store = makeStore(log);
    await store.init();
    expect(store.getSnapshot().status).toBe('ready');
    expect((await store.exportFile()).events.map((e) => e.id)).toContain('future-1');
  });

  it('resets to empty', async () => {
    const store = makeStore();
    await store.record('goal_tier_set', tier);
    await store.reset();
    expect(store.getSnapshot().eventCount).toBe(0);
    expect(store.getSnapshot().state.goalTier).toBeUndefined();
  });
});

describe('localDateOf', () => {
  it('pads month and day', () => {
    expect(localDateOf(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});
