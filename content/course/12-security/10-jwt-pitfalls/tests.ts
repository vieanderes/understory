import { readPayload } from './solution';

const priya =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiIsIm5hbWUiOiJQcml5YSIsInJvbGUiOiJtZW1iZXIiLCJpc3MiOiJodHRwczovL2xvZ2luLmV4YW1wbGUiLCJhdWQiOiJub3Rlcy1hcGkiLCJpYXQiOjE3OTAwMDAwMDAsImV4cCI6MTc5MDAwMDkwMH0.qOLqej7dWJ473pvrhFHdLVZapKoxmdvxdSX4iAWWPLU';

const withDashes =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3Iiwic3RhdHVzIjoiQ2F0cyA-IGRvZ3M_IFllcy4iLCJleHAiOjE3OTAwMDA5MDB9.8v_G0i68SkFGwelrT8DPQslh-qm7vmoJdMJu-6JMMhM';

test('reads the claims of a real token, with no key', () => {
  const claims = readPayload(priya);
  expect(claims.sub).toBe('42');
  expect(claims.role).toBe('member');
  expect(claims.aud).toBe('notes-api');
});

test('reads the expiry as a number', () => {
  expect(readPayload(priya).exp).toBe(1790000900);
});

test('reads a payload that uses base64url - and _', () => {
  expect(readPayload(withDashes)).toEqual({ sub: '7', status: 'Cats > dogs? Yes.', exp: 1790000900 });
});

test('refuses text that is not three dot-separated parts', () => {
  expect(() => readPayload('hello')).toThrow('not a JWT');
});
