export function createTodoList() {
  const items: { title: string; done: boolean }[] = [];
  return {
    items,
    add(title: string) {
      items.push({ title, done: false });
    },
    complete(title: string) {
      for (const item of items) if (item.title === title) item.done = true;
    },
    remaining() {
      return items.filter((item) => !item.done).length;
    },
  };
}

export function testAddingCounts() {
  const list = createTodoList();
  list.add('Buy milk');
  list.add('Call the plumber');
  expect(list.remaining()).toBe(2);
}

export function testCompletingOne() {
  const list = createTodoList();
  list.add('Buy milk');
  list.add('Call the plumber');
  list.complete('Buy milk');
  expect(list.remaining()).toBe(1);
}
