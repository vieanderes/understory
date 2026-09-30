import { checkHire } from './solution';

const ana = { userId: 'u-ana' };

test('a good form becomes a hire for the signed-in person', () => {
  expect(checkHire(ana, { bikeId: 'b-12', hours: '3' })).toEqual({
    ok: true,
    hire: { userId: 'u-ana', bikeId: 'b-12', hours: 3 },
  });
});

test('nobody signed in means no hire, whatever the form says', () => {
  expect(checkHire(null, { bikeId: 'b-12', hours: '3' })).toEqual({
    ok: false,
    error: 'Sign in first',
  });
});

test('the user comes from the session, never from the form', () => {
  const result = checkHire(ana, { bikeId: 'b-12', hours: '2', userId: 'u-ben' });
  expect(result).toEqual({ ok: true, hire: { userId: 'u-ana', bikeId: 'b-12', hours: 2 } });
});

test('a missing or blank bike is refused', () => {
  const noBike = { ok: false, error: 'Choose a bike' };
  expect(checkHire(ana, { hours: '2' })).toEqual(noBike);
  expect(checkHire(ana, { bikeId: '   ', hours: '2' })).toEqual(noBike);
});

test('hours outside 1 to 8, or not whole, are refused', () => {
  const badHours = { ok: false, error: 'Choose 1 to 8 hours' };
  for (const hours of ['0', '-5', '9', '2.5', 'lots', '']) {
    expect(checkHire(ana, { bikeId: 'b-12', hours })).toEqual(badHours);
  }
  expect(checkHire(ana, { bikeId: 'b-12' })).toEqual(badHours);
});

test('the checks run in order: session, bike, hours', () => {
  expect(checkHire(null, {})).toEqual({ ok: false, error: 'Sign in first' });
  expect(checkHire(ana, { hours: '99' })).toEqual({ ok: false, error: 'Choose a bike' });
});
