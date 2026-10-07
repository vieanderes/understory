import { addLesson, type Lesson } from './solution';

const maths: Lesson = { name: 'Maths', start: '09:00', end: '10:00' };
const science: Lesson = { name: 'Science', start: '10:00', end: '11:00' };
const chess: Lesson = { name: 'Chess club', start: '08:00', end: '08:45' };

test('adds an earlier lesson before the later ones', () => {
  expect(addLesson([maths], chess)).toEqual([chess, maths]);
});

test('keeps start order when the new lesson goes in the middle', () => {
  const art: Lesson = { name: 'Art', start: '11:15', end: '12:00' };
  const music: Lesson = { name: 'Music', start: '10:15', end: '11:00' };
  expect(addLesson([maths, art], music)).toEqual([maths, music, art]);
});

test('leaves the timetable it was given unchanged', () => {
  const timetable = [maths];
  addLesson(timetable, chess);
  expect(timetable).toEqual([maths]);
});

test('a lesson may start the minute another ends', () => {
  expect(addLesson([science], maths)).toEqual([maths, science]);
});

test('refuses an overlap and names the lesson it clashes with', () => {
  const drama: Lesson = { name: 'Drama', start: '09:30', end: '10:30' };
  expect(() => addLesson([maths], drama)).toThrow('Maths');
});

test('refuses a short lesson inside a longer one', () => {
  const choir: Lesson = { name: 'Choir', start: '09:15', end: '09:30' };
  expect(() => addLesson([chess, maths], choir)).toThrow('Maths');
});
