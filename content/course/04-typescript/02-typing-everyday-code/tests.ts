import { filmLabel } from './solution';

test('shows the subtitle when there is one', () => {
  expect(filmLabel({ title: 'Alien', subtitle: "Director's Cut", minutes: 117 })).toBe(
    "Alien: Director's Cut (117 min)",
  );
});

test('leaves the subtitle out when it is missing', () => {
  expect(filmLabel({ title: 'Alien', minutes: 117 })).toBe('Alien (117 min)');
});

test('treats a subtitle set to undefined as missing', () => {
  expect(filmLabel({ title: 'Heat', subtitle: undefined, minutes: 170 })).toBe('Heat (170 min)');
});

test('never shows the word undefined', () => {
  expect(filmLabel({ title: 'Up', minutes: 96 })).not.toContain('undefined');
});
