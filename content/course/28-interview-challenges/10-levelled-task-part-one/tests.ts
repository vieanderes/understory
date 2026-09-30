import { Database } from './solution';

test('level 1: get returns what set stored, or null', () => {
  const db = new Database();
  db.set('book1', 'title', 'Dune');
  expect(db.get('book1', 'title')).toBe('Dune');
  expect(db.get('book1', 'author')).toBe(null);
  expect(db.get('book2', 'title')).toBe(null);
});

test('level 1: set on an existing field replaces the value and keeps the others', () => {
  const db = new Database();
  db.set('book1', 'title', 'Dune');
  db.set('book1', 'year', '1965');
  db.set('book1', 'title', 'Emma');
  expect(db.get('book1', 'title')).toBe('Emma');
  expect(db.get('book1', 'year')).toBe('1965');
});

test('level 1: delete says whether a field was removed', () => {
  const db = new Database();
  db.set('book1', 'title', 'Dune');
  expect(db.delete('book1', 'title')).toBe(true);
  expect(db.get('book1', 'title')).toBe(null);
  expect(db.delete('book1', 'title')).toBe(false);
  expect(db.delete('book9', 'title')).toBe(false);
});

test('level 2: scan lists every field of a record, sorted by field', () => {
  const db = new Database();
  db.set('book1', 'year', '1965');
  db.set('book1', 'author', 'Herbert');
  db.set('book1', 'title', 'Dune');
  expect(db.scan('book1')).toEqual(['author(Herbert)', 'title(Dune)', 'year(1965)']);
  expect(db.scan('book2')).toEqual([]);
});

test('level 2: scanByPrefix keeps only fields that start with the prefix', () => {
  const db = new Database();
  db.set('user1', 'addr_town', 'Leeds');
  db.set('user1', 'name', 'Ada');
  db.set('user1', 'addr_city', 'York');
  expect(db.scanByPrefix('user1', 'addr_')).toEqual(['addr_city(York)', 'addr_town(Leeds)']);
  expect(db.scanByPrefix('user1', 'zip')).toEqual([]);
  expect(db.scanByPrefix('user9', 'addr_')).toEqual([]);
});

test('level 2: a deleted field no longer appears in a scan', () => {
  const db = new Database();
  db.set('cart1', 'tea', '2');
  db.set('cart1', 'jam', '1');
  db.delete('cart1', 'tea');
  expect(db.scan('cart1')).toEqual(['jam(1)']);
});

test('large: 100,000 fields are stored and scanned quickly', () => {
  const db = new Database();
  for (let i = 0; i < 100000; i++) {
    db.set('log', `f${String(i).padStart(6, '0')}`, String(i));
  }
  for (let i = 0; i < 100000; i++) db.set('log', `f${String(i).padStart(6, '0')}`, 'x');
  const all = db.scan('log');
  expect(all).toHaveLength(100000);
  expect(all[0]).toBe('f000000(x)');
  expect(db.scanByPrefix('log', 'f09999')).toHaveLength(10);
});
