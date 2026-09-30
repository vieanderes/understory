import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

type App = ReturnType<typeof createApp>;

let app: App;

beforeEach(() => {
  let n = 0;
  app = createApp({
    now: () => new Date('2026-01-01T09:00:00Z'),
    newId: () => `b${++n}`,
  });
});

const valid = {
  roomId: 'room-1',
  start: '2026-02-01T10:00:00Z',
  end: '2026-02-01T11:00:00Z',
  bookedBy: 'A. Person',
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.request('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function expectProblem(res: Response, status: number) {
  expect(res.status).toBe(status);
  expect(res.headers.get('Content-Type')).toContain('application/problem+json');
  const body = (await res.json()) as Record<string, unknown>;
  expect(body).toMatchObject({ status, title: expect.any(String), type: expect.any(String) });
  return body;
}

describe('POST /bookings', () => {
  it('creates a booking with 201 and a Location header', async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(res.headers.get('Location')).toBe('/bookings/b1');
    expect(await res.json()).toEqual({ id: 'b1', ...valid, createdAt: '2026-01-01T09:00:00.000Z' });
  });

  it('rejects invalid fields with a problem listing each one', async () => {
    const res = await post({ roomId: '', start: 'tomorrow', end: valid.end, bookedBy: 'x' });
    const body = await expectProblem(res, 400);
    const paths = (body.errors as Array<{ path: string }>).map((e) => e.path).sort();
    expect(paths).toEqual(['roomId', 'start']);
  });

  it('rejects an end before the start, naming end', async () => {
    const body = await expectProblem(
      await post({ ...valid, start: valid.end, end: valid.start }),
      400,
    );
    expect(body.errors).toEqual([{ path: 'end', message: expect.any(String) }]);
  });

  it('answers malformed JSON with a problem, not a crash', async () => {
    await expectProblem(await post('{"roomId": '), 400);
  });

  it('refuses an overlapping booking for the same room with 409', async () => {
    await post(valid);
    await expectProblem(
      await post({ ...valid, start: '2026-02-01T10:30:00Z', end: '2026-02-01T12:00:00Z' }),
      409,
    );
  });

  it('allows back-to-back bookings and the same slot in another room', async () => {
    await post(valid);
    const next = await post({ ...valid, start: valid.end, end: '2026-02-01T12:00:00Z' });
    const otherRoom = await post({ ...valid, roomId: 'room-2' });
    expect([next.status, otherRoom.status]).toEqual([201, 201]);
  });
});

describe('idempotency keys', () => {
  it('replays the stored response for a repeated key and body', async () => {
    const first = await post(valid, { 'Idempotency-Key': 'k1' });
    const second = await post(valid, { 'Idempotency-Key': 'k1' });
    expect(second.status).toBe(201);
    expect(second.headers.get('Idempotent-Replayed')).toBe('true');
    expect(await second.json()).toEqual(await first.json());

    const list = await (await app.request('/bookings')).json();
    expect(list.items).toHaveLength(1);
  });

  it('rejects the same key with a different body with 422', async () => {
    await post(valid, { 'Idempotency-Key': 'k1' });
    await expectProblem(
      await post({ ...valid, roomId: 'room-9' }, { 'Idempotency-Key': 'k1' }),
      422,
    );
  });

  it('treats requests without a key independently', async () => {
    await post(valid);
    await expectProblem(await post(valid), 409);
  });
});

describe('GET /bookings/:id', () => {
  it('returns a booking or a 404 problem', async () => {
    await post(valid);
    expect((await app.request('/bookings/b1')).status).toBe(200);
    await expectProblem(await app.request('/bookings/nope'), 404);
  });
});

describe('GET /bookings', () => {
  async function seed(count: number) {
    for (let i = 0; i < count; i += 1) {
      const hour = String(i).padStart(2, '0');
      await post({
        ...valid,
        roomId: i % 2 === 0 ? 'even' : 'odd',
        start: `2026-03-01T${hour}:00:00Z`,
        end: `2026-03-01T${hour}:30:00Z`,
      });
    }
  }

  it('pages through every booking in creation order with an opaque cursor', async () => {
    await seed(5);
    const seen: string[] = [];
    let url = '/bookings?limit=2';
    for (;;) {
      const page = (await (await app.request(url)).json()) as {
        items: Array<{ id: string }>;
        nextCursor: string | null;
      };
      seen.push(...page.items.map((b) => b.id));
      if (!page.nextCursor) break;
      expect(page.nextCursor).not.toMatch(/^\d+$/);
      url = `/bookings?limit=2&cursor=${encodeURIComponent(page.nextCursor)}`;
    }
    expect(seen).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
  });

  it('filters by room and ends with a null cursor', async () => {
    await seed(5);
    const page = await (await app.request('/bookings?roomId=odd&limit=10')).json();
    expect(page.items.map((b: { id: string }) => b.id)).toEqual(['b2', 'b4']);
    expect(page.nextCursor).toBeNull();
  });

  it('does not skip or repeat items when bookings are added between pages', async () => {
    await seed(3);
    const first = await (await app.request('/bookings?limit=2')).json();
    await post({ ...valid, roomId: 'late' });
    const second = await (
      await app.request(`/bookings?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`)
    ).json();
    expect(second.items.map((b: { id: string }) => b.id)).toEqual(['b3', 'b4']);
  });

  it('validates limit and cursor', async () => {
    await expectProblem(await app.request('/bookings?limit=0'), 400);
    await expectProblem(await app.request('/bookings?limit=101'), 400);
    await expectProblem(await app.request('/bookings?cursor=not-a-cursor'), 400);
  });
});

describe('unknown routes', () => {
  it('answer with a problem document', async () => {
    await expectProblem(await app.request('/nowhere'), 404);
  });
});
