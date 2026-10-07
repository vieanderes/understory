import { UnsupportedError, vendorBSource, type RawShow, type VendorBClient } from './solution';

function fakeClient(shows: RawShow[]) {
  const stats = { calls: 0 };
  const client: VendorBClient = {
    async fetchShows() {
      stats.calls += 1;
      return shows;
    },
  };
  return { client, stats };
}

const show: RawShow = {
  show_id: 901,
  title: 'The Long Field',
  start_utc: '2026-10-09T19:30:00Z',
  fields: { cf_17: '15', cf_22: 'Step-free access' },
};

test('declares that vendor B has no update filter, seat counts or webhooks', () => {
  const source = vendorBSource(fakeClient([]).client, {});
  expect(source.capabilities).toEqual({ updatedSince: false, seatCounts: false, webhooks: false });
});

test('maps a show to the common model, with seats unknown rather than zero', async () => {
  const [screening] = await vendorBSource(fakeClient([show]).client, {}).listScreenings();
  expect(screening?.remoteId).toBe('901');
  expect(screening?.film).toBe('The Long Field');
  expect(screening?.startsAt).toBe('2026-10-09T19:30:00Z');
  expect(screening?.seatsLeft).toBeNull();
});

test('keeps the raw payload untouched beside the mapped record', async () => {
  const [screening] = await vendorBSource(fakeClient([show]).client, {}).listScreenings();
  expect(screening?.raw).toEqual({
    show_id: 901,
    title: 'The Long Field',
    start_utc: '2026-10-09T19:30:00Z',
    fields: { cf_17: '15', cf_22: 'Step-free access' },
  });
});

test('custom holds only the fields this connection maps, under its names', async () => {
  const source = vendorBSource(fakeClient([show]).client, { cf_17: 'ageRating', cf_99: 'subtitles' });
  const [screening] = await source.listScreenings();
  expect(screening?.custom).toEqual({ ageRating: '15' });
});

test('two connections can map the same vendor field to different things', async () => {
  const twelve = vendorBSource(fakeClient([show]).client, { cf_17: 'ageRating' });
  const forty = vendorBSource(fakeClient([show]).client, { cf_22: 'access' });
  expect((await twelve.listScreenings())[0]?.custom).toEqual({ ageRating: '15' });
  expect((await forty.listScreenings())[0]?.custom).toEqual({ access: 'Step-free access' });
});

test('refuses an updatedSince filter before calling the vendor', async () => {
  const { client, stats } = fakeClient([show]);
  let caught: unknown;
  try {
    await vendorBSource(client, {}).listScreenings({ updatedSince: '2026-10-01T00:00:00Z' });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(UnsupportedError);
  expect((caught as UnsupportedError).feature).toBe('updatedSince');
  expect(stats.calls).toBe(0);
});
