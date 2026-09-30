import { morningAlarm, snoozeEnds } from './alarm.solution';

test('the morning alarm snoozes for 5 minutes, until 7:35', () => {
  expect(morningAlarm()).toEqual({ hour: 7, minute: 35 });
});

test('a snooze lasts 9 minutes when no length is given', () => {
  expect(snoozeEnds({ hour: 6, minute: 0 })).toEqual({ hour: 6, minute: 9 });
});

test('a snooze can run past the hour', () => {
  expect(snoozeEnds({ hour: 6, minute: 55, snoozeMinutes: 10 })).toEqual({ hour: 7, minute: 5 });
});
