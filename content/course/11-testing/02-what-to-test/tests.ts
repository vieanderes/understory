import { testAddingCounts, testCompletingOne } from './solution';

interface TodoList {
  add(title: string): void;
  complete(title: string): void;
  remaining(): number;
}
type MakeList = () => TodoList;

// Your code and these checks run as one script, so this is your `createTodoList`. Each
// check swaps in another version, runs your tests, then puts the real one back.
declare let createTodoList: MakeList;
const real = createTodoList;
const yours = [testAddingCounts, testCompletingOne];

function failureOf(version: MakeList, check: () => void): string | null {
  createTodoList = version;
  try {
    check();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    createTodoList = real;
  }
}

function expectAllPass(version: MakeList, where: string) {
  for (const check of yours) {
    const failure = failureOf(version, check);
    if (failure !== null) throw new Error(`${check.name} fails on ${where}: ${failure}`);
  }
}

function expectCaught(version: MakeList, hint: string) {
  if (yours.every((check) => failureOf(version, check) === null)) {
    throw new Error(`Both tests still pass. ${hint}`);
  }
}

// Behaves like the real list from outside, but counts open titles in a Map and has no `items`.
const rewrite: MakeList = () => {
  const open = new Map<string, number>();
  return {
    add(title) {
      open.set(title, (open.get(title) ?? 0) + 1);
    },
    complete(title) {
      open.delete(title);
    },
    remaining() {
      let count = 0;
      for (const n of open.values()) count = count + n;
      return count;
    },
  };
};

test('your tests pass on the real list', () => {
  expectAllPass(real, 'the real list');
});

test('they still pass after a rewrite that keeps the behaviour', () => {
  expectAllPass(rewrite, 'a correct rewrite. Test through add, complete and remaining only');
});

test('they catch a complete that does nothing', () => {
  expectCaught(() => {
    let count = 0;
    return { add: () => (count = count + 1), complete: () => {}, remaining: () => count };
  }, 'Complete a task, then check what is left.');
});

test('they catch a complete that ticks off every task', () => {
  expectCaught(() => {
    let count = 0;
    return { add: () => (count = count + 1), complete: () => (count = 0), remaining: () => count };
  }, 'Have two tasks when you complete one.');
});
