import { handle } from './solution';

const send = (method: string, path: string, body = '') => handle({ method, path, body });

test('GET /books still lists the books', () => {
  const res = send('GET', '/books');
  expect(res.status).toBe(200);
  expect(JSON.parse(res.body)[0].title).toBe('Emma');
});

test('POST /books answers 201 with the new book', () => {
  const res = send('POST', '/books', '{"title":"Persuasion"}');
  expect(res.status).toBe(201);
  expect(JSON.parse(res.body)).toEqual({ id: 2, title: 'Persuasion' });
});

test('POST /books says where the new book lives', () => {
  const res = send('POST', '/books', '{"title":"Emma"}');
  expect(res.headers.Location).toBe('/books/3');
});

test('DELETE /books/2 answers 204 with no body', () => {
  const res = send('DELETE', '/books/2');
  expect(res.status).toBe(204);
  expect(res.body).toBe('');
});

test('deleting the same book again is a 404', () => {
  send('DELETE', '/books/1');
  expect(send('DELETE', '/books/1').status).toBe(404);
});

test('a wrong method on /books is a 405 that lists the right ones', () => {
  const res = send('PUT', '/books');
  expect(res.status).toBe(405);
  expect(res.headers.Allow).toBe('GET, POST');
});

test('an unknown path is still a 404', () => {
  expect(send('GET', '/authors').status).toBe(404);
});
