import { publicDefines } from './solution';

test('passes a PUBLIC_ variable as a quoted string', () => {
  expect(publicDefines({ PUBLIC_API_URL: 'https://api.example.com' })).toEqual({
    'process.env.PUBLIC_API_URL': '"https://api.example.com"',
  });
});

test('leaves out every other variable', () => {
  const env = { PUBLIC_REGION: 'eu', API_KEY: 'sk_live_51abc', DATABASE_URL: 'postgres://db/shop' };
  expect(publicDefines(env)).toEqual({ 'process.env.PUBLIC_REGION': '"eu"' });
});

test('needs the prefix at the start of the name', () => {
  expect(publicDefines({ NOT_PUBLIC_TOKEN: 'abc' })).toEqual({});
});

test('skips a variable with no value', () => {
  expect(publicDefines({ PUBLIC_THEME: undefined })).toEqual({});
});

test('escapes quotes inside a value', () => {
  expect(publicDefines({ PUBLIC_MOTTO: 'say "hi"' })).toEqual({
    'process.env.PUBLIC_MOTTO': '"say \\"hi\\""',
  });
});

test('returns an empty object for an empty environment', () => {
  expect(publicDefines({})).toEqual({});
});
