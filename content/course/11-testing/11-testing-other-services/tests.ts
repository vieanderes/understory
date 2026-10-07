import { scrubFixture, type Json } from './solution';

const KEYS = ['name', 'email', 'phone'];

test('replaces sensitive fields and keeps the rest', () => {
  const recorded: Json = { id: 'P-17', status: 'delivered', name: 'Ada Brook', email: 'ada@mail.test' };
  expect(scrubFixture(recorded, KEYS)).toEqual({
    id: 'P-17',
    status: 'delivered',
    name: 'name-1',
    email: 'user-1@example.com',
  });
});

test('walks nested objects and arrays', () => {
  const recorded: Json = {
    parcels: [
      { id: 'P-1', recipient: { name: 'Ada Brook', phone: '07700 900123' } },
      { id: 'P-2', recipient: { name: 'Tom Hale', phone: null } },
    ],
  };
  expect(scrubFixture(recorded, KEYS)).toEqual({
    parcels: [
      { id: 'P-1', recipient: { name: 'name-1', phone: 'phone-1' } },
      { id: 'P-2', recipient: { name: 'name-2', phone: null } },
    ],
  });
});

test('the same value always gets the same placeholder', () => {
  const recorded: Json = [
    { email: 'ada@mail.test' },
    { email: 'tom@mail.test' },
    { email: 'ada@mail.test' },
  ];
  expect(scrubFixture(recorded, KEYS)).toEqual([
    { email: 'user-1@example.com' },
    { email: 'user-2@example.com' },
    { email: 'user-1@example.com' },
  ]);
});

test('a bearer token is redacted under any key', () => {
  const recorded: Json = { request: { headers: { authorization: 'Bearer sk_live_51Hx9' } } };
  expect(scrubFixture(recorded, KEYS)).toEqual({
    request: { headers: { authorization: 'Bearer REDACTED' } },
  });
});

test('keys match whatever their case, and an email keeps its shape', () => {
  const recorded: Json = { Name: 'Ada Brook', contact: { EMAIL: 'ada@mail.test' } };
  expect(scrubFixture(recorded, KEYS)).toEqual({
    Name: 'name-1',
    contact: { EMAIL: 'user-1@example.com' },
  });
});

test('numbers, booleans and the original fixture are left alone', () => {
  const recorded: Json = { name: 'Ada Brook', weightKg: 2.5, signed: true, phone: 7700900123 };
  const copy = JSON.parse(JSON.stringify(recorded)) as Json;
  expect(scrubFixture(recorded, KEYS)).toEqual({ name: 'name-1', weightKg: 2.5, signed: true, phone: 7700900123 });
  expect(recorded).toEqual(copy);
});
