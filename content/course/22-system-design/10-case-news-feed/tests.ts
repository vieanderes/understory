import { mergeFeed, type Post } from './solution';

const p = (id: string, at: number, author = 'friend'): Post => ({ id, author, at });

test('merges pushed and pulled posts, newest first', () => {
  const out = mergeFeed([p('a', 10), p('b', 5)], [[p('c', 8, 'star')]], 10);
  expect(out.map((x) => x.id)).toEqual(['a', 'c', 'b']);
});

test('takes posts from several celebrities', () => {
  const out = mergeFeed([p('a', 3)], [[p('s1', 9, 'star1')], [p('s2', 6, 'star2')]], 10);
  expect(out.map((x) => x.id)).toEqual(['s1', 's2', 'a']);
});

test('keeps at most limit posts', () => {
  const out = mergeFeed([p('a', 4), p('b', 3)], [[p('c', 2), p('d', 1)]], 2);
  expect(out.map((x) => x.id)).toEqual(['a', 'b']);
});

test('drops a post that arrives both ways', () => {
  const out = mergeFeed([p('a', 7)], [[p('a', 7)]], 10);
  expect(out.map((x) => x.id)).toEqual(['a']);
});

test('works with nothing pulled', () => {
  expect(mergeFeed([p('a', 1)], [], 5).map((x) => x.id)).toEqual(['a']);
});

test('a limit of 0 gives an empty feed', () => {
  expect(mergeFeed([p('a', 1)], [[p('b', 2)]], 0)).toEqual([]);
});
