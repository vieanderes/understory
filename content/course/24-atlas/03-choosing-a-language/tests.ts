import { shortlist, type Candidate } from './solution';

const languages: Candidate[] = [
  { name: 'JavaScript', runsOn: ['browser', 'server', 'terminal'], needsRuntime: true },
  { name: 'Python', runsOn: ['server', 'terminal'], needsRuntime: true },
  { name: 'Go', runsOn: ['server', 'terminal'], needsRuntime: false },
  { name: 'Rust', runsOn: ['server', 'terminal'], needsRuntime: false },
];

test('a browser job keeps only what runs in a browser, whatever the team knows', () => {
  const job = { runsOn: 'browser', noRuntimeAllowed: false, team: ['Python', 'Go'] };
  expect(shortlist(job, languages)).toEqual(['JavaScript']);
});

test('a tool for bare machines drops every language that needs a runtime', () => {
  const job = { runsOn: 'terminal', noRuntimeAllowed: true, team: [] };
  expect(shortlist(job, languages)).toEqual(['Go', 'Rust']);
});

test('languages the team knows come first', () => {
  const job = { runsOn: 'server', noRuntimeAllowed: false, team: ['Go', 'Python'] };
  expect(shortlist(job, languages)).toEqual(['Python', 'Go', 'JavaScript', 'Rust']);
});

test('the team never rescues a language that fails a hard constraint', () => {
  const job = { runsOn: 'terminal', noRuntimeAllowed: true, team: ['Python'] };
  expect(shortlist(job, languages)).toEqual(['Go', 'Rust']);
});

test('nothing fits gives an empty list', () => {
  const job = { runsOn: 'phone', noRuntimeAllowed: false, team: ['Go'] };
  expect(shortlist(job, languages)).toEqual([]);
});
