import { Database } from './solution';

test('levels 1 and 2 still hold with timestamps', () => {
  const db = new Database();
  db.set(1, 'book1', 'title', 'Dune');
  db.set(2, 'book1', 'author', 'Herbert');
  db.set(3, 'book1', 'title', 'Emma');
  expect(db.get(4, 'book1', 'title')).toBe('Emma');
  expect(db.get(5, 'book2', 'title')).toBe(null);
  expect(db.scan(6, 'book1')).toEqual(['author(Herbert)', 'title(Emma)']);
  expect(db.delete(7, 'book1', 'author')).toBe(true);
  expect(db.delete(8, 'book1', 'author')).toBe(false);
  expect(db.scanByPrefix(9, 'book1', 'ti')).toEqual(['title(Emma)']);
});

test('level 3: a field lives until timestamp + ttl, and is gone at that moment', () => {
  const db = new Database();
  db.set(10, 'room1', 'guest', 'Ada', 5);
  expect(db.get(14, 'room1', 'guest')).toBe('Ada');
  expect(db.get(15, 'room1', 'guest')).toBe(null);
});

test('level 3: scans skip expired fields and delete ignores them', () => {
  const db = new Database();
  db.set(1, 'user1', 'name', 'Sam');
  db.set(2, 'user1', 'code', '4821', 3);
  expect(db.scan(4, 'user1')).toEqual(['code(4821)', 'name(Sam)']);
  expect(db.scan(5, 'user1')).toEqual(['name(Sam)']);
  expect(db.delete(6, 'user1', 'code')).toBe(false);
});

test('level 3: setting a field again replaces its expiry', () => {
  const db = new Database();
  db.set(1, 'cart1', 'tea', '2', 5);
  db.set(3, 'cart1', 'tea', '3');
  expect(db.get(100, 'cart1', 'tea')).toBe('3');
  db.set(101, 'cart1', 'tea', '4', 10);
  expect(db.get(111, 'cart1', 'tea')).toBe(null);
});

test('level 4: backup counts records with a live field', () => {
  const db = new Database();
  db.set(1, 'a', 'x', '1');
  db.set(2, 'b', 'x', '2', 3);
  db.set(3, 'c', 'x', '3', 100);
  expect(db.backup(10)).toBe(2);
});

test('level 4: restore brings back the backup with its remaining ttl', () => {
  const db = new Database();
  db.set(10, 'room1', 'guest', 'Ada', 20);
  db.set(11, 'room1', 'note', 'late');
  db.backup(18);
  db.set(19, 'room1', 'guest', 'Sam');
  db.delete(20, 'room1', 'note');
  db.restore(50, 19);
  expect(db.scan(51, 'room1')).toEqual(['guest(Ada)', 'note(late)']);
  expect(db.get(61, 'room1', 'guest')).toBe('Ada');
  expect(db.get(62, 'room1', 'guest')).toBe(null);
});

test('level 4: restore uses the latest backup at or before the given time', () => {
  const db = new Database();
  db.set(1, 'k', 'v', 'one');
  db.backup(2);
  db.set(3, 'k', 'v', 'two');
  db.backup(4);
  db.set(5, 'k', 'v', 'three');
  db.restore(6, 3);
  expect(db.get(7, 'k', 'v')).toBe('one');
  db.restore(8, 4);
  expect(db.get(9, 'k', 'v')).toBe('two');
});

test('large: 100,000 fields with ttl are stored, scanned and backed up quickly', () => {
  const db = new Database();
  for (let i = 0; i < 100000; i++) {
    const ttl = i % 2 === 0 ? 1 : 1000000;
    db.set(i, 'log', `f${String(i).padStart(6, '0')}`, String(i), ttl);
  }
  // Every even field lived for one tick, so by 100,000 only the odd ones remain.
  expect(db.scanByPrefix(100000, 'log', 'f09999')).toEqual([
    'f099991(99991)',
    'f099993(99993)',
    'f099995(99995)',
    'f099997(99997)',
    'f099999(99999)',
  ]);
  expect(db.backup(100001)).toBe(1);
  expect(db.scan(100002, 'log')).toHaveLength(50000);
});
