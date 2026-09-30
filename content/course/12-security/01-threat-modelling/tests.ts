import { boundaryCrossings } from './solution';

const trust = { browser: 0, api: 1, database: 2, mailer: 1 };

test('data entering a more trusted part is a crossing', () => {
  const flows = [{ from: 'browser', to: 'api', data: 'order form' }];
  expect(boundaryCrossings(trust, flows)).toEqual(['order form from browser to api']);
});

test('data leaving for a less trusted part is not', () => {
  const flows = [{ from: 'api', to: 'browser', data: 'order page' }];
  expect(boundaryCrossings(trust, flows)).toEqual([]);
});

test('a flow between equals is not a crossing', () => {
  const flows = [{ from: 'api', to: 'mailer', data: 'receipt' }];
  expect(boundaryCrossings(trust, flows)).toEqual([]);
});

test('every crossing is listed, in order', () => {
  const flows = [
    { from: 'browser', to: 'api', data: 'login' },
    { from: 'api', to: 'database', data: 'query' },
    { from: 'database', to: 'api', data: 'rows' },
  ];
  expect(boundaryCrossings(trust, flows)).toEqual(['login from browser to api', 'query from api to database']);
});

test('a flow naming an unknown part is skipped', () => {
  const flows = [{ from: 'cdn', to: 'api', data: 'ping' }];
  expect(boundaryCrossings(trust, flows)).toEqual([]);
});
