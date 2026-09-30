import { corsHeaders } from './cors.solution';

const allowed = ['https://app.example.com', 'https://admin.example.com'];

test('a listed origin may read the reply', () => {
  expect(corsHeaders('https://app.example.com', allowed)).toEqual({
    'Access-Control-Allow-Origin': 'https://app.example.com',
    Vary: 'Origin',
  });
});

test('an unlisted origin gets no CORS headers', () => {
  expect(corsHeaders('https://news.example.org', allowed)).toEqual({});
});

test('a look-alike host that starts with a trusted origin is refused', () => {
  expect(corsHeaders('https://app.example.com.evil.net', allowed)).toEqual({});
});

test('the same host over http is another origin', () => {
  expect(corsHeaders('http://app.example.com', allowed)).toEqual({});
});
