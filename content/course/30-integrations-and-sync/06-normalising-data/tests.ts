import { toPupil, type RawRow, type Settings } from './solution';

const DMY: Settings = { dateOrder: 'DMY' };
const MDY: Settings = { dateOrder: 'MDY' };

function run(raw: RawRow, settings: Settings = DMY) {
  const warnings: [string, string][] = [];
  const pupil = toPupil(raw, settings, (field, value) => warnings.push([field, value]));
  return { pupil, warnings };
}

test('a clean row maps to the common shape', () => {
  const { pupil, warnings } = run({
    PupilID: ' 4471 ',
    Name: ' Ada Okafor',
    DOB: '09/03/2014',
    Status: 'ONR',
    FreeMeals: 'Y',
    Country: ' gb ',
  });
  expect(pupil).toEqual({
    remoteId: '4471',
    name: 'Ada Okafor',
    born: '2014-03-09',
    status: 'enrolled',
    freeMeals: true,
    country: 'GB',
  });
  expect(warnings).toEqual([]);
});

test('a month-first connection reads the same birthday, short digits included', () => {
  const { pupil } = run({ PupilID: '1', Name: 'Sam', DOB: '3/9/2014', Status: 'ACT' }, MDY);
  expect(pupil.born).toBe('2014-03-09');
});

test('every spelling of nothing becomes null, with no warnings', () => {
  const { pupil, warnings } = run({ PupilID: '2', Name: 'Jo', DOB: ' ', Status: 'N/A', FreeMeals: '-' });
  expect(pupil.born).toBeNull();
  expect(pupil.status).toBeNull();
  expect(pupil.freeMeals).toBeNull();
  expect(pupil.country).toBeNull();
  expect(warnings).toEqual([]);
});

test('flags accept the spellings of yes and no in any case', () => {
  for (const yes of ['yes', '1', 'X', 'TRUE']) {
    expect(run({ PupilID: '3', Name: 'Li', FreeMeals: yes }).pupil.freeMeals).toBe(true);
  }
  for (const no of ['N', '0', 'No', 'false']) {
    expect(run({ PupilID: '3', Name: 'Li', FreeMeals: no }).pupil.freeMeals).toBe(false);
  }
});

test('an unknown status becomes null and is reported once, without throwing', () => {
  const { pupil, warnings } = run({ PupilID: '5', Name: 'Mo', Status: 'SUSP' });
  expect(pupil.status).toBeNull();
  expect(warnings).toEqual([['Status', 'SUSP']]);
});

test('an unknown flag is null, not false', () => {
  const { pupil, warnings } = run({ PupilID: '6', Name: 'Kit', FreeMeals: 'maybe' });
  expect(pupil.freeMeals).toBeNull();
  expect(warnings).toEqual([['FreeMeals', 'maybe']]);
});
