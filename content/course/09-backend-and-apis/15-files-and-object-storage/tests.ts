import { acceptUpload } from './solution';

const png = [137, 80, 78, 71, 13, 10, 26, 10];
const jpeg = [255, 216, 255, 224, 0, 16];
const html = [60, 115, 99, 114, 105, 112, 116, 62]; // "<script>"

test('a real PNG is stored under a new key', () => {
  expect(acceptUpload({ id: 'a1', size: 1200, firstBytes: png, declaredType: 'image/png' })).toEqual({
    status: 201,
    key: 'avatars/a1.png',
    type: 'image/png',
  });
});

test('the type comes from the bytes, not the declared type', () => {
  expect(acceptUpload({ id: 'b2', size: 900, firstBytes: jpeg, declaredType: 'image/png' })).toEqual({
    status: 201,
    key: 'avatars/b2.jpg',
    type: 'image/jpeg',
  });
});

test('a script named like a PNG is refused with 415', () => {
  expect(acceptUpload({ id: 'c3', size: 25, firstBytes: html, declaredType: 'image/png' })).toEqual({
    status: 415,
  });
});

test('a file over the limit is refused with 413', () => {
  expect(acceptUpload({ id: 'd4', size: 3000000, firstBytes: png, declaredType: 'image/png' })).toEqual({
    status: 413,
  });
});

test('a file exactly at the limit is fine', () => {
  expect(acceptUpload({ id: 'e5', size: 2000000, firstBytes: png, declaredType: 'image/png' }).status).toBe(201);
});

test('too few bytes to match is refused', () => {
  expect(acceptUpload({ id: 'f6', size: 2, firstBytes: [137, 80], declaredType: 'image/png' }).status).toBe(415);
});
