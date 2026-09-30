import { fullName, greetingName, letterName } from './solution';

const ada = { first: 'Ada', last: 'Lovelace', title: 'Dr' };
const sam = { first: 'Sam', last: 'Okafor', title: '' };

test('fullName gives first and last name', () => {
  expect(fullName(ada)).toBe('Ada Lovelace');
});

test('greetingName gives the first name', () => {
  expect(greetingName(sam)).toBe('Sam');
});

test('letterName gives the title and surname', () => {
  expect(letterName(ada)).toBe('Dr Lovelace');
});

test('letterName falls back to the full name without a title', () => {
  expect(letterName(sam)).toBe('Sam Okafor');
});

test('each function takes only the person', () => {
  expect(fullName.length).toBe(1);
  expect(letterName.length).toBe(1);
});
