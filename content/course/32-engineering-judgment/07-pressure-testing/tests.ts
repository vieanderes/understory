import { triage, type Row } from './solution';

const row = (failure: string, likelihood: Row['likelihood'], impact: Row['impact'], detection = 'alert'): Row => ({
  failure,
  likelihood,
  impact,
  detection,
});

test('each row lands in the band the matrix gives it', () => {
  const result = triage([
    row('dock loses signal', 'high', 'high'),
    row('typo in a push message', 'low', 'low'),
    row('payment provider slow', 'medium', 'medium'),
  ]);
  expect(result).toEqual({
    act: ['dock loses signal'],
    plan: ['payment provider slow'],
    accept: ['typo in a push message'],
  });
});

test('rare but severe is planned for, not accepted', () => {
  expect(triage([row('database region outage', 'low', 'high')]).plan).toEqual(['database region outage']);
});

test('a silent failure moves up one band', () => {
  const result = triage([
    row('ride never ends', 'medium', 'medium', ''),
    row('wrong bike photo', 'low', 'low', ''),
  ]);
  expect(result.act).toEqual(['ride never ends']);
  expect(result.plan).toEqual(['wrong bike photo']);
});

test('a silent failure already in act stays in act', () => {
  expect(triage([row('card charged twice', 'high', 'high', '')]).act).toEqual(['card charged twice']);
});

test('a detection of only spaces counts as silent', () => {
  expect(triage([row('lock jams', 'medium', 'medium', '   ')]).act).toEqual(['lock jams']);
});

test('rows keep their order inside a band, and no rows gives empty bands', () => {
  const result = triage([row('first', 'high', 'medium'), row('second', 'medium', 'high')]);
  expect(result.act).toEqual(['first', 'second']);
  expect(triage([])).toEqual({ act: [], plan: [], accept: [] });
});
