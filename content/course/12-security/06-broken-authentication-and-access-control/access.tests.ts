import { getNote } from './access.solution';

const notes = [
  { id: 1, ownerId: 7, text: 'Dentist on Tuesday' },
  { id: 2, ownerId: 8, text: 'Gift ideas' },
];

test('the owner gets 200 and the note', () => {
  expect(getNote(7, 1, notes)).toEqual({ status: 200, note: notes[0] });
});

test('a stranger gets 404, as if the note did not exist', () => {
  expect(getNote(8, 1, notes)).toEqual({ status: 404 });
});

test('nobody signed in gets 401', () => {
  expect(getNote(null, 1, notes)).toEqual({ status: 401 });
});

test('a missing note is 404 for everyone', () => {
  expect(getNote(7, 99, notes)).toEqual({ status: 404 });
});
