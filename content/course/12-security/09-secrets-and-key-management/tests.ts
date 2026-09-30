import { publicConfig } from './solution';

const env = {
  SITE_NAME: 'Recipe Box',
  MAPS_KEY: 'pk_maps_123',
  DATABASE_URL: 'postgres://app:hunter2@db/app',
  EMAIL_API_KEY: 'em_live_456',
  PAYMENTS_SECRET_KEY: 'sk_live_789',
};

test('keeps the public names', () => {
  const config = publicConfig(env);
  expect(config.SITE_NAME).toBe('Recipe Box');
  expect(config.MAPS_KEY).toBe('pk_maps_123');
});

test('leaves out the database URL', () => {
  expect(publicConfig(env).DATABASE_URL).toBeUndefined();
});

test('leaves out a key whose name has no SECRET in it', () => {
  expect(publicConfig(env).EMAIL_API_KEY).toBeUndefined();
});

test('returns exactly the public names that are set', () => {
  expect(publicConfig(env)).toEqual({ SITE_NAME: 'Recipe Box', MAPS_KEY: 'pk_maps_123' });
});

test('an empty environment gives an empty config', () => {
  expect(publicConfig({})).toEqual({});
});
