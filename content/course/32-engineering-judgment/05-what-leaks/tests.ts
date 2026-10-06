import { leakedSinks } from './solution';

const email = 'ana.canary@example.com';
const token = 'tok_canary_7Q2';

test('finds a canary in a log line', () => {
  const sinks = [
    { name: 'log', text: `refresh ${token} ok` },
    { name: 'analytics', text: '{"event":"signed_up","plan":"film-club"}' },
  ];
  expect(leakedSinks([email, token], sinks)).toEqual(['log']);
});

test('ignores case', () => {
  const sinks = [{ name: 'error', text: 'No account for ANA.CANARY@EXAMPLE.COM' }];
  expect(leakedSinks([email], sinks)).toEqual(['error']);
});

test('catches a canary written into a URL', () => {
  const sinks = [{ name: 'url', text: 'GET /tickets?email=ana.canary%40example.com 200' }];
  expect(leakedSinks([email], sinks)).toEqual(['url']);
});

test('an empty canary matches nothing', () => {
  const sinks = [{ name: 'log', text: 'booking 812 confirmed' }];
  expect(leakedSinks(['', token], sinks)).toEqual([]);
});

test('names each leaking sink once, in the order given', () => {
  const sinks = [
    { name: 'log', text: `login ${email}` },
    { name: 'prompt', text: 'Summarise: seats not shown' },
    { name: 'log', text: `charge ${token}` },
    { name: 'analytics', text: `{"user":"${email}"}` },
  ];
  expect(leakedSinks([email, token], sinks)).toEqual(['log', 'analytics']);
});

test('clean sinks return nothing', () => {
  const sinks = [
    { name: 'log', text: 'booking 812 confirmed for user 5531' },
    { name: 'url', text: 'GET /shows/41 200' },
  ];
  expect(leakedSinks([email, token], sinks)).toEqual([]);
});
