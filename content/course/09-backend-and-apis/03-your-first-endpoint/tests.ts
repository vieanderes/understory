import { handle } from './solution';

const get = (path: string) => handle({ method: 'GET', path, body: '' });
const read = (path: string) => JSON.parse(get(path).body);

test('GET /todos still lists the to-dos', () => {
  expect(get('/todos').status).toBe(200);
  expect(read('/todos')[0].title).toBe('Buy milk');
});

test('POST /todos adds a to-do and answers 201 with it', () => {
  const res = handle({ method: 'POST', path: '/todos', body: '{"title":"Call Sam"}' });
  expect(res.status).toBe(201);
  expect(JSON.parse(res.body)).toEqual({ id: 2, title: 'Call Sam', done: false });
  expect(read('/todos')).toHaveLength(2);
});

test('each new to-do gets the next id', () => {
  const res = handle({ method: 'POST', path: '/todos', body: '{"title":"Water plants"}' });
  expect(JSON.parse(res.body).id).toBe(3);
});

test('GET /todos/1 reads one to-do', () => {
  expect(get('/todos/1').status).toBe(200);
  expect(read('/todos/1')).toEqual({ id: 1, title: 'Buy milk', done: false });
});

test('a to-do that does not exist is a 404', () => {
  expect(get('/todos/99').status).toBe(404);
  expect(read('/todos/99')).toEqual({ error: 'Not found' });
});

test('an unknown path or method is still a 404', () => {
  expect(get('/users').status).toBe(404);
  expect(handle({ method: 'DELETE', path: '/todos', body: '' }).status).toBe(404);
});
