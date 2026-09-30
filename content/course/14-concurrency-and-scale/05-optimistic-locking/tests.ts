import { saveWithRetry, type Store, type Ticket } from './solution';

// An in-memory store. `rivalSaves` is how many times another writer saves between a read
// and our save.
function makeStore(rivalSaves: number) {
  let row = { data: { title: 'Refund not received', labels: ['billing'] } as Ticket, version: 1 };
  const stats = { reads: 0 };
  let rivalsLeft = rivalSaves;
  const store: Store = {
    async read() {
      stats.reads += 1;
      return { data: { ...row.data, labels: [...row.data.labels] }, version: row.version };
    },
    async saveIf(_id, version, data) {
      if (rivalsLeft > 0) {
        rivalsLeft -= 1;
        row = { data: { ...row.data, labels: [...row.data.labels, `rival-${rivalsLeft}`] }, version: row.version + 1 };
      }
      if (version !== row.version) return false;
      row = { data, version: row.version + 1 };
      return true;
    },
  };
  return { store, stats, current: () => row };
}

const addUrgent = (ticket: Ticket): Ticket => ({ ...ticket, labels: [...ticket.labels, 'urgent'] });

test('with no rival, one read and one save', async () => {
  const { store, stats, current } = makeStore(0);
  await saveWithRetry(store, 't1', addUrgent);
  expect(stats.reads).toBe(1);
  expect(current().data.labels).toEqual(['billing', 'urgent']);
});

test('after a refused save, it reads again and keeps the rival change', async () => {
  const { store, stats, current } = makeStore(1);
  const saved = await saveWithRetry(store, 't1', addUrgent);
  expect(stats.reads).toBe(2);
  expect(current().data.labels).toEqual(['billing', 'rival-0', 'urgent']);
  expect(saved.labels).toEqual(['billing', 'rival-0', 'urgent']);
});

test('two refusals still end in a save on the third attempt', async () => {
  const { store, stats, current } = makeStore(2);
  await saveWithRetry(store, 't1', addUrgent);
  expect(stats.reads).toBe(3);
  expect(current().data.labels).toContain('urgent');
});

test('three refusals throw, after exactly three attempts', async () => {
  const { store, stats, current } = makeStore(5);
  let error: unknown = null;
  try {
    await saveWithRetry(store, 't1', addUrgent);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(Error);
  expect(stats.reads).toBe(3);
  expect(current().data.labels).not.toContain('urgent');
});
