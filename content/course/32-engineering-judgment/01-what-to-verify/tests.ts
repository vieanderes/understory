import { searchBooks, type Book } from './solution';

const shelf: Book[] = [
  { id: 1, title: 'Rivers of Salt', author: 'M. Okafor' },
  { id: 2, title: 'The Night Garden', author: 'A. Brandt' },
  { id: 3, title: 'Salt and Stone', author: 'L. Moreau' },
];

test('finds titles, ignoring case, in catalogue order', () => {
  expect(searchBooks(shelf, 'SALT')).toEqual([
    { id: 1, title: 'Rivers of Salt', author: 'M. Okafor' },
    { id: 3, title: 'Salt and Stone', author: 'L. Moreau' },
  ]);
});

test('skips books with no title yet instead of crashing', () => {
  const books: Book[] = [{ id: 9, author: 'Unknown' }, ...shelf];
  expect(searchBooks(books, 'garden')).toEqual([
    { id: 2, title: 'The Night Garden', author: 'A. Brandt' },
  ]);
});

test('returns at most 20 results', () => {
  const books: Book[] = [];
  for (let id = 1; id <= 50; id++) books.push({ id, title: `Garden Notes ${id}`, author: 'K. Lund' });
  const results = searchBooks(books, 'garden');
  expect(results).toHaveLength(20);
  expect(results[0]?.id).toBe(1);
  expect(results[19]?.id).toBe(20);
});

test('never sends who borrowed a book to the public page', () => {
  const books: Book[] = [
    { id: 4, title: 'Salt Roads', author: 'R. Ito', borrowerEmail: 'reader@example.com' },
  ];
  expect(searchBooks(books, 'salt')).toEqual([{ id: 4, title: 'Salt Roads', author: 'R. Ito' }]);
});

test('a blank query returns nothing', () => {
  expect(searchBooks(shelf, '')).toEqual([]);
  expect(searchBooks(shelf, '   ')).toEqual([]);
});
