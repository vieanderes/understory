import { callback, type Session } from './solution';

const exchange = (code: string) => (code === 'c_attacker' ? 'eve' : 'sam');

test('a matching state and a code sign the user in', () => {
  const session: Session = { state: 'IVH3ao3F' };
  const res = callback({ code: 'c_m5ryo3wz', state: 'IVH3ao3F' }, session, exchange);
  expect(res.status).toBe(302);
  expect(res.headers?.Location).toBe('/');
  expect(session.user).toBe('sam');
});

test('a code the app never asked for is refused', () => {
  const session: Session = { state: 'IVH3ao3F' };
  const res = callback({ code: 'c_attacker', state: 'forged' }, session, exchange);
  expect(res.status).toBe(400);
  expect(JSON.parse(res.body)).toEqual({ error: 'State does not match' });
  expect(session.user).toBe(undefined);
});

test('a callback with no state is refused', () => {
  const session: Session = { state: 'IVH3ao3F' };
  expect(callback({ code: 'c_attacker' }, session, exchange).status).toBe(400);
  expect(session.user).toBe(undefined);
});

test('a callback the app never started is refused, even with no state on either side', () => {
  const session: Session = {};
  expect(callback({ code: 'c_attacker' }, session, exchange).status).toBe(400);
  expect(session.user).toBe(undefined);
});

test('a missing code is a 400', () => {
  const session: Session = { state: 'IVH3ao3F' };
  const res = callback({ state: 'IVH3ao3F' }, session, exchange);
  expect(res.status).toBe(400);
  expect(JSON.parse(res.body)).toEqual({ error: 'Missing code' });
});

test('a state works only once', () => {
  const session: Session = { state: 'IVH3ao3F' };
  callback({ code: 'c_m5ryo3wz', state: 'IVH3ao3F' }, session, exchange);
  session.user = undefined;
  expect(callback({ code: 'c_attacker', state: 'IVH3ao3F' }, session, exchange).status).toBe(400);
  expect(session.user).toBe(undefined);
});
