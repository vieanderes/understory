import { createOnce, MAX_CREATES, SEARCH_LAG_MS, VendorError, type Deps, type Wholesaler } from './solution';

type Step = 'ok' | 'land-then-timeout' | VendorError;

// A fake wholesaler. A new order shows up in search only after the next sleep, like a lagging index.
function fake(script: Step[], alreadyPlaced: string[] = []) {
  const visible = new Map<string, string>(alreadyPlaced.map((ref) => [ref, `wo-old-${ref}`]));
  const pending = new Map<string, string>();
  const log = { creates: 0, sleeps: [] as number[], refreshed: [] as string[] };
  const vendor: Wholesaler = {
    async findByRef(ref) {
      const id = visible.get(ref);
      return id === undefined ? null : { id };
    },
    async createOrder(order) {
      log.creates += 1;
      const step = script.shift() ?? 'ok';
      if (step instanceof VendorError) throw step;
      const id = `wo-${log.creates}`;
      pending.set(order.ref, id);
      if (step === 'land-then-timeout') throw new VendorError('timeout');
      return { id };
    },
  };
  const deps: Deps = {
    async sleep(ms) {
      log.sleeps.push(ms);
      for (const [ref, id] of pending) visible.set(ref, id);
      pending.clear();
    },
    async refresh(vendorId) {
      log.refreshed.push(vendorId);
    },
  };
  return { vendor, deps, log };
}

const order = { ref: 'bk-1042', lines: [{ sku: 'flour-strong-16kg', quantity: 4 }] };

test('an order placed by an earlier run is found, not created again', async () => {
  const { vendor, deps, log } = fake([], ['bk-1042']);
  expect(await createOnce(vendor, order, deps)).toEqual({ ok: true, vendorId: 'wo-old-bk-1042', existed: true });
  expect(log.creates).toBe(0);
  expect(log.refreshed).toEqual(['wo-old-bk-1042']);
});

test('a clean create happens once and refreshes the new order', async () => {
  const { vendor, deps, log } = fake(['ok']);
  expect(await createOnce(vendor, order, deps)).toEqual({ ok: true, vendorId: 'wo-1', existed: false });
  expect(log.creates).toBe(1);
  expect(log.refreshed).toEqual(['wo-1']);
});

test('a timeout that landed waits for search, finds the order and stops', async () => {
  const { vendor, deps, log } = fake(['land-then-timeout']);
  expect(await createOnce(vendor, order, deps)).toEqual({ ok: true, vendorId: 'wo-1', existed: true });
  expect(log.sleeps).toEqual([SEARCH_LAG_MS]);
  expect(log.creates).toBe(1);
});

test('a 503 that never landed is created again after the lookup', async () => {
  const { vendor, deps, log } = fake([new VendorError(503), 'ok']);
  expect(await createOnce(vendor, order, deps)).toEqual({ ok: true, vendorId: 'wo-2', existed: false });
  expect(log.creates).toBe(2);
});

test('a validation error is not retried and comes back in words a baker understands', async () => {
  const { vendor, deps, log } = fake([new VendorError(422, 'unknown_sku')]);
  expect(await createOnce(vendor, order, deps)).toEqual({
    ok: false,
    action: 'fix-data',
    message: "One of the products isn't sold by the wholesaler any more.",
  });
  expect(log.creates).toBe(1);
  expect(log.sleeps).toEqual([]);
});

test('a revoked connection asks for a reconnect without retrying', async () => {
  const { vendor, deps, log } = fake([new VendorError(401, 'invalid_token')]);
  const result = await createOnce(vendor, order, deps);
  expect(result.ok).toBe(false);
  expect(result.ok ? '' : result.action).toBe('reconnect');
  expect(log.creates).toBe(1);
});

test('when nothing ever confirms, it stops after the last create and says so', async () => {
  const { vendor, deps, log } = fake([new VendorError('timeout'), new VendorError('timeout'), new VendorError('timeout')]);
  const result = await createOnce(vendor, order, deps);
  expect(result.ok ? '' : result.action).toBe('retry-later');
  expect(log.creates).toBe(MAX_CREATES);
});
