import { login, me } from './solution';

let counter = 0;
const newId = () => `id-${++counter}-Wz7NjkFxJhj9giLE`;
const signIn = (user: string, password: string) =>
  login({ method: 'POST', path: '/login', body: JSON.stringify({ user, password }) }, newId);
const whoAmI = (cookie?: string) =>
  me({ method: 'GET', path: '/me', headers: cookie === undefined ? {} : { Cookie: cookie }, body: '' });

test('login sets a session cookie with all three flags', () => {
  const res = signIn('sam', 'sam-secret');
  expect(res.status).toBe(204);
  expect(res.headers?.['Set-Cookie']).toBe('sid=id-1-Wz7NjkFxJhj9giLE; Path=/; HttpOnly; Secure; SameSite=Lax');
});

test('the cookie from login gets you in', () => {
  const cookie = signIn('ana', 'ana-secret').headers?.['Set-Cookie'] ?? '';
  const sid = cookie.split(';')[0] ?? '';
  const res = whoAmI(sid);
  expect(res.status).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ user: 'ana' });
});

test('the session cookie is found among other cookies', () => {
  const cookie = signIn('ben', 'ben-secret').headers?.['Set-Cookie'] ?? '';
  const sid = cookie.split(';')[0] ?? '';
  expect(JSON.parse(whoAmI(`theme=dark; ${sid}`).body)).toEqual({ user: 'ben' });
});

test('a made-up session id is a 401', () => {
  expect(whoAmI('sid=abc123').status).toBe(401);
});

test('a cookie that claims a user name proves nothing', () => {
  expect(whoAmI('user=sam').status).toBe(401);
});

test('no cookie at all is a 401', () => {
  expect(whoAmI().status).toBe(401);
  expect(JSON.parse(whoAmI().body)).toEqual({ error: 'Not signed in' });
});

test('a wrong password gets a 401 and no cookie', () => {
  const res = signIn('sam', 'guess');
  expect(res.status).toBe(401);
  expect(res.headers?.['Set-Cookie']).toBe(undefined);
});
