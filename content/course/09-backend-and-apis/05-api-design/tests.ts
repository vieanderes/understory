import { paginate } from './solution';

const post = (id: number) => ({ id, title: `Post ${id}` });
const feed = [5, 4, 3, 2, 1].map(post);

test('the first page starts at the top', () => {
  expect(paginate(feed, null, 2)).toEqual({ items: [post(5), post(4)], nextCursor: '4' });
});

test('a cursor continues after that post', () => {
  expect(paginate(feed, '4', 2)).toEqual({ items: [post(3), post(2)], nextCursor: '2' });
});

test('a new post at the top does not shift the next page', () => {
  const grown = [post(6), ...feed];
  expect(paginate(grown, '4', 2).items).toEqual([post(3), post(2)]);
});

test('the last page has no next cursor', () => {
  expect(paginate(feed, '2', 2)).toEqual({ items: [post(1)], nextCursor: null });
});

test('a page that ends exactly at the end has no next cursor', () => {
  expect(paginate(feed, '3', 2)).toEqual({ items: [post(2), post(1)], nextCursor: null });
});

test('an unknown cursor gives an empty page', () => {
  expect(paginate(feed, '99', 2)).toEqual({ items: [], nextCursor: null });
});
