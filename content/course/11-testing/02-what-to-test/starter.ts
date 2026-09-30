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
  // Add two tasks, then check what's left
}

export function testCompletingOne() {
  const list = createTodoList();
  // Add two tasks, complete one, then check what's left
}
