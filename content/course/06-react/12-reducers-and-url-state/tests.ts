import { todoReducer } from './solution';
import type { TodoState } from './solution';

function start(): TodoState {
  const todos = [
    { id: 1, text: 'Buy milk', done: false },
    { id: 2, text: 'Walk the dog', done: false },
  ];
  todos.forEach((todo) => Object.freeze(todo));
  Object.freeze(todos);
  return Object.freeze({ todos, nextId: 3 });
}

test('add appends a new todo with the next id', () => {
  const next = todoReducer(start(), { type: 'add', text: 'Call the bank' });
  expect(next.todos[2]).toEqual({ id: 3, text: 'Call the bank', done: false });
  expect(next.nextId).toBe(4);
});

test('toggle flips done on the matching todo only', () => {
  const next = todoReducer(start(), { type: 'toggle', id: 2 });
  expect(next.todos.map((todo) => todo.done)).toEqual([false, true]);
});

test('toggle keeps the other todos as the same objects', () => {
  const before = start();
  const next = todoReducer(before, { type: 'toggle', id: 2 });
  expect(next.todos[0] === before.todos[0]).toBe(true);
});

test('remove drops the matching todo', () => {
  const next = todoReducer(start(), { type: 'remove', id: 1 });
  expect(next.todos.map((todo) => todo.text)).toEqual(['Walk the dog']);
});

test('returns a new state object, never the old one changed', () => {
  const before = start();
  const next = todoReducer(before, { type: 'remove', id: 2 });
  expect(next === before).toBe(false);
  expect(before.todos).toHaveLength(2);
});
